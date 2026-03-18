
import React, { useState } from 'react';
import { NormalizedPhone } from '../types';
import { normalizePhone } from '../services/crawlerService';
import { LoaderIcon } from './icons/LoaderIcon';

const PhoneValidator: React.FC = () => {
  const [rawNumber, setRawNumber] = useState<string>('');
  const [result, setResult] = useState<NormalizedPhone | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleValidate = async () => {
    if (!rawNumber) return;
    setIsLoading(true);
    setError(null);
    setResult(null);
    try {
      const validationResult = await normalizePhone(rawNumber);
      setResult(validationResult);
    } catch (err) {
      setError('Falha ao validar o número de telefone.');
    } finally {
      setIsLoading(false);
    }
  };
  
  const ResultDisplay: React.FC<{ result: NormalizedPhone }> = ({ result }) => {
    const baseClasses = "flex justify-between items-center px-4 py-3 rounded-md";
    const valueClasses = "font-mono text-sm";
  
    return (
      <div className={`mt-6 p-4 rounded-lg shadow-inner ${result.is_valid ? 'bg-green-900/50' : 'bg-red-900/50'}`}>
        <h3 className="text-lg font-semibold mb-3 border-b pb-2 border-gray-600">Resultado da Validação</h3>
        <div className="space-y-2">
            <div className={`${baseClasses} bg-gray-700/50`}>
                <span className="text-gray-300">É Válido:</span>
                <span className={`${valueClasses} font-bold ${result.is_valid ? 'text-green-400' : 'text-red-400'}`}>
                    {result.is_valid ? 'Sim' : 'Não'}
                </span>
            </div>
            <div className={`${baseClasses} bg-gray-700/50`}>
                <span className="text-gray-300">Formato E.164:</span>
                <span className={valueClasses}>{result.e164 || 'N/A'}</span>
            </div>
             <div className={`${baseClasses} bg-gray-700/50`}>
                <span className="text-gray-300">Localização (DDD):</span>
                <span className={`${valueClasses} capitalize`}>{result.location || 'N/A'}</span>
            </div>
            <div className={`${baseClasses} bg-gray-700/50`}>
                <span className="text-gray-300">Tipo:</span>
                <span className={`${valueClasses} capitalize`}>{result.type || 'N/A'}</span>
            </div>
            <div className={`${baseClasses} bg-gray-700/50`}>
                <span className="text-gray-300">Código do País:</span>
                <span className={valueClasses}>{result.country_code || 'N/A'}</span>
            </div>
        </div>
      </div>
    );
  };


  return (
    <div className="space-y-6">
        <div>
            <h1 className="text-4xl font-bold text-white tracking-tight">Validador de Número de Telefone</h1>
            <p className="mt-2 text-lg text-gray-400">
                Um utilitário simples para testar o serviço de normalização de números de telefone.
            </p>
        </div>

        <div className="bg-gray-800 p-6 rounded-lg shadow-xl max-w-2xl mx-auto">
            <div className="flex flex-col sm:flex-row items-stretch gap-4">
                <input
                    type="text"
                    value={rawNumber}
                    onChange={(e) => setRawNumber(e.target.value)}
                    placeholder="Digite o número de telefone (ex: (11) 98765-4321)"
                    className="flex-grow bg-gray-700 border border-gray-600 rounded-md shadow-sm py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
                <button
                    onClick={handleValidate}
                    disabled={isLoading || !rawNumber}
                    className="bg-sky-600 hover:bg-sky-700 disabled:bg-sky-800 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-md shadow-lg transition duration-300 flex items-center justify-center"
                >
                    {isLoading ? <LoaderIcon /> : 'Validar'}
                </button>
            </div>

            {error && <p className="mt-4 text-center text-red-400">{error}</p>}
            
            {result && <ResultDisplay result={result} />}
        </div>
    </div>
  );
};

export default PhoneValidator;
