import React, { useState, useEffect } from 'react';
import { XIcon, PlusIcon, Trash2Icon, ClockIcon, SendIcon, SparklesIcon, AlertCircleIcon, LayersIcon, MapPinIcon, GlobeIcon } from 'lucide-react';
import { InstagramIcon as InstaIcon } from './icons/InstagramIcon';
import { LinkedInIcon as Linkedin } from './icons/LinkedInIcon';
import { campaignService, templateService } from '../services/campaignService';
import { getJobs } from '../services/crawlerService';
import { CrawlJob, MessageTemplate, CampaignStep } from '../types';
import { LoaderIcon } from './icons/LoaderIcon';

interface CampaignModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

const CampaignModal: React.FC<CampaignModalProps> = ({ isOpen, onClose, onSuccess }) => {
    const [name, setName] = useState('');
    const [channel, setChannel] = useState<'email' | 'linkedin' | 'instagram' | 'whatsapp' | 'omnichannel'>('whatsapp');
    const [dailyLimit, setDailyLimit] = useState(50);
    const [selectedJobIds, setSelectedJobIds] = useState<string[]>([]);
    const [steps, setSteps] = useState<CampaignStep[]>([]);
    
    const [jobs, setJobs] = useState<CrawlJob[]>([]);
    const [templates, setTemplates] = useState<MessageTemplate[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!isOpen) return;
        fetchData();
    }, [isOpen]);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [fetchedJobs, fetchedTemplates] = await Promise.all([
                getJobs(),
                templateService.getTemplates()
            ]);
            setJobs(fetchedJobs);
            setTemplates(fetchedTemplates);
            
            // Add initial step based on channel
            if (steps.length === 0) {
                addStep();
            }
        } catch (error) {
            console.error("Error fetching campaign data:", error);
            setError("Falha ao carregar dados para a campanha.");
        } finally {
            setIsLoading(false);
        }
    };

    const addStep = () => {
        const newStep: CampaignStep = {
            id: `step_${Date.now()}`,
            type: steps.length === 0 && channel === 'linkedin' ? 'invitation' : 'message',
            order: steps.length,
            template_id: '',
            delay_hours: steps.length === 0 ? 0 : 24
        };
        setSteps(prev => [...prev, newStep]);
    };

    const removeStep = (id: string) => {
        setSteps(prev => prev.filter(s => s.id !== id).map((s, i) => ({ ...s, order: i })));
    };

    const updateStep = (id: string, updates: Partial<CampaignStep>) => {
        setSteps(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
    };

    const toggleJob = (jobId: string) => {
        setSelectedJobIds(prev => 
            prev.includes(jobId) ? prev.filter(id => id !== jobId) : [...prev, jobId]
        );
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (selectedJobIds.length === 0) {
            setError("Selecione pelo menos uma lista de leads.");
            return;
        }
        if (steps.length === 0) {
            setError("Adicione pelo menos um passo na campanha.");
            return;
        }

        setIsSubmitting(true);
        setError(null);
        try {
            await campaignService.createCampaign({
                name,
                channel,
                daily_limit: dailyLimit,
                job_ids: selectedJobIds,
                steps: steps.map((s, i) => ({ ...s, order: i })),
                status: 'active'
            });
            onSuccess();
            onClose();
        } catch (error) {
            console.error("Error creating campaign:", error);
            setError("Erro ao criar campanha. Verifique sua conexão.");
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
            <div className="bg-gray-800 border border-gray-700 rounded-3xl shadow-2xl w-full max-w-4xl my-8 animate-in zoom-in duration-300 overflow-hidden flex flex-col max-h-[90vh]">
                <div className="px-8 py-6 border-b border-gray-700 flex justify-between items-center bg-gray-900/50">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-sky-600 rounded-2xl flex items-center justify-center shadow-lg transform -rotate-3">
                            <LayersIcon className="text-white" size={24} />
                        </div>
                        <div>
                            <h3 className="text-2xl font-bold text-white tracking-tight">Configurar Nova Campanha</h3>
                            <p className="text-gray-400 text-sm">Defina sua sequência e público-alvo.</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors p-2 hover:bg-gray-700 rounded-full">
                        <XIcon size={24} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto custom-scrollbar p-8 space-y-8">
                    {/* Basic Settings */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="md:col-span-2">
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2 ml-1 tracking-widest">Nome da Campanha</label>
                            <input 
                                required
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="w-full bg-gray-900 border border-gray-700 rounded-2xl px-5 py-3 text-white focus:ring-2 focus:ring-sky-500 shadow-inner outline-none transition-all"
                                placeholder="Ex: Prospecção Médicos RJ - LinkedIn"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2 ml-1 tracking-widest">Limite Diário</label>
                            <input 
                                type="number"
                                value={dailyLimit}
                                onChange={(e) => setDailyLimit(Number(e.target.value))}
                                className="w-full bg-gray-900 border border-gray-700 rounded-2xl px-5 py-3 text-white focus:ring-2 focus:ring-sky-500 shadow-inner outline-none transition-all"
                                min="1"
                                max="200"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Target Lists */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <label className="block text-xs font-bold text-gray-500 uppercase ml-1 tracking-widest">Público-Alvo (Listas)</label>
                                <span className="text-[10px] text-sky-400">{selectedJobIds.length} selecionadas</span>
                            </div>
                            <div className="bg-gray-900 rounded-2xl border border-gray-700 h-48 overflow-y-auto p-2 custom-scrollbar space-y-1">
                                {jobs.length === 0 ? (
                                    <div className="p-4 text-center text-gray-600 text-sm">Nenhuma lista encontrada.</div>
                                ) : (
                                    jobs.map(job => (
                                        <label key={job.id} className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all border ${
                                            selectedJobIds.includes(job.id) ? 'bg-sky-600/10 border-sky-500/30 text-sky-300' : 'bg-transparent border-transparent text-gray-400 hover:bg-gray-800'
                                        }`}>
                                            <input 
                                                type="checkbox" 
                                                checked={selectedJobIds.includes(job.id)}
                                                onChange={() => toggleJob(job.id)}
                                                className="w-4 h-4 rounded border-gray-600 bg-gray-900 text-sky-600 focus:ring-sky-500"
                                            />
                                            <div className="flex flex-col truncate flex-1">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-sm font-bold truncate">{job.name || job.niche}</span>
                                                    <div className="flex gap-1">
                                                        {job.sources.includes('instagram_via_search') && <InstaIcon size={10} className="text-pink-500/60" />}
                                                        {job.sources.includes('linkedin_via_search') && <Linkedin size={10} className="text-blue-500/60" />}
                                                        {job.sources.includes('google_maps') && <MapPinIcon size={10} className="text-emerald-500/60" />}
                                                        {job.sources.includes('google') && <GlobeIcon size={10} className="text-sky-500/60" />}
                                                    </div>
                                                </div>
                                                <span className="text-[10px] opacity-60">{job.contacts_found} leads • {job.city || 'Geral'}</span>
                                            </div>
                                        </label>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Channel Selection */}
                        <div className="space-y-4">
                            <label className="block text-xs font-bold text-gray-500 uppercase ml-1 tracking-widest">Canal de Disparo</label>
                            <div className="grid grid-cols-2 gap-3">
                                {[
                                    { id: 'whatsapp', label: 'WhatsApp', color: 'emerald' },
                                    { id: 'linkedin', label: 'LinkedIn', color: 'blue' },
                                    { id: 'instagram', label: 'Instagram', color: 'pink' },
                                    { id: 'email', label: 'E-mail', color: 'purple' }
                                ].map((ch) => (
                                    <button
                                        key={ch.id}
                                        type="button"
                                        onClick={() => setChannel(ch.id as any)}
                                        className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 group ${
                                            channel === ch.id 
                                            ? `bg-${ch.color}-900/20 border-${ch.color}-500 text-${ch.color}-400 shadow-lg` 
                                            : 'bg-gray-900 border-gray-700 text-gray-500 hover:border-gray-600'
                                        }`}
                                    >
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center bg-gray-800 transition-colors ${channel === ch.id ? `bg-${ch.color}-500 text-white` : 'group-hover:text-white'}`}>
                                            {ch.id === 'whatsapp' && <SendIcon size={16} />}
                                            {ch.id === 'linkedin' && <LayersIcon size={16} />}
                                            {ch.id === 'instagram' && <SparklesIcon size={16} />}
                                            {ch.id === 'email' && <AlertCircleIcon size={16} />}
                                        </div>
                                        <span className="text-xs font-bold">{ch.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Sequence Steps */}
                    <div className="space-y-6">
                        <div className="flex items-center justify-between border-b border-gray-700 pb-2">
                            <label className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-widest">
                                <LayersIcon size={16} className="text-sky-500" /> Sequência de Ações
                            </label>
                            <button 
                                type="button" 
                                onClick={addStep}
                                className="text-xs font-bold text-sky-400 hover:text-sky-300 flex items-center gap-1 transition-all"
                            >
                                <PlusIcon size={14} /> Adicionar Passo
                            </button>
                        </div>

                        <div className="space-y-4">
                            {steps.map((step, index) => (
                                <div key={step.id} className="relative bg-gray-900 border border-gray-700 rounded-3xl p-6 transition-all hover:border-gray-600 group">
                                    <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-sky-600 rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-xl">
                                        {index + 1}
                                    </div>
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-end">
                                        <div className="md:col-span-3">
                                            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-2">Ação</label>
                                            <select 
                                                value={step.type}
                                                onChange={(e) => updateStep(step.id, { type: e.target.value as any })}
                                                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-white text-sm outline-none focus:ring-1 focus:ring-sky-500"
                                            >
                                                {channel === 'linkedin' && <option value="invitation">Convite LinkedIn</option>}
                                                <option value="message">Enviar Mensagem</option>
                                                <option value="delay">Aguardar (Delay)</option>
                                            </select>
                                        </div>

                                        {step.type === 'delay' ? (
                                            <div className="md:col-span-7">
                                                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-2">Tempo de Espera</label>
                                                <div className="flex items-center gap-3">
                                                    <ClockIcon className="text-gray-500" size={18} />
                                                    <input 
                                                        type="number"
                                                        value={step.delay_hours || 24}
                                                        onChange={(e) => updateStep(step.id, { delay_hours: Number(e.target.value) })}
                                                        className="w-24 bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-white text-sm"
                                                    />
                                                    <span className="text-gray-400 text-sm font-medium">horas após o passo anterior</span>
                                                </div>
                                            </div>
                                        ) : step.type === 'invitation' ? (
                                            <div className="md:col-span-7">
                                                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-2">Nota de Convite (Opcional)</label>
                                                <textarea 
                                                    value={step.content || ''}
                                                    onChange={(e) => updateStep(step.id, { content: e.target.value })}
                                                    placeholder="Olá {nome}, vi seu perfil..."
                                                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-white text-sm h-10 resize-none"
                                                />
                                            </div>
                                        ) : (
                                            <div className="md:col-span-7">
                                                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-2">Template da Mensagem</label>
                                                <select 
                                                    required
                                                    value={step.template_id}
                                                    onChange={(e) => updateStep(step.id, { template_id: e.target.value })}
                                                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-white text-sm outline-none focus:ring-1 focus:ring-sky-500"
                                                >
                                                    <option value="">Selecione um template</option>
                                                    {templates.filter(t => t.channel === channel || channel === 'omnichannel' || (t.channel as string) === 'whatsapp' && channel === 'omnichannel')
                                                        .map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                                </select>
                                            </div>
                                        )}

                                        <div className="md:col-span-2 flex justify-end">
                                            <button 
                                                type="button" 
                                                onClick={() => removeStep(step.id)}
                                                className="p-2 text-gray-500 hover:text-rose-500 bg-gray-800 hover:bg-gray-700 rounded-xl transition-all"
                                                title="Remover passo"
                                            >
                                                <Trash2Icon size={18} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {error && (
                        <div className="bg-rose-900/20 border border-rose-500/30 p-4 rounded-2xl flex items-center gap-3 text-rose-200 text-sm animate-pulse">
                            <AlertCircleIcon size={20} className="shrink-0" />
                            {error}
                        </div>
                    )}
                </form>

                <div className="px-8 py-6 bg-gray-900/80 border-t border-gray-700 flex justify-end gap-4">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-8 py-3 rounded-2xl text-gray-400 font-bold hover:bg-gray-800 transition-all border border-gray-700"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={isSubmitting || !name || selectedJobIds.length === 0}
                        className="bg-sky-600 hover:bg-sky-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-12 py-3 rounded-2xl font-bold transition-all shadow-xl shadow-sky-900/30 flex items-center gap-3 transform hover:scale-105 active:scale-95"
                    >
                        {isSubmitting ? (
                            <>
                                <span className="animate-spin h-5 w-5 border-3 border-white/30 border-t-white rounded-full"></span>
                                Criando Campanha...
                            </>
                        ) : (
                            <>
                                <SendIcon size={20} />
                                Lançar Campanha 🚀
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CampaignModal;
