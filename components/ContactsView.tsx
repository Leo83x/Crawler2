import React, { useState, useEffect, useMemo } from 'react';
import { Contact, CrawlJob, CrawlSource } from '../types';
import { getContacts, getJobs } from '../services/crawlerService';
import { LoaderIcon } from './icons/LoaderIcon';
import SendMessageModal from './SendMessageModal';
import { DownloadIcon } from './icons/DownloadIcon';
import { BackIcon } from './icons/BackIcon';
import { GoogleIcon } from './icons/GoogleIcon';
import { InstagramIcon } from './icons/InstagramIcon';
import { GoogleMapsIcon } from './icons/GoogleMapsIcon';
import { DoctoraliaIcon } from './icons/DoctoraliaIcon';
import { LinkIcon } from './icons/LinkIcon';

const ITEMS_PER_PAGE = 10;

const SourceDisplay: React.FC<{ sourceType: CrawlSource; sourceUrl: string }> = ({ sourceType, sourceUrl }) => {
    const sourceConfig = {
      google: {
        label: 'Google',
        className: 'bg-sky-600/20 text-sky-300 border border-sky-500/30',
        icon: <GoogleIcon />,
      },
      instagram_via_search: {
        label: 'Instagram',
        className: 'bg-pink-600/20 text-pink-300 border border-pink-500/30',
        icon: <InstagramIcon />,
      },
      google_maps: {
        label: 'Google Maps',
        className: 'bg-green-600/20 text-green-300 border border-green-500/30',
        icon: <GoogleMapsIcon />,
      },
      doctoralia_via_search: {
        label: 'Doctoralia',
        className: 'bg-purple-600/20 text-purple-300 border border-purple-500/30',
        icon: <DoctoraliaIcon />,
      }
    };
  
    const config = sourceConfig[sourceType] || { 
        label: sourceType.replace(/_/g, ' '), 
        className: 'bg-gray-600/20 text-gray-300 border border-gray-500/30',
        icon: <LinkIcon />
    };
  
    return (
      <a 
          href={sourceUrl} 
          target="_blank" 
          rel="noopener noreferrer"
          title={sourceUrl}
          className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold transition-transform hover:scale-105 ${config.className}`}
      >
          {config.icon}
          <span className="ml-2">{config.label}</span>
      </a>
    );
};

const ContactsView: React.FC = () => {
  const [jobs, setJobs] = useState<CrawlJob[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedJob, setSelectedJob] = useState<CrawlJob | null>(null);
  
  const [isLoadingJobs, setIsLoadingJobs] = useState<boolean>(true);
  const [isLoadingContacts, setIsLoadingContacts] = useState<boolean>(false);
  
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedSources, setSelectedSources] = useState<CrawlSource[]>([]);
  const [dateFilter, setDateFilter] = useState<{ start: string; end: string }>({ start: '', end: '' });
  const [dddFilter, setDddFilter] = useState<string>('');


  useEffect(() => {
    const fetchJobs = async () => {
      try {
        setIsLoadingJobs(true);
        const fetchedJobs = await getJobs();
        setJobs(fetchedJobs.filter(j => j.status === 'completed' || j.status === 'failed'));
        setError(null);
      } catch (err) {
        setError('Falha ao buscar as pesquisas.');
      } finally {
        setIsLoadingJobs(false);
      }
    };
    fetchJobs();
  }, []);
  
  useEffect(() => {
    if (!selectedJob) {
        setContacts([]);
        return;
    }
    
    const fetchContacts = async () => {
        try {
            setIsLoadingContacts(true);
            const fetchedContacts = await getContacts(selectedJob.id);
            setContacts(fetchedContacts);
            setError(null);
        } catch (err) {
            setError(`Falha ao buscar contatos para a pesquisa.`);
        } finally {
            setIsLoadingContacts(false);
        }
    };
    fetchContacts();
    resetFilters();
  }, [selectedJob]);

  const availableSources = useMemo(() => {
    const sources = new Set(contacts.map(c => c.source_type));
    return Array.from(sources).filter(Boolean) as CrawlSource[];
  }, [contacts]);

  const filteredContacts = useMemo(() => {
    const term = searchTerm.toLowerCase();
    const ddd = dddFilter.trim();
    const startDate = dateFilter.start ? new Date(dateFilter.start + 'T00:00:00') : null;
    const endDate = dateFilter.end ? new Date(dateFilter.end + 'T23:59:59') : null;

    return contacts
      .filter(contact =>
        (contact.name && contact.name.toLowerCase().includes(term)) ||
        contact.e164_number.includes(term) ||
        (contact.city && contact.city.toLowerCase().includes(term))
      )
      .filter(contact =>
        selectedSources.length === 0 || selectedSources.includes(contact.source_type)
      )
      .filter(contact => {
          if (!startDate && !endDate) return true;
          const contactDate = new Date(contact.found_at);
          if (startDate && contactDate < startDate) return false;
          if (endDate && contactDate > endDate) return false;
          return true;
      })
      .filter(contact => {
          if (!ddd) return true;
          const contactDdd = contact.e164_number.substring(3, 5);
          return contactDdd === ddd;
      });
  }, [contacts, searchTerm, selectedSources, dateFilter, dddFilter]);
  
  const resetFilters = () => {
    setSearchTerm('');
    setSelectedSources([]);
    setDateFilter({ start: '', end: '' });
    setDddFilter('');
    setCurrentPage(1);
  };
  
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedSources, dateFilter, dddFilter]);

  const paginatedContacts = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredContacts.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredContacts, currentPage]);

  const totalPages = Math.ceil(filteredContacts.length / ITEMS_PER_PAGE);

  const handleSendMessageClick = (contact: Contact) => setSelectedContact(contact);
  const handleCloseModal = () => setSelectedContact(null);

  const handleSourceChange = (source: CrawlSource) => {
    setSelectedSources(prev =>
      prev.includes(source)
        ? prev.filter(s => s !== source)
        : [...prev, source]
    );
  };
  
  const handleDateFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setDateFilter(prev => ({ ...prev, [name]: value }));
  };

  const exportToCSV = () => {
    const headers = ['Nome', 'Categoria', 'Telefone E.164', 'URL da Fonte', 'Fonte', 'Endereço', 'Cidade', 'Nicho'];
    const rows = filteredContacts.map(c => [
        `"${c.name || ''}"`, `"${c.category || ''}"`, `"${c.e164_number}"`, `"${c.source_url}"`, `"${c.source_type}"`, `"${c.address || ''}"`, `"${c.city || ''}"`, `"${c.niche}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + headers.join(',') + '\n' + rows.map(e => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    const fileName = `contatos_${selectedJob?.niche.replace(/\s/g, '_') || 'export'}.csv`;
    link.setAttribute("download", fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  const sourceLabels: Record<string, string> = {
    google: 'Google',
    instagram_via_search: 'Instagram',
    google_maps: 'Google Maps',
    doctoralia_via_search: 'Doctoralia',
  };
  
  const renderContactList = () => (
    <>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <button onClick={() => setSelectedJob(null)} className="p-2 bg-gray-700 hover:bg-gray-600 rounded-full transition-colors">
            <BackIcon />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight">Contatos para: <span className="text-sky-400">{selectedJob?.niche}</span></h1>
            <p className="mt-1 text-md text-gray-400">Local: {selectedJob?.city || 'N/A'} / {selectedJob?.ddd || 'N/A'}</p>
          </div>
        </div>

        <div className="bg-gray-800 p-6 rounded-lg shadow-xl">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                <input
                    type="text"
                    placeholder="Pesquisar por nome, cidade..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-gray-700 border border-gray-600 rounded-md shadow-sm py-2 px-4 text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
                <input
                    type="text"
                    placeholder="Filtrar por DDD (ex: 11)"
                    value={dddFilter}
                    onChange={(e) => setDddFilter(e.target.value)}
                    className="w-full bg-gray-700 border border-gray-600 rounded-md shadow-sm py-2 px-4 text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
                 <div className="flex items-center gap-2 text-sm">
                    <span className="text-gray-300">De:</span>
                    <input type="date" name="start" value={dateFilter.start} onChange={handleDateFilterChange} className="w-full bg-gray-700 border border-gray-600 rounded-md text-white px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-sky-500" />
                    <span className="text-gray-300">Até:</span>
                    <input type="date" name="end" value={dateFilter.end} onChange={handleDateFilterChange} className="w-full bg-gray-700 border border-gray-600 rounded-md text-white px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-sky-500" />
                </div>
            </div>
            <div className="flex flex-col md:flex-row justify-between items-center mb-4 gap-4 flex-wrap">
                {availableSources.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-gray-300">Fontes:</span>
                    {availableSources.map(source => (
                        <button
                            key={source}
                            onClick={() => handleSourceChange(source)}
                            className={`px-3 py-1 text-xs font-semibold rounded-full transition-colors ${
                                selectedSources.includes(source)
                                    ? 'bg-sky-600 text-white'
                                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                            }`}
                        >
                            {sourceLabels[source] || source.replace(/_/g, ' ')}
                        </button>
                    ))}
                  </div>
                )}
                
                <div className="flex items-center gap-4">
                  <button onClick={resetFilters} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-md transition duration-200 text-sm">
                    Limpar Filtros
                  </button>
                  <button onClick={exportToCSV} disabled={filteredContacts.length === 0} className="flex items-center bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed text-white font-bold py-2 px-4 rounded-md transition duration-200">
                    <DownloadIcon />
                    <span className="ml-2">Exportar CSV</span>
                  </button>
                </div>
            </div>
            {isLoadingContacts ? (
                <div className="flex justify-center items-center h-64"><LoaderIcon /><span className="ml-3 text-gray-400">Carregando contatos...</span></div>
            ) : error ? (
                <p className="text-center text-red-400 p-4">{error}</p>
            ) : filteredContacts.length === 0 ? (
                <p className="text-center text-gray-400 p-10">{contacts.length > 0 ? 'Nenhum contato corresponde à sua pesquisa.' : 'Nenhum contato foi encontrado para esta pesquisa.'}</p>
            ) : (
                <>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-700">
                        {/* Table Head */}
                        <thead className="bg-gray-800"><tr>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Nome / Empresa</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">WhatsApp</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Local</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Fonte</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Ações</th>
                        </tr></thead>
                        {/* Table Body */}
                        <tbody className="bg-gray-800 divide-y divide-gray-700">
                            {paginatedContacts.map(contact => (
                            <tr key={contact.id} className="hover:bg-gray-700 transition-colors">
                                <td className="px-6 py-4 whitespace-nowrap"><div className="text-sm font-medium text-white">{contact.name}</div><div className="text-xs text-gray-400">{contact.category}</div></td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-sky-400 font-mono">{contact.e164_number}</td>
                                <td className="px-6 py-4 whitespace-nowrap"><div className="text-sm text-gray-300">{contact.city || 'Não informado'}</div><div className="text-xs text-gray-400 truncate max-w-xs">{contact.address}</div></td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">
                                    <SourceDisplay sourceType={contact.source_type} sourceUrl={contact.source_url} />
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium"><button onClick={() => handleSendMessageClick(contact)} className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-md transition duration-200 text-xs">Enviar Mensagem</button></td>
                            </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {/* Pagination Controls */}
                <div className="flex justify-between items-center mt-4 px-2">
                    <span className="text-sm text-gray-400">Total de {filteredContacts.length} contatos</span>
                    <div className="flex items-center gap-2">
                        <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-3 py-1 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:cursor-not-allowed rounded-md text-sm transition-colors">Anterior</button>
                        <span className="text-sm text-gray-300">Página {currentPage} de {totalPages}</span>
                        <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="px-3 py-1 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:cursor-not-allowed rounded-md text-sm transition-colors">Próximo</button>
                    </div>
                </div>
                </>
            )}
        </div>
      </div>
      {selectedContact && <SendMessageModal contact={selectedContact} onClose={handleCloseModal} />}
    </>
  );
  
  const renderJobList = () => (
    <div className="space-y-6">
        <div>
            <h1 className="text-4xl font-bold text-white tracking-tight">Pesquisas Realizadas</h1>
            <p className="mt-2 text-lg text-gray-400">Selecione uma pesquisa para visualizar, filtrar e exportar os contatos coletados.</p>
        </div>
        <div className="bg-gray-800 rounded-lg shadow-xl overflow-hidden">
            {isLoadingJobs ? (
                 <div className="flex justify-center items-center h-64"><LoaderIcon /><span className="ml-3 text-gray-400">Carregando pesquisas...</span></div>
            ) : error ? (
                <p className="text-center text-red-400 p-4">{error}</p>
            ) : jobs.length === 0 ? (
                 <p className="text-center text-gray-400 p-10">Nenhuma pesquisa foi concluída ainda. Vá para o Gerenciador de Crawl para iniciar uma.</p>
            ) : (
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-700">
                        <thead className="bg-gray-800"><tr>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Nicho</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Local</th>
                            <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider">Contatos Encontrados</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Data</th>
                        </tr></thead>
                        <tbody className="bg-gray-800 divide-y divide-gray-700">
                            {jobs.map(job => (
                                <tr key={job.id} onClick={() => setSelectedJob(job)} className="hover:bg-gray-700 transition-colors cursor-pointer">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">{job.niche}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{job.city || '--'} / {job.ddd || '--'}</td>
                                    <td className={`px-6 py-4 whitespace-nowrap text-sm text-center font-bold ${job.contacts_found > 0 ? 'text-sky-400' : 'text-gray-500'}`}>{job.contacts_found}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">{new Date(job.created_at).toLocaleString()}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    </div>
  );

  return selectedJob ? renderContactList() : renderJobList();
};

export default ContactsView;