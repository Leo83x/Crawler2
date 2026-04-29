
import React from 'react';
import { CrawlJob } from '../types';
import { LoaderIcon } from './icons/LoaderIcon';
import { CheckCircleIcon } from './icons/CheckCircleIcon';
import { XCircleIcon } from './icons/XCircleIcon';
import { TrashIcon } from './icons/TrashIcon';
import { RefreshIcon } from './icons/RefreshIcon';

import { Edit2Icon, CheckIcon, XIcon } from 'lucide-react';

interface JobListProps {
  jobs: CrawlJob[];
  isLoading: boolean;
  error: string | null;
  onDeleteJob: (id: string) => void;
  onRetryJob: (job: CrawlJob) => void;
  onRenameJob: (id: string, name: string) => Promise<void>;
}

const StatusIndicator: React.FC<{ status: CrawlJob['status'] }> = ({ status }) => {
  switch (status) {
    case 'running':
      return <div className="flex items-center text-yellow-400"><LoaderIcon /> <span className="ml-2">Em Execução</span></div>;
    case 'completed':
      return <div className="flex items-center text-green-400"><CheckCircleIcon /> <span className="ml-2">Concluído</span></div>;
    case 'failed':
      return <div className="flex items-center text-red-400"><XCircleIcon /> <span className="ml-2">Falhou</span></div>;
    case 'pending':
      return <div className="flex items-center text-gray-400"><span className="h-2 w-2 bg-gray-400 rounded-full animate-pulse mr-2"></span>Pendente</div>;
    default:
      return null;
  }
};

const JobList: React.FC<JobListProps> = ({ jobs, isLoading, error, onDeleteJob, onRetryJob, onRenameJob }) => {
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [tempName, setTempName] = React.useState('');

  const handleStartEdit = (job: CrawlJob) => {
    setEditingId(job.id);
    setTempName(job.name || job.niche);
  };

  const handleSave = async (id: string) => {
    await onRenameJob(id, tempName);
    setEditingId(null);
  };

  const renderContent = () => {
    if (isLoading && jobs.length === 0) {
      return (
        <div className="flex justify-center items-center h-48">
            <LoaderIcon />
            <span className="ml-3 text-gray-400">Carregando jobs...</span>
        </div>
      );
    }

    if (jobs.length === 0) {
      return (
        <div className="space-y-4">
            {error && (
                <div className="p-3 bg-red-900/30 border border-red-500/50 rounded text-red-200 text-sm">
                    {error}
                </div>
            )}
            <p className="text-center text-gray-400 py-10">Nenhum job encontrado. Crie um para começar!</p>
        </div>
      );
    }

    return (
        <div className="space-y-4">
            {error && (
                <div className="p-3 bg-red-900/30 border border-red-500/50 rounded text-red-200 text-sm">
                    {error}
                </div>
            )}
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-700">
            <thead className="bg-gray-800">
                <tr>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Identificador / Nicho</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Local</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Status</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Contatos</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Iniciado em</th>
                <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider">Ações</th>
                </tr>
            </thead>
            <tbody className="bg-gray-800 divide-y divide-gray-700">
                {jobs.map(job => (
                <tr key={job.id} className="hover:bg-gray-700 transition-colors group">
                    <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-white">
                        {editingId === job.id ? (
                            <div className="flex items-center gap-2">
                                <input 
                                    autoFocus
                                    className="bg-gray-900 border border-sky-500 rounded px-2 py-1 text-xs text-white outline-none w-32"
                                    value={tempName}
                                    onChange={e => setTempName(e.target.value)}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter') handleSave(job.id);
                                        if (e.key === 'Escape') setEditingId(null);
                                    }}
                                />
                                <button onClick={() => handleSave(job.id)} className="text-emerald-400 hover:text-emerald-300">
                                    <CheckIcon size={14} />
                                </button>
                                <button onClick={() => setEditingId(null)} className="text-gray-500 hover:text-gray-400">
                                    <XIcon size={14} />
                                </button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2">
                                <div className="flex flex-col">
                                    <span className="font-bold">{job.name || job.niche}</span>
                                    {job.name && <span className="text-[10px] text-gray-500 italic font-normal">{job.niche}</span>}
                                </div>
                                <button 
                                    onClick={() => handleStartEdit(job)}
                                    className="p-1 text-gray-500 hover:text-sky-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <Edit2Icon size={12} />
                                </button>
                            </div>
                        )}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-300">
                        {job.city || '--'} / {job.ddd || '--'}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm">
                        <StatusIndicator status={job.status} />
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-center text-sky-400 font-semibold">{job.contacts_found}</td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-400">
                        {job.created_at ? new Date(job.created_at).toLocaleString() : '--'}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-right">
                        <div className="flex justify-end space-x-2">
                            {job.status === 'failed' && (
                                <button 
                                    onClick={() => onRetryJob(job)}
                                    className="p-1 text-sky-400 hover:text-sky-300 hover:bg-sky-900/20 rounded transition-colors"
                                    title="Tentar novamente"
                                >
                                    <RefreshIcon />
                                </button>
                            )}
                            <button 
                                onClick={() => onDeleteJob(job.id)}
                                className="p-1 text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded transition-colors"
                                title="Excluir Job"
                            >
                                <TrashIcon />
                            </button>
                        </div>
                    </td>
                </tr>
                ))}
            </tbody>
            </table>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-gray-800 rounded-lg shadow-xl overflow-hidden h-full">
      <h2 className="text-2xl font-bold text-white p-6 border-b border-gray-700">Status dos Jobs</h2>
      {renderContent()}
    </div>
  );
};

export default JobList;
