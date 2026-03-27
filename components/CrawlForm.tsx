
import React, { useState } from 'react';
import { CrawlJob, CrawlJobParams, CrawlSource } from '../types';
import { startCrawl } from '../services/crawlerService';
import { PlayIcon } from './icons/PlayIcon';
import { LoaderIcon } from './icons/LoaderIcon';

interface CrawlFormProps {
  onJobCreated: (newJob: CrawlJob) => void;
}

const allSources: CrawlSource[] = ['google', 'instagram_via_search', 'linkedin_via_search', 'facebook_via_search', 'apify', 'firecrawl', 'google_maps', 'doctoralia_via_search', 'scrape_do'];

const CrawlForm: React.FC<CrawlFormProps> = ({ onJobCreated }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<Omit<CrawlJobParams, 'rate_limit' | 'run_mode'>>({
    niche: '',
    city: '',
    ddd: '',
    sources: ['google', 'instagram_via_search', 'linkedin_via_search', 'facebook_via_search', 'google_maps'],
    use_proxies: false,
    proxy_url: '',
    proxy_rotation: 'none',
    max_pages_per_source: 10,
    schedule: 'once',
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target as HTMLInputElement;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
    setError(null);
  };

  const handleSourceChange = (source: CrawlSource) => {
    setFormData(prev => {
      const newSources = prev.sources.includes(source)
        ? prev.sources.filter(s => s !== source)
        : [...prev.sources, source];
      return { ...prev, sources: newSources };
    });
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isSubmitting || !formData.niche || formData.sources.length === 0) {
        if (formData.sources.length === 0) setError("Selecione pelo menos uma fonte.");
        return;
    }
    
    setIsSubmitting(true);
    setError(null);
    try {
      // Re-add non-interactive params for the service call
      const fullParams: CrawlJobParams = {
          ...formData,
          rate_limit: 60,
          run_mode: formData.schedule === 'once' ? 'once' : 'recurrent',
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
    } catch (err) {
      console.error("Failed to start crawl job:", err);
      setError(err instanceof Error ? err.message : "Ocorreu um erro ao iniciar a busca.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-gray-800 p-6 rounded-lg shadow-xl h-full">
      <h2 className="text-2xl font-bold text-white mb-6 border-b border-gray-700 pb-4">Criar Novo Job</h2>
      {error && (
        <div className="mb-4 p-3 bg-red-900/50 border border-red-500 rounded text-red-200 text-sm">
          {error}
        </div>
      )}
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
            maxLength={99}
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
                maxLength={99}
              />
            </div>
            <div>
              <label htmlFor="schedule" className="block text-sm font-medium text-gray-300 mb-1">Agendamento</label>
              <select
                name="schedule"
                id="schedule"
                value={formData.schedule}
                onChange={handleInputChange}
                className="w-full bg-gray-700 border border-gray-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
              >
                <option value="once">Executar Agora</option>
                <option value="daily">Diário</option>
                <option value="weekly">Semanal</option>
                <option value="monthly">Mensal</option>
              </select>
            </div>
        </div>

        <div>
          <label htmlFor="max_pages_per_source" className="block text-sm font-medium text-gray-300 mb-1">
            Profundidade da Busca (Páginas por Fonte): <span className="text-sky-400 font-bold">{formData.max_pages_per_source}</span>
          </label>
          <input
            type="range"
            name="max_pages_per_source"
            id="max_pages_per_source"
            min="1"
            max="50"
            step="1"
            value={formData.max_pages_per_source}
            onChange={(e) => setFormData(prev => ({ ...prev, max_pages_per_source: parseInt(e.target.value) }))}
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-sky-500"
          />
          <p className="mt-1 text-xs text-gray-400">Quanto maior o número, mais completa e lenta será a busca.</p>
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

        <div className="border-t border-gray-700 pt-4">
          <label className="flex items-center space-x-2 cursor-pointer mb-4">
            <input
              type="checkbox"
              name="use_proxies"
              checked={formData.use_proxies}
              onChange={handleInputChange}
              className="h-4 w-4 rounded border-gray-500 bg-gray-600 text-sky-600 focus:ring-sky-500"
            />
            <span className="text-sm font-medium text-gray-300">Usar Proxy Rotativo</span>
          </label>

          {formData.use_proxies && (
            <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
              <div>
                <label htmlFor="proxy_url" className="block text-sm font-medium text-gray-300 mb-1">URL do Proxy (HTTP/HTTPS)</label>
                <input
                  type="text"
                  name="proxy_url"
                  id="proxy_url"
                  value={formData.proxy_url}
                  onChange={handleInputChange}
                  className="w-full bg-gray-700 border border-gray-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                  placeholder="ex: http://user:pass@proxy.com:8080"
                />
              </div>
              <div>
                <label htmlFor="proxy_rotation" className="block text-sm font-medium text-gray-300 mb-1">Rotação de Proxy</label>
                <select
                  name="proxy_rotation"
                  id="proxy_rotation"
                  value={formData.proxy_rotation}
                  onChange={handleInputChange}
                  className="w-full bg-gray-700 border border-gray-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                >
                  <option value="none">Sem Rotação Automática</option>
                  <option value="per_request">Rotacionar por Requisição</option>
                  <option value="per_job">Rotacionar por Job</option>
                </select>
              </div>
            </div>
          )}
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