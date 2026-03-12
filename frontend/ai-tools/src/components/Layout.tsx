import React from 'react';
import { Navbar } from './Navbar';
import { AuthModal } from './AuthModal';
import { Toast } from './Toast';
import { useAppContext } from '../context/AppContext';

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isAuthModalOpen } = useAppContext();

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900 relative overflow-hidden">
      {/* Decorative background blobs */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full max-w-7xl pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-200/30 blur-[100px]" />
        <div className="absolute top-[20%] right-[-10%] w-[30%] h-[40%] rounded-full bg-violet-200/30 blur-[100px]" />
        <div className="absolute bottom-[-10%] left-[20%] w-[50%] h-[40%] rounded-full bg-fuchsia-200/20 blur-[100px]" />
      </div>

      <Navbar />
      <main className="flex-1 flex flex-col relative z-10 overflow-y-auto overflow-x-hidden custom-scrollbar">
        {children}
      </main>
      
      {/* Modals and Toasts */}
      {isAuthModalOpen && <AuthModal />}
      <Toast />
    </div>
  );
};
