import React, { useState, useEffect } from 'react';
import { OutreachCampaign } from '../types';
import { campaignService } from '../services/campaignService';
import { LoaderIcon } from './icons/LoaderIcon';
import { SendIcon, PauseIcon, PlayIcon, CheckCircleIcon, CalendarIcon, BarChart3Icon, PlusIcon, Trash2Icon, RefreshCwIcon, TargetIcon } from 'lucide-react';
import CampaignModal from './CampaignModal';

const CampaignsView: React.FC = () => {
    const [campaigns, setCampaigns] = useState<OutreachCampaign[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);

    const fetchCampaigns = async () => {
        setIsLoading(true);
        try {
            const data = await campaignService.getCampaigns();
            setCampaigns(data);
        } catch (error) {
            console.error("Error fetching campaigns:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchCampaigns();
    }, []);

    const toggleStatus = async (id: string, currentStatus: string) => {
        try {
            const newStatus = currentStatus === 'active' ? 'paused' : 'active';
            await campaignService.updateCampaign(id, { status: newStatus });
            setCampaigns(prev => prev.map(c => c.id === id ? { ...c, status: newStatus } : c));
        } catch (error) {
            console.error("Error updating campaign status:", error);
        }
    };

    const deleteCampaign = async (id: string) => {
        if (!confirm("Tem certeza que deseja excluir esta campanha?")) return;
        try {
            await campaignService.deleteCampaign(id);
            setCampaigns(prev => prev.filter(c => c.id !== id));
        } catch (error) {
            console.error("Error deleting campaign:", error);
        }
    };

    if (isLoading && campaigns.length === 0) {
        return <div className="flex justify-center items-center h-64"><LoaderIcon /><span className="ml-3 text-gray-400">Carregando campanhas...</span></div>;
    }

    return (
        <div className="p-6 space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
                        <BarChart3Icon className="text-sky-500" /> Suas Campanhas
                    </h2>
                    <p className="text-gray-400 mt-2">Acompanhe o desempenho e status das suas automações de outreach.</p>
                </div>
                <div className="flex gap-3">
                    <button 
                        onClick={fetchCampaigns}
                        className="p-3 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white rounded-2xl border border-gray-700 transition-all flex items-center gap-2"
                        title="Atualizar dados"
                    >
                        <RefreshCwIcon size={18} className={isLoading ? 'animate-spin' : ''} />
                    </button>
                    <button 
                        onClick={() => setShowModal(true)}
                        className="bg-sky-600 hover:bg-sky-500 text-white px-6 py-3 rounded-2xl font-bold transition-all shadow-xl shadow-sky-900/30 flex items-center gap-2 transform active:scale-95"
                    >
                        <PlusIcon size={20} /> Nova Campanha
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {campaigns.length === 0 ? (
                    <div className="col-span-full bg-gray-800/50 border border-gray-700 border-dashed rounded-3xl p-20 text-center text-gray-500 animate-in fade-in duration-500">
                        <div className="w-20 h-20 bg-gray-800 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-gray-700 shadow-inner">
                            <SendIcon className="opacity-20" size={40} />
                        </div>
                        <p className="text-lg font-medium">Nenhuma campanha criada ainda.</p>
                        <button 
                            onClick={() => setShowModal(true)}
                            className="mt-6 text-sky-400 hover:text-sky-300 font-bold underline"
                        >
                            Crie sua primeira agora mesmo
                        </button>
                    </div>
                ) : (
                    campaigns.map(campaign => (
                        <div key={campaign.id} className="bg-gray-800 border border-gray-700 rounded-3xl p-6 hover:border-sky-500/50 transition-all shadow-xl group relative overflow-hidden">
                            {/* Decorative background gradient */}
                            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-sky-600/5 to-transparent pointer-events-none" />
                            
                            <div className="flex justify-between items-start mb-6">
                                <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 ${
                                    campaign.status === 'active' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 
                                    'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                }`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${campaign.status === 'active' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`}></span>
                                    {campaign.status === 'active' ? 'Executando' : 'Pausada'}
                                </span>
                                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button 
                                        onClick={() => toggleStatus(campaign.id, campaign.status)}
                                        className="p-2 bg-gray-900/60 hover:bg-gray-700 text-gray-300 rounded-xl border border-gray-700 shadow-sm"
                                        title={campaign.status === 'active' ? 'Pausar' : 'Retomar'}
                                    >
                                        {campaign.status === 'active' ? <PauseIcon size={14} /> : <PlayIcon size={14} />}
                                    </button>
                                    <button 
                                        onClick={() => deleteCampaign(campaign.id)}
                                        className="p-2 bg-rose-900/20 hover:bg-rose-900/40 text-rose-400 rounded-xl border border-rose-500/20 shadow-sm"
                                        title="Excluir"
                                    >
                                        <Trash2Icon size={14} />
                                    </button>
                                </div>
                            </div>
                            
                            <h3 className="text-xl font-bold text-white mb-4 leading-tight group-hover:text-sky-400 transition-colors uppercase tracking-tight">{campaign.name}</h3>
                            
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-gray-900/40 p-3 rounded-2xl border border-gray-700/50">
                                        <div className="flex items-center gap-2 mb-1">
                                            <TargetIcon size={12} className="text-gray-500" />
                                            <span className="text-[10px] font-bold text-gray-500 uppercase">Canal</span>
                                        </div>
                                        <p className="text-sm text-sky-400 font-bold capitalize">{campaign.channel}</p>
                                    </div>
                                    <div className="bg-gray-900/40 p-3 rounded-2xl border border-gray-700/50">
                                        <div className="flex items-center gap-2 mb-1">
                                            <TargetIcon size={12} className="text-gray-500" />
                                            <span className="text-[10px] font-bold text-gray-500 uppercase">Sequência</span>
                                        </div>
                                        <p className="text-sm text-white font-bold">{campaign.steps?.length || 1} passos</p>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <div className="flex justify-between items-end text-xs">
                                        <span className="text-gray-500 font-bold uppercase tracking-widest text-[10px]">Taxa de Disparo (Hoje)</span>
                                        <span className="text-white font-mono font-bold text-sm">{campaign.sent_today || 0} <span className="text-gray-600 font-normal">/ {campaign.daily_limit}</span></span>
                                    </div>
                                    <div className="w-full bg-gray-900 h-2.5 rounded-full overflow-hidden border border-gray-700 shadow-inner">
                                        <div 
                                            className={`h-full transition-all duration-1000 shadow-lg ${campaign.status === 'active' ? 'bg-sky-500 shadow-sky-500/20' : 'bg-amber-500 shadow-amber-500/20'}`} 
                                            style={{ width: `${Math.min(100, ((campaign.sent_today || 0) / campaign.daily_limit) * 100)}%` }}
                                        ></div>
                                    </div>
                                </div>
                                
                                <div className="flex items-center justify-between text-[11px] text-gray-500 mt-6 pt-4 border-t border-gray-700/50 italic">
                                    <div className="flex items-center gap-2">
                                        <CalendarIcon size={12} />
                                        <span>Desde {campaign.created_at.toLocaleDateString()}</span>
                                    </div>
                                    <div className="flex items-center gap-1 font-bold text-gray-400">
                                        <span>Total: {campaign.total_sent || 0} envios</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {showModal && (
                <CampaignModal 
                    isOpen={showModal} 
                    onClose={() => setShowModal(false)} 
                    onSuccess={fetchCampaigns} 
                />
            )}
        </div>
    );
};

export default CampaignsView;
