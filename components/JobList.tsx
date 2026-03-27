
import React from 'react';
import { CrawlJob } from '../types';
import { LoaderIcon } from './icons/LoaderIcon';
import { CheckCircleIcon } from './icons/CheckCircleIcon';
import { XCircleIcon } from './icons/XCircleIcon';
import { TrashIcon } from './icons/TrashIcon';
import { RefreshIcon } from './icons/RefreshIcon';

interface JobListProps {
  jobs: CrawlJob[];
  isLoading: boolean;
  error: string | null;
  onDeleteJob: (id: string) => void;
  onRetryJob: (job: CrawlJob) => void;
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

const JobList: React.FC<JobListProps> = ({ jobs, isLoading, error, onDeleteJob, onRetryJob }) => {

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
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Nicho</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Local</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Status</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Contatos</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Iniciado em</th>
                <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider">Ações</th>
                </tr>
            </thead>
            <tbody className="bg-gray-800 divide-y divide-gray-700">
                {jobs.map(job => (
                <tr key={job.id} className="hover:bg-gray-700 transition-colors">
                    <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-white">{job.niche}</td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-300">
                        {job.city || '--'} / {job.ddd || '--'}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm">
                        <StatusIndicator status={job.status} />
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-center text-sky-400 font-semibold">{job.contacts_found}</td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-400">{new Date(job.created_at).toLocaleString()}</td>
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
