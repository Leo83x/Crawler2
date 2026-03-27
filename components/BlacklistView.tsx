
import React, { useState, useEffect } from 'react';
import { BlacklistedContact } from '../types';
import { getBlacklist, removeFromBlacklist, addToBlacklist } from '../services/crawlerService';
import { LoaderIcon } from './icons/LoaderIcon';
import { TrashIcon } from './icons/TrashIcon';
import ConfirmationModal from './ConfirmationModal';

const BlacklistView: React.FC = () => {
    const [blacklist, setBlacklist] = useState<BlacklistedContact[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [newNumber, setNewNumber] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [confirmModal, setConfirmModal] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        onConfirm: () => void;
        isDestructive?: boolean;
    }>({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: () => {},
    });

    useEffect(() => {
        fetchBlacklist();
    }, []);

    const fetchBlacklist = async () => {
        try {
            setIsLoading(true);
            const data = await getBlacklist();
            setBlacklist(data);
        } catch (err) {
            setError("Falha ao carregar lista de exclusão.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleRemove = async (id: string) => {
        setConfirmModal({
            isOpen: true,
            title: 'Remover da Lista de Exclusão',
            message: "Deseja remover este número da lista de exclusão?",
            isDestructive: true,
            onConfirm: async () => {
                try {
                    await removeFromBlacklist(id);
                    setBlacklist(prev => prev.filter(item => item.id !== id));
                } catch (err) {
                    setError("Falha ao remover item.");
                } finally {
                    setConfirmModal(prev => ({ ...prev, isOpen: false }));
                }
            }
        });
    };

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newNumber || isSubmitting) return;

        try {
            setIsSubmitting(true);
            // Basic validation for E.164 (starts with + and digits)
            let formatted = newNumber.trim();
            if (!formatted.startsWith('+')) {
                formatted = '+' + formatted.replace(/\D/g, '');
            }
            
            await addToBlacklist(formatted, "Adicionado manualmente");
            setNewNumber('');
            fetchBlacklist();
        } catch (err) {
            setError("Falha ao adicionar número.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            const content = event.target?.result as string;
            const lines = content.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
            
            if (lines.length === 0) return;
            
            setConfirmModal({
                isOpen: true,
                title: 'Importar Números',
                message: `Deseja importar ${lines.length} números para a lista de exclusão?`,
                onConfirm: async () => {
                    setIsSubmitting(true);
                    let successCount = 0;
                    try {
                        for (const line of lines) {
                            let formatted = line;
                            if (!formatted.startsWith('+')) {
                                formatted = '+' + formatted.replace(/\D/g, '');
                            }
                            
                            if (formatted.length > 5) {
                                await addToBlacklist(formatted, "Importado via arquivo");
                                successCount++;
                            }
                        }
                        fetchBlacklist();
                    } catch (err) {
                        setError("Ocorreu um erro durante a importação.");
                    } finally {
                        setIsSubmitting(false);
                        e.target.value = '';
                        setConfirmModal(prev => ({ ...prev, isOpen: false }));
                    }
                }
            });
        };
        reader.readAsText(file);
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-4xl font-bold text-white tracking-tight">Lista de Exclusão (Blacklist)</h1>
                    <p className="mt-2 text-lg text-gray-400">Contatos nesta lista serão ignorados em todas as pesquisas futuras.</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                    <label className="cursor-pointer bg-gray-700 hover:bg-gray-600 text-white text-sm font-bold py-2 px-4 rounded-md transition-colors border border-gray-600">
                        Importar Arquivo (.txt / .csv)
                        <input type="file" accept=".txt,.csv" onChange={handleFileUpload} className="hidden" />
                    </label>
                    <span className="text-xs text-gray-500">Um número por linha</span>
                </div>
            </div>

            <div className="bg-gray-800 p-6 rounded-lg shadow-xl">
                <form onSubmit={handleAdd} className="flex gap-4 mb-8">
                    <input
                        type="text"
                        placeholder="Adicionar número (ex: +5511999999999)"
                        value={newNumber}
                        onChange={(e) => setNewNumber(e.target.value)}
                        className="flex-1 bg-gray-700 border border-gray-600 rounded-md shadow-sm py-2 px-4 text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="bg-sky-600 hover:bg-sky-700 disabled:bg-sky-800 text-white font-bold py-2 px-6 rounded-md transition duration-200"
                    >
                        {isSubmitting ? 'Adicionando...' : 'Adicionar'}
                    </button>
                </form>

                {isLoading ? (
                    <div className="flex justify-center items-center h-64"><LoaderIcon /><span className="ml-3 text-gray-400">Carregando...</span></div>
                ) : error ? (
                    <p className="text-center text-red-400 p-4">{error}</p>
                ) : blacklist.length === 0 ? (
                    <p className="text-center text-gray-400 p-10">A lista de exclusão está vazia.</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-700">
                            <thead className="bg-gray-800">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Número</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Motivo</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Data</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="bg-gray-800 divide-y divide-gray-700">
                                {blacklist.map((item) => (
                                    <tr key={item.id} className="hover:bg-gray-700 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-sky-400">{item.e164_number}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{item.reason || 'N/A'}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">{new Date(item.created_at).toLocaleDateString()}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <button
                                                onClick={() => handleRemove(item.id)}
                                                className="text-red-400 hover:text-red-300 p-2"
                                                title="Remover da lista"
                                            >
                                                <TrashIcon />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
            <ConfirmationModal
                isOpen={confirmModal.isOpen}
                title={confirmModal.title}
                message={confirmModal.message}
                onConfirm={confirmModal.onConfirm}
                onCancel={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                isDestructive={confirmModal.isDestructive}
            />
        </div>
    );
};

export default BlacklistView;
