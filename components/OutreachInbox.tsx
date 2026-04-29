
import React, { useState, useEffect } from 'react';
import { Avatar } from './Avatar';
import { MailIcon, MessageSquareIcon, UserIcon, ClockIcon, SendIcon, CheckCircleIcon, XIcon, PlusIcon, SparklesIcon, Trash2Icon, SendHorizonalIcon, SearchIcon, FilterIcon, Edit2Icon, CheckIcon, BuildingIcon, MapPinIcon } from 'lucide-react';
import { LinkedInIcon } from './icons/LinkedInIcon';
import { InstagramIcon } from './icons/InstagramIcon';
import { Contact, MessageTemplate, OutreachCampaign, OutreachInteraction, CrawlJob } from '../types';
import { getContacts, updateContact, getJobs, updateJobName } from '../services/crawlerService';
import { templateService, campaignService, interactionService } from '../services/campaignService';
import { LoaderIcon } from './icons/LoaderIcon';
import CampaignModal from './CampaignModal';
import TemplateModal from './TemplateModal';

interface OutreachInboxProps {
    jobs: CrawlJob[];
    onJobsUpdate: () => void;
}

const OutreachInbox: React.FC<OutreachInboxProps> = ({ jobs, onJobsUpdate }) => {
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [selectedJobId, setSelectedJobId] = useState<string | 'all'>('all');
    
    const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
    const [interactions, setInteractions] = useState<OutreachInteraction[]>([]);
    const [templates, setTemplates] = useState<MessageTemplate[]>([]);
    const [campaigns, setCampaigns] = useState<OutreachCampaign[]>([]);
    
    const [isLoading, setIsLoading] = useState(true);
    const [isSending, setIsSending] = useState(false);
    const [newMessage, setNewMessage] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [activeChannel, setActiveChannel] = useState<'email' | 'linkedin' | 'instagram' | 'whatsapp'>('whatsapp');
    
    // Modals
    const [showCampaignModal, setShowCampaignModal] = useState(false);
    const [showTemplateModal, setShowTemplateModal] = useState(false);
    const [editingJobId, setEditingJobId] = useState<string | null>(null);
    const [tempJobName, setTempJobName] = useState('');
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    const replaceVariables = (text: string, contact: Contact) => {
        const vars: Record<string, string> = {
            nome: contact.name || 'parceiro',
            empresa: contact.name || 'empresa',
          nicho: contact.niche || 'segmento',
          cidade: contact.city || 'região',
        };
      
        return text.replace(/\{(\w+)\}/gi, (match, p1) => {
          const key = p1.toLowerCase();
          return vars[key] || match;
        });
      };

    useEffect(() => {
        fetchInitialData();
    }, []);

    useEffect(() => {
        if (selectedContact) {
            fetchInteractions(selectedContact.id);
            // Auto-detect best channel
            if (selectedContact.linkedin_url) setActiveChannel('linkedin');
            else if (selectedContact.instagram_handle) setActiveChannel('instagram');
            else if (selectedContact.email) setActiveChannel('email');
            else setActiveChannel('whatsapp');
        } else {
            setInteractions([]);
        }
    }, [selectedContact]);

    const fetchInitialData = async () => {
        setIsLoading(true);
        try {
            const [fetchedContacts, fetchedTemplates, fetchedCampaigns] = await Promise.all([
                getContacts(),
                templateService.getTemplates(),
                campaignService.getCampaigns()
            ]);
            await onJobsUpdate();
            setContacts(fetchedContacts);
            setTemplates(fetchedTemplates);
            setCampaigns(fetchedCampaigns);
        } catch (error) {
            console.error("Error fetching outreach data:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchInteractions = async (contactId: string) => {
        try {
            const history = await interactionService.getInteractions(contactId);
            setInteractions(history);
        } catch (error) {
            console.error("Error fetching interactions:", error);
        }
    };

    const handleCampaignSuccess = () => {
        setSuccessMessage("Campanha criada com sucesso! Você pode acompanhar o progresso na aba 'Campanhas'.");
        fetchInitialData();
        setTimeout(() => setSuccessMessage(null), 8000);
    };

    const handleRenameJob = async (jobId: string) => {
        if (!tempJobName.trim()) {
            setEditingJobId(null);
            return;
        }
        try {
            await updateJobName(jobId, tempJobName);
            await onJobsUpdate();
            setEditingJobId(null);
        } catch (error) {
            console.error("Error renaming job:", error);
        }
    };

    const filteredContacts = contacts.filter(c => {
        const matchesJob = selectedJobId === 'all' || c.job_id === selectedJobId;
        const query = searchQuery.toLowerCase();
        const matchesSearch = 
            (c.name || '').toLowerCase().includes(query) || 
            (c.e164_number || '').includes(searchQuery) ||
            (c.email || '').toLowerCase().includes(query) ||
            (c.instagram_handle || '').toLowerCase().includes(query) ||
            (c.linkedin_url || '').toLowerCase().includes(query);
            
        return matchesJob && matchesSearch;
    });

    const handleSendMessage = async () => {
        if (!selectedContact || !newMessage.trim()) return;

        setIsSending(true);
        try {
            const encodedMessage = encodeURIComponent(newMessage);
            let externalUrl = '';

            // Clipboard logic for platforms where pre-fill is hard
            if (['linkedin', 'instagram'].includes(activeChannel)) {
                await navigator.clipboard.writeText(newMessage);
            }

            switch (activeChannel) {
                case 'whatsapp':
                    if (selectedContact.e164_number) {
                        const cleanPhone = selectedContact.e164_number.replace(/\D/g, '');
                        externalUrl = `https://web.whatsapp.com/send?phone=${cleanPhone}&text=${encodedMessage}`;
                    }
                    break;
                case 'linkedin':
                    if (selectedContact.linkedin_url) {
                        externalUrl = selectedContact.linkedin_url.includes('messaging') 
                            ? selectedContact.linkedin_url 
                            : `${selectedContact.linkedin_url.replace(/\/$/, '')}/`;
                    }
                    break;
                case 'instagram':
                    if (selectedContact.instagram_handle) {
                        externalUrl = `https://www.instagram.com/${selectedContact.instagram_handle.replace('@', '')}/`;
                    }
                    break;
                case 'email':
                    if (selectedContact.email) {
                        externalUrl = `mailto:${selectedContact.email}?subject=Contato&body=${encodedMessage}`;
                    }
                    break;
            }

            if (externalUrl) {
                window.open(externalUrl, '_blank');
            }

            await interactionService.logInteraction(selectedContact.id, {
                type: activeChannel,
                direction: 'outbound',
                content: newMessage,
                status: 'sent'
            });
            
            const successMsg = ['linkedin', 'instagram'].includes(activeChannel) 
                ? "Texto copiado! Cole no chat da rede social." 
                : "Plataforma aberta!";
            
            setSuccessMessage(successMsg);
            setTimeout(() => setSuccessMessage(null), 5000);

            setNewMessage('');
            fetchInteractions(selectedContact.id);
            // Update local contacts list status
            setContacts(prev => prev.map(c => c.id === selectedContact.id ? { ...c, status: 'contacted' } : c));
        } catch (error) {
            console.error("Error sending message:", error);
        } finally {
            setIsSending(false);
        }
    };

    const channelIcons = {
        linkedin: <LinkedInIcon />,
        instagram: <InstagramIcon />,
        email: <MailIcon size={16} className="text-purple-400" />,
        whatsapp: <MessageSquareIcon size={16} className="text-emerald-400" />
    };

    if (isLoading) {
        return <div className="h-[80vh] flex items-center justify-center"><LoaderIcon /></div>;
    }

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {showCampaignModal && (
                <CampaignModal 
                    isOpen={showCampaignModal} 
                    onClose={() => setShowCampaignModal(false)} 
                    onSuccess={handleCampaignSuccess} 
                />
            )}
            {showTemplateModal && (
                <TemplateModal 
                    isOpen={showTemplateModal} 
                    onClose={() => setShowTemplateModal(false)} 
                    onSuccess={fetchInitialData} 
                />
            )}

            {successMessage && (
                <div className="bg-emerald-900/20 border border-emerald-500/30 p-4 rounded-2xl flex items-center justify-between text-emerald-400 text-sm animate-in slide-in-from-top-4 duration-300">
                    <div className="flex items-center gap-3">
                        <CheckCircleIcon size={20} />
                        {successMessage}
                    </div>
                    <button onClick={() => setSuccessMessage(null)} className="text-emerald-400/50 hover:text-emerald-400">
                        <XIcon size={16} />
                    </button>
                </div>
            )}

            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h2 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
                    <MessageSquareIcon className="text-sky-500" /> Outreach & Inbox
                </h2>
                <div className="flex gap-2">
                    <button 
                        onClick={() => setShowTemplateModal(true)}
                        className="bg-gray-800 hover:bg-gray-700 text-gray-300 px-4 py-2 rounded-xl border border-gray-700 text-sm font-bold transition-all flex items-center gap-2"
                    >
                        <PlusIcon size={16} /> Templates
                    </button>
                    <button 
                        onClick={() => setShowCampaignModal(true)}
                        className="bg-sky-600 hover:bg-sky-500 text-white px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 shadow-lg shadow-sky-900/20"
                    >
                        <SendIcon size={16} /> Nova Campanha
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-[75vh]">
                {/* List of Jobs (Navigation) */}
                <div className="bg-gray-800 rounded-2xl border border-gray-700 flex flex-col overflow-hidden shadow-2xl">
                    <div className="p-4 border-b border-gray-700 bg-gray-900/40 font-bold text-gray-400 text-xs uppercase tracking-widest flex items-center justify-between">
                        Listas / Pesquisas
                        <FilterIcon size={14} />
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
                        <button 
                            onClick={() => setSelectedJobId('all')}
                            className={`w-full text-left p-3 rounded-xl text-sm transition-all flex items-center justify-between group ${selectedJobId === 'all' ? 'bg-sky-600 text-white shadow-lg' : 'text-gray-400 hover:bg-gray-700/50'}`}
                        >
                            <span className="font-bold flex items-center gap-2">
                                <SearchIcon size={16} /> Todos os Leads
                            </span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${selectedJobId === 'all' ? 'bg-sky-500' : 'bg-gray-900 text-gray-500'}`}>{contacts.length}</span>
                        </button>
                        
                        {jobs.map(job => (
                            <div key={job.id} className="relative group/job">
                                <button 
                                    onClick={() => setSelectedJobId(job.id)}
                                    className={`w-full text-left p-3 rounded-xl text-sm transition-all flex items-center justify-between group ${selectedJobId === job.id ? 'bg-sky-900/40 text-sky-400 border border-sky-500/30' : 'text-gray-400 hover:bg-gray-700/50'}`}
                                >
                                    <div className="flex flex-col truncate pr-6">
                                        {editingJobId === job.id ? (
                                            <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                                                <input 
                                                    autoFocus
                                                    value={tempJobName}
                                                    onChange={e => setTempJobName(e.target.value)}
                                                    onKeyDown={e => {
                                                        if (e.key === 'Enter') handleRenameJob(job.id);
                                                        if (e.key === 'Escape') setEditingJobId(null);
                                                    }}
                                                    className="bg-gray-900 border border-sky-500/50 rounded px-2 py-0.5 text-xs text-white outline-none w-full"
                                                />
                                                <button onClick={() => handleRenameJob(job.id)} className="text-emerald-400 hover:text-emerald-300">
                                                    <CheckIcon size={14} />
                                                </button>
                                            </div>
                                        ) : (
                                            <>
                                                <span className="font-bold truncate">{job.name || job.niche}</span>
                                                <span className="text-[10px] opacity-60 truncate">{job.city || 'Geral'}</span>
                                            </>
                                        )}
                                    </div>
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${selectedJobId === job.id ? 'bg-sky-900/50 text-sky-300' : 'bg-gray-900 text-gray-500'}`}>
                                        {contacts.filter(c => c.job_id === job.id).length}
                                    </span>
                                </button>
                                {editingJobId !== job.id && (
                                    <button 
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setEditingJobId(job.id);
                                            setTempJobName(job.name || job.niche);
                                        }}
                                        className="absolute right-8 top-3.5 p-1 text-gray-500 hover:text-sky-400 opacity-0 group-hover/job:opacity-100 transition-opacity"
                                    >
                                        <Edit2Icon size={12} />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* List of Contacts */}
                <div className="bg-gray-800 rounded-2xl border border-gray-700 flex flex-col overflow-hidden shadow-2xl">
                    <div className="p-4 border-b border-gray-700 bg-gray-800/50">
                        <input 
                            type="text" 
                            placeholder="Buscar leads..." 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-500 shadow-inner"
                        />
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                        {filteredContacts.length === 0 ? (
                            <div className="p-10 text-center text-gray-500 text-sm">Nenhum lead nesta lista.</div>
                        ) : (
                            filteredContacts.map(contact => (
                                <div 
                                    key={contact.id} 
                                    onClick={() => setSelectedContact(contact)}
                                    className={`p-4 border-b border-gray-700/50 hover:bg-gray-700/30 cursor-pointer transition-colors group ${selectedContact?.id === contact.id ? 'bg-sky-900/20 border-l-4 border-l-sky-500 shadow-inner' : ''}`}
                                >
                                    <div className="flex justify-between items-start mb-1">
                                        <div className="flex items-center gap-3">
                                            <Avatar 
                                                src={contact.photo_url} 
                                                name={contact.name} 
                                                size="sm" 
                                                accountType={contact.account_type as any}
                                                fallbackIcon={(channelIcons as any)[contact.email ? 'email' : (contact.linkedin_url ? 'linkedin' : (contact.instagram_handle ? 'instagram' : 'whatsapp'))]}
                                            />
                                            <span className="text-sm font-bold text-gray-200 group-hover:text-white transition-colors truncate max-w-[120px]">
                                                {contact.name || contact.e164_number || (contact.instagram_handle ? `@${contact.instagram_handle.replace(/^@+/, '')}` : 'Sem nome')}
                                            </span>
                                        </div>
                                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
                                            contact.status === 'interested' ? 'bg-green-900/30 text-green-400' :
                                            contact.status === 'contacted' ? 'bg-sky-900/30 text-sky-400' : 'bg-gray-900/30 text-gray-500'
                                        }`}>
                                            {contact.status}
                                        </span>
                                    </div>
                                    <p className="text-[10px] text-gray-500 truncate">{contact.category || contact.source_type}</p>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Chat Panel */}
                <div className="lg:col-span-2 bg-gray-800 rounded-2xl border border-gray-700 flex flex-col shadow-2xl relative overflow-hidden">
                    {selectedContact ? (
                        <>
                            {/* Chat Header */}
                            <div className="p-4 border-b border-gray-700 bg-gray-900/40 flex justify-between items-center">
                                <div className="flex items-center gap-3">
                                    <Avatar 
                                        src={selectedContact.photo_url} 
                                        name={selectedContact.name} 
                                        size="lg" 
                                        accountType={selectedContact.account_type as any}
                                        className="border-sky-500/20"
                                    />
                                    <div>
                                        <h4 className="text-sm font-bold text-white leading-tight">{selectedContact.name || 'Sem Nome'}</h4>
                                        <div className="flex gap-2">
                                            {selectedContact.email && (
                                                <button 
                                                    onClick={() => setActiveChannel('email')}
                                                    className={`text-[9px] px-1.5 rounded transition-colors ${activeChannel === 'email' ? 'bg-purple-600 text-white' : 'bg-purple-900/20 text-purple-400 hover:bg-purple-900/40'}`}
                                                >
                                                    {selectedContact.email}
                                                </button>
                                            )}
                                            {selectedContact.linkedin_url && (
                                                <button 
                                                    onClick={() => setActiveChannel('linkedin')}
                                                    className={`text-[9px] px-1.5 rounded transition-colors ${activeChannel === 'linkedin' ? 'bg-blue-600 text-white' : 'bg-blue-900/20 text-blue-400 hover:bg-blue-900/40'}`}
                                                >
                                                    LinkedIn
                                                </button>
                                            )}
                                            {selectedContact.instagram_handle && (
                                                <button 
                                                    onClick={() => setActiveChannel('instagram')}
                                                    className={`text-[9px] px-1.5 rounded transition-colors ${activeChannel === 'instagram' ? 'bg-pink-600 text-white' : 'bg-pink-900/20 text-pink-400 hover:bg-pink-900/40'}`}
                                                >
                                                    @{selectedContact.instagram_handle.replace(/^@+/, '')}
                                                </button>
                                            )}
                                            <button 
                                                onClick={() => setActiveChannel('whatsapp')}
                                                className={`text-[9px] px-1.5 rounded transition-colors ${activeChannel === 'whatsapp' ? 'bg-emerald-600 text-white' : 'bg-emerald-900/20 text-emerald-400 hover:bg-emerald-900/40'}`}
                                            >
                                                WhatsApp
                                            </button>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <select 
                                        value={selectedContact.status}
                                        onChange={(e) => {
                                            const newStatus = e.target.value as any;
                                            updateContact(selectedContact.id, { status: newStatus });
                                            setSelectedContact({ ...selectedContact, status: newStatus });
                                            setContacts(prev => prev.map(c => c.id === selectedContact.id ? { ...c, status: newStatus } : c));
                                        }}
                                        className="bg-gray-900 border border-gray-700 text-[10px] text-white rounded px-2 py-1 outline-none"
                                    >
                                        <option value="new">Novo</option>
                                        <option value="contacted">Contatado</option>
                                        <option value="interested">Interessado</option>
                                        <option value="converted">Convertido</option>
                                        <option value="rejected">Rejeitado</option>
                                    </select>
                                </div>
                            </div>

                            {/* Interactions History */}
                            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-gray-900/20">
                                {interactions.length === 0 ? (
                                    <div className="h-full flex flex-col items-center justify-center text-center p-8">
                                        <div className="w-16 h-16 bg-gray-800 rounded-2xl flex items-center justify-center mb-4 text-gray-600 border border-gray-700">
                                            <ClockIcon size={32} />
                                        </div>
                                        <p className="text-sm text-gray-500">Nenhum histórico de conversa ainda.</p>
                                        <p className="text-xs text-gray-600 mt-1">Inicie o contato usando um template ou escreva manualmente abaixo.</p>
                                    </div>
                                ) : (
                                    interactions.map(int => (
                                        <div key={int.id} className={`flex ${int.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}>
                                            <div className={`max-w-[80%] p-3 rounded-2xl text-sm shadow-md relative group/msg ${
                                                int.direction === 'outbound' 
                                                ? 'bg-sky-600 text-white rounded-br-none border border-sky-500/30' 
                                                : 'bg-gray-700 text-gray-200 rounded-bl-none border border-gray-600/30'
                                            }`}>
                                                <div className={`flex items-center gap-1 mb-1 px-1.5 py-0.5 rounded-full text-[8px] uppercase font-bold w-fit ${
                                                    int.type === 'linkedin' ? 'bg-blue-900/40 text-blue-300' :
                                                    int.type === 'instagram' ? 'bg-pink-900/40 text-pink-300' :
                                                    int.type === 'email' ? 'bg-purple-900/40 text-purple-300' : 'bg-emerald-900/40 text-emerald-300'
                                                }`}>
                                                    {(channelIcons as any)[int.type]}
                                                    {int.type}
                                                </div>
                                                <p className="leading-relaxed">{int.content}</p>
                                                <div className="text-[9px] mt-1 text-right opacity-50 font-mono">
                                                    {new Date(int.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>

                            {/* Chat Input */}
                            <div className="p-4 bg-gray-800 border-t border-gray-700">
                                <div className="flex gap-2">
                                    <div className="flex-1 relative">
                                        <textarea 
                                            value={newMessage}
                                            onChange={(e) => setNewMessage(e.target.value)}
                                            placeholder="Escreva uma mensagem..."
                                            className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-2 pr-12 text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-500 resize-none h-12"
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' && !e.shiftKey) {
                                                    e.preventDefault();
                                                    handleSendMessage();
                                                }
                                            }}
                                        />
                                        <button 
                                            onClick={handleSendMessage}
                                            disabled={isSending || !newMessage.trim()}
                                            className="absolute right-2 top-2 p-2 text-sky-400 hover:text-sky-300 transition-colors disabled:opacity-50"
                                        >
                                            {isSending ? <LoaderIcon /> : <SendHorizonalIcon size={20} />}
                                        </button>
                                    </div>
                                </div>
                                <div className="mt-2 flex gap-2">
                                    <select 
                                        onChange={(e) => {
                                            const body = e.target.value;
                                            if (body && selectedContact) {
                                                setNewMessage(replaceVariables(body, selectedContact));
                                            }
                                        }}
                                        className="bg-gray-900 border border-gray-700 text-[10px] text-gray-400 rounded px-2 py-1 outline-none"
                                    >
                                        <option value="">Rápido: Templates</option>
                                        {templates.map(t => <option key={t.id} value={t.base_content}>{t.name}</option>)}
                                    </select>
                                    <div className="flex gap-4 text-[9px] text-gray-600 mt-1 pl-1">
                                        <span>{`{nome}`}</span>
                                        <span>{`{empresa}`}</span>
                                        <span>{`{nicho}`}</span>
                                        <span>{`{cidade}`}</span>
                                    </div>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
                            <div className="absolute inset-0 bg-gradient-to-br from-sky-600/5 to-transparent pointer-events-none" />
                            <div className="w-20 h-20 bg-gray-900 rounded-3xl flex items-center justify-center mb-6 border border-gray-700 shadow-xl transform rotate-3">
                                <MessageSquareIcon size={40} className="text-gray-600" />
                            </div>
                            <h3 className="text-2xl font-bold text-white mb-2">Selecione um lead</h3>
                            <p className="text-gray-400 max-w-sm">
                                Escolha um contato à esquerda para iniciar a conversa ou ver o histórico de interações.
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* Stats Card */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-gray-800 p-4 rounded-xl border border-gray-700 flex items-center gap-4">
                    <div className="w-10 h-10 bg-sky-900/30 rounded-lg flex items-center justify-center text-sky-400">
                        <SendIcon size={20} />
                    </div>
                    <div>
                        <p className="text-xs text-gray-500 font-bold uppercase">Enviados (Hoje)</p>
                        <p className="text-xl font-bold text-white">{campaigns.reduce((acc, c) => acc + (c.sent_today || 0), 0)}</p>
                    </div>
                </div>
                <div className="bg-gray-800 p-4 rounded-xl border border-gray-700 flex items-center gap-4">
                    <div className="w-10 h-10 bg-purple-900/30 rounded-lg flex items-center justify-center text-purple-400">
                        <MailIcon size={20} />
                    </div>
                    <div>
                        <p className="text-xs text-gray-500 font-bold uppercase">Taxa de Abertura</p>
                        <p className="text-xl font-bold text-white">24.5%</p>
                    </div>
                </div>
                <div className="bg-gray-800 p-4 rounded-xl border border-gray-700 flex items-center gap-4">
                    <div className="w-10 h-10 bg-emerald-900/30 rounded-lg flex items-center justify-center text-emerald-400">
                        <CheckCircleIcon size={20} />
                    </div>
                    <div>
                        <p className="text-xs text-gray-500 font-bold uppercase">Convertidos</p>
                        <p className="text-xl font-bold text-white">{contacts.filter(c => c.status === 'converted').length}</p>
                    </div>
                </div>
                <div className="bg-gray-800 p-4 rounded-xl border border-gray-700 flex items-center gap-4">
                    <div className="w-10 h-10 bg-orange-900/30 rounded-lg flex items-center justify-center text-orange-400">
                        <UserIcon size={20} />
                    </div>
                    <div>
                        <p className="text-xs text-gray-500 font-bold uppercase">Leads Ativos</p>
                        <p className="text-xl font-bold text-white">{contacts.filter(c => ['contacted', 'interested'].includes(c.status)).length}</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default OutreachInbox;
