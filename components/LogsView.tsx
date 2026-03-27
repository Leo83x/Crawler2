import React, { useState, useEffect } from 'react';
import { ErrorLog } from '../types';
import { getLogs } from '../services/crawlerService';
import { LoaderIcon } from './icons/LoaderIcon';
import { BackIcon } from './icons/BackIcon';

const LogsView: React.FC = () => {
    const [logs, setLogs] = useState<ErrorLog[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedLog, setSelectedLog] = useState<ErrorLog | null>(null);

    useEffect(() => {
        fetchLogs();
    }, []);

    const fetchLogs = async () => {
        try {
            setIsLoading(true);
            const data = await getLogs();
            setLogs(data);
        } catch (err) {
            setError("Falha ao carregar logs de erro.");
        } finally {
            setIsLoading(false);
        }
    };

    if (selectedLog) {
        return (
            <div className="space-y-6">
                <button 
                    onClick={() => setSelectedLog(null)}
                    className="flex items-center text-sky-400 hover:text-sky-300 transition-colors"
                >
                    <BackIcon /> <span className="ml-2">Voltar para a lista</span>
                </button>

                <div className="bg-gray-800 rounded-xl shadow-xl overflow-hidden border border-gray-700">
                    <div className="p-6 border-b border-gray-700 bg-gray-900/50">
                        <h2 className="text-2xl font-bold text-white">{selectedLog.source}</h2>
                        <p className="text-gray-400 mt-1">{new Date(selectedLog.timestamp).toLocaleString()}</p>
                    </div>
                    <div className="p-6 space-y-6">
                        <div>
                            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Mensagem</h3>
                            <p className="text-red-400 font-mono bg-red-900/20 p-4 rounded-lg border border-red-900/30">
                                {selectedLog.message}
                            </p>
                        </div>
                        {selectedLog.context && (
                            <div>
                                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Contexto</h3>
                                <pre className="text-gray-300 font-mono bg-gray-900 p-4 rounded-lg overflow-x-auto text-sm">
                                    {JSON.stringify(selectedLog.context, null, 2)}
                                </pre>
                            </div>
                        )}
                        {selectedLog.stack && (
                            <div>
                                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Stack Trace</h3>
                                <pre className="text-gray-500 font-mono bg-gray-900 p-4 rounded-lg overflow-x-auto text-xs whitespace-pre-wrap">
                                    {selectedLog.stack}
                                </pre>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-4xl font-bold text-white tracking-tight">Logs de Erro</h1>
                    <p className="mt-2 text-lg text-gray-400">Histórico de falhas técnicas do sistema.</p>
                </div>
                <button 
                    onClick={fetchLogs}
                    className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors text-sm"
                >
                    Atualizar
                </button>
            </div>

            <div className="bg-gray-800 rounded-xl shadow-xl overflow-hidden border border-gray-700">
                {isLoading ? (
                    <div className="flex justify-center items-center h-64">
                        <LoaderIcon />
                        <span className="ml-3 text-gray-400">Carregando logs...</span>
                    </div>
                ) : error ? (
                    <div className="p-10 text-center text-red-400">{error}</div>
                ) : logs.length === 0 ? (
                    <div className="p-20 text-center text-gray-500">Nenhum erro registrado recentemente.</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-700">
                            <thead className="bg-gray-900/50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Fonte</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Mensagem</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Data</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-700">
                                {logs.map(log => (
                                    <tr 
                                        key={log.id} 
                                        onClick={() => setSelectedLog(log)}
                                        className="hover:bg-gray-700/50 cursor-pointer transition-colors"
                                    >
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-sky-400">{log.source}</td>
                                        <td className="px-6 py-4 text-sm text-gray-300 max-w-md truncate">{log.message}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(log.timestamp).toLocaleString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default LogsView;
