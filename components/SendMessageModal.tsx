
import React, { useState } from 'react';
import { Contact } from '../types';
import { sendMessage } from '../services/crawlerService';
import { LoaderIcon } from './icons/LoaderIcon';

interface SendMessageModalProps {
  contact: Contact;
  onClose: () => void;
}

const SendMessageModal: React.FC<SendMessageModalProps> = ({ contact, onClose }) => {
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sendStatus, setSendStatus] = useState<{ success: boolean; message: string } | null>(null);

  const handleSend = async () => {
    if (!message || isSending) return;
    setIsSending(true);
    setSendStatus(null);
    const result = await sendMessage(contact.id, message);
    setSendStatus(result);
    setIsSending(false);
    if(result.success) {
        setTimeout(onClose, 2000);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50 transition-opacity duration-300">
      <div className="bg-gray-800 rounded-lg shadow-2xl p-6 w-full max-w-lg mx-4 transform transition-all duration-300 scale-100">
        <div className="flex justify-between items-start">
            <div>
                <h2 className="text-2xl font-bold text-white">Enviar Mensagem</h2>
                <p className="text-sm text-sky-400 font-mono mt-1">{contact.name ? `${contact.name} - `: ''}{contact.e164_number}</p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl">&times;</button>
        </div>

        <div className="mt-6">
          <label htmlFor="message" className="block text-sm font-medium text-gray-300 mb-2">Mensagem</label>
          <textarea
            id="message"
            rows={5}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="w-full bg-gray-700 border border-gray-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
            placeholder="Digite sua mensagem aqui..."
          />
        </div>

        {sendStatus && (
            <div className={`mt-4 text-center p-3 rounded-md text-sm ${sendStatus.success ? 'bg-green-900/50 text-green-300' : 'bg-red-900/50 text-red-300'}`}>
                {sendStatus.message}
            </div>
        )}

        <div className="mt-6 flex justify-end space-x-4">
          <button onClick={onClose} className="bg-gray-600 hover:bg-gray-700 text-gray-200 font-bold py-2 px-4 rounded-md transition duration-200">
            Cancelar
          </button>
          <button
            onClick={handleSend}
            disabled={isSending || !message}
            className="bg-green-600 hover:bg-green-700 disabled:bg-green-800 disabled:cursor-not-allowed text-white font-bold py-2 px-4 rounded-md transition duration-200 flex items-center"
          >
            {isSending && <LoaderIcon />}
            <span className="ml-2">{isSending ? 'Enviando...' : 'Enviar via Z-API'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default SendMessageModal;
