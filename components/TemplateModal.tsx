import React, { useState } from 'react';
import { XIcon, SparklesIcon, Trash2Icon, CheckCircleIcon, SendIcon, MessageCircleIcon } from 'lucide-react';
import { templateService } from '../services/campaignService';
import { LoaderIcon } from './icons/LoaderIcon';

interface TemplateModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

const TemplateModal: React.FC<TemplateModalProps> = ({ isOpen, onClose, onSuccess }) => {
    const [name, setName] = useState('');
    const [content, setContent] = useState('');
    const [channel, setChannel] = useState<'whatsapp' | 'linkedin' | 'instagram' | 'email'>('whatsapp');
    const [variants, setVariants] = useState<string[]>([]);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [saveStatus, setSaveStatus] = useState<{success: boolean, message: string} | null>(null);

    const handleGenerateVariants = async () => {
        if (!content.trim()) return;
        setIsGenerating(true);
        try {
            const generated = await templateService.generateVariants(content);
            setVariants(generated);
        } catch (error) {
            console.error("Error generating variants:", error);
        } finally {
            setIsGenerating(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setSaveStatus(null);
        try {
            await templateService.saveTemplate({
                name,
                base_content: content,
                variants,
                channel
            });
            setSaveStatus({ success: true, message: 'Template salvo com sucesso!' });
            setTimeout(() => {
                onSuccess();
                onClose();
            }, 1000);
        } catch (error) {
            console.error("Error creating template:", error);
            setSaveStatus({ success: false, message: 'Erro ao salvar template. Tente novamente.' });
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <div className="bg-gray-800 border border-gray-700 rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in duration-300">
                <div className="px-8 py-6 border-b border-gray-700 flex justify-between items-center bg-gray-900/40">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
                            <SparklesIcon className="text-white" size={20} />
                        </div>
                        <h3 className="text-xl font-bold text-white tracking-tight">Criação de Template Anti-Spam</h3>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors p-2 hover:bg-gray-700 rounded-full">
                        <XIcon size={20} />
                    </button>
                </div>
                
                <form onSubmit={handleSubmit} className="p-8 space-y-6 max-h-[80vh] overflow-y-auto custom-scrollbar">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2 ml-1 tracking-widest">Nome do Template</label>
                            <input 
                                required
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="w-full bg-gray-900 border border-gray-700 rounded-2xl px-5 py-3 text-white focus:outline-none focus:ring-2 focus:ring-sky-500 shadow-inner"
                                placeholder="Ex: Contato LinkedIn Frio"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2 ml-1 tracking-widest">Canal</label>
                            <select 
                                value={channel}
                                onChange={(e: any) => setChannel(e.target.value)}
                                className="w-full bg-gray-900 border border-gray-700 rounded-2xl px-5 py-3 text-white focus:outline-none focus:ring-2 focus:ring-sky-500 shadow-inner cursor-pointer"
                            >
                                <option value="whatsapp">WhatsApp</option>
                                <option value="linkedin">LinkedIn</option>
                                <option value="instagram">Instagram</option>
                                <option value="email">E-mail</option>
                            </select>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="block text-xs font-bold text-gray-500 uppercase flex justify-between tracking-widest">
                            Conteúdo Base 
                            <span className="text-sky-400 normal-case font-medium tracking-normal flex gap-3 lowercase">
                                <span>{`{nome}`}</span> <span>{`{empresa}`}</span> <span>{`{nicho}`}</span> <span>{`{cidade}`}</span>
                            </span>
                        </label>
                        <textarea 
                            required
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            className="w-full bg-gray-900 border border-gray-700 rounded-2xl px-5 py-4 text-white h-40 focus:outline-none focus:ring-2 focus:ring-sky-500 leading-relaxed shadow-inner"
                            placeholder="Olá {nome}, vi sua empresa {empresa} e gostaria de propor..."
                        />
                        <button 
                            type="button"
                            onClick={handleGenerateVariants}
                            disabled={isGenerating || !content}
                            className="mt-2 text-sm font-bold text-purple-400 hover:text-purple-300 flex items-center gap-2 transition-colors py-2 px-4 rounded-xl bg-purple-900/10 border border-purple-500/20 w-fit"
                        >
                            {isGenerating ? <LoaderIcon /> : <><SparklesIcon size={16} /> Gerar Variações Anti-Gravidade com IA (Anti-Spam)</>}
                        </button>
                    </div>

                    {variants.length > 0 && (
                        <div className="space-y-3 animate-in fade-in slide-in-from-top-4 duration-500">
                            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">Variações Alternativas Sugeridas</label>
                            <div className="grid grid-cols-1 gap-3">
                                {variants.map((v, i) => (
                                    <div key={i} className="bg-gray-900 p-4 rounded-2xl border border-gray-700 text-xs text-gray-300 relative group italic leading-relaxed hover:border-purple-500/30 transition-all shadow-sm">
                                        "{v}"
                                        <button 
                                            type="button"
                                            onClick={() => setVariants(prev => prev.filter((_, idx) => idx !== i))}
                                            className="absolute top-2 right-2 p-1.5 text-gray-500 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-800 rounded-lg"
                                        >
                                            <Trash2Icon size={14} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {saveStatus && (
                        <div className={`p-4 rounded-2xl text-sm font-bold border flex items-center gap-3 animate-in zoom-in duration-300 ${
                            saveStatus.success ? 'bg-green-900/10 text-green-400 border-green-500/30' : 'bg-rose-900/10 text-rose-400 border-rose-500/30'
                        }`}>
                            <CheckCircleIcon size={20} />
                            {saveStatus.message}
                        </div>
                    )}

                    <div className="pt-4 flex gap-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-8 py-3 rounded-2xl text-gray-400 font-bold hover:bg-gray-700 transition-all border border-gray-700"
                        >
                            Fechar
                        </button>
                        <button 
                            disabled={isSubmitting || !name || !content}
                            type="submit" 
                            className="flex-1 bg-sky-600 hover:bg-sky-500 text-white font-bold py-3 rounded-2xl transition-all shadow-xl shadow-sky-900/30 flex items-center justify-center gap-2 transform active:scale-95 disabled:opacity-50"
                        >
                            {isSubmitting ? <LoaderIcon /> : <><CheckCircleIcon size={18} /> Salvar Template na Nuvem</>}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default TemplateModal;
