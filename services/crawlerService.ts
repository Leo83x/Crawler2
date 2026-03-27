import { GoogleGenAI, Type } from "@google/genai";
import { CrawlJob, CrawlJobParams, Contact, NormalizedPhone, CrawlSource, BlacklistedContact } from '../types';
import { 
  db, 
  auth, 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  onSnapshot, 
  orderBy, 
  limit, 
  Timestamp,
  handleFirestoreError,
  OperationType,
  deleteDoc,
  writeBatch,
  updateDoc
} from '../firebase';

// --- Persistence Layer Helpers ---
const convertTimestamps = (data: any) => {
    if (!data) return data;
    const result = { ...data };
    for (const key in result) {
        if (result[key] instanceof Timestamp) {
            result[key] = result[key].toDate();
        } else if (typeof result[key] === 'object' && result[key] !== null) {
            result[key] = convertTimestamps(result[key]);
        }
    }
    return result;
};

// --- Error Tracking & Logging ---
interface ErrorLog {
    id: string;
    timestamp: Date;
    source: string;
    message: string;
    stack?: string;
    context?: any;
}

class CrawlerLogger {
    private static MAX_LOGS = 100;

    static async logError(source: string, error: any, context?: any) {
        const message = error instanceof Error ? error.message : String(error);
        const stack = error instanceof Error ? error.stack : undefined;
        const uid = auth.currentUser?.uid;

        if (!uid) {
            console.error("Cannot log error to Firestore: User not authenticated.");
            return;
        }
        
        const logId = `log_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        const newLog: any = {
            id: logId,
            timestamp: Timestamp.now(),
            source,
            message,
            stack: stack || null,
            context: context || null,
            uid
        };

        // Strip undefined values from context to prevent Firestore errors
        if (newLog.context) {
            const cleanContext = JSON.parse(JSON.stringify(newLog.context));
            newLog.context = cleanContext;
        }

        console.error(`[CrawlerLogger][${source}]`, message, { context, stack });

        try {
            await setDoc(doc(db, 'error_logs', logId), newLog);
        } catch (err) {
            console.error("Failed to save error log to Firestore", err);
        }
    }

    static async getLogs(): Promise<ErrorLog[]> {
        const uid = auth.currentUser?.uid;
        if (!uid) return [];

        try {
            const q = query(
                collection(db, 'error_logs'), 
                where('uid', '==', uid)
            );
            const snapshot = await getDocs(q);
            const logs = snapshot.docs.map(doc => convertTimestamps(doc.data()) as ErrorLog);
            return logs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()).slice(0, this.MAX_LOGS);
        } catch (error) {
            handleFirestoreError(error, OperationType.LIST, 'error_logs');
            return [];
        }
    }
}

export const getLogs = async (): Promise<ErrorLog[]> => {
    return CrawlerLogger.getLogs();
};

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const generateId = () => `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// FIX: Define a specific type for the contact data returned by Gemini to ensure type safety.
type GeminiContact = Omit<Contact, 'id' | 'job_id' | 'found_at' | 'niche' | 'category' | 'city' | 'source_type' | 'uid' | 'status' | 'notes'>;

// Fallback Regex for Brazilian Phones
const BRAZIL_PHONE_REGEX = /(?:(?:\+|00)?55\s?)?(?:\(?([1-9][0-9])\)?\s?)?(?:((?:9\d|[2-9])\d{3})\-?(\d{4}))/g;

const extractPhonesFromText = (text: string): GeminiContact[] => {
    if (!text) return [];
    const matches = [...text.matchAll(BRAZIL_PHONE_REGEX)];
    const contacts: GeminiContact[] = [];
    
    matches.forEach(match => {
        const ddd = match[1];
        const part1 = match[2];
        const part2 = match[3];
        
        if (ddd && part1 && part2) {
            // Check if it looks like a mobile (starts with 9 and has 9 digits total in number part)
            // Or just allow all and let validator handle it.
            const fullNumber = `+55${ddd}${part1}${part2}`;
            contacts.push({
                name: "Contato Extraído (Regex)",
                e164_number: fullNumber,
                raw_number: match[0],
                source_url: "Texto extraído",
            });
        }
    });
    return contacts;
};

const parseGeminiJsonResponse = (responseText: string | undefined | null): GeminiContact[] => {
    if (!responseText) return [];

    let contacts: GeminiContact[] = [];
    
    // 1. Try parsing JSON block
    try {
        const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/);
        const jsonString = jsonMatch ? jsonMatch[1] : responseText;
        
        // Clean up any potential leading/trailing non-JSON text if match failed
        const firstBracket = jsonString.indexOf('{');
        const lastBracket = jsonString.lastIndexOf('}');
        
        if (firstBracket !== -1 && lastBracket !== -1) {
             const cleanJson = jsonString.substring(firstBracket, lastBracket + 1);
             const data = JSON.parse(cleanJson);
             const list = Array.isArray(data) ? data : (data.contacts || []);
             
             if (Array.isArray(list)) {
                contacts = list.map((item: any) => {
                    const phoneVal = item.whatsapp || item.phone || '';
                    return {
                        name: String(item.name || 'Não informado'),
                        e164_number: String(phoneVal),
                        raw_number: String(phoneVal),
                        address: item.address ? String(item.address) : null,
                        source_url: String(item.source || 'N/A'),
                    };
                });
             }
        }
    } catch (e) {
        console.warn("Primary JSON parsing failed, attempting fallback regex.", e);
        CrawlerLogger.logError("parseGeminiJsonResponse", e, { responseText });
    }

    // 2. Fallback: If JSON yielded nothing, try Regex on the whole text
    if (contacts.length === 0) {
        console.log("JSON parsing returned 0 results. Running Regex fallback...");
        const regexContacts = extractPhonesFromText(responseText);
        // De-duplicate regex results
        const unique = new Map();
        regexContacts.forEach(c => unique.set(c.e164_number, c));
        contacts = Array.from(unique.values());
    }

    return contacts;
};

const isValidBrazilianMobileNumber = (phone: string | null | undefined): boolean => {
    if (!phone) return false;
    const digits = phone.replace(/\D/g, '');
    // 55 + 2 digit DDD + (optional 9) + 8 digits
    // Mobile: 55 + DDD + 9 + 8 digits (13 digits)
    // Landline/Old Mobile: 55 + DDD + 8 digits (12 digits)
    return /^55\d{2}9?\d{8}$/.test(digits);
};

// --- Specialized Agents ---

const getGoogleSearchAgent = async (params: CrawlJobParams): Promise<GeminiContact[]> => {
    // Broader query to capture more directory-style results
    const searchQuery = `"${params.niche}" "${params.city || 'Brasil'}" (whatsapp OR "celular" OR "contato") -site:instagram.com`;
    
    const contactSearchPrompt = `Realize uma pesquisa no Google para encontrar empresas de: "${params.niche}" em "${params.city || 'Brasil'}".
    
    QUERY: ${searchQuery}
    
    TAREFA:
    1. Analise os resultados da busca (títulos e descrições).
    2. Identifique nomes de empresas e NÚMEROS DE WHATSAPP/CELULAR brasileiros.
    3. Tente extrair pelo menos 10 contatos.
    
    SAÍDA OBRIGATÓRIA:
    Gere um bloco JSON com a seguinte estrutura:
    \`\`\`json
    {
      "contacts": [
        { "name": "Nome da Empresa", "whatsapp": "+55...", "source": "URL ou Contexto" }
      ]
    }
    \`\`\`
    `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: contactSearchPrompt,
            config: {
                tools: [{ googleSearch: {} }],
                // Removed responseMimeType to allow the model to use the tool more freely before formatting
            }
        });
        return parseGeminiJsonResponse(response.text);
    } catch (error) {
        CrawlerLogger.logError("GoogleSearchAgent", error, { params, searchQuery });
        return [];
    }
}

const getInstagramSearchAgent = async (params: CrawlJobParams): Promise<GeminiContact[]> => {
    // Simplified Dorking for snippet visibility
    const searchQuery = `site:instagram.com "${params.niche}" "${params.city || ''}" "whatsapp"`;

    const contactSearchPrompt = `Pesquise no Google por perfis do Instagram.
    
    QUERY: ${searchQuery}

    TAREFA:
    1. Olhe para os snippets dos resultados de busca.
    2. Procure por números de telefone no formato brasileiro ((xx) 9xxxx-xxxx) que aparecem na descrição/bio do Instagram.
    3. Ignore perfis sem número de telefone visível.
    
    SAÍDA OBRIGATÓRIA:
    Gere um bloco JSON:
    \`\`\`json
    {
      "contacts": [
        { "name": "@usuario ou Nome", "whatsapp": "+55...", "source": "Link do Instagram" }
      ]
    }
    \`\`\`
    `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: contactSearchPrompt,
            config: {
                tools: [{ googleSearch: {} }],
            }
        });
        return parseGeminiJsonResponse(response.text);
    } catch (error) {
        CrawlerLogger.logError("InstagramAgent", error, { params, searchQuery });
        return [];
    }
}

const getGoogleMapsAgent = async (params: CrawlJobParams): Promise<GeminiContact[]> => {
    if (!params.city) return [];
    
    const contactSearchPrompt = `Busque no Google Maps por "${params.niche}" em "${params.city}".
    
    TAREFA:
    1. Identifique pelo menos 10 estabelecimentos relevantes.
    2. Extraia o nome, telefone e endereço (se disponível).
    3. Priorize estabelecimentos que tenham número de telefone brasileiro.
    
    SAÍDA OBRIGATÓRIA:
    Gere um bloco JSON com a seguinte estrutura:
    \`\`\`json
    {
      "contacts": [
        { "name": "Nome", "whatsapp": "+55...", "address": "Endereço", "source": "Google Maps" }
      ]
    }
    \`\`\`
    `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: contactSearchPrompt,
            config: {
                tools: [{ googleMaps: {} }],
            }
        });
        return parseGeminiJsonResponse(response.text);
    } catch (error) {
        CrawlerLogger.logError("GoogleMapsAgent", error, { params });
        return [];
    }
}

const getDoctoraliaAgent = async (params: CrawlJobParams): Promise<GeminiContact[]> => {
    const searchQuery = `site:doctoralia.com.br "${params.niche}" "${params.city || ''}" whatsapp`;
    const contactSearchPrompt = `Pesquise perfis no Doctoralia usando a query: "${searchQuery}".
    
    TAREFA:
    1. Identifique profissionais.
    2. Extraia números de contato visíveis nos snippets de busca.
    
    SAÍDA:
    Bloco JSON com a chave "contacts".
    `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: contactSearchPrompt,
            config: {
                tools: [{ googleSearch: {} }],
            }
        });
        return parseGeminiJsonResponse(response.text);
    } catch (error) {
        CrawlerLogger.logError("DoctoraliaAgent", error, { params, searchQuery });
        return [];
    }
};

const getLinkedInSearchAgent = async (params: CrawlJobParams): Promise<GeminiContact[]> => {
    const searchQuery = `site:linkedin.com/in/ OR site:linkedin.com/company/ "${params.niche}" "${params.city || ''}" whatsapp`;
    const contactSearchPrompt = `Pesquise perfis no LinkedIn usando a query: "${searchQuery}".
    
    TAREFA:
    1. Identifique profissionais ou empresas.
    2. Extraia números de contato visíveis nos snippets de busca.
    
    SAÍDA:
    Bloco JSON com a chave "contacts".
    `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: contactSearchPrompt,
            config: {
                tools: [{ googleSearch: {} }],
            }
        });
        return parseGeminiJsonResponse(response.text);
    } catch (error) {
        CrawlerLogger.logError("LinkedInAgent", error, { params, searchQuery });
        return [];
    }
};

const getFacebookSearchAgent = async (params: CrawlJobParams): Promise<GeminiContact[]> => {
    const searchQuery = `site:facebook.com "${params.niche}" "${params.city || ''}" whatsapp`;
    const contactSearchPrompt = `Pesquise perfis no Facebook usando a query: "${searchQuery}".
    
    TAREFA:
    1. Identifique páginas ou perfis.
    2. Extraia números de contato visíveis nos snippets de busca.
    
    SAÍDA:
    Bloco JSON com a chave "contacts".
    `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: contactSearchPrompt,
            config: {
                tools: [{ googleSearch: {} }],
            }
        });
        return parseGeminiJsonResponse(response.text);
    } catch (error) {
        CrawlerLogger.logError("FacebookAgent", error, { params, searchQuery });
        return [];
    }
};

const getApifyAgent = async (params: CrawlJobParams): Promise<GeminiContact[]> => {
    const apiKey = (process.env as any).APIFY_API_KEY;
    if (!apiKey) {
        console.warn("Apify API Key not found. Skipping Apify source.");
        return [];
    }

    try {
        // Using Apify's Google Search Scraper as an example
        // In a real app, you might use a more specific actor
        const response = await fetch(`https://api.apify.com/v2/acts/apify~google-search-scraper/runs?token=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                queries: `${params.niche} ${params.city || ''} whatsapp`,
                maxPagesPerQuery: 1,
                resultsPerPage: 10,
                mobileResults: true
            })
        });

        if (!response.ok) throw new Error(`Apify error: ${response.statusText}`);
        
        const runData = await response.json();
        const runId = runData.data.id;

        // Poll for results (simplified for this demo)
        // In a real production app, you'd use webhooks or a more robust polling mechanism
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        const datasetResponse = await fetch(`https://api.apify.com/v2/acts/apify~google-search-scraper/runs/${runId}/dataset/items?token=${apiKey}`);
        const items = await datasetResponse.json();

        // Use Gemini to extract contacts from the scraped data
        const textToAnalyze = JSON.stringify(items);
        const extractionPrompt = `Extraia nomes de empresas e números de WhatsApp brasileiros do seguinte JSON de resultados de busca:
        
        ${textToAnalyze}
        
        SAÍDA OBRIGATÓRIA:
        Gere um bloco JSON com a chave "contacts".`;

        const geminiResponse = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: extractionPrompt,
        });

        return parseGeminiJsonResponse(geminiResponse.text);
    } catch (error) {
        CrawlerLogger.logError("ApifyAgent", error, { params });
        return [];
    }
};

const getFirecrawlAgent = async (params: CrawlJobParams): Promise<GeminiContact[]> => {
    const apiKey = (process.env as any).FIRECRAWL_API_KEY;
    if (!apiKey) {
        console.warn("Firecrawl API Key not found. Skipping Firecrawl source.");
        return [];
    }

    try {
        const response = await fetch('https://api.firecrawl.dev/v1/search', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                query: `${params.niche} ${params.city || ''} whatsapp`,
                limit: 5,
                lang: 'pt-BR'
            })
        });

        if (!response.ok) throw new Error(`Firecrawl error: ${response.statusText}`);
        
        const data = await response.json();
        
        // Firecrawl returns markdown/text. Use Gemini to extract.
        const textToAnalyze = JSON.stringify(data);
        const extractionPrompt = `Extraia nomes de empresas e números de WhatsApp brasileiros destes dados de busca:
        
        ${textToAnalyze}
        
        SAÍDA OBRIGATÓRIA:
        Gere um bloco JSON com a chave "contacts".`;

        const geminiResponse = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: extractionPrompt,
        });

        return parseGeminiJsonResponse(geminiResponse.text);
    } catch (error) {
        CrawlerLogger.logError("FirecrawlAgent", error, { params });
        return [];
    }
};


const getScrapeDoAgent = async (params: CrawlJobParams): Promise<GeminiContact[]> => {
    const token = process.env.SCRAPE_DO_TOKEN || "49d2cd42c1374d9a9bd0e741bd2fb43f348015dd31a";
    const searchQuery = `"${params.niche}" "${params.city || 'Brasil'}" (whatsapp OR "celular" OR "contato")`;
    const targetUrl = `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`;
    
    try {
        const scrapeDoUrl = `https://api.scrape.do?token=${token}&url=${encodeURIComponent(targetUrl)}&geoCode=br`;
        const proxiedUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(scrapeDoUrl)}`;
        
        const response = await fetch(proxiedUrl);
        
        if (!response.ok) throw new Error(`Scrape.do error: ${response.statusText}`);
        
        const html = await response.text();
        
        // Strip out some HTML to reduce payload size, or just pass a chunk
        const textToAnalyze = html.substring(0, 40000); 
        
        const extractionPrompt = `Extraia nomes de empresas e números de WhatsApp brasileiros do seguinte HTML de resultados de busca:
        
        ${textToAnalyze}
        
        SAÍDA OBRIGATÓRIA:
        Gere um bloco JSON com a chave "contacts".`;

        const geminiResponse = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: extractionPrompt,
        });

        return parseGeminiJsonResponse(geminiResponse.text);
    } catch (error) {
        CrawlerLogger.logError("ScrapeDoAgent", error, { params });
        return [];
    }
};

const withTimeout = <T>(promise: Promise<T>, ms: number, sourceName: string): Promise<T> => {
    return Promise.race([
        promise,
        new Promise<T>((_, reject) => 
            setTimeout(() => reject(new Error(`Timeout after ${ms}ms in ${sourceName}`)), ms)
        )
    ]);
};

const stripUndefined = (obj: any) => {
    const newObj: any = {};
    Object.keys(obj).forEach(key => {
        if (obj[key] !== undefined) {
            newObj[key] = obj[key];
        }
    });
    return newObj;
};

export const startCrawl = async (params: CrawlJobParams): Promise<CrawlJob> => {
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error("User must be authenticated to start a crawl.");

    const jobId = generateId();
    const newJob: any = {
      id: jobId,
      niche: params.niche,
      city: params.city || null,
      ddd: params.ddd || null,
      sources: params.sources,
      max_pages_per_source: params.max_pages_per_source || 10,
      status: 'running',
      contacts_found: 0,
      created_at: Timestamp.now(),
      uid,
      schedule: params.schedule || 'once'
    };

    // Strip undefined values
    Object.keys(newJob).forEach(key => {
        if (newJob[key] === undefined) {
            delete newJob[key];
        }
    });

    try {
        await setDoc(doc(db, 'jobs', jobId), newJob);
    } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, `jobs/${jobId}`);
    }

    if (params.use_proxies && params.proxy_url) {
        console.log(`[Proxy] Iniciando job com proxy rotativo: ${params.proxy_url} (Rotação: ${params.proxy_rotation})`);
    }

    try {
        const agentPromises: Promise<{ contacts: GeminiContact[], sourceType: CrawlSource }>[] = [];

        const TIMEOUT_MS = 60000; // 60 seconds per agent

        if (params.sources.includes('google')) {
            agentPromises.push(withTimeout(getGoogleSearchAgent(params), TIMEOUT_MS, 'google').then(c => ({ contacts: c, sourceType: 'google' })));
        }
        if (params.sources.includes('instagram_via_search')) {
            agentPromises.push(withTimeout(getInstagramSearchAgent(params), TIMEOUT_MS, 'instagram_via_search').then(c => ({ contacts: c, sourceType: 'instagram_via_search' })));
        }
        if (params.sources.includes('linkedin_via_search')) {
            agentPromises.push(withTimeout(getLinkedInSearchAgent(params), TIMEOUT_MS, 'linkedin_via_search').then(c => ({ contacts: c, sourceType: 'linkedin_via_search' })));
        }
        if (params.sources.includes('facebook_via_search')) {
            agentPromises.push(withTimeout(getFacebookSearchAgent(params), TIMEOUT_MS, 'facebook_via_search').then(c => ({ contacts: c, sourceType: 'facebook_via_search' })));
        }
        if (params.sources.includes('apify')) {
            agentPromises.push(withTimeout(getApifyAgent(params), TIMEOUT_MS, 'apify').then(c => ({ contacts: c, sourceType: 'apify' })));
        }
        if (params.sources.includes('firecrawl')) {
            agentPromises.push(withTimeout(getFirecrawlAgent(params), TIMEOUT_MS, 'firecrawl').then(c => ({ contacts: c, sourceType: 'firecrawl' })));
        }
        if (params.sources.includes('google_maps')) {
            agentPromises.push(withTimeout(getGoogleMapsAgent(params), TIMEOUT_MS, 'google_maps').then(c => ({ contacts: c, sourceType: 'google_maps' })));
        }
        if (params.sources.includes('doctoralia_via_search')) {
            agentPromises.push(withTimeout(getDoctoraliaAgent(params), TIMEOUT_MS, 'doctoralia_via_search').then(c => ({ contacts: c, sourceType: 'doctoralia_via_search' })));
        }
        if (params.sources.includes('scrape_do')) {
            agentPromises.push(withTimeout(getScrapeDoAgent(params), TIMEOUT_MS, 'scrape_do').then(c => ({ contacts: c, sourceType: 'scrape_do' })));
        }

        if (agentPromises.length === 0) throw new Error("Nenhuma fonte selecionada.");

        const agentResultsSettled = await Promise.allSettled(agentPromises);
        
        const agentResults = agentResultsSettled
            .filter((result): result is PromiseFulfilledResult<{ contacts: GeminiContact[], sourceType: CrawlSource }> => result.status === 'fulfilled')
            .map(result => result.value);

        const failedAgents = agentResultsSettled
            .filter(result => result.status === 'rejected')
            .map(result => (result as PromiseRejectedResult).reason);

        if (failedAgents.length > 0) {
            console.warn("Some agents failed or timed out:", failedAgents);
        }
        
        let allContactsData = agentResults.flatMap(result => {
            return result.contacts.map(contact => ({ ...contact, source_type: result.sourceType }));
        });

        // Deduplication and Sanitation
        const uniqueContactsMap = new Map<string, typeof allContactsData[0]>();
        
        allContactsData.forEach(contact => {
             const phoneDigits = String(contact.e164_number || '').replace(/\D/g, '');
             
             // Normalize to 55...
             let fullNumberToCheck = phoneDigits;
             // Heuristic: If 10 or 11 digits (DDD + number), assume BR and prepend 55
             if (phoneDigits.length === 10 || phoneDigits.length === 11) {
                 fullNumberToCheck = '55' + phoneDigits;
             }
             
             // Validate
             if (isValidBrazilianMobileNumber(fullNumberToCheck)) {
                 if (!uniqueContactsMap.has(fullNumberToCheck)) {
                    // Update contact number to normalized version
                    contact.e164_number = '+' + fullNumberToCheck; 
                    uniqueContactsMap.set(fullNumberToCheck, contact);
                 }
             }
        });
        
        // Load existing to prevent global duplicates
        const existingContacts = await getContacts();
        const existingPhones = new Set(existingContacts.map(c => String(c.e164_number || '').replace(/\D/g, '')));
        
        const blacklist = await getBlacklist();
        const blacklistedPhones = new Set(blacklist.map(b => String(b.e164_number || '').replace(/\D/g, '')));

        const newUniqueContactsData = Array.from(uniqueContactsMap.values()).filter(contact => {
            const digits = String(contact.e164_number || '').replace(/\D/g, '');
            return !existingPhones.has(digits) && !blacklistedPhones.has(digits);
        });

        const newContacts: Contact[] = newUniqueContactsData.map(contactData => ({
            ...contactData,
            id: `contact_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            job_id: jobId,
            found_at: new Date(),
            niche: params.niche,
            category: params.niche,
            city: params.city || null,
            status: 'new',
            uid
        } as any));
        
        if (newContacts.length > 0) {
            for (const contact of newContacts) {
                const contactToSave = { ...contact, found_at: Timestamp.fromDate(contact.found_at) };
                
                // Strip undefined values to prevent Firestore errors
                Object.keys(contactToSave).forEach(key => {
                    if ((contactToSave as any)[key] === undefined) {
                        delete (contactToSave as any)[key];
                    }
                });

                await setDoc(doc(db, 'contacts', contact.id), contactToSave);
            }
        }
        
        // Update Job Status
        newJob.status = 'completed';
        newJob.contacts_found = newContacts.length;
        await setDoc(doc(db, 'jobs', jobId), newJob);

    } catch (error) {
        CrawlerLogger.logError("startCrawl", error, { params });
        try {
            newJob.status = 'failed';
            await setDoc(doc(db, 'jobs', jobId), newJob);
        } catch (updateErr) {
            console.error("Failed to update job status to failed", updateErr);
        }
    }
    
    return convertTimestamps(newJob) as CrawlJob;
};

export const getJobs = async (): Promise<CrawlJob[]> => {
    const uid = auth.currentUser?.uid;
    if (!uid) return [];

    try {
        const q = query(collection(db, 'jobs'), where('uid', '==', uid));
        const snapshot = await getDocs(q);
        const jobs = snapshot.docs.map(doc => convertTimestamps(doc.data()) as CrawlJob);
        return jobs.sort((a, b) => b.created_at.getTime() - a.created_at.getTime());
    } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'jobs');
        return [];
    }
};

export const deleteJob = async (jobId: string): Promise<void> => {
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error("User must be authenticated to delete a job.");

    try {
        // 1. Delete all contacts associated with this job
        const contactsQ = query(
            collection(db, 'contacts'), 
            where('uid', '==', uid),
            where('job_id', '==', jobId)
        );
        const contactsSnapshot = await getDocs(contactsQ);
        
        // Firestore batch limit is 500 operations
        const docs = contactsSnapshot.docs;
        for (let i = 0; i < docs.length; i += 500) {
            const batch = writeBatch(db);
            const chunk = docs.slice(i, i + 500);
            chunk.forEach(d => batch.delete(d.ref));
            await batch.commit();
        }
        
        // 2. Delete the job itself
        await deleteDoc(doc(db, 'jobs', jobId));
    } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `jobs/${jobId}`);
    }
};

export const getContacts = async (jobId?: string): Promise<Contact[]> => {
    const uid = auth.currentUser?.uid;
    if (!uid) return [];

    try {
        let q = query(collection(db, 'contacts'), where('uid', '==', uid));
        if (jobId) {
            q = query(collection(db, 'contacts'), where('uid', '==', uid), where('job_id', '==', jobId));
        }
        const snapshot = await getDocs(q);
        const contacts = snapshot.docs.map(doc => convertTimestamps(doc.data()) as Contact);
        return contacts.sort((a, b) => b.found_at.getTime() - a.found_at.getTime());
    } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'contacts');
        return [];
    }
};

export const updateContact = async (contactId: string, updates: Partial<Contact>): Promise<void> => {
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error("User must be authenticated to update a contact.");
    try {
        await updateDoc(doc(db, 'contacts', contactId), updates);
    } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `contacts/${contactId}`);
    }
};

export const getDashboardStats = async () => {
    const contacts = await getContacts();
    const jobs = await getJobs();
    
    const statsBySource: Record<string, number> = {};
    const statsByStatus: Record<string, number> = {};
    const statsByCity: Record<string, number> = {};
    
    contacts.forEach(c => {
        statsBySource[c.source_type] = (statsBySource[c.source_type] || 0) + 1;
        statsByStatus[c.status || 'new'] = (statsByStatus[c.status || 'new'] || 0) + 1;
        if (c.city) {
            statsByCity[c.city] = (statsByCity[c.city] || 0) + 1;
        }
    });
    
    return {
        totalLeads: contacts.length,
        totalJobs: jobs.length,
        statsBySource,
        statsByStatus,
        statsByCity
    };
};

export const enrichContact = async (contact: Contact): Promise<Contact> => {
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error("User not authenticated.");

    try {
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: `Analyze the following URL and extract information specifically about the entity (person or business) named "${contact.name}".
            
            IMPORTANT CONSTRAINTS:
            1. Do NOT extract support or generic emails from the platform itself (e.g., @google.com, @google-maps.com, @instagram.com, @facebook.com, @doctoralia.com.br, @linkedin.com).
            2. The description MUST be about "${contact.name}" and their services/profile, NOT about the platform (Google Maps, Instagram, etc.).
            3. If no specific email for this entity is found, return an empty string for the email field.
            4. Lead quality score (1-10) should reflect how good this lead is for a sales outreach.

            Entity Name: ${contact.name}
            Entity Category: ${contact.category}
            URL: ${contact.source_url}`,
            config: {
                tools: [{ urlContext: {} }],
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        email: { type: Type.STRING },
                        description: { type: Type.STRING },
                        account_type: { type: Type.STRING, enum: ['personal', 'business', 'unknown'] },
                        lead_quality: { type: Type.NUMBER }
                    },
                    required: ["email", "description", "account_type", "lead_quality"]
                }
            }
        });

        const enrichmentData = JSON.parse(response.text);
        
        // Extra client-side filter for platform emails
        const platformDomains = ['google.com', 'google-maps.com', 'instagram.com', 'facebook.com', 'doctoralia.com.br', 'linkedin.com', 'apify.com'];
        if (enrichmentData.email && platformDomains.some(domain => enrichmentData.email.toLowerCase().endsWith(domain))) {
            enrichmentData.email = "";
        }

        const updatedContact: Partial<Contact> = {
            ...enrichmentData,
            enriched_at: new Date()
        };

        await updateContact(contact.id, updatedContact);
        return { ...contact, ...updatedContact } as Contact;
    } catch (error) {
        await CrawlerLogger.logError("enrichContact", error, { contactId: contact.id, url: contact.source_url });
        throw error;
    }
};

export const deleteContact = async (contactId: string): Promise<void> => {
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error("User must be authenticated to delete a contact.");

    try {
        await deleteDoc(doc(db, 'contacts', contactId));
    } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `contacts/${contactId}`);
    }
};

export const deleteContacts = async (contactIds: string[]): Promise<void> => {
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error("User must be authenticated to delete contacts.");

    try {
        // Firestore batch limit is 500 operations
        for (let i = 0; i < contactIds.length; i += 500) {
            const batch = writeBatch(db);
            const chunk = contactIds.slice(i, i + 500);
            chunk.forEach(id => {
                batch.delete(doc(db, 'contacts', id));
            });
            await batch.commit();
        }
    } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, 'contacts/bulk');
    }
};

export const getBlacklist = async (): Promise<BlacklistedContact[]> => {
    const uid = auth.currentUser?.uid;
    if (!uid) return [];

    try {
        const q = query(collection(db, 'blacklist'), where('uid', '==', uid));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => convertTimestamps(doc.data()) as BlacklistedContact);
    } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'blacklist');
        return [];
    }
};

export const addToBlacklist = async (e164_number: string, reason?: string): Promise<void> => {
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error("User must be authenticated to blacklist a contact.");

    try {
        const id = `bl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const blacklisted: any = {
            id,
            e164_number,
            reason,
            created_at: new Date(),
            uid
        };
        await setDoc(doc(db, 'blacklist', id), stripUndefined(blacklisted));
    } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, 'blacklist');
    }
};

export const removeFromBlacklist = async (id: string): Promise<void> => {
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error("User must be authenticated to remove from blacklist.");

    try {
        await deleteDoc(doc(db, 'blacklist', id));
    } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `blacklist/${id}`);
    }
};

const dddToCityMap: { [ddd: string]: string } = {
    '11': 'São Paulo (SP)', '12': 'São José dos Campos (SP)', '13': 'Santos (SP)', '14': 'Bauru (SP)', '15': 'Sorocaba (SP)', '16': 'Ribeirão Preto (SP)', '17': 'São José do Rio Preto (SP)', '18': 'Presidente Prudente (SP)', '19': 'Campinas (SP)', '21': 'Rio de Janeiro (RJ)', '22': 'Campos dos Goytacazes (RJ)', '24': 'Volta Redonda (RJ)', '27': 'Vitória (ES)', '28': 'Cachoeiro de Itapemirim (ES)', '31': 'Belo Horizonte (MG)', '32': 'Juiz de Fora (MG)', '33': 'Governador Valadares (MG)', '34': 'Uberlândia (MG)', '35': 'Poços de Caldas (MG)', '37': 'Divinópolis (MG)', '38': 'Montes Claros (MG)', '41': 'Curitiba (PR)', '42': 'Ponta Grossa (PR)', '43': 'Londrina (PR)', '44': 'Maringá (PR)', '45': 'Foz do Iguaçu (PR)', '46': 'Francisco Beltrão/Pato Branco (PR)', '47': 'Joinville (SC)', '48': 'Florianópolis (SC)', '49': 'Chapecó (SC)', '51': 'Porto Alegre (RS)', '53': 'Pelotas (RS)', '54': 'Caxias do Sul (RS)', '55': 'Santa Maria (RS)', '61': 'Brasília (DF)', '62': 'Goiânia (GO)', '63': 'Palmas (TO)', '64': 'Rio Verde (GO)', '65': 'Cuiabá (MT)', '66': 'Rondonópolis (MT)', '67': 'Campo Grande (MS)', '68': 'Rio Branco (AC)', '69': 'Porto Velho (RO)', '71': 'Salvador (BA)', '73': 'Ilhéus (BA)', '74': 'Juazeiro (BA)', '75': 'Feira de Santana (BA)', '77': 'Barreiras (BA)', '79': 'Aracaju (SE)', '81': 'Recife (PE)', '82': 'Maceió (AL)', '83': 'João Pessoa (PB)', '84': 'Natal (RN)', '85': 'Fortaleza (CE)', '86': 'Teresina (PI)', '87': 'Petrolina (PE)', '88': 'Juazeiro do Norte (CE)', '89': 'Picos (PI)', '91': 'Belém (PA)', '92': 'Manaus (AM)', '93': 'Santarém (PA)', '94': 'Marabá (PA)', '95': 'Boa Vista (RR)', '96': 'Macapá (AP)', '97': 'Coari (AM)', '98': 'São Luís (MA)', '99': 'Imperatriz (MA)'
};

export const normalizePhone = (rawNumber: string): Promise<NormalizedPhone> => {
    return new Promise((resolve) => {
        setTimeout(() => {
            const digits = rawNumber.replace(/\D/g, '');
            let result: NormalizedPhone;

            const e164 = digits.startsWith('55') ? `+${digits}` : `+55${digits}`;
            const isValidLength = e164.startsWith('+55') && (e164.length === 13 || e164.length === 14);

            if (isValidLength) {
                const ddd = e164.substring(3, 5);
                const numberPart = e164.substring(5);
                result = {
                    e164: e164,
                    country_code: '55',
                    is_valid: true,
                    type: numberPart.length === 9 ? 'MOBILE' : 'LANDLINE',
                    raw: rawNumber,
                    default_country: 'BR',
                    location: dddToCityMap[ddd] || 'Unknown',
                };
            } else {
                result = {
                    e164: null,
                    country_code: null,
                    is_valid: false,
                    type: null,
                    raw: rawNumber,
                    default_country: 'BR',
                    location: null,
                };
            }
            resolve(result);
        }, 500);
    });
};

export const sendMessage = (contactId: string, message: string): Promise<{ success: boolean; message: string }> => {
  return new Promise((resolve) => {
    console.log(`Sending message to contact ${contactId}: "${message}"`);
    // Simulate API call
    setTimeout(() => {
      if (message.toLowerCase().includes('fail')) {
          resolve({ success: false, message: 'Failed to send message: Simulated error.' });
      } else {
          resolve({ success: true, message: 'Message sent successfully via Z-API.' });
      }
    }, 1500);
  });
};