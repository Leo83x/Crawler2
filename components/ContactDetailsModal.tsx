import React from 'react';
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
  TagIcon
} from 'lucide-react';

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
            <div className={`p-2 rounded-lg ${contact.account_type === 'business' ? 'bg-sky-900/30 text-sky-400' : 'bg-purple-900/30 text-purple-400'}`}>
              {contact.account_type === 'business' ? <BuildingIcon size={20} /> : <UserIcon size={20} />}
            </div>
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
              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Informações Básicas</h4>
              
              <div className="flex items-start gap-3">
                <PhoneIcon size={18} className="text-sky-400 mt-0.5" />
                <div>
                  <p className="text-xs text-gray-500">WhatsApp (E.164)</p>
                  <p className="text-sm text-white font-mono">{contact.e164_number}</p>
                </div>
              </div>

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
            <span>Encontrado em: {new Date(contact.found_at).toLocaleDateString('pt-BR')}</span>
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
