import React, { useState } from 'react';
import { XIcon, UploadIcon, FileTextIcon, CheckCircleIcon, AlertTriangleIcon, PlusCircleIcon } from 'lucide-react';
import { importContacts, createManualJob } from '../services/crawlerService';
import { Contact, CrawlJob, CrawlSource } from '../types';

interface ImportContactsModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentJobs: CrawlJob[];
    onImportSuccess: () => void;
}

const ImportContactsModal: React.FC<ImportContactsModalProps> = ({ isOpen, onClose, currentJobs, onImportSuccess }) => {
    const [selectedJobId, setSelectedJobId] = useState<string>('');
    const [newListName, setNewListName] = useState('');
    const [isCreatingList, setIsCreatingList] = useState(false);
    const [file, setFile] = useState<File | null>(null);
    const [isImporting, setIsImporting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [preview, setPreview] = useState<any[]>([]);

    if (!isOpen) return null;

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            setFile(selectedFile);
            parseFile(selectedFile);
        }
    };

    const parseFile = (file: File) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const content = e.target?.result as string;
            // Simple CSV parser
            const lines = content.split('\n');
            const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
            
            const results = lines.slice(1).filter(l => l.trim()).map(line => {
                const values = line.split(',').map(v => v.trim());
                const obj: any = {};
                headers.forEach((header, i) => {
                    obj[header] = values[i];
                });
                return obj;
            });
            setPreview(results.slice(0, 5));
        };
        reader.readAsText(file);
    };

    const handleImport = async () => {
        if (!file || !selectedJobId) {
            setError("Selecione um arquivo e uma lista de destino.");
            return;
        }

        setIsImporting(true);
        setError(null);

        try {
            let targetJobId = selectedJobId;
            if (selectedJobId === 'new') {
                if (!newListName.trim()) {
                    setError("Dê um nome para a nova lista.");
                    setIsImporting(false);
                    return;
                }
                targetJobId = await createManualJob(newListName);
            }

            const reader = new FileReader();
            reader.onload = async (e) => {
                const content = e.target?.result as string;
                const lines = content.split('\n');
                const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
                
                const contactsToImport: Partial<Contact>[] = lines.slice(1).filter(l => l.trim()).map(line => {
                    const values = line.split(',').map(v => v.trim());
                    const data: any = {};
                    
                    // Map common headers to our fields
                    headers.forEach((header, i) => {
                        const val = values[i];
                        if (!val) return;

                        if (header.includes('nome') || header === 'name') data.name = val;
                        if (header.includes('telefone') || header.includes('whatsapp') || header === 'phone') {
                            data.raw_number = val;
                            data.e164_number = val.startsWith('+') ? val : `+55${val.replace(/\D/g, '')}`;
                        }
                        if (header.includes('email') || header === 'e-mail') data.email = val;
                        if (header.includes('instagram')) data.instagram_handle = val.replace('@', '');
                        if (header.includes('linkedin') || header.includes('perfil') || header === 'url') data.linkedin_url = val;
                        if (header.includes('cargo') || header === 'role' || header.includes('title')) data.category = val;
                        if (header.includes('foto') || header.includes('photo') || header.includes('avatar') || header.includes('image') || header.includes('img')) data.photo_url = val;
                        if (header.includes('cidade') || header === 'city') data.city = val;
                        if (header.includes('link') || header === 'url') data.source_url = val;
                        if (header.includes('empresa') || header === 'company') data.notes = (data.notes || '') + ` Empresa: ${val}`;
                    });

                    // Ensure required fields
                    if (!data.raw_number && data.instagram_handle) {
                        data.raw_number = `@${data.instagram_handle}`;
                        data.e164_number = `@${data.instagram_handle}`;
                    }

                    return data;
                }).filter(c => c.raw_number || c.instagram_handle || c.email);

                const count = await importContacts(contactsToImport, targetJobId);
                onImportSuccess();
                onClose();
            };
            reader.readAsText(file);
        } catch (err) {
            setError("Falha ao importar contatos. Verifique o formato do arquivo.");
            console.error(err);
        } finally {
            setIsImporting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <div className="bg-gray-800 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in duration-200">
                <div className="px-6 py-4 border-b border-gray-700 flex justify-between items-center bg-gray-900/40">
                    <div className="flex items-center gap-3">
                        <UploadIcon className="text-sky-400" />
                        <h3 className="text-xl font-bold text-white tracking-tight">Importar Lista de Contatos</h3>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors p-2 hover:bg-gray-700 rounded-full">
                        <XIcon size={20} />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    {/* Instructions */}
                    <div className="bg-sky-900/20 border border-sky-500/30 p-4 rounded-xl flex gap-4">
                        <FileTextIcon className="text-sky-400 shrink-0 mt-1" />
                        <div className="text-sm text-sky-200">
                            <p className="font-bold mb-1">Dica de Formato:</p>
                            <p>O arquivo CSV deve conter cabeçalhos como: <code className="bg-sky-900/40 px-1 rounded text-white">Nome</code>, <code className="bg-sky-900/40 px-1 rounded text-white">Telefone</code>, <code className="bg-sky-900/40 px-1 rounded text-white">Email</code>, <code className="bg-sky-900/40 px-1 rounded text-white">Instagram</code>.</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Select Target List */}
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2 tracking-wider">Lista de Destino</label>
                            <select
                                value={selectedJobId}
                                onChange={(e) => setSelectedJobId(e.target.value)}
                                className="w-full bg-gray-700 border border-gray-600 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-sky-500 transition-all appearance-none cursor-pointer"
                            >
                                <option value="">Selecione uma lista...</option>
                                <option value="new">+ Criar Nova Lista</option>
                                {currentJobs.map(job => (
                                    <option key={job.id} value={job.id}>{job.name || job.niche} ({job.city || 'Geral'})</option>
                                ))}
                            </select>
                        </div>

                        {selectedJobId === 'new' && (
                            <div className="animate-in slide-in-from-top-2 duration-200">
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-2 tracking-wider">Nome da Nova Lista</label>
                                <input
                                    type="text"
                                    value={newListName}
                                    onChange={(e) => setNewListName(e.target.value)}
                                    placeholder="Ex: Leads Importados Lessie"
                                    className="w-full bg-gray-700 border border-gray-600 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-sky-500 transition-all"
                                />
                            </div>
                        )}

                        {/* File Upload Area */}
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2 tracking-wider">Arquivo CSV</label>
                            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-600 rounded-xl cursor-pointer hover:border-sky-500 hover:bg-gray-700/50 transition-all group">
                                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                    <UploadIcon className="w-8 h-8 text-gray-400 group-hover:text-sky-400 mb-2 transition-colors" />
                                    <p className="text-sm text-gray-400 group-hover:text-gray-300">
                                        {file ? file.name : "Clique para selecionar CSV"}
                                    </p>
                                </div>
                                <input type="file" className="hidden" accept=".csv" onChange={handleFileChange} />
                            </label>
                        </div>
                    </div>

                    {/* Preview */}
                    {preview.length > 0 && (
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2 tracking-wider">Prévia dos Dados</label>
                            <div className="bg-gray-900/60 rounded-xl border border-gray-700 overflow-x-auto">
                                <table className="w-full text-left text-sm">
                                    <thead>
                                        <tr className="border-b border-gray-700 bg-gray-800/50">
                                            {Object.keys(preview[0]).map(h => (
                                                <th key={h} className="px-4 py-2 font-bold text-gray-400 uppercase text-[10px]">{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {preview.map((row, i) => (
                                            <tr key={i} className="border-b border-gray-700/50 last:border-0">
                                                {Object.values(row).map((v: any, j) => (
                                                    <td key={j} className="px-4 py-2 text-gray-300 truncate max-w-[150px]">{String(v)}</td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {error && (
                        <div className="bg-rose-900/20 border border-rose-500/30 p-4 rounded-xl flex gap-3 animate-pulse">
                            <AlertTriangleIcon className="text-rose-400 shrink-0" />
                            <p className="text-sm text-rose-200">{error}</p>
                        </div>
                    )}
                </div>

                <div className="px-6 py-4 bg-gray-900/60 border-t border-gray-700 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 rounded-xl text-gray-400 font-bold hover:bg-gray-700 transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleImport}
                        disabled={isImporting || !file || !selectedJobId}
                        className="bg-sky-600 hover:bg-sky-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-8 py-2 rounded-xl font-bold transition-all shadow-lg shadow-sky-900/20 flex items-center gap-2"
                    >
                        {isImporting ? (
                            <>
                                <span className="animate-spin h-4 w-4 border-2 border-white/30 border-t-white rounded-full"></span>
                                Importando...
                            </>
                        ) : (
                            <>
                                <CheckCircleIcon size={18} />
                                Iniciar Importação
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ImportContactsModal;
