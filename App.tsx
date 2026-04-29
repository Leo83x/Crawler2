
import React, { useState, useEffect } from 'react';
import Dashboard from './components/Dashboard';
import ContactsView from './components/ContactsView';
import PhoneValidator from './components/PhoneValidator';
import BlacklistView from './components/BlacklistView';
import LogsView from './components/LogsView';
import OutreachInbox from './components/OutreachInbox';
import CampaignsView from './components/CampaignsView';
import { SearchIcon } from './components/icons/SearchIcon';
import { UsersIcon } from './components/icons/UsersIcon';
import { CheckCircleIcon } from './components/icons/CheckCircleIcon';
import { TrashIcon } from './components/icons/TrashIcon';
import { MessageSquareIcon, BarChart3Icon } from 'lucide-react';
import { auth, loginWithGoogle, logout, onAuthStateChanged, User, db } from './firebase';
import { LoaderIcon } from './components/icons/LoaderIcon';
import { getJobs } from './services/crawlerService';
import { CrawlJob } from './types';
import { doc, getDocFromServer } from 'firebase/firestore';

type View = 'dashboard' | 'contacts' | 'validator' | 'blacklist' | 'logs' | 'outreach' | 'campaigns';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState<CrawlJob[]>([]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
      if (user) {
        fetchJobs();
        testConnection();
      }
    });
    return () => unsubscribe();
  }, []);

  const fetchJobs = async () => {
    try {
      const fetchedJobs = await getJobs();
      setJobs(fetchedJobs);
    } catch (err) {
      console.error("Error fetching jobs:", err);
    }
  };

  const testConnection = async () => {
    try {
      await getDocFromServer(doc(db, 'test', 'connection'));
    } catch (error) {
      if (error instanceof Error && error.message.includes('the client is offline')) {
        console.error("Please check your Firebase configuration.");
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <LoaderIcon />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-gray-800 p-8 rounded-2xl shadow-2xl max-w-md w-full text-center border border-gray-700">
          <div className="w-20 h-20 bg-sky-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg transform rotate-3">
            <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Omnichannel Outreach</h1>
          <p className="text-gray-400 mb-8">Faça login para gerenciar seus jobs de extração e prospecção.</p>
          <button
            onClick={loginWithGoogle}
            className="w-full flex items-center justify-center bg-white text-gray-900 font-bold py-3 px-4 rounded-xl hover:bg-gray-100 transition duration-300 shadow-lg"
          >
            <img src="https://www.gstatic.com/firebase/anonymous-scan.png" alt="Google" className="w-6 h-6 mr-3" referrerPolicy="no-referrer" />
            Entrar com Google
          </button>
        </div>
      </div>
    );
  }

  const renderView = () => {
    switch (currentView) {
      case 'dashboard':
        return <Dashboard jobs={jobs} onJobsUpdate={fetchJobs} />;
      case 'contacts':
        return <ContactsView jobs={jobs} onJobsUpdate={fetchJobs} />;
      case 'validator':
        return <PhoneValidator />;
      case 'blacklist':
        return <BlacklistView />;
      case 'logs':
        return <LogsView />;
      case 'outreach':
        return <OutreachInbox jobs={jobs} onJobsUpdate={fetchJobs} />;
      case 'campaigns':
        return <CampaignsView />;
      default:
        return <Dashboard jobs={jobs} onJobsUpdate={fetchJobs} />;
    }
  };

  const NavItem: React.FC<{
    viewName: View;
    icon: React.ReactNode;
    label: string;
  }> = ({ viewName, icon, label }) => (
    <li className="mb-2">
      <button
        onClick={() => setCurrentView(viewName)}
        className={`w-full flex items-center p-3 rounded-lg transition-colors duration-200 ${
          currentView === viewName
            ? 'bg-sky-600 text-white shadow-lg'
            : 'text-gray-400 hover:bg-gray-700 hover:text-white'
        }`}
      >
        {icon}
        <span className="ml-4 font-medium">{label}</span>
      </button>
    </li>
  );

  return (
    <div className="flex min-h-screen bg-gray-900 text-gray-100 font-sans">
      <aside className="w-64 bg-gray-800 p-4 shadow-2xl flex flex-col">
        <div className="text-2xl font-bold text-white mb-8 border-b border-gray-700 pb-4 flex items-center">
          <svg className="w-8 h-8 mr-2 text-sky-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
          Outreach Pro
        </div>
        <nav className="flex-grow">
          <ul>
            <NavItem viewName="dashboard" icon={<SearchIcon />} label="Gerenciador de Crawl" />
            <NavItem viewName="contacts" icon={<UsersIcon />} label="Contatos" />
            <NavItem viewName="validator" icon={<CheckCircleIcon />} label="Validador de Telefone" />
            <NavItem viewName="blacklist" icon={<TrashIcon />} label="Lista de Exclusão" />
            <NavItem viewName="outreach" icon={<MessageSquareIcon size={20} />} label="Inbox Unificada" />
            <NavItem viewName="campaigns" icon={<BarChart3Icon size={20} />} label="Campanhas" />
            <NavItem viewName="logs" icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>} label="Logs de Erro" />
          </ul>
        </nav>
        <div className="mt-4 pt-4 border-t border-gray-700">
          <div className="flex items-center mb-4">
            <img 
              src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}`} 
              alt={user.displayName || 'User'} 
              className="w-10 h-10 rounded-full border border-gray-600"
              referrerPolicy="no-referrer"
            />
            <div className="ml-3 overflow-hidden">
              <p className="text-sm font-medium text-white truncate">{user.displayName}</p>
              <p className="text-xs text-gray-400 truncate">{user.email}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center p-2 text-gray-400 hover:text-red-400 transition-colors"
          >
            <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>
            <span className="text-sm font-medium">Sair</span>
          </button>
        </div>
        <div className="text-xs text-gray-500 mt-4">
            <p>&copy; 2024. Todos os direitos reservados.</p>
            <p>Criado com React & Tailwind CSS</p>
        </div>
      </aside>

      <main className="flex-1 p-6 lg:p-10">
        {renderView()}
      </main>
    </div>
  );
};

export default App;
