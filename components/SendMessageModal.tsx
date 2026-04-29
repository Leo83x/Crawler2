
import React, { useState } from 'react';
import { Avatar } from './Avatar';
import { MailIcon, MessageSquareIcon, UserIcon, BuildingIcon, MapPinIcon } from 'lucide-react';
import { LinkedInIcon } from './icons/LinkedInIcon';
import { InstagramIcon } from './icons/InstagramIcon';
import { LoaderIcon } from './icons/LoaderIcon';
import { Contact } from '../types';
import { interactionService, templateService } from '../services/campaignService';

interface SendMessageModalProps {
  contact: Contact;
  onClose: () => void;
}

const replaceVariables = (text: string, contact: Contact) => {
  const vars: Record<string, string> = {
    nome: contact.name || 'parceiro',
    empresa: contact.name || 'empresa',
    nicho: contact.niche || 'segmento',
    cidade: contact.city || 'região',
  };

  return text.replace(/\{(\w+)\}/gi, (match, p1) => {
    const key = p1.toLowerCase();
    return vars[key] || match;
  });
};

const SendMessageModal: React.FC<SendMessageModalProps> = ({ contact, onClose }) => {
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sendStatus, setSendStatus] = useState<{ success: boolean; message: string } | null>(null);
  const [activeChannel, setActiveChannel] = useState<'whatsapp' | 'linkedin' | 'instagram' | 'email'>('whatsapp');
  const [templates, setTemplates] = useState<any[]>([]);

  React.useEffect(() => {
    // Auto-detect best channel
    if (contact.linkedin_url) setActiveChannel('linkedin');
    else if (contact.instagram_handle) setActiveChannel('instagram');
    else if (contact.email) setActiveChannel('email');

    // Fetch templates
    templateService.getTemplates().then(setTemplates);
  }, [contact]);

  const handleSend = async () => {
    if (!message || isSending) return;
    setIsSending(true);
    setSendStatus(null);
    try {
        const encodedMessage = encodeURIComponent(message);
        let externalUrl = '';

        // Clipboard logic for platforms where pre-fill is hard
        if (['linkedin', 'instagram'].includes(activeChannel)) {
            await navigator.clipboard.writeText(message);
        }

        switch (activeChannel) {
            case 'whatsapp':
                if (contact.e164_number) {
                    const cleanPhone = contact.e164_number.replace(/\D/g, '');
                    externalUrl = `https://web.whatsapp.com/send?phone=${cleanPhone}&text=${encodedMessage}`;
                }
                break;
            case 'linkedin':
                if (contact.linkedin_url) {
                    externalUrl = contact.linkedin_url.includes('messaging') 
                        ? contact.linkedin_url 
                        : `${contact.linkedin_url.replace(/\/$/, '')}/`;
                    // LinkedIn doesn't support pre-fill via URL schemes reliably anymore
                    // We just open the profile/last thread
                }
                break;
            case 'instagram':
                if (contact.instagram_handle) {
                    externalUrl = `https://www.instagram.com/${contact.instagram_handle.replace('@', '')}/`;
                }
                break;
            case 'email':
                if (contact.email) {
                    externalUrl = `mailto:${contact.email}?subject=Contato&body=${encodedMessage}`;
                }
                break;
        }

        if (externalUrl) {
            window.open(externalUrl, '_blank');
        }

        await interactionService.logInteraction(contact.id, {
            type: activeChannel,
            direction: 'outbound',
            content: message,
            status: 'sent'
        });

        const successMsg = ['linkedin', 'instagram'].includes(activeChannel) 
            ? 'Mensagem copiada para o clipboard! Cole na rede social.' 
            : 'Plataforma aberta com sucesso!';

        setSendStatus({ success: true, message: successMsg });
        setTimeout(onClose, 2500);
    } catch (err) {
        setSendStatus({ success: false, message: 'Falha ao processar envio.' });
    } finally {
        setIsSending(false);
    }
  };

  const channelConfig = {
    whatsapp: { label: 'Z-API (WhatsApp)', icon: <MessageSquareIcon size={16} />, color: 'bg-emerald-600' },
    linkedin: { label: 'LinkedIn API', icon: <LinkedInIcon />, color: 'bg-blue-600' },
    instagram: { label: 'Instagram Direct', icon: <InstagramIcon />, color: 'bg-pink-600' },
    email: { label: 'Serviço de E-mail', icon: <MailIcon size={16} />, color: 'bg-purple-600' }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex justify-center items-center z-50 transition-opacity p-4">
      <div className="bg-gray-800 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden animate-in zoom-in duration-200">
        <div className="p-6 border-b border-gray-700 bg-gray-900/40 flex justify-between items-start">
            <div className="flex items-center gap-4">
                <Avatar 
                    src={contact.photo_url} 
                    name={contact.name} 
                    size="xl" 
                    accountType={contact.account_type as any}
                    className="border-2 border-gray-700"
                />
                <div>
                    <h2 className="text-xl font-bold text-white">Novo Outreach</h2>
                    <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-sm font-bold text-sky-400">{contact.name || contact.e164_number}</span>
                        <span className="text-[10px] bg-gray-700 px-2 py-0.5 rounded text-gray-400">{contact.niche}</span>
                    </div>
                </div>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">&times;</button>
        </div>

        <div className="p-6 space-y-6">
            <div className="flex flex-wrap gap-2">
                <span className="text-xs font-bold text-gray-500 uppercase w-full mb-1 tracking-widest">Escolher Canal</span>
                <button 
                  onClick={() => setActiveChannel('whatsapp')}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${activeChannel === 'whatsapp' ? 'bg-emerald-600 text-white border-emerald-500 shadow-lg shadow-emerald-900/20' : 'bg-gray-900 text-gray-400 border-gray-700 hover:bg-gray-800'}`}
                >
                  <MessageSquareIcon size={14} /> WhatsApp
                </button>
                {contact.linkedin_url && (
                    <button 
                      onClick={() => setActiveChannel('linkedin')}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${activeChannel === 'linkedin' ? 'bg-blue-600 text-white border-blue-500 shadow-lg shadow-blue-900/20' : 'bg-gray-900 text-gray-400 border-gray-700 hover:bg-gray-800'}`}
                    >
                      <LinkedInIcon /> LinkedIn
                    </button>
                )}
                {contact.instagram_handle && (
                    <button 
                      onClick={() => setActiveChannel('instagram')}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${activeChannel === 'instagram' ? 'bg-pink-600 text-white border-pink-500 shadow-lg shadow-pink-900/20' : 'bg-gray-900 text-gray-400 border-gray-700 hover:bg-gray-800'}`}
                    >
                      <InstagramIcon /> Instagram
                    </button>
                )}
                {contact.email && (
                    <button 
                      onClick={() => setActiveChannel('email')}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${activeChannel === 'email' ? 'bg-purple-600 text-white border-purple-500 shadow-lg shadow-purple-900/20' : 'bg-gray-900 text-gray-400 border-gray-700 hover:bg-gray-800'}`}
                    >
                      <MailIcon size={14} /> E-mail
                    </button>
                )}
            </div>

            <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2 tracking-widest">Mensagem do Lead</label>
                <div className="relative">
                    <textarea
                        rows={6}
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        className="w-full bg-gray-900 border border-gray-700 rounded-xl py-3 px-4 text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-500 shadow-inner"
                        placeholder={`Digite sua mensagem para o ${activeChannel}...`}
                    />
                    <div className="absolute top-2 right-2 flex gap-1">
                        <select 
                            onChange={(e) => {
                                const val = e.target.value;
                                if (val) setMessage(replaceVariables(val, contact));
                            }}
                            className="bg-gray-800 text-[10px] text-gray-400 rounded border border-gray-700 px-2 py-1 outline-none cursor-pointer"
                        >
                            <option value="">Templates</option>
                            {templates.map(t => <option key={t.id} value={t.base_content}>{t.name}</option>)}
                        </select>
                    </div>
                </div>
            </div>

            <div className="flex flex-wrap gap-4 text-[10px] text-gray-500">
                <div className="flex items-center gap-1"><UserIcon size={12} /> {`{nome}`}</div>
                <div className="flex items-center gap-1"><BuildingIcon size={12} /> {`{empresa}`}</div>
                <div className="flex items-center gap-1"><MapPinIcon size={12} /> {`{cidade}`}</div>
            </div>

            {sendStatus && (
                <div className={`text-center p-3 rounded-xl text-sm font-bold border ${sendStatus.success ? 'bg-green-900/20 text-green-400 border-green-500/30' : 'bg-red-900/20 text-red-400 border-red-500/30'}`}>
                    {sendStatus.message}
                </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
                <button onClick={onClose} className="px-6 py-2.5 text-gray-400 hover:text-white font-bold transition-colors">
                    Descartar
                </button>
                <button
                    onClick={handleSend}
                    disabled={isSending || !message.trim()}
                    className={`${channelConfig[activeChannel].color} hover:opacity-95 disabled:grayscale text-white font-extrabold py-2.5 px-8 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2`}
                >
                    {isSending ? <LoaderIcon /> : <>{channelConfig[activeChannel].icon} Enviar via {channelConfig[activeChannel].label}</>}
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};

export default SendMessageModal;
