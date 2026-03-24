import React from 'react';
import { useLocation } from 'react-router-dom';
import { Navbar } from './Navbar';
import { Sidebar } from './Sidebar';
import { AuthModal } from './AuthModal';
import { Toast } from './Toast';
import { useAppContext } from '../context/AppContext';

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthModalOpen } = useAppContext();
  const location = useLocation();
  const useContainedScrollLayout = ['/tools/ai-scene', '/tools/ai-product-set'].includes(location.pathname);

  return (
    <div className="h-screen bg-slate-50 flex flex-col font-sans text-slate-900 overflow-hidden">
      <Navbar />
      
      <div className="flex-1 flex min-h-0 relative z-10 w-full">
        <Sidebar />
        
        <main className="flex-1 min-w-0 h-full overflow-hidden flex flex-col">
          <div
            className={
              useContainedScrollLayout
                ? 'relative flex-1 h-full min-h-0 overflow-hidden p-0'
                : 'flex-1 overflow-y-auto custom-scrollbar h-full relative p-4 lg:p-6 pb-0'
            }
          >
            {children}
          </div>
        </main>
      </div>
      
      {/* Modals and Toasts */}
      {isAuthModalOpen && <AuthModal />}
      <Toast />
    </div>
  );
};
