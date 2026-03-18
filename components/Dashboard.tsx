
import React, { useState, useEffect, useCallback } from 'react';
import { CrawlJob } from '../types';
import CrawlForm from './CrawlForm';
import JobList from './JobList';
import { getJobs } from '../services/crawlerService';

const Dashboard: React.FC = () => {
  const [jobs, setJobs] = useState<CrawlJob[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchJobs = useCallback(async () => {
    try {
      // Don't set loading to true on refetch to avoid flicker
      // setIsLoading(true); 
      const fetchedJobs = await getJobs();
      setJobs(fetchedJobs);
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
    // The list is already updated via polling, but we can add it for instant feedback
    setJobs(prevJobs => [newJob, ...prevJobs.filter(j => j.id !== newJob.id)]);
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold text-white tracking-tight">Gerenciador de Crawl</h1>
        <p className="mt-2 text-lg text-gray-400">
          Configure e inicie novos jobs de crawling para encontrar contatos do WhatsApp.
        </p>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1">
          <CrawlForm onJobCreated={handleJobCreated} />
        </div>
        <div className="lg:col-span-2">
          <JobList jobs={jobs} isLoading={isLoading} error={error} />
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
