
import { 
    collection, 
    addDoc, 
    getDocs, 
    query, 
    where, 
    serverTimestamp, 
    doc, 
    setDoc,
    updateDoc, 
    deleteDoc,
    Timestamp 
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { OutreachCampaign, MessageTemplate, OutreachInteraction, Contact } from '../types';
import { ai } from './crawlerService';

/**
 * Service to manage message templates
 */
export const templateService = {
    async getTemplates(): Promise<MessageTemplate[]> {
        const uid = auth.currentUser?.uid;
        if (!uid) return [];
        const q = query(collection(db, 'templates'), where('uid', '==', uid));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MessageTemplate))
            .sort((a: any, b: any) => (b.created_at?.seconds || 0) - (a.created_at?.seconds || 0));
    },

    async saveTemplate(template: Omit<MessageTemplate, 'id' | 'uid'>): Promise<string> {
        const uid = auth.currentUser?.uid;
        if (!uid) throw new Error("Unauthenticated");
        
        const templateId = `temp_${Date.now()}`;
        
        await setDoc(doc(db, 'templates', templateId), { 
            ...template, 
            id: templateId,
            uid,
            created_at: serverTimestamp() 
        });
        return templateId;
    },

    async generateVariants(baseContent: string, count: number = 5): Promise<string[]> {
        try {
            const response = await ai.models.generateContent({
                model: "gemini-3-flash-preview",
                contents: `Create ${count} different variations of the following message for a cold outreach campaign. 
                Keep the same meaning and call to action, but change the tone, structure, and words to avoid spam filters.
                
                Original Message: "${baseContent}"`,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: "object",
                        properties: {
                            variants: { 
                                type: "array", 
                                items: { type: "string" } 
                            }
                        },
                        required: ["variants"]
                    }
                }
            });
            const data = JSON.parse(response.text);
            return data.variants;
        } catch (error) {
            console.error("Error generating variants:", error);
            return [];
        }
    }
};

/**
 * Service to manage outreach campaigns
 */
export const campaignService = {
    async getCampaigns(): Promise<OutreachCampaign[]> {
        const uid = auth.currentUser?.uid;
        if (!uid) return [];
        const q = query(collection(db, 'campaigns'), where('uid', '==', uid));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => {
            const data = doc.data();
            return { 
                ...data, 
                id: doc.id,
                created_at: (data.created_at as Timestamp).toDate()
            } as OutreachCampaign;
        });
    },

    async createCampaign(campaign: Omit<OutreachCampaign, 'id' | 'created_at' | 'sent_today' | 'uid'>): Promise<string> {
        const uid = auth.currentUser?.uid;
        if (!uid) throw new Error("Unauthenticated");
        const id = `camp_${Date.now()}`;
        await setDoc(doc(db, 'campaigns', id), {
            ...campaign,
            id,
            uid,
            sent_today: 0,
            total_sent: 0,
            created_at: serverTimestamp(),
            status: 'active'
        });
        return id;
    },

    async updateCampaign(campaignId: string, updates: Partial<OutreachCampaign>): Promise<void> {
        const uid = auth.currentUser?.uid;
        if (!uid) throw new Error("Unauthenticated");
        const ref = doc(db, 'campaigns', campaignId);
        await updateDoc(ref, updates);
    },

    async deleteCampaign(campaignId: string): Promise<void> {
        const uid = auth.currentUser?.uid;
        if (!uid) throw new Error("Unauthenticated");
        await deleteDoc(doc(db, 'campaigns', campaignId));
    }
};

/**
 * Service to manage interactions and manual chat
 */
export const interactionService = {
    async logInteraction(contactId: string, interaction: Omit<OutreachInteraction, 'id' | 'timestamp'>) {
        const uid = auth.currentUser?.uid;
        if (!uid) throw new Error("Unauthenticated");

        const interactionId = `int_${Date.now()}`;
        const newInteraction = {
            ...interaction,
            id: interactionId,
            timestamp: new Date()
        };

        const contactRef = doc(db, 'contacts', contactId);
        // In a real scenario, we might want a subcollection, but for MVP we update the history array
        // Caution: Arrays in Firestore have a 1MB limit.
        // For a more scalable approach, we'll use a transaction or a separate collection.
        // Let's use a separate collection for interactions.
        
        await addDoc(collection(db, 'interactions'), {
            ...newInteraction,
            contact_id: contactId,
            uid,
            timestamp: serverTimestamp()
        });

        await updateDoc(contactRef, {
            status: 'contacted',
            last_interaction_at: serverTimestamp()
        });

        return interactionId;
    },

    async getInteractions(contactId: string): Promise<OutreachInteraction[]> {
        const uid = auth.currentUser?.uid;
        if (!uid) return [];
        const q = query(
            collection(db, 'interactions'), 
            where('uid', '==', uid), 
            where('contact_id', '==', contactId)
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                ...data,
                id: doc.id,
                timestamp: (data.timestamp as Timestamp).toDate()
            } as OutreachInteraction;
        }).sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    }
};
