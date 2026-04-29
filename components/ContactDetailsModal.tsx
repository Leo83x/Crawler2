import React from 'react';
import { Avatar } from './Avatar';
import { Contact } from '../types';
import { 
  XIcon, 
  MailIcon, 
  PhoneIcon, 
  MapPinIcon, 
  GlobeIcon, 
  StarIcon, 
  BuildingIcon, 
  UserIcon, 
  CalendarIcon,
  ExternalLinkIcon,
  InfoIcon,
  TagIcon,
  LaptopIcon
} from 'lucide-react';
import { LinkedInIcon } from './icons/LinkedInIcon';
import { InstagramIcon } from './icons/InstagramIcon';
import { FacebookIcon } from './icons/FacebookIcon';

interface ContactDetailsModalProps {
  contact: Contact;
  onClose: () => void;
}

const ContactDetailsModal: React.FC<ContactDetailsModalProps> = ({ contact, onClose }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-gray-800 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-700 flex justify-between items-center bg-gray-800/50">
          <div className="flex items-center gap-3">
            <Avatar 
                src={contact.photo_url} 
                name={contact.name} 
                size="xl" 
                accountType={contact.account_type as any}
                className="border-2 border-sky-500/50"
            />
            <div>
              <h3 className="text-xl font-bold text-white leading-tight">{contact.name || 'Sem Nome'}</h3>
              <p className="text-sm text-gray-400">{contact.category || 'Sem Categoria'}</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-gray-700 rounded-full text-gray-400 hover:text-white transition-colors"
          >
            <XIcon size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Basic Info */}
            <div className="space-y-4">
              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Informação de Contato</h4>
              
              {contact.e164_number ? (
                <div className="flex items-start gap-3">
                  <PhoneIcon size={18} className="text-sky-400 mt-0.5" />
                  <div>
                    <p className="text-xs text-gray-500">WhatsApp (E.164)</p>
                    <p className="text-sm text-white font-mono">{contact.e164_number}</p>
                  </div>
                </div>
              ) : contact.instagram_handle ? (
                <div className="flex items-start gap-3">
                  <div className="text-pink-400 mt-0.5"><InstagramIcon /></div>
                  <div>
                    <p className="text-xs text-gray-500">Instagram Principal</p>
                    <a href={`https://instagram.com/${contact.instagram_handle.replace(/^@+/, '')}`} target="_blank" rel="noopener noreferrer" className="text-sm text-sky-400 hover:underline">
                      @{contact.instagram_handle.replace(/^@+/, '')}
                    </a>
                  </div>
                </div>
              ) : contact.linkedin_url ? (
                <div className="flex items-start gap-3">
                  <div className="text-blue-400 mt-0.5"><LinkedInIcon /></div>
                  <div>
                    <p className="text-xs text-gray-500">LinkedIn Principal</p>
                    <a href={contact.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-sm text-sky-400 hover:underline">
                      Ver Perfil
                    </a>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-3">
                  <InfoIcon size={18} className="text-gray-500 mt-0.5" />
                  <div>
                    <p className="text-xs text-gray-500">Contato Direto</p>
                    <p className="text-sm text-gray-400 italic">Não identificado</p>
                  </div>
                </div>
              )}

              <div className="flex items-start gap-3">
                <MapPinIcon size={18} className="text-sky-400 mt-0.5" />
                <div>
                  <p className="text-xs text-gray-500">Localização</p>
                  <p className="text-sm text-white">{contact.city || 'Não informado'}</p>
                  {contact.address && <p className="text-xs text-gray-400 mt-1">{contact.address}</p>}
                </div>
              </div>

              <div className="flex items-start gap-3">
                <GlobeIcon size={18} className="text-sky-400 mt-0.5" />
                <div>
                  <p className="text-xs text-gray-500">Fonte</p>
                  <a 
                    href={contact.source_url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-sm text-sky-400 hover:underline flex items-center gap-1"
                  >
                    {contact.source_type} <ExternalLinkIcon size={12} />
                  </a>
                </div>
              </div>

              {contact.photo_url && (
                <div className="flex items-start gap-3">
                  <LaptopIcon size={18} className="text-sky-400 mt-0.5" />
                  <div>
                    <p className="text-xs text-gray-500">URL da Foto</p>
                    <p className="text-[10px] text-gray-400 font-mono break-all line-clamp-2">{contact.photo_url}</p>
                  </div>
                </div>
              )}
            </div>

            {/* AI Enrichment Info */}
            <div className="space-y-4">
              <h4 className="text-xs font-bold text-purple-500 uppercase tracking-wider flex items-center gap-2">
                Inteligência Artificial {contact.enriched_at && <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />}
              </h4>

              {contact.enriched_at ? (
                <>
                  <div className="flex items-start gap-3">
                    <MailIcon size={18} className="text-purple-400 mt-0.5" />
                    <div>
                      <p className="text-xs text-gray-500">E-mail Extraído</p>
                      <p className="text-sm text-white">{contact.email || 'Nenhum e-mail encontrado'}</p>
                    </div>
                  </div>

                  {(contact.linkedin_url || contact.instagram_handle || contact.website || contact.facebook_url) && (
                    <div className="space-y-4 mt-4 pt-4 border-t border-gray-700/50">
                      <h5 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Presença Digital</h5>
                      
                      {contact.linkedin_url && (
                        <div className="flex items-center gap-3">
                          <LinkedInIcon />
                          <a href={contact.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-sm text-sky-400 hover:underline flex items-center gap-1">
                            LinkedIn <ExternalLinkIcon size={12} />
                          </a>
                        </div>
                      )}

                      {contact.instagram_handle && (
                        <div className="flex items-center gap-3">
                          <InstagramIcon />
                          <a href={`https://instagram.com/${contact.instagram_handle.replace(/^@+/, '')}`} target="_blank" rel="noopener noreferrer" className="text-sm text-sky-400 hover:underline flex items-center gap-1">
                            @{contact.instagram_handle.replace(/^@+/, '')} <ExternalLinkIcon size={12} />
                          </a>
                        </div>
                      )}

                      {contact.website && (
                        <div className="flex items-center gap-3">
                          <LaptopIcon size={16} className="text-emerald-400" />
                          <a href={contact.website.startsWith('http') ? contact.website : `https://${contact.website}`} target="_blank" rel="noopener noreferrer" className="text-sm text-sky-400 hover:underline flex items-center gap-1">
                            Website <ExternalLinkIcon size={12} />
                          </a>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex items-start gap-3">
                    <StarIcon size={18} className="text-yellow-400 mt-0.5" />
                    <div>
                      <p className="text-xs text-gray-500">Qualidade do Lead</p>
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-24 bg-gray-700 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-yellow-400" 
                            style={{ width: `${(contact.lead_quality || 0) * 10}%` }}
                          />
                        </div>
                        <span className="text-sm text-white font-bold">{contact.lead_quality}/10</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <InfoIcon size={18} className="text-purple-400 mt-0.5" />
                    <div>
                      <p className="text-xs text-gray-500">Descrição da IA</p>
                      <p className="text-sm text-gray-300 italic leading-relaxed">
                        "{contact.description || 'Sem descrição disponível.'}"
                      </p>
                    </div>
                  </div>
                </>
              ) : (
                <div className="bg-gray-900/50 p-4 rounded-xl border border-dashed border-gray-700 text-center">
                  <p className="text-sm text-gray-500 mb-2">Este lead ainda não foi enriquecido com IA.</p>
                  <p className="text-xs text-gray-600">Clique no botão ✨ na lista para extrair e-mail, descrição e qualidade.</p>
                </div>
              )}
            </div>
          </div>

          {/* Notes Section */}
          <div className="mt-8 pt-6 border-t border-gray-700">
            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
              <TagIcon size={14} /> Notas e Observações
            </h4>
            <div className="bg-gray-900/30 p-4 rounded-xl border border-gray-700 min-h-[80px]">
              <p className="text-sm text-gray-300 whitespace-pre-wrap">
                {contact.notes || 'Nenhuma nota adicionada.'}
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-700 bg-gray-800/50 flex justify-between items-center">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <CalendarIcon size={14} />
            <span>Encontrado em: {contact.found_at ? new Date(contact.found_at).toLocaleDateString('pt-BR') : '--'}</span>
          </div>
          <button 
            onClick={onClose}
            className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-bold transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};

export default ContactDetailsModal;
