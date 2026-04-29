import React, { useState } from 'react';
import { XIcon, UserPlusIcon, CheckCircleIcon, AlertTriangleIcon, PlusCircleIcon } from 'lucide-react';
import { addManualContact, createManualJob } from '../services/crawlerService';
import { Contact, CrawlJob } from '../types';

interface AddContactModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentJobs: CrawlJob[];
    onSuccess: () => void;
}

const AddContactModal: React.FC<AddContactModalProps> = ({ isOpen, onClose, currentJobs, onSuccess }) => {
    const [formData, setFormData] = useState({
        name: '',
        raw_number: '',
        email: '',
        instagram_handle: '',
        linkedin_url: '',
        city: '',
        category: '',
        job_id: '',
        photo_url: ''
    });
    
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [newListName, setNewListName] = useState('');

    if (!isOpen) return null;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.job_id) {
            setError("Selecione uma lista de destino.");
            return;
        }

        if (!formData.raw_number && !formData.instagram_handle && !formData.email) {
            setError("Forneça pelo menos um meio de contato (Telefone, Instagram ou Email).");
            return;
        }

        setIsSubmitting(true);
        setError(null);

        try {
            let targetJobId = formData.job_id;
            if (formData.job_id === 'new') {
                if (!newListName.trim()) {
                    setError("Dê um nome para a nova lista.");
                    setIsSubmitting(false);
                    return;
                }
                targetJobId = await createManualJob(newListName);
            }

            const contactData: Partial<Contact> = {
                ...formData,
                job_id: targetJobId,
                e164_number: formData.raw_number.startsWith('+') ? formData.raw_number : `+55${formData.raw_number.replace(/\D/g, '')}`,
                status: 'new'
            };

            // If only instagram handle is provided, use it as raw number for display fallback
            if (!formData.raw_number && formData.instagram_handle) {
                contactData.raw_number = `@${formData.instagram_handle.replace(/^@+/, '')}`;
                contactData.e164_number = contactData.raw_number;
            }

            await addManualContact(contactData);
            onSuccess();
            onClose();
        } catch (err) {
            setError("Falha ao adicionar contato manualmente.");
            console.error(err);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <div className="bg-gray-800 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden animate-in zoom-in duration-200">
                <div className="px-6 py-4 border-b border-gray-700 flex justify-between items-center bg-gray-900/40">
                    <div className="flex items-center gap-3">
                        <UserPlusIcon className="text-sky-400" />
                        <h3 className="text-xl font-bold text-white tracking-tight">Adicionar Contato Manualmente</h3>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors p-2 hover:bg-gray-700 rounded-full">
                        <XIcon size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="md:col-span-2">
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5 tracking-wider">Lista de Destino*</label>
                            <select
                                name="job_id"
                                required
                                value={formData.job_id}
                                onChange={handleChange}
                                className="w-full bg-gray-700 border border-gray-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-sky-500 transition-all appearance-none cursor-pointer"
                            >
                                <option value="">Selecione uma lista...</option>
                                <option value="new">+ Criar Nova Lista</option>
                                {currentJobs.map(job => (
                                    <option key={job.id} value={job.id}>{job.name || job.niche} ({job.city || 'Geral'})</option>
                                ))}
                            </select>
                        </div>

                        {formData.job_id === 'new' && (
                            <div className="md:col-span-2 animate-in slide-in-from-top-2 duration-200">
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5 tracking-wider">Nome da Nova Lista</label>
                                <input
                                    type="text"
                                    value={newListName}
                                    onChange={(e) => setNewListName(e.target.value)}
                                    placeholder="Ex: Novos Leads de Indicação"
                                    className="w-full bg-gray-700 border border-gray-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-sky-500 transition-all"
                                />
                            </div>
                        )}

                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5 tracking-wider">Nome Completo</label>
                            <input
                                type="text"
                                name="name"
                                value={formData.name}
                                onChange={handleChange}
                                placeholder="Ex: Alexandre Carvalho"
                                className="w-full bg-gray-700 border border-gray-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-sky-500 transition-all"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5 tracking-wider">WhatsApp / Telefone</label>
                            <input
                                type="text"
                                name="raw_number"
                                value={formData.raw_number}
                                onChange={handleChange}
                                placeholder="Ex: 21999999999"
                                className="w-full bg-gray-700 border border-gray-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-sky-500 transition-all"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5 tracking-wider">E-mail</label>
                            <input
                                type="email"
                                name="email"
                                value={formData.email}
                                onChange={handleChange}
                                placeholder="exemplo@email.com"
                                className="w-full bg-gray-700 border border-gray-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-sky-500 transition-all"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5 tracking-wider">Instagram (@usuario)</label>
                            <input
                                type="text"
                                name="instagram_handle"
                                value={formData.instagram_handle}
                                onChange={handleChange}
                                placeholder="Ex: dralexandre"
                                className="w-full bg-gray-700 border border-gray-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-sky-500 transition-all"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5 tracking-wider">LinkedIn (URL)</label>
                            <input
                                type="text"
                                name="linkedin_url"
                                value={formData.linkedin_url}
                                onChange={handleChange}
                                placeholder="linkedin.com/in/perfil"
                                className="w-full bg-gray-700 border border-gray-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-sky-500 transition-all"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5 tracking-wider">URL da Foto (Avatar)</label>
                            <input
                                type="text"
                                name="photo_url"
                                value={formData.photo_url}
                                onChange={handleChange}
                                placeholder="http://.../foto.jpg"
                                className="w-full bg-gray-700 border border-gray-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-sky-500 transition-all font-mono text-[10px]"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5 tracking-wider">Cidade</label>
                            <input
                                type="text"
                                name="city"
                                value={formData.city}
                                onChange={handleChange}
                                placeholder="Ex: Rio de Janeiro"
                                className="w-full bg-gray-700 border border-gray-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-sky-500 transition-all"
                            />
                        </div>
                        
                        <div className="md:col-span-2">
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5 tracking-wider">Cargo / Especialidade</label>
                            <input
                                type="text"
                                name="category"
                                value={formData.category}
                                onChange={handleChange}
                                placeholder="Ex: CEO / Cirurgião Plástico"
                                className="w-full bg-gray-700 border border-gray-600 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-sky-500 transition-all"
                            />
                        </div>
                    </div>

                    {error && (
                        <div className="bg-rose-900/20 border border-rose-500/30 p-4 rounded-xl flex gap-3">
                            <AlertTriangleIcon className="text-rose-400 shrink-0" />
                            <p className="text-sm text-rose-200">{error}</p>
                        </div>
                    )}

                    <div className="pt-4 flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-6 py-2 rounded-xl text-gray-400 font-bold hover:bg-gray-700 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white px-8 py-2 rounded-xl font-bold transition-all shadow-lg shadow-sky-900/20 flex items-center gap-2"
                        >
                            {isSubmitting ? (
                                <span className="animate-spin h-4 w-4 border-2 border-white/30 border-t-white rounded-full"></span>
                            ) : (
                                <CheckCircleIcon size={18} />
                            )}
                            Salvar Contato
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AddContactModal;
