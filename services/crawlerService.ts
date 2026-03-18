import { GoogleGenAI, Type } from "@google/genai";
import { CrawlJob, CrawlJobParams, Contact, NormalizedPhone, CrawlSource } from '../types';

// --- Persistence Layer ---
const safeJSONParse = <T>(item: string | null): T | null => {
  if (!item) return null;
  try {
    const data = JSON.parse(item);
    // Revive dates
    if (Array.isArray(data)) {
        data.forEach(obj => {
            if (obj.created_at) obj.created_at = new Date(obj.created_at);
            if (obj.found_at) obj.found_at = new Date(obj.found_at);
        });
    }
    return data;
  } catch (e) {
    console.error("Failed to parse JSON from localStorage", e);
    return null;
  }
};

const loadFromStorage = <T>(key: string, defaultValue: T): T => {
    return safeJSONParse<T>(localStorage.getItem(key)) || defaultValue;
};

const saveToStorage = <T>(key: string, data: T) => {
    localStorage.setItem(key, JSON.stringify(data));
};

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const generateId = () => `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// FIX: Define a specific type for the contact data returned by Gemini to ensure type safety.
type GeminiContact = Omit<Contact, 'id' | 'job_id' | 'found_at' | 'niche' | 'category' | 'city' | 'source_type'>;

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
                contacts = list.map((item: any) => ({
                    name: item.name || 'Não informado',
                    e164_number: item.whatsapp || item.phone,
                    raw_number: item.whatsapp || item.phone,
                    address: item.address || undefined,
                    source_url: item.source || 'N/A',
                }));
             }
        }
    } catch (e) {
        console.warn("Primary JSON parsing failed, attempting fallback regex.", e);
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
    // 55 + 2 digit DDD + 9 + 8 digits = 13 digits
    return /^55\d{2}9\d{8}$/.test(digits);
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
            model: "gemini-2.5-flash",
            contents: contactSearchPrompt,
            config: {
                tools: [{ googleSearch: {} }],
                // Removed responseMimeType to allow the model to use the tool more freely before formatting
            }
        });
        return parseGeminiJsonResponse(response.text);
    } catch (error) {
        console.error("Google Search Agent Error:", error);
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
            model: "gemini-2.5-flash",
            contents: contactSearchPrompt,
            config: {
                tools: [{ googleSearch: {} }],
            }
        });
        return parseGeminiJsonResponse(response.text);
    } catch (error) {
        console.error("Instagram Agent Error:", error);
        return [];
    }
}

const getGoogleMapsAgent = async (params: CrawlJobParams): Promise<GeminiContact[]> => {
    if (!params.city) return [];
    
    const contactSearchPrompt = `Busque no Google Maps por "${params.niche}" em "${params.city}".
    
    TAREFA:
    1. Liste 5-10 estabelecimentos encontrados.
    2. Extraia o nome e o telefone (se disponível).
    
    SAÍDA:
    Bloco JSON com a chave "contacts".
    `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: contactSearchPrompt,
            config: {
                tools: [{ googleMaps: {} }],
            }
        });
        return parseGeminiJsonResponse(response.text);
    } catch (error) {
        console.error("Maps Agent Error:", error);
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
            model: "gemini-2.5-flash",
            contents: contactSearchPrompt,
            config: {
                tools: [{ googleSearch: {} }],
            }
        });
        return parseGeminiJsonResponse(response.text);
    } catch (error) {
        console.error("Doctoralia Agent Error:", error);
        return [];
    }
};


export const startCrawl = async (params: CrawlJobParams): Promise<CrawlJob> => {
    let mockJobs = loadFromStorage<CrawlJob[]>('crawler_jobs', []);
    const newJob: CrawlJob = {
      id: generateId(),
      niche: params.niche,
      city: params.city,
      ddd: params.ddd,
      sources: params.sources,
      max_pages_per_source: params.max_pages_per_source,
      status: 'running',
      contacts_found: 0,
      created_at: new Date(),
    };
    mockJobs.unshift(newJob);
    saveToStorage('crawler_jobs', mockJobs);

    try {
        const agentPromises: Promise<{ contacts: GeminiContact[], sourceType: CrawlSource }>[] = [];

        if (params.sources.includes('google')) {
            agentPromises.push(getGoogleSearchAgent(params).then(c => ({ contacts: c, sourceType: 'google' })));
        }
        if (params.sources.includes('instagram_via_search')) {
            agentPromises.push(getInstagramSearchAgent(params).then(c => ({ contacts: c, sourceType: 'instagram_via_search' })));
        }
        if (params.sources.includes('google_maps')) {
            agentPromises.push(getGoogleMapsAgent(params).then(c => ({ contacts: c, sourceType: 'google_maps' })));
        }
        if (params.sources.includes('doctoralia_via_search')) {
            agentPromises.push(getDoctoraliaAgent(params).then(c => ({ contacts: c, sourceType: 'doctoralia_via_search' })));
        }

        if (agentPromises.length === 0) throw new Error("Nenhuma fonte selecionada.");

        const agentResults = await Promise.all(agentPromises);
        
        let allContactsData = agentResults.flatMap(result => {
            return result.contacts.map(contact => ({ ...contact, source_type: result.sourceType }));
        });

        // Deduplication and Sanitation
        const uniqueContactsMap = new Map<string, typeof allContactsData[0]>();
        
        allContactsData.forEach(contact => {
             const phoneDigits = (contact.e164_number || '').replace(/\D/g, '');
             
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
        const mockContacts = loadFromStorage<Contact[]>('crawler_contacts', []);
        const existingPhones = new Set(mockContacts.map(c => c.e164_number.replace(/\D/g, '')));
        
        const newUniqueContactsData = Array.from(uniqueContactsMap.values()).filter(contact => {
            const digits = contact.e164_number.replace(/\D/g, '');
            return !existingPhones.has(digits);
        });

        const newContacts: Contact[] = newUniqueContactsData.map(contactData => ({
            ...contactData,
            id: `contact_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            job_id: newJob.id,
            found_at: new Date(),
            niche: params.niche,
            category: params.niche,
            city: params.city,
        }));
        
        if (newContacts.length > 0) {
            mockContacts.unshift(...newContacts);
            saveToStorage('crawler_contacts', mockContacts);
        }
        
        // Update Job Status
        mockJobs = loadFromStorage<CrawlJob[]>('crawler_jobs', []);
        const jobIndex = mockJobs.findIndex(j => j.id === newJob.id);
        if (jobIndex !== -1) {
            mockJobs[jobIndex].status = 'completed';
            mockJobs[jobIndex].contacts_found = newContacts.length;
            saveToStorage('crawler_jobs', mockJobs);
        }

    } catch (error) {
        console.error("Critical Crawler Error:", error);
        mockJobs = loadFromStorage<CrawlJob[]>('crawler_jobs', []);
        const jobIndex = mockJobs.findIndex(j => j.id === newJob.id);
        if (jobIndex !== -1) {
            mockJobs[jobIndex].status = 'failed';
            saveToStorage('crawler_jobs', mockJobs);
        }
    }
    
    return newJob;
};

export const getJobs = (): Promise<CrawlJob[]> => {
  return new Promise((resolve) => {
    const currentJobs = loadFromStorage<CrawlJob[]>('crawler_jobs', []);
    setTimeout(() => resolve([...currentJobs]), 300);
  });
};

export const getContacts = (jobId?: string): Promise<Contact[]> => {
    return new Promise((resolve) => {
      const currentContacts = loadFromStorage<Contact[]>('crawler_contacts', []);
      setTimeout(() => {
          if (jobId) {
              resolve(currentContacts.filter(c => c.job_id === jobId));
          } else {
              resolve([...currentContacts]);
          }
      }, 300);
    });
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