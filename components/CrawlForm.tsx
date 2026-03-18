
import React, { useState } from 'react';
import { CrawlJob, CrawlJobParams, CrawlSource } from '../types';
import { startCrawl } from '../services/crawlerService';
import { PlayIcon } from './icons/PlayIcon';
import { LoaderIcon } from './icons/LoaderIcon';

interface CrawlFormProps {
  onJobCreated: (newJob: CrawlJob) => void;
}

const allSources: CrawlSource[] = ['google', 'instagram_via_search', 'google_maps', 'doctoralia_via_search'];

const CrawlForm: React.FC<CrawlFormProps> = ({ onJobCreated }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<Omit<CrawlJobParams, 'max_pages_per_source' | 'use_proxies' | 'rate_limit' | 'run_mode'>>({
    niche: '',
    city: '',
    ddd: '',
    sources: ['google', 'instagram_via_search', 'google_maps'],
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSourceChange = (source: CrawlSource) => {
    setFormData(prev => {
      const newSources = prev.sources.includes(source)
        ? prev.sources.filter(s => s !== source)
        : [...prev.sources, source];
      return { ...prev, sources: newSources };
    });
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isSubmitting || !formData.niche || formData.sources.length === 0) return;
    
    setIsSubmitting(true);
    try {
      // Re-add non-interactive params for the service call
      const fullParams: CrawlJobParams = {
          ...formData,
          max_pages_per_source: 10,
          rate_limit: 60,
          use_proxies: true,
          run_mode: 'once',
      }
      const newJob = await startCrawl(fullParams);
      onJobCreated(newJob);
      // Reset text fields for the next job
      setFormData(prev => ({
          ...prev, // Keep sources
          niche: '',
          city: '',
          ddd: '',
      }));
    } catch (error) {
      console.error("Failed to start crawl job:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-gray-800 p-6 rounded-lg shadow-xl h-full">
      <h2 className="text-2xl font-bold text-white mb-6 border-b border-gray-700 pb-4">Criar Novo Job</h2>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="niche" className="block text-sm font-medium text-gray-300 mb-1">Nicho</label>
          <input
            type="text"
            name="niche"
            id="niche"
            value={formData.niche}
            onChange={handleInputChange}
            className="w-full bg-gray-700 border border-gray-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
            placeholder="ex: clínica veterinária"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="city" className="block text-sm font-medium text-gray-300 mb-1">Cidade (Opcional)</label>
              <input
                type="text"
                name="city"
                id="city"
                value={formData.city}
                onChange={handleInputChange}
                className="w-full bg-gray-700 border border-gray-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                placeholder="ex: São Paulo"
              />
            </div>
            <div>
              <label htmlFor="ddd" className="block text-sm font-medium text-gray-300 mb-1">DDD (Opcional)</label>
              <input
                type="text"
                name="ddd"
                id="ddd"
                value={formData.ddd}
                onChange={handleInputChange}
                className="w-full bg-gray-700 border border-gray-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                placeholder="ex: 11"
              />
            </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Fontes</label>
          <div className="grid grid-cols-2 gap-2">
            {allSources.map(source => (
              <label key={source} className="flex items-center space-x-2 bg-gray-700 p-2 rounded-md cursor-pointer hover:bg-gray-600 transition">
                <input
                  type="checkbox"
                  checked={formData.sources.includes(source)}
                  onChange={() => handleSourceChange(source)}
                  className="h-4 w-4 rounded border-gray-500 bg-gray-600 text-sky-600 focus:ring-sky-500"
                />
                <span className="text-sm text-gray-200 capitalize">{source.replace(/_/g, ' ')}</span>
              </label>
            ))}
          </div>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full flex justify-center items-center bg-sky-600 hover:bg-sky-700 disabled:bg-sky-800 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-lg shadow-lg transition duration-300 ease-in-out transform hover:scale-105"
        >
          {isSubmitting ? <LoaderIcon /> : <PlayIcon />}
          <span className="ml-2">{isSubmitting ? 'Iniciando Job...' : 'Iniciar Crawl'}</span>
        </button>
      </form>
    </div>
  );
};

export default CrawlForm;