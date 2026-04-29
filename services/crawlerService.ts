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

export const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

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
                    const phoneVal = item.whatsapp || item.phone || item.e164_number || '';
                    return {
                        name: String(item.name || 'Não informado'),
                        e164_number: phoneVal ? String(phoneVal) : undefined,
                        raw_number: phoneVal ? String(phoneVal) : undefined,
                        email: item.email ? String(item.email) : undefined,
                        instagram_handle: item.instagram_handle || item.instagram || item.handle ? String(item.instagram_handle || item.instagram || item.handle) : undefined,
                        linkedin_url: item.linkedin_url || item.linkedin ? String(item.linkedin_url || item.linkedin) : undefined,
                        facebook_url: item.facebook_url || item.facebook ? String(item.facebook_url || item.facebook) : undefined,
                        website: item.website || item.site ? String(item.website || item.site) : undefined,
                        description: item.description || item.bio ? String(item.description || item.bio) : undefined,
                        photo_url: (item.photo_url || item.photo || item.image || item.avatar) ? String(item.photo_url || item.photo || item.image || item.avatar) : undefined,
                        address: item.address ? String(item.address) : null,
                        source_url: String(item.source || item.source_url || 'N/A'),
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
    
    // Brazilian numbers should have 10 to 13 digits
    // 10: DDD + 8 digits (Landline/Old Mobile)
    // 11: DDD + 9 + 8 digits (Mobile)
    // 12: 55 + DDD + 8 digits
    // 13: 55 + DDD + 9 + 8 digits
    
    if (digits.length < 10 || digits.length > 13) return false;
    
    // If it has 12 or 13 digits, it MUST start with 55
    if (digits.length >= 12 && !digits.startsWith('55')) return false;
    
    // If it has 10 or 11 digits, it's just DDD + Number
    return true;
};

// --- Specialized Agents ---

const getGoogleSearchAgent = async (params: CrawlJobParams): Promise<GeminiContact[]> => {
    // More flexible query to include social media profiles and DDD if provided
    const dddQuery = params.ddd ? `(${params.ddd}) OR "DDD ${params.ddd}"` : '';
    const searchQuery = `${params.niche} ${params.city || 'Brasil'} ${dddQuery} (whatsapp OR "celular" OR "contato" OR site:instagram.com OR site:linkedin.com)`;
    
    const contactSearchPrompt = `Realize uma pesquisa exaustiva no Google para encontrar o máximo de profissionais, clínicas ou empresas de: "${params.niche}" em "${params.city || 'Brasil'}".
    
    QUERY DE APOIO: ${searchQuery}
    
    INSTRUÇÕES CRÍTICAS:
    1. Utilize a ferramenta de busca para encontrar perfis em redes sociais, sites oficiais e diretórios.
    2. FOCO: Extraia nomes, NÚMEROS DE WHATSAPP/CELULAR, perfis de Instagram, LinkedIn e E-mails.
    3. Mesmo que não encontre o número de telefone, capture o perfil do Instagram ou LinkedIn se for relevante.
    4. Tente encontrar pelo menos 30 a 50 resultados diferentes.
    5. No campo "source", coloque a URL de onde a informação foi extraída.
    
    SAÍDA OBRIGATÓRIA:
    Gere um bloco JSON com a chave "contacts".`;

    try {
        const result = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: contactSearchPrompt,
            config: {
                tools: [{ googleSearch: {} }],
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        contacts: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    name: { type: Type.STRING },
                                    whatsapp: { type: Type.STRING },
                                    instagram_handle: { type: Type.STRING },
                                    linkedin_url: { type: Type.STRING },
                                    email: { type: Type.STRING },
                                    website: { type: Type.STRING },
                                    description: { type: Type.STRING },
                                    source: { type: Type.STRING }
                                }
                            }
                        }
                    },
                    required: ["contacts"]
                },
                safetySettings: [
                    { category: 'HARM_CATEGORY_HATE_SPEECH' as any, threshold: 'BLOCK_NONE' as any },
                    { category: 'HARM_CATEGORY_HARASSMENT' as any, threshold: 'BLOCK_NONE' as any },
                    { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT' as any, threshold: 'BLOCK_NONE' as any },
                    { category: 'HARM_CATEGORY_DANGEROUS_CONTENT' as any, threshold: 'BLOCK_NONE' as any }
                ]
            }
        });
        return parseGeminiJsonResponse(result.text);
    } catch (error) {
        CrawlerLogger.logError("GoogleSearchAgent", error, { params, searchQuery });
        return [];
    }
}

const getInstagramSearchAgent = async (params: CrawlJobParams): Promise<GeminiContact[]> => {
    // Simplified Dorking for snippet visibility
    const dddQuery = params.ddd ? `(${params.ddd}) OR "DDD ${params.ddd}"` : '';
    const searchQuery = `site:instagram.com "${params.niche}" "${params.city || ''}" ${dddQuery} (whatsapp OR "@") -inurl:directory`;

    const contactSearchPrompt = `Realize uma pesquisa exaustiva no Google por perfis do Instagram de "${params.niche}" no "${params.city || 'Brasil'}".
    
    QUERY SUGERIDA: ${searchQuery}

    TAREFA:
    1. Analise todos os snippets dos resultados de busca do Instagram e use a busca se necessário para encontrar mais detalhes.
    2. Extraia nomes (@usuario), Bio, e números de WhatsApp que aparecem na descrição.
    3. IMPORTANTE: Extraia o instagram_handle (@usuario) MESMO QUE não tenha WhatsApp.
    4. Tente capturar o link da imagem de perfil (photo_url).
    5. Tente encontrar pelo menos 20 contatos diferentes.
    
    SAÍDA OBRIGATÓRIA:
    Gere um bloco JSON:
    \`\`\`json
    {
      "contacts": [
        { 
          "name": "Nome exibido", 
          "instagram_handle": "@usuario",
          "whatsapp": "+55...", 
          "photo_url": "URL da foto", 
          "description": "bio",
          "source": "Link do Instagram" 
        }
      ]
    }
    \`\`\`
    `;

    try {
        const result = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: contactSearchPrompt,
            config: {
                tools: [{ googleSearch: {} }],
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        contacts: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    name: { type: Type.STRING },
                                    instagram_handle: { type: Type.STRING },
                                    whatsapp: { type: Type.STRING },
                                    photo_url: { type: Type.STRING },
                                    description: { type: Type.STRING },
                                    source: { type: Type.STRING }
                                }
                            }
                        }
                    },
                    required: ["contacts"]
                },
                safetySettings: [
                    { category: 'HARM_CATEGORY_HATE_SPEECH' as any, threshold: 'BLOCK_NONE' as any },
                    { category: 'HARM_CATEGORY_HARASSMENT' as any, threshold: 'BLOCK_NONE' as any },
                    { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT' as any, threshold: 'BLOCK_NONE' as any },
                    { category: 'HARM_CATEGORY_DANGEROUS_CONTENT' as any, threshold: 'BLOCK_NONE' as any }
                ]
            }
        });
        return parseGeminiJsonResponse(result.text);
    } catch (error) {
        CrawlerLogger.logError("InstagramAgent", error, { params, searchQuery });
        return [];
    }
}

const getGoogleMapsAgent = async (params: CrawlJobParams): Promise<GeminiContact[]> => {
    if (!params.city) return [];
    
    const dddInfo = params.ddd ? `focando em números com DDD ${params.ddd}` : '';
    const contactSearchPrompt = `Busque no Google Maps por profissionais ou empresas de "${params.niche}" em "${params.city}" ${dddInfo}.
    
    TAREFA:
    1. Identifique pelo menos 20 a 25 estabelecimentos relevantes.
    2. Extraia o nome, telefone (priorize celular/whatsapp) e endereço.
    3. Se encontrar sites, tente identificar o whatsapp neles também.
    
    SAÍDA OBRIGATÓRIA:
    Retorne APENAS um bloco JSON com a seguinte estrutura:
    {
      "contacts": [
        { "name": "Nome", "whatsapp": "+55...", "address": "Endereço", "source": "Google Maps" }
      ]
    }`;

    try {
        const result = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: contactSearchPrompt,
            config: {
                tools: [{ googleMaps: {} }],
                // Google Maps tool DOES NOT support responseMimeType: "application/json"
                safetySettings: [
                    { category: 'HARM_CATEGORY_HATE_SPEECH' as any, threshold: 'BLOCK_NONE' as any },
                    { category: 'HARM_CATEGORY_HARASSMENT' as any, threshold: 'BLOCK_NONE' as any },
                    { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT' as any, threshold: 'BLOCK_NONE' as any },
                    { category: 'HARM_CATEGORY_DANGEROUS_CONTENT' as any, threshold: 'BLOCK_NONE' as any }
                ]
            }
        });
        
        const text = result.text || '';
        if (!text) return [];

        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const data = JSON.parse(jsonMatch[0]);
            return (data.contacts || []).map((c: any) => ({
                name: c.name || '',
                whatsapp: c.whatsapp || '',
                address: c.address || '',
                source: c.source || 'Google Maps'
            }));
        }
        return [];
    } catch (error) {
        CrawlerLogger.logError("GoogleMapsAgent", error, { params });
        return [];
    }
}

const proxyFetch = async (url: string, options: any = {}) => {
    const response = await fetch('/api/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, ...options })
    });
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `Proxy error: ${response.status}`);
    }
    // Check if it's JSON or Text
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
        return await response.json();
    }
    return await response.text();
};

const getDoctoraliaDirectAgent = async (params: CrawlJobParams): Promise<GeminiContact[]> => {
    const token = process.env.SCRAPE_DO_TOKEN || "49d2cd42c1374d9a9bd0e741bd2fb43f348015dd31a";
    let allContacts: GeminiContact[] = [];
    
    // 1. Determine the target URL
    let baseUrl: string;
    if (params.direct_url && params.direct_url.includes('doctoralia.com.br')) {
        baseUrl = params.direct_url;
    } else {
        const niche = encodeURIComponent(params.niche);
        const city = params.city ? encodeURIComponent(params.city.split('/')[0].trim()) : '';
        baseUrl = `https://www.doctoralia.com.br/pesquisa?q=${niche}&loc=${city}`;
    }

    const maxPages = params.max_pages_per_source || 1;

    for (let page = 0; page < maxPages; page++) {
        let currentUrl = baseUrl;
        if (page > 0) {
            if (currentUrl.includes('page=')) {
                currentUrl = currentUrl.replace(/page=\d+/, `page=${page + 1}`);
            } else {
                currentUrl += (currentUrl.includes('?') ? '&' : '?') + `page=${page + 1}`;
            }
        }

        try {
            console.log(`[DoctoraliaDirect] Scraping list page ${page + 1}: ${currentUrl}`);
            const scrapeDoUrl = `https://api.scrape.do?token=${token}&url=${encodeURIComponent(currentUrl)}&geoCode=br&render=true`;
            
            const html = await proxyFetch(scrapeDoUrl);
            
            if (!html || (typeof html === 'string' && html.length < 1000)) {
                console.warn("[DoctoraliaDirect] Empty or too short HTML from list page.");
                continue;
            }

            // Extract profile links using regex first as it's more reliable for simple patterns
            const htmlString = typeof html === 'string' ? html : JSON.stringify(html);
            
            // Regex to find doctoralia profile links (usually /name-surname or /name-surname/specialty/city)
            // Example profile link: <a href="/jose-silva" ... or <a href="https://www.doctoralia.com.br/jose-silva"
            const urlRegex = /href="(\/([^"\/]+)|https:\/\/www\.doctoralia\.com\.br\/([^"\/]+))"/g;
            let foundUrls = new Set<string>();
            let match;
            while ((match = urlRegex.exec(htmlString)) !== null) {
                const url = match[1];
                // Filter out common non-profile paths
                const isBlacklisted = /^\/(pesquisa|search|api|static|blog|ajuda|login|signup|termos|privacidade|faq|contato|sobre|imprensa|carreiras|anuncie|for-doctors|for-clinics|business|perfil-do-profissional|especialistas-pro|especialidades|doencas|exames|centros|opinioes|perguntas|servicos|telemedicina|perguntas-frequentes|convenios|planos-de-saude|unidades-de-saude|mapa-do-site|especialistas-mais-buscados)/.test(url);
                
                if (!isBlacklisted && url.length > 5) {
                    foundUrls.add(url);
                }
            }

            console.log(`[DoctoraliaDirect] Regex found ${foundUrls.size} potential links on page ${page + 1}`);

            // If regex found too few, fallback to Gemini
            let profileUrls: string[] = Array.from(foundUrls);
            if (profileUrls.length < 5) {
                const extractionPrompt = `Analise o HTML da Doctoralia e extraia todos os links (URLs) de perfis de médicos e profissionais de saúde.
                Links geralmente seguem o padrão "/nome-do-profissional" ou "https://www.doctoralia.com.br/nome...". 
                Ignore links de busca, filtros, rodapé ou anúncios.
                
                HTML:
                ${htmlString.substring(0, 50000)}
                
                Retorne APENAS um array JSON de strings: ["url1", "url2", ...]`;

                const result = await ai.models.generateContent({
                    model: "gemini-3-flash-preview",
                    contents: extractionPrompt,
                });

                const text = result.text || '';
                const urlsMatch = text.match(/\[[\s\S]*\]/);
                if (urlsMatch) {
                    try {
                        const geminiUrls: string[] = JSON.parse(urlsMatch[0]);
                        profileUrls = Array.from(new Set([...profileUrls, ...geminiUrls]));
                    } catch (e) {
                        console.error("[DoctoraliaDirect] Gemini URL parse error", e);
                    }
                }
            }
            
            // Normalize and filter URLs again
            profileUrls = profileUrls
                .map(u => u.startsWith('http') ? u : `https://www.doctoralia.com.br${u.startsWith('/') ? '' : '/'}${u}`)
                .filter(u => !u.includes('?') && !u.includes('#') && u.split('/').length >= 4); // Usually needs at least one path segment after domain

            console.log(`[DoctoraliaDirect] Final profile count for page ${page + 1}: ${profileUrls.length}`);

            // 2. Fetch each profile to find the phone number
            for (const profileUrl of profileUrls.slice(0, 10)) {
                try {
                    console.log(`[DoctoraliaDirect] Deep scraping profile: ${profileUrl}`);
                    const profileScrapeUrl = `https://api.scrape.do?token=${token}&url=${encodeURIComponent(profileUrl)}&geoCode=br&render=true`;
                    
                    const profileHtml = await proxyFetch(profileScrapeUrl);
                    const profileHtmlString = typeof profileHtml === 'string' ? profileHtml : JSON.stringify(profileHtml);

                    const profileExtractionPrompt = `Você é um especialista em extração de contatos. Capture os detalhes do profissional neste HTML da Doctoralia.
                    
                    INSTRUÇÕES:
                    1. Encontre o NOME do profissional.
                    2. Encontre o TELEFONE ou WHATSAPP. Procure dentro de blocos <script> que contenham "initialState" ou dados JSON (onde o telefone costuma estar escondido em propriedades como "phone", "telephone", "mobile", "whatsapp", "plainPhoneNumber").
                    3. Também procure por números no texto visível.
                    
                    URL: ${profileUrl}
                    HTML:
                    ${profileHtmlString.substring(0, 60000)}
                    
                    Retorne JSON: { "name": "...", "whatsapp": "...", "source": "${profileUrl}", "description": "..." }`;

                    const profileResult = await ai.models.generateContent({
                        model: "gemini-3-flash-preview",
                        contents: profileExtractionPrompt,
                    });

                    const profileText = profileResult.text || '';
                    const profileJsonMatch = profileText.match(/\{[\s\S]*\}/);
                    if (profileJsonMatch) {
                        try {
                            const contact = JSON.parse(profileJsonMatch[0]);
                            if (contact.name && (contact.whatsapp || contact.phone)) {
                                allContacts.push({
                                    ...contact,
                                    whatsapp: contact.whatsapp || contact.phone
                                });
                                // Periodically update job contacts_found if possible
                                // For now we return at the end
                            }
                        } catch (e) {
                            console.error("[DoctoraliaDirect] Error parsing profile JSON", e);
                        }
                    }
                    
                    await new Promise(r => setTimeout(r, 1500)); // Slightly faster
                } catch (err) {
                    console.error(`[DoctoraliaDirect] Failed profile ${profileUrl}:`, err);
                }
            }

            if (profileUrls.length < 3) break; 
            if (page < maxPages - 1) await new Promise(r => setTimeout(r, 5000));

        } catch (error) {
            CrawlerLogger.logError("DoctoraliaDirectAgent", error, { params, page });
            break;
        }
    }

    return allContacts;
};

const getDoctoraliaAgent = async (params: CrawlJobParams): Promise<GeminiContact[]> => {
    const dddQuery = params.ddd ? `(${params.ddd}) OR "DDD ${params.ddd}"` : '';
    const searchQuery = `site:doctoralia.com.br ${params.niche} ${params.city || ''} ${dddQuery} whatsapp`;
    const contactSearchPrompt = `Realize uma pesquisa exaustiva no Doctoralia para encontrar profissionais de "${params.niche}" em "${params.city || 'Brasil'}".
    
    TAREFA:
    1. Identifique o máximo de profissionais relevantes.
    2. Extraia números de contato visíveis nos snippets de busca.
    3. Tente extrair pelo menos 30 contatos únicos.
    
    SAÍDA:
    Bloco JSON com a chave "contacts".
    `;

    try {
        const result = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: contactSearchPrompt,
            config: {
                tools: [{ googleSearch: {} }],
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        contacts: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    name: { type: Type.STRING },
                                    whatsapp: { type: Type.STRING },
                                    source: { type: Type.STRING }
                                }
                            }
                        }
                    },
                    required: ["contacts"]
                },
                safetySettings: [
                    { category: 'HARM_CATEGORY_HATE_SPEECH' as any, threshold: 'BLOCK_NONE' as any },
                    { category: 'HARM_CATEGORY_HARASSMENT' as any, threshold: 'BLOCK_NONE' as any },
                    { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT' as any, threshold: 'BLOCK_NONE' as any },
                    { category: 'HARM_CATEGORY_DANGEROUS_CONTENT' as any, threshold: 'BLOCK_NONE' as any }
                ]
            }
        });
        return parseGeminiJsonResponse(result.text);
    } catch (error) {
        CrawlerLogger.logError("DoctoraliaAgent", error, { params, searchQuery });
        return [];
    }
};

const getLinkedInSearchAgent = async (params: CrawlJobParams): Promise<GeminiContact[]> => {
    const cityClean = params.city ? params.city.split('/')[0].trim() : '';
    const dddQuery = params.ddd ? `(${params.ddd}) OR "DDD ${params.ddd}"` : '';
    const searchQuery = `site:linkedin.com/in/ OR site:linkedin.com/company/ "${params.niche}" "${cityClean}" ${dddQuery} (whatsapp OR "contato" OR "email")`;
    const contactSearchPrompt = `Realize uma pesquisa exaustiva no LinkedIn para encontrar empresas ou profissionais de "${params.niche}" em "${cityClean || 'Brasil'}".
    
    TAREFA:
    1. Identifique perfis ou páginas de empresas.
    2. Extraia nomes, números de contato, LinkedIn URLs, e E-mails.
    3. IMPORTANTE: Capture o LinkedIn URL mesmo que não tenha WhatsApp.
    4. Tente extrair pelo menos 20 contatos.
    
    SAÍDA:
    Bloco JSON com a chave "contacts". Cada contato deve ter name, linkedin_url, whatsapp (se houver), email (se houver) e description.
    `;

    try {
        const result = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: contactSearchPrompt,
            config: {
                tools: [{ googleSearch: {} }],
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        contacts: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    name: { type: Type.STRING },
                                    linkedin_url: { type: Type.STRING },
                                    whatsapp: { type: Type.STRING },
                                    email: { type: Type.STRING },
                                    description: { type: Type.STRING }
                                }
                            }
                        }
                    },
                    required: ["contacts"]
                },
                safetySettings: [
                    { category: 'HARM_CATEGORY_HATE_SPEECH' as any, threshold: 'BLOCK_NONE' as any },
                    { category: 'HARM_CATEGORY_HARASSMENT' as any, threshold: 'BLOCK_NONE' as any },
                    { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT' as any, threshold: 'BLOCK_NONE' as any },
                    { category: 'HARM_CATEGORY_DANGEROUS_CONTENT' as any, threshold: 'BLOCK_NONE' as any }
                ]
            }
        });
        return parseGeminiJsonResponse(result.text);
    } catch (error) {
        CrawlerLogger.logError("LinkedInAgent", error, { params, searchQuery });
        return [];
    }
};

const getFacebookSearchAgent = async (params: CrawlJobParams): Promise<GeminiContact[]> => {
    const cityClean = params.city ? params.city.split('/')[0].trim() : '';
    const dddQuery = params.ddd ? `(${params.ddd}) OR "DDD ${params.ddd}"` : '';
    const searchQuery = `site:facebook.com "${params.niche}" "${cityClean}" ${dddQuery} ("whatsapp" OR "contato" OR "email")`;
    const contactSearchPrompt = `Realize uma pesquisa exaustiva no Facebook para encontrar empresas de "${params.niche}" em "${cityClean || 'Brasil'}".
    
    TAREFA:
    1. Identifique páginas de negócios ou perfis profissionais.
    2. Extraia Nomes, WhatsApp, Facebook URL e E-mails.
    3. Tente extrair pelo menos 20 contatos.
    
    SAÍDA:
    Bloco JSON com a chave "contacts".
    `;

    try {
        const result = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: contactSearchPrompt,
            config: {
                tools: [{ googleSearch: {} }],
                // ... (safety settings)
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        contacts: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    name: { type: Type.STRING },
                                    whatsapp: { type: Type.STRING },
                                    facebook_url: { type: Type.STRING },
                                    email: { type: Type.STRING }
                                }
                            }
                        }
                    },
                    required: ["contacts"]
                },
                safetySettings: [
                    { category: 'HARM_CATEGORY_HATE_SPEECH' as any, threshold: 'BLOCK_NONE' as any },
                    { category: 'HARM_CATEGORY_HARASSMENT' as any, threshold: 'BLOCK_NONE' as any },
                    { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT' as any, threshold: 'BLOCK_NONE' as any },
                    { category: 'HARM_CATEGORY_DANGEROUS_CONTENT' as any, threshold: 'BLOCK_NONE' as any }
                ]
            }
        });
        return parseGeminiJsonResponse(result.text);
    } catch (error) {
        CrawlerLogger.logError("FacebookAgent", error, { params, searchQuery });
        return [];
    }
};

const getApifyAgent = async (params: CrawlJobParams): Promise<GeminiContact[]> => {
    const apiKey = (process.env as any).APIFY_API_KEY;
    if (!apiKey) {
        const msg = "APIFY_API_KEY não encontrada. Por favor, configure sua chave Apify nas configurações para usar esta fonte.";
        console.warn(msg);
        CrawlerLogger.logError("ApifyAgent", msg, { params });
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
                maxPagesPerQuery: params.max_pages_per_source || 2,
                resultsPerPage: 20,
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
        const extractionPrompt = `Extraia nomes de empresas, números de WhatsApp brasileiros, perfis de redes sociais (Instagram handles, LinkedIn URLs, etc) e e-mails do seguinte JSON de resultados de busca:
        
        ${textToAnalyze}
        
        SAÍDA OBRIGATÓRIA:
        Gere um bloco JSON com a chave "contacts". Cada objeto deve tentar preencher os campos: name, whatsapp, instagram_handle, linkedin_url, email, website e source.`;

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
        const msg = "FIRECRAWL_API_KEY não encontrada. Por favor, configure sua chave Firecrawl nas configurações para usar esta fonte.";
        console.warn(msg);
        CrawlerLogger.logError("FirecrawlAgent", msg, { params });
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
                limit: (params.max_pages_per_source || 2) * 10,
                lang: 'pt-BR'
            })
        });

        if (!response.ok) throw new Error(`Firecrawl error: ${response.statusText}`);
        
        const data = await response.json();
        
        // Firecrawl returns markdown/text. Use Gemini to extract.
        const textToAnalyze = JSON.stringify(data);
        const extractionPrompt = `Extraia nomes de empresas, números de WhatsApp brasileiros, perfis de redes sociais e e-mails destes dados de busca:
        
        ${textToAnalyze}
        
        SAÍDA OBRIGATÓRIA:
        Gere um bloco JSON com a chave "contacts". Tente extrair o máximo de detalhes possível, incluindo Bio/Descrição.`;

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
    // Note: The token below is a fallback, users should use their own
    const token = process.env.SCRAPE_DO_TOKEN || "49d2cd42c1374d9a9bd0e741bd2fb43f348015dd31a";
    const searchQuery = `"${params.niche}" "${params.city || 'Brasil'}" (whatsapp OR "celular" OR "contato")`;
    
    let allContacts: GeminiContact[] = [];
    const maxPages = params.max_pages_per_source || 1;

    for (let page = 0; page < maxPages; page++) {
        const start = page * 10;
        const targetUrl = `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}&start=${start}`;
        
        try {
            const scrapeDoUrl = `https://api.scrape.do?token=${token}&url=${encodeURIComponent(targetUrl)}&geoCode=br&render=true`;
            
            const html = await proxyFetch(scrapeDoUrl);
            
            if (typeof html === 'string' && (html.includes("detected unusual traffic") || html.includes("captcha"))) {
                console.warn(`[Scrape.do] Bloqueio detectado na página ${page + 1}.`);
                break;
            }

            const textToAnalyze = html.substring(0, 40000); 
            
            const extractionPrompt = `Extraia nomes de empresas, números de WhatsApp brasileiros, perfis de redes sociais e e-mails do seguinte HTML de resultados de busca (Página ${page + 1}):
            
            ${textToAnalyze}
            
            SAÍDA OBRIGATÓRIA:
            Gere um bloco JSON com a chave "contacts". Cada objeto deve conter: name, whatsapp (se houver), instagram_handle (se houver), linkedin_url (se houver), facebook_url (se houver), email (se houver) e description.`;

            const result = await ai.models.generateContent({
                model: "gemini-3-flash-preview",
                contents: extractionPrompt,
            });

            const contacts = parseGeminiJsonResponse(result.text);
            allContacts = [...allContacts, ...contacts];

            if (contacts.length < 3) break; // Most likely end of results
            if (page < maxPages - 1) await new Promise(r => setTimeout(r, 5000));

        } catch (error) {
            CrawlerLogger.logError("ScrapeDoAgent", error, { params, page });
            break;
        }
    }

    return allContacts;
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
      name: params.name || `${params.niche}${params.city ? ` - ${params.city}` : ''}`,
      niche: params.niche,
      city: params.city || null,
      ddd: params.ddd || null,
      sources: params.sources,
      max_pages_per_source: params.max_pages_per_source || 10,
      status: 'pending',
      contacts_found: 0,
      created_at: Timestamp.now(),
      uid,
      schedule: params.schedule || 'once',
      direct_url: params.direct_url || null
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
        console.error("Error creating job doc:", error);
    }

    if (params.use_proxies && params.proxy_url) {
        console.log(`[Proxy] Iniciando job com proxy rotativo: ${params.proxy_url} (Rotação: ${params.proxy_rotation})`);
    }

    try {
        const TIMEOUT_MS = 300000; // Increased to 5 minutes
        
        // Stagger agent calls to avoid rate limit bursts and platform error toasts
        const agentPromises = params.sources.map(async (source, index) => {
            // Wait index * 15 seconds before starting this agent to avoid heavy RPM bursts (429 errors)
            await new Promise(resolve => setTimeout(resolve, index * 15000));
            
            try {
                let contacts: GeminiContact[] = [];
                switch (source) {
                    case 'google':
                        contacts = await withTimeout(getGoogleSearchAgent(params), TIMEOUT_MS, 'google');
                        break;
                    case 'instagram_via_search':
                        contacts = await withTimeout(getInstagramSearchAgent(params), TIMEOUT_MS, 'instagram_via_search');
                        break;
                    case 'linkedin_via_search':
                        contacts = await withTimeout(getLinkedInSearchAgent(params), TIMEOUT_MS, 'linkedin_via_search');
                        break;
                    case 'facebook_via_search':
                        contacts = await withTimeout(getFacebookSearchAgent(params), TIMEOUT_MS, 'facebook_via_search');
                        break;
                    case 'apify':
                        contacts = await withTimeout(getApifyAgent(params), TIMEOUT_MS, 'apify');
                        break;
                    case 'firecrawl':
                        contacts = await withTimeout(getFirecrawlAgent(params), TIMEOUT_MS, 'firecrawl');
                        break;
                    case 'google_maps':
                        contacts = await withTimeout(getGoogleMapsAgent(params), TIMEOUT_MS, 'google_maps');
                        break;
                    case 'doctoralia_via_search':
                        contacts = await withTimeout(getDoctoraliaAgent(params), TIMEOUT_MS, 'doctoralia_via_search');
                        break;
                    case 'doctoralia_direct':
                        contacts = await withTimeout(getDoctoraliaDirectAgent(params), TIMEOUT_MS * 2, 'doctoralia_direct');
                        break;
                    case 'scrape_do':
                        contacts = await withTimeout(getScrapeDoAgent(params), TIMEOUT_MS, 'scrape_do');
                        break;
                }
                return { contacts, sourceType: source };
            } catch (error: any) {
                const errorMsg = error instanceof Error ? error.message : String(error);
                const isThrottled = errorMsg.includes('429') || errorMsg.includes('quota') || errorMsg.includes('throttled');
                
                console.error(`[Agent Failed] ${source}:`, error);
                
                if (isThrottled) {
                    console.warn(`[Quota Alert] Agent ${source} was throttled. Try running with fewer sources or wait.`);
                }
                
                CrawlerLogger.logError(`${source.charAt(0).toUpperCase() + source.slice(1).replace(/_via_search/g, '')}Agent`, error, { source, params });
                return { contacts: [], sourceType: source };
            }
        });

        if (agentPromises.length === 0) throw new Error("Nenhuma fonte selecionada.");

        const agentResultsSettled = await Promise.allSettled(agentPromises);
        
        const agentResults = agentResultsSettled
            .filter((result): result is PromiseFulfilledResult<{ contacts: GeminiContact[], sourceType: CrawlSource }> => result.status === 'fulfilled')
            .map(result => result.value);

        // Debug logging for awareness
        agentResults.forEach(res => {
            console.log(`[Crawl Logs] Agent ${res.sourceType} found ${res.contacts?.length || 0} contacts initially.`);
        });
        
        let allContactsData = agentResults.flatMap(result => {
             if (!result.contacts) return [];
             return result.contacts.map(contact => ({ ...contact, source_type: result.sourceType }));
        });

        const totalBeforeDedup = allContactsData.length;

        // Deduplication and Sanitation
        const uniqueContactsMap = new Map<string, typeof allContactsData[0]>();
        
        allContactsData.forEach(contact => {
             // 1. Normalize Phone if exists
             let phoneDigits = contact.e164_number ? String(contact.e164_number).replace(/\D/g, '') : '';
             let fullNumberNormalized = '';

             if (phoneDigits) {
                 if (phoneDigits.startsWith('0') && (phoneDigits.length === 11 || phoneDigits.length === 12)) {
                     phoneDigits = phoneDigits.substring(1);
                 }
                 if (phoneDigits.length === 10 || phoneDigits.length === 11) {
                     fullNumberNormalized = '55' + phoneDigits;
                 } else if (phoneDigits.length >= 12 && phoneDigits.startsWith('55')) {
                     fullNumberNormalized = phoneDigits;
                 }
                 
                 if (fullNumberNormalized && isValidBrazilianMobileNumber(fullNumberNormalized)) {
                     contact.e164_number = '+' + fullNumberNormalized;
                     contact.raw_number = contact.e164_number;
                 }
             }

             // 2. Determine Unique Key (Priority: Phone > Email > Instagram > LinkedIn > SourceURL)
             let uniqueKey = '';
             if (fullNumberNormalized) {
                 uniqueKey = 'phone_' + fullNumberNormalized;
             } else if (contact.email) {
                 uniqueKey = 'email_' + contact.email.toLowerCase();
             } else if (contact.instagram_handle) {
                 uniqueKey = 'ig_' + contact.instagram_handle.toLowerCase().replace(/^@+/, '');
             } else if (contact.linkedin_url) {
                 uniqueKey = 'li_' + contact.linkedin_url.toLowerCase();
             } else {
                 uniqueKey = 'url_' + contact.source_url;
             }
             
             if (!uniqueContactsMap.has(uniqueKey)) {
                 uniqueContactsMap.set(uniqueKey, contact);
             }
        });
        
        // Load existing to prevent global duplicates
        const existingContacts = await getContacts();
        const existingIdentifiers = new Set<string>();
        existingContacts.forEach(c => {
            if (c.e164_number) existingIdentifiers.add('phone_' + c.e164_number.replace(/\D/g, ''));
            if (c.email) existingIdentifiers.add('email_' + c.email.toLowerCase());
            if (c.instagram_handle) existingIdentifiers.add('ig_' + c.instagram_handle.toLowerCase().replace(/^@+/, ''));
        });
        
        const blacklist = await getBlacklist();
        const blacklistedPhones = new Set(blacklist.map(b => String(b.e164_number || '').replace(/\D/g, '')));

        const newUniqueContactsData = Array.from(uniqueContactsMap.values()).filter(contact => {
            const phoneDigits = contact.e164_number ? String(contact.e164_number).replace(/\D/g, '') : '';
            
            if (phoneDigits && (existingIdentifiers.has('phone_' + phoneDigits) || blacklistedPhones.has(phoneDigits))) return false;
            if (contact.email && existingIdentifiers.has('email_' + contact.email.toLowerCase())) return false;
            if (contact.instagram_handle && existingIdentifiers.has('ig_' + contact.instagram_handle.toLowerCase().replace(/^@+/, ''))) return false;
            
            return true;
        });

        if (totalBeforeDedup > 0 && newUniqueContactsData.length === 0) {
            console.warn(`[Crawl Alert] Encontrados ${totalBeforeDedup} contatos, mas todos já existiam no banco ou estavam na blacklist.`);
            CrawlerLogger.logError("DeduplicationFilter", "Todos os contatos encontrados eram duplicados.", { totalBeforeDedup, niche: params.niche, city: params.city });
        }

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
            // Use Firestore Batches for performance (limit 500)
            const BATCH_SIZE = 500;
            for (let i = 0; i < newContacts.length; i += BATCH_SIZE) {
                const batch = writeBatch(db);
                const chunk = newContacts.slice(i, i + BATCH_SIZE);
                
                chunk.forEach(contact => {
                    const contactToSave = { ...contact, found_at: Timestamp.fromDate(contact.found_at) };
                    Object.keys(contactToSave).forEach(key => {
                        if ((contactToSave as any)[key] === undefined) {
                            delete (contactToSave as any)[key];
                        }
                    });
                    batch.set(doc(db, 'contacts', contact.id), contactToSave);
                });
                
                await batch.commit();
            }
        }
        
        // Update Job Status
        await updateDoc(doc(db, 'jobs', jobId), {
            status: 'completed',
            contacts_found: newContacts.length
        });

    } catch (error) {
        CrawlerLogger.logError("startCrawl", error, { params });
        try {
            await updateDoc(doc(db, 'jobs', jobId), {
                status: 'failed'
            });
        } catch (updateErr) {
            console.error("Failed to update job status to failed", updateErr);
        }
    }
    
    // Refresh local newJob state for return
    const finalJobSnap = await getDoc(doc(db, 'jobs', jobId));
    return convertTimestamps(finalJobSnap.data()) as CrawlJob;
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

export const importContacts = async (contactsData: Partial<Contact>[], jobId: string): Promise<number> => {
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error("Unauthenticated");

    const batch = writeBatch(db);
    let count = 0;

    for (const data of contactsData) {
        const id = `import_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const contact: any = {
            ...data,
            id,
            job_id: jobId,
            found_at: Timestamp.now(),
            status: data.status || 'new',
            uid,
            source_type: data.source_type || 'import'
        };

        // Strip undefined
        Object.keys(contact).forEach(key => {
            if (contact[key] === undefined) delete contact[key];
        });

        const docRef = doc(db, 'contacts', id);
        batch.set(docRef, contact);
        count++;
        
        // Batch limit is 500
        if (count % 450 === 0) {
            await batch.commit();
        }
    }

    if (count % 450 !== 0) {
        await batch.commit();
    }

    return count;
};

export const addManualContact = async (contactData: Partial<Contact>): Promise<string> => {
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error("Unauthenticated");

    const id = `manual_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const contact: any = {
        ...contactData,
        id,
        found_at: Timestamp.now(),
        status: contactData.status || 'new',
        uid,
        source_type: 'manual',
        job_id: contactData.job_id || 'manual_list'
    };

    // Strip undefined
    Object.keys(contact).forEach(key => {
        if (contact[key] === undefined) delete contact[key];
    });

    await setDoc(doc(db, 'contacts', id), contact);
    return id;
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

export const createManualJob = async (name: string, niche: string = 'Manual Import'): Promise<string> => {
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error("Unauthenticated");

    const id = `job_manual_${Date.now()}`;
    const newJob: any = {
        id,
        name,
        niche,
        status: 'completed',
        contacts_found: 0,
        created_at: Timestamp.now(),
        uid,
        sources: ['manual'],
        max_pages_per_source: 1
    };

    await setDoc(doc(db, 'jobs', id), newJob);
    return id;
};

export const updateJobName = async (jobId: string, name: string): Promise<void> => {
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error("User must be authenticated to update a job.");
    try {
        await updateDoc(doc(db, 'jobs', jobId), { name });
    } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `jobs/${jobId}`);
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
        const result = await ai.models.generateContent({
            // ... (rest of config)
            model: "gemini-3-flash-preview",
            contents: `Analyze the following URL and extract detailed information specifically about the entity (person or business) named "${contact.name}".
            
            IMPORTANT CONSTRAINTS:
            1. Do NOT extract support or generic emails from the platform itself (e.g., @google.com, @google-maps.com, @instagram.com, @facebook.com, @doctoralia.com.br, @linkedin.com).
            2. The description MUST be about "${contact.name}" and their services/profile, NOT about the platform.
            3. If no specific email for this entity is found, return an empty string for the email field.
            4. Extract official LinkedIn profile URLs, Instagram handles (@user), Facebook pages, and official website URLs if visible.
            5. Lead quality score (1-10) should reflect how good this lead is for a multi-channel outreach.
            6. MANDATORY: Find a VALID profile picture URL (avatar). 
               - A VALID URL must end with an image extension (.jpg, .png, .webp) or contain a direct CDN link (fbcdn.net, cdninstagram.com, ggpht.com).
               - DO NOT return a page link (e.g., instagram.com/p/...) as a photo_url.
               - Look for 'og:image' or 'twitter:image' meta tags.
               - FOR WHATSAPP: Search the phone ${contact.e164_number} in professional directories.
               - IF NO IMAGE IS FOUND: Return an empty string or null. DO NOT guess a broken URL.
               - Use Google Search extensively to verify the "Profile Image" of ${contact.name}.

            Entity Name: ${contact.name}
            Entity Category: ${contact.category}
            URL: ${contact.source_url}`,
            config: {
                tools: [{ urlContext: {} }, { googleSearch: {} }],
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        email: { type: Type.STRING },
                        description: { type: Type.STRING },
                        account_type: { type: Type.STRING, enum: ['personal', 'business', 'unknown'] },
                        lead_quality: { type: Type.NUMBER },
                        photo_url: { type: Type.STRING },
                        linkedin_url: { type: Type.STRING },
                        instagram_handle: { type: Type.STRING },
                        facebook_url: { type: Type.STRING },
                        website: { type: Type.STRING }
                    },
                    required: ["email", "description", "account_type", "lead_quality"]
                }
            }
        });

        const enrichmentData = JSON.parse(result.text || '{}');
        
        // Normalize handle
        if (enrichmentData.instagram_handle) {
            enrichmentData.instagram_handle = enrichmentData.instagram_handle.replace(/^@+/, '');
        }
        
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