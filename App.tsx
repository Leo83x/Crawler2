
import React, { useState } from 'react';
import Dashboard from './components/Dashboard';
import ContactsView from './components/ContactsView';
import PhoneValidator from './components/PhoneValidator';
import { SearchIcon } from './components/icons/SearchIcon';
import { UsersIcon } from './components/icons/UsersIcon';
import { CheckCircleIcon } from './components/icons/CheckCircleIcon';

type View = 'dashboard' | 'contacts' | 'validator';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<View>('dashboard');

  const renderView = () => {
    switch (currentView) {
      case 'dashboard':
        return <Dashboard />;
      case 'contacts':
        return <ContactsView />;
      case 'validator':
        return <PhoneValidator />;
      default:
        return <Dashboard />;
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
          UI de Crawler
        </div>
        <nav className="flex-grow">
          <ul>
            <NavItem viewName="dashboard" icon={<SearchIcon />} label="Gerenciador de Crawl" />
            <NavItem viewName="contacts" icon={<UsersIcon />} label="Contatos" />
            <NavItem viewName="validator" icon={<CheckCircleIcon />} label="Validador de Telefone" />
          </ul>
        </nav>
        <div className="text-xs text-gray-500 mt-auto">
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
