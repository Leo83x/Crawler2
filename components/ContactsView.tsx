import { Avatar } from './Avatar';
import React, { useState, useEffect, useMemo } from 'react';
import { Contact, CrawlJob, CrawlSource } from '../types';
import { getContacts, getJobs, deleteContacts, addToBlacklist, deleteJob, updateContact, enrichContact, updateJobName } from '../services/crawlerService';
import { LoaderIcon } from './icons/LoaderIcon';
import SendMessageModal from './SendMessageModal';
import ConfirmationModal from './ConfirmationModal';
import { DownloadIcon } from './icons/DownloadIcon';
import { BackIcon } from './icons/BackIcon';
import { TrashIcon } from './icons/TrashIcon';
import { GoogleIcon } from './icons/GoogleIcon';
import { SparklesIcon, MailIcon, InfoIcon, StarIcon, BuildingIcon, UserIcon, BrainCircuitIcon, Edit2Icon, CheckIcon, XIcon, PlusIcon, UploadIcon, PhoneIcon } from 'lucide-react';
import ContactDetailsModal from './ContactDetailsModal';
import ImportContactsModal from './ImportContactsModal';
import AddContactModal from './AddContactModal';
import { InstagramIcon } from './icons/InstagramIcon';
import { GoogleMapsIcon } from './icons/GoogleMapsIcon';
import { DoctoraliaIcon } from './icons/DoctoraliaIcon';
import { LinkedInIcon } from './icons/LinkedInIcon';
import { FacebookIcon } from './icons/FacebookIcon';
import { ApifyIcon } from './icons/ApifyIcon';
import { FirecrawlIcon } from './icons/FirecrawlIcon';
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
      },
      linkedin_via_search: {
        label: 'LinkedIn',
        className: 'bg-blue-700/20 text-blue-300 border border-blue-600/30',
        icon: <LinkedInIcon />,
      },
      facebook_via_search: {
        label: 'Facebook',
        className: 'bg-blue-600/20 text-blue-300 border border-blue-500/30',
        icon: <FacebookIcon />,
      },
      apify: {
        label: 'Apify',
        className: 'bg-orange-600/20 text-orange-300 border border-orange-500/30',
        icon: <ApifyIcon />,
      },
      firecrawl: {
        label: 'Firecrawl',
        className: 'bg-red-600/20 text-red-300 border border-red-500/30',
        icon: <FirecrawlIcon />,
      },
      scrape_do: {
        label: 'Scrape.do',
        className: 'bg-yellow-600/20 text-yellow-300 border border-yellow-500/30',
        icon: <LinkIcon />,
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

interface ContactsViewProps {
  jobs: CrawlJob[];
  onJobsUpdate: () => void;
}

const ContactsView: React.FC<ContactsViewProps> = ({ jobs, onJobsUpdate }) => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedJob, setSelectedJob] = useState<CrawlJob | null>(null);
  
  const [isLoadingJobs, setIsLoadingJobs] = useState<boolean>(false);
  const [isLoadingContacts, setIsLoadingContacts] = useState<boolean>(false);
  
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedSources, setSelectedSources] = useState<CrawlSource[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<Contact['status'][]>([]);
  const [dateFilter, setDateFilter] = useState<{ start: string; end: string }>({ start: '', end: '' });
  const [dddFilter, setDddFilter] = useState<string>('');
  const [selectedContactIds, setSelectedContactIds] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
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
  const [isUpdatingStatus, setIsUpdatingStatus] = useState<string | null>(null);
  const [isEnriching, setIsEnriching] = useState<string | null>(null);
  const [onlyWithWhatsApp, setOnlyWithWhatsApp] = useState(false);
  const [notesModalContact, setNotesModalContact] = useState<Contact | null>(null);
  const [viewingContact, setViewingContact] = useState<Contact | null>(null);
  const [editingJobNameId, setEditingJobNameId] = useState<string | null>(null);
  const [tempJobName, setTempJobName] = useState('');
  
  const [showImportModal, setShowImportModal] = useState(false);
  const [showAddContactModal, setShowAddContactModal] = useState(false);

  const fetchContacts = React.useCallback(async () => {
    if (!selectedJob) return;
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
  }, [selectedJob]);

  const toggleSelectAll = () => {
    if (selectedContactIds.size === filteredContacts.length) {
      setSelectedContactIds(new Set());
    } else {
      setSelectedContactIds(new Set(filteredContacts.map(c => c.id)));
    }
  };

  const toggleSelectContact = (id: string) => {
    const newSelected = new Set(selectedContactIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedContactIds(newSelected);
  };

  const handleDeleteSelected = async () => {
    if (selectedContactIds.size === 0) return;
    
    setConfirmModal({
      isOpen: true,
      title: 'Excluir Contatos',
      message: `Tem certeza que deseja excluir ${selectedContactIds.size} contatos selecionados?`,
      isDestructive: true,
      onConfirm: async () => {
        try {
          setIsDeleting(true);
          await deleteContacts(Array.from(selectedContactIds) as string[]);
          setContacts(prev => prev.filter(c => !selectedContactIds.has(c.id)));
          setSelectedContactIds(new Set());
        } catch (err) {
          setError("Falha ao excluir contatos selecionados.");
        } finally {
          setIsDeleting(false);
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  const handleBlacklistSelected = async () => {
    if (selectedContactIds.size === 0) return;
    
    setConfirmModal({
      isOpen: true,
      title: 'Banir Contatos',
      message: `Deseja adicionar os ${selectedContactIds.size} contatos selecionados à lista de exclusão? Eles serão removidos dos resultados atuais e ignorados em pesquisas futuras.`,
      isDestructive: true,
      onConfirm: async () => {
        try {
          setIsDeleting(true);
          const idsToBlacklist = Array.from(selectedContactIds) as string[];
          const contactsToBlacklist = contacts.filter(c => selectedContactIds.has(c.id));
          
          for (const contact of contactsToBlacklist) {
            await addToBlacklist(contact.e164_number, `Exclusão em massa: ${contact.niche}`);
          }
          
          await deleteContacts(idsToBlacklist);
          setContacts(prev => prev.filter(c => !selectedContactIds.has(c.id)));
          setSelectedContactIds(new Set());
        } catch (err) {
          setError("Falha ao adicionar contatos selecionados à lista de exclusão.");
        } finally {
          setIsDeleting(false);
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  const handleDeleteAll = async () => {
    if (filteredContacts.length === 0) return;
    
    setConfirmModal({
      isOpen: true,
      title: 'Excluir Tudo',
      message: `Tem certeza que deseja excluir TODOS os ${filteredContacts.length} contatos filtrados desta pesquisa?`,
      isDestructive: true,
      onConfirm: async () => {
        try {
          setIsDeleting(true);
          const idsToDelete = filteredContacts.map(c => c.id);
          await deleteContacts(idsToDelete);
          setContacts(prev => prev.filter(c => !idsToDelete.includes(c.id)));
          setSelectedContactIds(new Set());
        } catch (err) {
          setError("Falha ao excluir todos os contatos.");
        } finally {
          setIsDeleting(false);
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  const handleUpdateStatus = async (contactId: string, newStatus: Contact['status']) => {
    try {
      setIsUpdatingStatus(contactId);
      await updateContact(contactId, { status: newStatus });
      setContacts(prev => prev.map(c => c.id === contactId ? { ...c, status: newStatus } : c));
    } catch (error) {
      console.error("Failed to update status:", error);
    } finally {
      setIsUpdatingStatus(null);
    }
  };

  const handleUpdateNotes = async (contactId: string, notes: string) => {
    try {
      await updateContact(contactId, { notes });
      setContacts(prev => prev.map(c => c.id === contactId ? { ...c, notes } : c));
    } catch (error) {
      console.error("Failed to update notes:", error);
    }
  };

  const handleEnrichContact = async (contact: Contact) => {
    try {
      setIsEnriching(contact.id);
      const enriched = await enrichContact(contact);
      setContacts(prev => prev.map(c => c.id === contact.id ? enriched : c));
    } catch (error) {
      console.error("Failed to enrich contact:", error);
      setError("Falha ao enriquecer contato com IA.");
    } finally {
      setIsEnriching(null);
    }
  };

  const handleRenameJob = async (jobId: string, newName: string) => {
    try {
        await updateJobName(jobId, newName);
        onJobsUpdate();
        if (selectedJob?.id === jobId) {
            setSelectedJob(prev => prev ? { ...prev, name: newName } : null);
        }
        setEditingJobNameId(null);
    } catch (error) {
        console.error("Failed to rename job:", error);
        setError("Falha ao renomear pesquisa.");
    }
  };

  const handleAddToBlacklist = async (contact: Contact) => {
    setConfirmModal({
      isOpen: true,
      title: 'Adicionar à Lista de Exclusão',
      message: `Deseja adicionar o número ${contact.e164_number} à lista de exclusão? Ele não aparecerá em pesquisas futuras.`,
      isDestructive: true,
      onConfirm: async () => {
        try {
          setIsDeleting(true);
          await addToBlacklist(contact.e164_number, `Excluído da pesquisa: ${contact.niche}`);
          // Also delete from current results
          await deleteContacts([contact.id]);
          setContacts(prev => prev.filter(c => c.id !== contact.id));
        } catch (err) {
          setError("Falha ao adicionar à lista de exclusão.");
        } finally {
          setIsDeleting(false);
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  const handleDeleteJob = async (e: React.MouseEvent, jobId: string) => {
    e.stopPropagation(); // Prevent row click
    
    setConfirmModal({
      isOpen: true,
      title: 'Excluir Pesquisa',
      message: "Tem certeza que deseja excluir esta pesquisa e todos os seus contatos?",
      isDestructive: true,
      onConfirm: async () => {
        try {
          await deleteJob(jobId);
          onJobsUpdate();
          if (selectedJob?.id === jobId) setSelectedJob(null);
        } catch (err) {
          setError("Falha ao excluir pesquisa.");
        } finally {
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  const handleExportCSV = () => {
    if (filteredContacts.length === 0) return;

    const headers = [
      'Nome', 
      'Categoria', 
      'Telefone (E.164)', 
      'Telefone (Original)', 
      'Cidade', 
      'Endereço', 
      'Fonte', 
      'URL da Fonte', 
      'Data Encontrado',
      'E-mail (IA)',
      'Descrição (IA)',
      'Tipo de Conta (IA)',
      'Qualidade do Lead (IA)',
      'Data Enriquecimento',
      'Notas'
    ];

    const rows = filteredContacts.map(c => [
      c.name || '',
      c.category || '',
      c.e164_number,
      c.raw_number,
      c.city || '',
      c.address || '',
      c.source_type,
      c.source_url,
      c.found_at.toLocaleString(),
      c.email || '',
      c.description || '',
      c.account_type || '',
      c.lead_quality || '',
      c.enriched_at ? c.enriched_at.toLocaleString() : '',
      c.notes || ''
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.map(field => `"${String(field || '').replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `contatos_avancado_${selectedJob?.niche || 'extraidos'}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  useEffect(() => {
    onJobsUpdate();
  }, [onJobsUpdate]);
  
  useEffect(() => {
    if (!selectedJob) {
        setContacts([]);
        return;
    }
    
    fetchContacts();
    resetFilters();
  }, [selectedJob, fetchContacts]);

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
        (contact.e164_number && contact.e164_number.includes(term)) ||
        (contact.email && contact.email.toLowerCase().includes(term)) ||
        (contact.instagram_handle && contact.instagram_handle.toLowerCase().includes(term)) ||
        (contact.linkedin_url && contact.linkedin_url.toLowerCase().includes(term)) ||
        (contact.city && contact.city.toLowerCase().includes(term))
      )
      .filter(contact =>
        selectedSources.length === 0 || selectedSources.includes(contact.source_type)
      )
      .filter(contact =>
        selectedStatuses.length === 0 || selectedStatuses.includes(contact.status || 'new')
      )
      .filter(contact => {
          if (!startDate && !endDate) return true;
          const contactDate = new Date(contact.found_at);
          if (startDate && contactDate < startDate) return false;
          if (endDate && contactDate > endDate) return false;
          return true;
      })
      .filter(contact => {
          if (!ddd || !contact.e164_number) return true;
          const contactDdd = contact.e164_number.substring(3, 5);
          return contactDdd === ddd;
      })
      .filter(contact => {
          if (onlyWithWhatsApp) return !!contact.e164_number;
          return true;
      });
  }, [contacts, searchTerm, selectedSources, selectedStatuses, dateFilter, dddFilter, onlyWithWhatsApp]);
  
  const resetFilters = () => {
    setSearchTerm('');
    setSelectedSources([]);
    setSelectedStatuses([]);
    setDateFilter({ start: '', end: '' });
    setDddFilter('');
    setOnlyWithWhatsApp(false);
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
  
  const sourceLabels: Record<string, string> = {
    google: 'Google',
    instagram_via_search: 'Instagram',
    google_maps: 'Google Maps',
    doctoralia_via_search: 'Doctoralia',
    linkedin_via_search: 'LinkedIn',
    facebook_via_search: 'Facebook',
    apify: 'Apify',
    firecrawl: 'Firecrawl',
  };
  
  const renderContactList = () => (
    <>
      {showImportModal && (
          <ImportContactsModal 
            isOpen={showImportModal} 
            onClose={() => setShowImportModal(false)} 
            currentJobs={jobs}
            onImportSuccess={() => selectedJob && fetchContacts()}
          />
      )}
      {showAddContactModal && (
          <AddContactModal 
            isOpen={showAddContactModal} 
            onClose={() => setShowAddContactModal(false)} 
            currentJobs={jobs}
            onSuccess={() => selectedJob && fetchContacts()}
          />
      )}

      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <button onClick={() => setSelectedJob(null)} className="p-2 bg-gray-700 hover:bg-gray-600 rounded-full transition-colors">
            <BackIcon />
          </button>
          <div className="flex-1">
            {editingJobNameId === selectedJob?.id ? (
                <div className="flex items-center gap-2">
                    <input 
                        autoFocus
                        value={tempJobName}
                        onChange={e => setTempJobName(e.target.value)}
                        className="bg-gray-700 border border-sky-500 rounded px-3 py-1 text-xl font-bold text-white outline-none"
                        onKeyDown={e => {
                            if (e.key === 'Enter') handleRenameJob(selectedJob!.id, tempJobName);
                            if (e.key === 'Escape') setEditingJobNameId(null);
                        }}
                    />
                    <button onClick={() => handleRenameJob(selectedJob!.id, tempJobName)} className="text-emerald-400 p-2">
                        <CheckIcon size={20} />
                    </button>
                    <button onClick={() => setEditingJobNameId(null)} className="text-gray-400 p-2">
                        <XIcon size={20} />
                    </button>
                </div>
            ) : (
                <div className="flex items-center gap-2 group">
                    <h1 className="text-3xl font-bold text-white tracking-tight">
                        Contatos para: <span className="text-sky-400">{selectedJob?.name || selectedJob?.niche}</span>
                    </h1>
                    <button 
                        onClick={() => {
                            setEditingJobNameId(selectedJob!.id);
                            setTempJobName(selectedJob?.name || selectedJob?.niche || '');
                        }}
                        className="p-1 text-gray-500 hover:text-sky-400 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                        <Edit2Icon size={18} />
                    </button>
                </div>
            )}
            <p className="mt-1 text-md text-gray-400">Local: {selectedJob?.city || 'N/A'} / {selectedJob?.ddd || 'N/A'} {selectedJob?.name && <span className="text-xs italic ml-2 opacity-50">({selectedJob.niche})</span>}</p>
          </div>

          <div className="flex items-center gap-3">
              <button 
                onClick={() => setShowAddContactModal(true)}
                className="bg-gray-800 hover:bg-gray-700 text-gray-300 px-4 py-2 rounded-xl border border-gray-700 text-sm font-bold transition-all flex items-center gap-2"
              >
                  <PlusIcon size={16} /> Adicionar Manual
              </button>
              <button 
                onClick={() => setShowImportModal(true)}
                className="bg-sky-600 hover:bg-sky-500 text-white px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 shadow-lg shadow-sky-900/20"
              >
                  <UploadIcon size={16} /> Importar Lista
              </button>
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
                <div className="flex items-center gap-4 flex-wrap">
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

                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-gray-300">Status:</span>
                      {(['new', 'contacted', 'interested', 'converted', 'rejected'] as Contact['status'][]).map(status => (
                        <button
                          key={status}
                          onClick={() => {
                            setSelectedStatuses(prev => 
                              prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status]
                            );
                            setCurrentPage(1);
                          }}
                          className={`px-3 py-1 text-xs font-semibold rounded-full transition-colors ${
                            selectedStatuses.includes(status)
                              ? 'bg-sky-600 text-white'
                              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                          }`}
                        >
                          {status === 'new' ? 'Novo' : 
                           status === 'contacted' ? 'Contatado' : 
                           status === 'interested' ? 'Interessado' : 
                           status === 'converted' ? 'Convertido' : 'Descartado'}
                        </button>
                      ))}
                    </div>
                    
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-gray-300">Filtro Rápido:</span>
                      <button
                        onClick={() => setOnlyWithWhatsApp(!onlyWithWhatsApp)}
                        className={`px-3 py-1 text-xs font-semibold rounded-full transition-colors flex items-center gap-1.5 ${
                          onlyWithWhatsApp
                            ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/40'
                            : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                        }`}
                      >
                        <PhoneIcon className="w-3 h-3" />
                        Apenas WhatsApp
                      </button>
                    </div>

                    {selectedContactIds.size > 0 && (
                        <div className="flex items-center gap-2 animate-in fade-in zoom-in duration-200">
                            <button 
                                onClick={handleDeleteSelected}
                                disabled={isDeleting}
                                className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold py-1.5 px-3 rounded-md transition-colors"
                            >
                                <TrashIcon /> Excluir ({selectedContactIds.size})
                            </button>
                            <button 
                                onClick={handleBlacklistSelected}
                                disabled={isDeleting}
                                className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-white text-xs font-bold py-1.5 px-3 rounded-md transition-colors border border-gray-600"
                            >
                                <TrashIcon /> Banir ({selectedContactIds.size})
                            </button>
                        </div>
                    )}
                </div>
                
                <div className="flex items-center gap-4">
                  <button 
                    onClick={handleExportCSV}
                    disabled={filteredContacts.length === 0}
                    className="flex items-center gap-2 bg-sky-600 hover:bg-sky-700 disabled:bg-gray-700 text-white font-bold py-2 px-4 rounded-md transition duration-200 text-sm"
                  >
                    <DownloadIcon /> Exportar CSV ({filteredContacts.length})
                  </button>
                  <button 
                    onClick={() => {
                        const info = filteredContacts.map(c => c.e164_number || c.instagram_handle || c.linkedin_url || c.email).filter(Boolean).join('\n');
                        navigator.clipboard.writeText(info);
                        alert("Dados de contato copiados para a área de transferência.");
                    }}
                    disabled={filteredContacts.length === 0}
                    className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 text-white font-bold py-2 px-4 rounded-md transition duration-200 text-sm"
                  >
                    Copiar Contatos
                  </button>
                  <button onClick={resetFilters} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-md transition duration-200 text-sm">
                    Limpar Filtros
                  </button>
                  <button 
                    onClick={handleDeleteAll}
                    disabled={isDeleting || filteredContacts.length === 0}
                    className="flex items-center gap-2 bg-red-900/40 hover:bg-red-800/60 text-red-200 border border-red-500/30 font-bold py-2 px-4 rounded-md transition duration-200 text-sm"
                  >
                    <TrashIcon />
                    Excluir Todos
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
                            <th scope="col" className="px-4 py-3 text-left">
                                <input 
                                    type="checkbox" 
                                    checked={selectedContactIds.size === filteredContacts.length && filteredContacts.length > 0}
                                    onChange={toggleSelectAll}
                                    className="h-4 w-4 rounded border-gray-500 bg-gray-600 text-sky-600 focus:ring-sky-500"
                                />
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Nome / Empresa</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Contato Principal</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Local</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Inteligência</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Status</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Fonte</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Ações</th>
                        </tr></thead>
                        {/* Table Body */}
                        <tbody className="bg-gray-800 divide-y divide-gray-700">
                            {paginatedContacts.map(contact => (
                            <tr 
                              key={contact.id} 
                              onClick={() => setViewingContact(contact)}
                              className={`hover:bg-gray-700 transition-colors cursor-pointer ${selectedContactIds.has(contact.id) ? 'bg-sky-900/20' : ''}`}
                            >
                                <td className="px-4 py-4 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                                    <input 
                                        type="checkbox" 
                                        checked={selectedContactIds.has(contact.id)}
                                        onChange={() => toggleSelectContact(contact.id)}
                                        className="h-4 w-4 rounded border-gray-500 bg-gray-600 text-sky-600 focus:ring-sky-500"
                                    />
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="flex items-center gap-3">
                                        <Avatar 
                                            src={contact.photo_url} 
                                            name={contact.name} 
                                            size="md" 
                                            accountType={contact.account_type as any}
                                        />
                                        <div>
                                            <div className="text-sm font-medium text-white">{contact.name || 'Sem nome'}</div>
                                            <div className="text-xs text-gray-400">{contact.category}</div>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-sky-400 font-mono">
                                    <div className="flex flex-col gap-1" onClick={(e) => e.stopPropagation()}>
                                        {contact.e164_number ? (
                                            <div className="flex items-center gap-2">
                                                <span>{contact.e164_number}</span>
                                                <button 
                                                    onClick={() => navigator.clipboard.writeText(contact.e164_number!)}
                                                    className="p-1 hover:bg-gray-600 rounded text-gray-400 hover:text-white transition-colors"
                                                    title="Copiar número"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                                                </button>
                                            </div>
                                        ) : contact.instagram_handle ? (
                                            <div className="flex items-center gap-2 text-pink-400 font-sans">
                                                <InstagramIcon />
                                                <span>@{contact.instagram_handle}</span>
                                            </div>
                                        ) : contact.linkedin_url ? (
                                            <div className="flex items-center gap-2 text-blue-400 font-sans">
                                                <LinkedInIcon />
                                                <span className="truncate max-w-[120px]">LinkedIn Perfil</span>
                                            </div>
                                        ) : contact.email ? (
                                            <div className="flex items-center gap-2 text-gray-400 font-sans">
                                                <MailIcon size={14} />
                                                <span className="truncate max-w-[120px]">{contact.email}</span>
                                            </div>
                                        ) : (
                                            <span className="text-gray-600 italic">Sem contato direto</span>
                                        )}
                                    </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="text-sm text-gray-300">{contact.city || 'Não informado'}</div>
                                    <div className="text-xs text-gray-400 truncate max-w-xs">{contact.address}</div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    {contact.enriched_at ? (
                                        <div className="space-y-1">
                                            {contact.email && (
                                                <div className="flex items-center gap-1 text-xs text-sky-400">
                                                    <MailIcon size={12} />
                                                    <span className="truncate max-w-[150px]">{contact.email}</span>
                                                </div>
                                            )}
                                            {contact.lead_quality && (
                                                <div className="flex items-center gap-1 text-xs text-yellow-400">
                                                    <StarIcon size={12} fill="currentColor" />
                                                    <span>{contact.lead_quality}/10</span>
                                                </div>
                                            )}
                                            {contact.account_type && (
                                                <div className="flex items-center gap-1 text-[10px] text-purple-400 uppercase font-bold">
                                                    {contact.account_type === 'business' ? <BuildingIcon size={10} /> : <UserIcon size={10} />}
                                                    <span>{contact.account_type === 'business' ? 'Empresa' : 'Pessoal'}</span>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="text-xs text-gray-500 italic">Aguardando IA...</div>
                                    )}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                                    <select 
                                        value={contact.status || 'new'} 
                                        onChange={(e) => handleUpdateStatus(contact.id, e.target.value as any)}
                                        disabled={isUpdatingStatus === contact.id}
                                        className={`text-xs font-bold rounded-full px-2 py-1 border-none focus:ring-0 cursor-pointer transition-colors ${
                                            contact.status === 'interested' ? 'bg-green-900/40 text-green-400' :
                                            contact.status === 'contacted' ? 'bg-blue-900/40 text-blue-400' :
                                            contact.status === 'converted' ? 'bg-purple-900/40 text-purple-400' :
                                            contact.status === 'rejected' ? 'bg-red-900/40 text-red-400' :
                                            'bg-gray-700 text-gray-300'
                                        }`}
                                    >
                                        <option value="new" className="bg-gray-800 text-white">Novo</option>
                                        <option value="contacted" className="bg-gray-800 text-white">Contatado</option>
                                        <option value="interested" className="bg-gray-800 text-white">Interessado</option>
                                        <option value="converted" className="bg-gray-800 text-white">Convertido</option>
                                        <option value="rejected" className="bg-gray-800 text-white">Descartado</option>
                                    </select>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">
                                    <SourceDisplay sourceType={contact.source_type} sourceUrl={contact.source_url} />
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium" onClick={(e) => e.stopPropagation()}>
                                    <div className="flex items-center gap-2">
                                        <button onClick={() => handleSendMessageClick(contact)} className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-md transition duration-200 text-xs">Enviar Mensagem</button>
                                        <button 
                                            onClick={() => handleEnrichContact(contact)} 
                                            disabled={isEnriching === contact.id}
                                            title="Enriquecer com IA"
                                            className={`p-2 rounded-md transition-colors ${contact.enriched_at ? 'bg-purple-900/40 text-purple-400 border border-purple-500/30' : 'bg-gray-700 hover:bg-gray-600 text-gray-300'}`}
                                        >
                                            {isEnriching === contact.id ? <LoaderIcon className="w-4 h-4 animate-spin" /> : <SparklesIcon size={16} />}
                                        </button>
                                        <button 
                                            onClick={() => setNotesModalContact(contact)} 
                                            title="Adicionar Notas"
                                            className={`p-2 rounded-md transition-colors ${contact.notes ? 'bg-sky-900/40 text-sky-400 border border-sky-500/30' : 'bg-gray-700 hover:bg-gray-600 text-gray-300'}`}
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15.5 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8.5L15.5 3Z"/><path d="M15 3v6h6"/><path d="M9 18h6"/><path d="M9 14h6"/><path d="M9 10h3"/></svg>
                                        </button>
                                        <button 
                                            onClick={() => handleAddToBlacklist(contact)} 
                                            title="Adicionar à Lista de Exclusão"
                                            className="p-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-md transition-colors"
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
      {viewingContact && <ContactDetailsModal contact={viewingContact} onClose={() => setViewingContact(null)} />}
      {notesModalContact && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 border border-gray-700 rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-6">
              <h3 className="text-xl font-bold text-white mb-2">Notas para {notesModalContact.name || notesModalContact.e164_number}</h3>
              <p className="text-gray-400 text-sm mb-4">Adicione observações internas sobre este lead.</p>
              <textarea
                className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-sky-500 focus:border-transparent transition-all h-32 resize-none"
                placeholder="Ex: Já conversamos, ficou de retornar na segunda..."
                defaultValue={notesModalContact.notes || ''}
                id="notes-textarea"
              />
              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setNotesModalContact(null)}
                  className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => {
                    const notes = (document.getElementById('notes-textarea') as HTMLTextAreaElement).value;
                    handleUpdateNotes(notesModalContact.id, notes);
                    setNotesModalContact(null);
                  }}
                  className="px-6 py-2 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-lg transition-all shadow-lg shadow-sky-900/20"
                >
                  Salvar Notas
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
        isDestructive={confirmModal.isDestructive}
      />
    </>
  );
  
  const renderJobList = () => (
    <div className="space-y-6">
        {showImportModal && (
            <ImportContactsModal 
                isOpen={showImportModal} 
                onClose={() => setShowImportModal(false)} 
                currentJobs={jobs}
                onImportSuccess={() => onJobsUpdate()}
            />
        )}
        {showAddContactModal && (
            <AddContactModal 
                isOpen={showAddContactModal} 
                onClose={() => setShowAddContactModal(false)} 
                currentJobs={jobs}
                onSuccess={() => onJobsUpdate()}
            />
        )}

        <div className="flex justify-between items-end">
            <div>
                <h1 className="text-4xl font-bold text-white tracking-tight">Pesquisas Realizadas</h1>
                <p className="mt-2 text-lg text-gray-400">Selecione uma pesquisa para visualizar, filtrar e exportar os contatos coletados.</p>
            </div>
            <div className="flex items-center gap-3">
                <button 
                    onClick={() => setShowAddContactModal(true)}
                    className="bg-gray-800 hover:bg-gray-700 text-gray-300 px-4 py-2 rounded-xl border border-gray-700 text-sm font-bold transition-all flex items-center gap-2"
                >
                    <PlusIcon size={16} /> Adicionar Manual
                </button>
                <button 
                    onClick={() => setShowImportModal(true)}
                    className="bg-sky-600 hover:bg-sky-500 text-white px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 shadow-lg shadow-sky-900/20"
                >
                    <UploadIcon size={16} /> Importar Lista
                </button>
            </div>
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
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Nome / Nicho</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Local</th>
                            <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider">Contatos Encontrados</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Data</th>
                            <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider">Ações</th>
                        </tr></thead>
                        <tbody className="bg-gray-800 divide-y divide-gray-700">
                            {jobs.map(job => (
                                <tr key={job.id} onClick={() => setSelectedJob(job)} className="hover:bg-gray-700 transition-colors cursor-pointer group/tr">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">
                                        {editingJobNameId === job.id ? (
                                            <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                                                <input 
                                                    autoFocus
                                                    value={tempJobName}
                                                    onChange={e => setTempJobName(e.target.value)}
                                                    className="bg-gray-900 border border-sky-500 rounded px-2 py-1 text-xs text-white outline-none"
                                                    onKeyDown={e => {
                                                        if (e.key === 'Enter') handleRenameJob(job.id, tempJobName);
                                                        if (e.key === 'Escape') setEditingJobNameId(null);
                                                    }}
                                                />
                                                <button onClick={() => handleRenameJob(job.id, tempJobName)} className="text-emerald-400">
                                                    <CheckIcon size={14} />
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2">
                                                <div className="flex flex-col">
                                                    <span className="font-bold">{job.name || job.niche}</span>
                                                    {job.name && <span className="text-[10px] text-gray-500 font-normal italic">{job.niche}</span>}
                                                </div>
                                                <button 
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setEditingJobNameId(job.id);
                                                        setTempJobName(job.name || job.niche);
                                                    }}
                                                    className="p-1 text-gray-500 hover:text-sky-400 opacity-0 group-hover/tr:opacity-100 transition-opacity"
                                                >
                                                    <Edit2Icon size={14} />
                                                </button>
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{job.city || '--'} / {job.ddd || '--'}</td>
                                    <td className={`px-6 py-4 whitespace-nowrap text-sm text-center font-bold ${job.contacts_found > 0 ? 'text-sky-400' : 'text-gray-500'}`}>{job.contacts_found}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">{new Date(job.created_at).toLocaleString()}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <button 
                                            onClick={(e) => handleDeleteJob(e, job.id)}
                                            className="text-red-400 hover:text-red-300 p-2 transition-colors"
                                            title="Excluir Pesquisa"
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
    </div>
  );

  return (
    <>
      {selectedJob ? renderContactList() : renderJobList()}
      {selectedContact && <SendMessageModal contact={selectedContact} onClose={handleCloseModal} />}
      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
        isDestructive={confirmModal.isDestructive}
      />
    </>
  );
};

export default ContactsView;