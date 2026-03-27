
import React, { useState, useEffect, useCallback } from 'react';
import { CrawlJob, CrawlJobParams } from '../types';
import CrawlForm from './CrawlForm';
import JobList from './JobList';
import { getJobs, deleteJob, startCrawl, getDashboardStats } from '../services/crawlerService';
import ConfirmationModal from './ConfirmationModal';
import { DashboardStats } from './DashboardStats';

const Dashboard: React.FC = () => {
  const [jobs, setJobs] = useState<CrawlJob[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<{
    totalLeads: number;
    totalJobs: number;
    statsBySource: Record<string, number>;
    statsByStatus: Record<string, number>;
    statsByCity: Record<string, number>;
  } | null>(null);
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

  const fetchJobs = useCallback(async () => {
    try {
      // Don't set loading to true on refetch to avoid flicker
      // setIsLoading(true); 
      const fetchedJobs = await getJobs();
      setJobs(fetchedJobs);
      const fetchedStats = await getDashboardStats();
      setStats(fetchedStats);
      setError(null);
    } catch (err) {
      setError('Falha ao buscar jobs. Por favor, tente novamente.');
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  useEffect(() => {
    fetchJobs();
    const interval = setInterval(fetchJobs, 2000); // Poll for updates
    return () => clearInterval(interval);
  }, [fetchJobs]);

  const handleJobCreated = (newJob: CrawlJob) => {
    setJobs(prevJobs => [newJob, ...prevJobs.filter(j => j.id !== newJob.id)]);
  };

  const handleDeleteJob = async (id: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Excluir Job',
      message: 'Deseja excluir este job e todos os contatos associados a ele?',
      isDestructive: true,
      onConfirm: async () => {
        try {
          await deleteJob(id);
          setJobs(prev => prev.filter(j => j.id !== id));
        } catch (err) {
          setError('Falha ao excluir job.');
        } finally {
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  const handleRetryJob = async (job: CrawlJob) => {
    setConfirmModal({
      isOpen: true,
      title: 'Tentar Novamente',
      message: `Deseja reiniciar a pesquisa para "${job.niche}" em "${job.city || 'Brasil'}"?`,
      onConfirm: async () => {
        try {
          const params: CrawlJobParams = {
            niche: job.niche,
            city: job.city || undefined,
            ddd: job.ddd || undefined,
            sources: job.sources || ['google'],
            max_pages_per_source: job.max_pages_per_source || 10,
            use_proxies: false, // Default to false for retry unless we store it
            rate_limit: 1, // Default rate limit
            run_mode: 'once' // Default run mode for retry
          };
          await startCrawl(params);
          fetchJobs();
        } catch (err) {
          setError('Falha ao reiniciar job.');
        } finally {
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold text-white tracking-tight">Gerenciador de Crawl</h1>
        <p className="mt-2 text-lg text-gray-400">
          Configure e inicie novos jobs de crawling para encontrar contatos do WhatsApp.
        </p>
      </div>

      {stats && <DashboardStats stats={stats} />}
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1">
          <CrawlForm onJobCreated={handleJobCreated} />
        </div>
        <div className="lg:col-span-2">
          <JobList 
            jobs={jobs} 
            isLoading={isLoading} 
            error={error} 
            onDeleteJob={handleDeleteJob}
            onRetryJob={handleRetryJob}
          />
        </div>
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

export default Dashboard;
