import React from 'react';
import { UsersIcon, SearchIcon, GlobeIcon, CheckCircleIcon, MapPinIcon, BarChart3Icon } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

interface DashboardStatsProps {
  stats: {
    totalLeads: number;
    totalJobs: number;
    statsBySource: Record<string, number>;
    statsByStatus: Record<string, number>;
    statsByCity: Record<string, number>;
  };
}

const COLORS = ['#0ea5e9', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#6366f1', '#ec4899'];

export const DashboardStats: React.FC<DashboardStatsProps> = ({ stats }) => {
  const sourceData = (Object.entries(stats.statsBySource) as [string, number][]).map(([name, value]) => ({ name, value }));
  const cityData = (Object.entries(stats.statsByCity) as [string, number][])
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  return (
    <div className="space-y-8 mb-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gray-800 border border-gray-700 p-6 rounded-xl shadow-lg hover:border-sky-500/50 transition-all group">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-sky-900/30 rounded-lg text-sky-400 group-hover:scale-110 transition-transform">
              <UsersIcon size={24} />
            </div>
            <span className="text-xs font-bold text-sky-500 bg-sky-900/20 px-2 py-1 rounded-full">Total</span>
          </div>
          <div className="text-3xl font-bold text-white">{stats.totalLeads}</div>
          <div className="text-gray-400 text-sm mt-1">Leads Coletados</div>
        </div>

        <div className="bg-gray-800 border border-gray-700 p-6 rounded-xl shadow-lg hover:border-purple-500/50 transition-all group">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-purple-900/30 rounded-lg text-purple-400 group-hover:scale-110 transition-transform">
              <SearchIcon size={24} />
            </div>
            <span className="text-xs font-bold text-purple-500 bg-purple-900/20 px-2 py-1 rounded-full">Atividade</span>
          </div>
          <div className="text-3xl font-bold text-white">{stats.totalJobs}</div>
          <div className="text-gray-400 text-sm mt-1">Pesquisas Realizadas</div>
        </div>

        <div className="bg-gray-800 border border-gray-700 p-6 rounded-xl shadow-lg hover:border-green-500/50 transition-all group">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-green-900/30 rounded-lg text-green-400 group-hover:scale-110 transition-transform">
              <CheckCircleIcon size={24} />
            </div>
            <span className="text-xs font-bold text-green-500 bg-green-900/20 px-2 py-1 rounded-full">Conversão</span>
          </div>
          <div className="text-3xl font-bold text-white">{stats.statsByStatus['converted'] || 0}</div>
          <div className="text-gray-400 text-sm mt-1">Leads Convertidos</div>
        </div>

        <div className="bg-gray-800 border border-gray-700 p-6 rounded-xl shadow-lg hover:border-orange-500/50 transition-all group">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-orange-900/30 rounded-lg text-orange-400 group-hover:scale-110 transition-transform">
              <GlobeIcon size={24} />
            </div>
            <span className="text-xs font-bold text-orange-500 bg-orange-900/20 px-2 py-1 rounded-full">Fontes</span>
          </div>
          <div className="text-3xl font-bold text-white">{Object.keys(stats.statsBySource).length}</div>
          <div className="text-gray-400 text-sm mt-1">Fontes Ativas</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gray-800 border border-gray-700 p-6 rounded-xl shadow-lg">
          <div className="flex items-center gap-2 mb-6">
            <BarChart3Icon className="text-sky-400" size={20} />
            <h3 className="text-lg font-bold text-white">Leads por Fonte</h3>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={sourceData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {sourceData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                  itemStyle={{ color: '#fff' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-4">
            {sourceData.map((entry, index) => (
              <div key={entry.name} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                <span className="text-xs text-gray-400 capitalize">{entry.name.replace(/_/g, ' ')}: {entry.value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-gray-800 border border-gray-700 p-6 rounded-xl shadow-lg">
          <div className="flex items-center gap-2 mb-6">
            <MapPinIcon className="text-purple-400" size={20} />
            <h3 className="text-lg font-bold text-white">Cidades mais "Quentes"</h3>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cityData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" horizontal={false} />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" stroke="#9ca3af" fontSize={12} width={80} />
                <Tooltip 
                  cursor={{ fill: '#374151' }}
                  contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                  itemStyle={{ color: '#fff' }}
                />
                <Bar dataKey="value" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
