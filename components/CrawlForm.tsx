
import React, { useState } from 'react';
import { CrawlJob, CrawlJobParams, CrawlSource } from '../types';
import { startCrawl } from '../services/crawlerService';
import { PlayIcon } from './icons/PlayIcon';
import { LoaderIcon } from './icons/LoaderIcon';
import { SparklesIcon, MapPinIcon, GlobeIcon, ListPlusIcon, SearchIcon } from 'lucide-react';
import { InstagramIcon as InstaIcon } from './icons/InstagramIcon';
import { LinkedInIcon as Linkedin } from './icons/LinkedInIcon';

interface CrawlFormProps {
  onJobCreated: (newJob: CrawlJob) => void;
}

const allSources: CrawlSource[] = ['google', 'instagram_via_search', 'linkedin_via_search', 'facebook_via_search', 'apify', 'firecrawl', 'google_maps', 'doctoralia_via_search', 'doctoralia_direct', 'scrape_do'];

const sourceLabels: Record<string, { label: string; isPremium?: boolean; icon?: React.ReactNode }> = {
    google: { label: 'Google Search', icon: <GlobeIcon size={12} /> },
    google_maps: { label: 'Google Maps', icon: <MapPinIcon size={12} /> },
    instagram_via_search: { label: 'Instagram', icon: <InstaIcon size={12} /> },
    linkedin_via_search: { label: 'LinkedIn', icon: <Linkedin size={12} /> },
    facebook_via_search: { label: 'Facebook' },
    doctoralia_via_search: { label: 'Doctoralia (Google)', icon: <SearchIcon size={12} /> },
    doctoralia_direct: { label: 'Doctoralia (Direto)', icon: <SparklesIcon size={12} />, isPremium: true },
    apify: { label: 'Apify (API)', isPremium: true },
    firecrawl: { label: 'Firecrawl (API)', isPremium: true },
    scrape_do: { label: 'Scrape.do (API)', isPremium: true },
    bing: { label: 'Bing Search' },
    openai_atlas: { label: 'OpenAI Atlas' }
};

const presets = [
    { id: 'all', label: 'Busca Completa', icon: <SparklesIcon size={14} />, sources: ['google', 'instagram_via_search', 'linkedin_via_search', 'facebook_via_search', 'google_maps', 'doctoralia_via_search'] },
    { id: 'instagram', label: 'Só Instagram', icon: <InstaIcon size={14} />, sources: ['instagram_via_search'] },
    { id: 'linkedin', label: 'Só LinkedIn', icon: <Linkedin size={14} />, sources: ['linkedin_via_search'] },
    { id: 'local', label: 'Local (Maps)', icon: <MapPinIcon size={14} />, sources: ['google_maps', 'google'] },
];

const CrawlForm: React.FC<CrawlFormProps> = ({ onJobCreated }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<Omit<CrawlJobParams, 'rate_limit' | 'run_mode'>>({
    name: '',
    niche: '',
    city: '',
    ddd: '',
    sources: ['google', 'instagram_via_search', 'linkedin_via_search', 'facebook_via_search', 'google_maps', 'doctoralia_via_search'],
    use_proxies: false,
    proxy_url: '',
    proxy_rotation: 'none',
    max_pages_per_source: 10,
    schedule: 'once',
    direct_url: '',
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target as HTMLInputElement;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
    setError(null);
  };

  const applyPreset = (sources: CrawlSource[]) => {
      setFormData(prev => ({ ...prev, sources }));
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
      const fullParams: CrawlJobParams = {
          ...formData,
          rate_limit: 60,
          run_mode: formData.schedule === 'once' ? 'once' : 'recurrent',
      }
      const newJob = await startCrawl(fullParams);
      onJobCreated(newJob);
      setFormData(prev => ({
          ...prev,
          name: '',
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
    <div className="bg-gray-800 p-6 rounded-2xl shadow-xl h-full border border-gray-700">
      <h2 className="text-2xl font-bold text-white mb-6 border-b border-gray-700 pb-4 flex items-center gap-3">
        <ListPlusIcon className="text-sky-400" /> Criar Novo Job
      </h2>
      {error && (
        <div className="mb-4 p-3 bg-red-900/50 border border-red-500 rounded-xl text-red-200 text-sm animate-pulse">
          {error}
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-[10px] font-bold text-gray-500 uppercase mb-2 tracking-widest ml-1">Nome do Job (Opcional)</label>
              <input
                type="text"
                name="name"
                id="name"
                value={formData.name}
                onChange={handleInputChange}
                className="w-full bg-gray-900 border border-gray-700 rounded-xl py-2.5 px-4 text-white focus:outline-none focus:ring-2 focus:ring-sky-500 shadow-inner transition-all"
                placeholder="Ex: Leads Médicos RJ - Instagram"
              />
            </div>

            <div>
              <label htmlFor="niche" className="block text-[10px] font-bold text-gray-500 uppercase mb-2 tracking-widest ml-1">Nicho / Palavra-Chave</label>
              <input
                type="text"
                name="niche"
                id="niche"
                value={formData.niche}
                onChange={handleInputChange}
                className="w-full bg-gray-900 border border-gray-700 rounded-xl py-2.5 px-4 text-white focus:outline-none focus:ring-2 focus:ring-sky-500 shadow-inner transition-all"
                placeholder="ex: clínica veterinária"
                required
                maxLength={99}
              />
            </div>

            <div>
              <label htmlFor="direct_url" className="block text-[10px] font-bold text-gray-500 uppercase mb-2 tracking-widest ml-1">URL Direta (Opcional - p/ Doctoralia Direto)</label>
              <input
                type="url"
                name="direct_url"
                id="direct_url"
                value={formData.direct_url}
                onChange={handleInputChange}
                className="w-full bg-gray-900 border border-gray-700 rounded-xl py-2.5 px-4 text-white focus:outline-none focus:ring-2 focus:ring-sky-500 shadow-inner transition-all text-xs"
                placeholder="https://www.doctoralia.com.br/pesquisa?q=..."
              />
              <p className="text-[9px] text-gray-500 mt-1 ml-1 italic">Cole o link da página de resultados do seu navegador para uma busca semi-automática.</p>
            </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              <label htmlFor="city" className="block text-[10px] font-bold text-gray-500 uppercase mb-2 tracking-widest ml-1">Cidade</label>
              <input
                type="text"
                name="city"
                id="city"
                value={formData.city}
                onChange={handleInputChange}
                className="w-full bg-gray-900 border border-gray-700 rounded-xl py-2.5 px-4 text-white focus:outline-none focus:ring-2 focus:ring-sky-500 shadow-inner transition-all"
                placeholder="ex: São Paulo"
                maxLength={99}
              />
            </div>
            <div>
              <label htmlFor="ddd" className="block text-[10px] font-bold text-gray-500 uppercase mb-2 tracking-widest ml-1">DDD (Opcional)</label>
              <input
                type="text"
                name="ddd"
                id="ddd"
                value={formData.ddd || ''}
                onChange={handleInputChange}
                className="w-full bg-gray-900 border border-gray-700 rounded-xl py-2.5 px-4 text-white focus:outline-none focus:ring-2 focus:ring-sky-500 shadow-inner transition-all"
                placeholder="ex: 11"
                maxLength={3}
              />
            </div>
        </div>

        <div className="grid grid-cols-1 gap-4">
            <div>
              <label htmlFor="schedule" className="block text-[10px] font-bold text-gray-500 uppercase mb-2 tracking-widest ml-1">Frequência</label>
              <select
                name="schedule"
                id="schedule"
                value={formData.schedule}
                onChange={handleInputChange}
                className="w-full bg-gray-900 border border-gray-700 rounded-xl py-2.5 px-4 text-white focus:outline-none focus:ring-2 focus:ring-sky-500 shadow-inner transition-all cursor-pointer"
              >
                <option value="once">Executar Agora</option>
                <option value="daily">Diário (Recorrente)</option>
                <option value="weekly">Semanal (Recorrente)</option>
                <option value="monthly">Mensal (Recorrente)</option>
              </select>
            </div>
        </div>

        <div>
          <label className="block text-[10px] font-bold text-gray-500 uppercase mb-3 tracking-widest ml-1">Atalhos de Fontes (Presets)</label>
          <div className="flex flex-wrap gap-2 mb-4">
            {presets.map(p => (
                <button
                    key={p.id}
                    type="button"
                    onClick={() => applyPreset(p.sources as CrawlSource[])}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-full text-[10px] font-bold text-gray-300 transition-all border border-gray-600 hover:border-sky-500/50"
                >
                    {p.icon} {p.label}
                </button>
            ))}
          </div>

          <label className="block text-[10px] font-bold text-gray-500 uppercase mb-3 tracking-widest ml-1">Fontes Específicas</label>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {allSources.map(source => (
              <label key={source} className={`flex flex-col p-2.5 rounded-xl cursor-pointer transition-all border ${
                formData.sources.includes(source) 
                ? 'bg-sky-900/20 border-sky-500 shadow-sm' 
                : 'bg-gray-700/50 border-gray-600 hover:border-gray-500'
              }`}>
                <div className="flex items-center justify-between mb-1">
                    <input
                        type="checkbox"
                        checked={formData.sources.includes(source)}
                        onChange={() => handleSourceChange(source)}
                        className="h-3.5 w-3.5 rounded border-gray-500 bg-gray-600 text-sky-600 focus:ring-sky-500 shadow-none"
                    />
                    <div className="flex items-center gap-1">
                        {sourceLabels[source]?.icon && <span className="text-gray-500">{sourceLabels[source].icon}</span>}
                        {sourceLabels[source]?.isPremium && (
                            <span className="text-[8px] font-bold text-yellow-500 bg-yellow-500/10 px-1 py-0.5 rounded border border-yellow-500/20 uppercase">API</span>
                        )}
                    </div>
                </div>
                <span className={`text-[11px] font-medium leading-tight truncate ${formData.sources.includes(source) ? 'text-sky-300' : 'text-gray-400'}`}>
                    {sourceLabels[source]?.label || source.replace(/_/g, ' ')}
                </span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <label htmlFor="max_pages_per_source" className="block text-[10px] font-bold text-gray-500 uppercase mb-3 tracking-widest ml-1 flex justify-between">
            <span>Profundidade: <span className="text-sky-400">{formData.max_pages_per_source} páginas</span></span>
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
            className="w-full h-1.5 bg-gray-900 rounded-lg appearance-none cursor-pointer accent-sky-500 mb-2"
          />
          <p className="text-[10px] text-gray-500 italic leading-tight">Quanto maior, mais leads, mas o tempo de execução aumenta.</p>
        </div>

        <div className="border-t border-gray-700 pt-6">
          <label className="flex items-center space-x-3 cursor-pointer mb-6 group">
            <input
              type="checkbox"
              name="use_proxies"
              checked={formData.use_proxies}
              onChange={handleInputChange}
              className="h-4 w-4 rounded border-gray-500 bg-gray-600 text-sky-600 focus:ring-sky-500"
            />
            <span className="text-sm font-bold text-gray-300 group-hover:text-white transition-colors">Usar Proxy Rotativo (Opcional)</span>
          </label>

          {formData.use_proxies && (
            <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300 bg-gray-900/40 p-4 rounded-2xl border border-gray-700 shadow-inner mb-6">
              <div>
                <label htmlFor="proxy_url" className="block text-[10px] font-bold text-gray-500 uppercase mb-2 tracking-widest">URL do Proxy</label>
                <input
                  type="text"
                  name="proxy_url"
                  id="proxy_url"
                  value={formData.proxy_url}
                  onChange={handleInputChange}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl py-2 px-3 text-white text-xs"
                  placeholder="http://user:pass@proxy.com:8080"
                />
              </div>
              <div>
                <label htmlFor="proxy_rotation" className="block text-[10px] font-bold text-gray-500 uppercase mb-2 tracking-widest">Rotação</label>
                <select
                  name="proxy_rotation"
                  id="proxy_rotation"
                  value={formData.proxy_rotation}
                  onChange={handleInputChange}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl py-2 px-3 text-white text-xs border-r-8 border-r-transparent"
                >
                  <option value="none">Sem Rotação</option>
                  <option value="per_request">Por Requisição</option>
                  <option value="per_job">Por Job</option>
                </select>
              </div>
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full flex justify-center items-center bg-gradient-to-r from-sky-600 to-sky-700 hover:from-sky-500 hover:to-sky-600 disabled:from-gray-700 disabled:to-gray-800 disabled:cursor-not-allowed text-white font-black py-4 px-6 rounded-2xl shadow-xl transition-all transform hover:scale-[1.02] active:scale-[0.98] tracking-widest uppercase text-xs"
        >
          {isSubmitting ? <LoaderIcon /> : <PlayIcon />}
          <span className="ml-3">{isSubmitting ? 'Explorando a Web...' : 'Lançar Crawl Master'}</span>
        </button>
      </form>
    </div>
  );
};

export default CrawlForm;
