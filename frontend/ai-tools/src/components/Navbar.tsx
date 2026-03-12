import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { LogOut, User } from 'lucide-react';
import { motion } from 'motion/react';
import { useAppContext } from '../context/AppContext';

export const Navbar: React.FC = () => {
  const { user, points, openAuthModal, logout, showToast } = useAppContext();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-40 w-full border-b border-slate-200 bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8 relative">
        <Link to="/" className="flex items-center gap-2 transition-opacity hover:opacity-80">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-sm">
            <span className="font-bold">E</span>
          </div>
          <span className="text-lg font-semibold tracking-tight text-slate-900">E-Tool</span>
        </Link>

        {/* Middle Navigation */}
        <div className="hidden md:flex items-center gap-8 absolute left-1/2 -translate-x-1/2 h-full">
          <button 
            onClick={() => showToast('一键铺货功能开发中...', 'success')} 
            className="text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors h-full flex items-center"
          >
            一键铺货
          </button>
          <button 
            onClick={() => showToast('商品管理功能开发中...', 'success')} 
            className="text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors h-full flex items-center"
          >
            商品管理
          </button>
          <div className="text-sm font-medium text-indigo-600 relative h-full flex items-center cursor-default">
            图片处理
            <motion.div 
              className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600" 
              layoutId="activeTab" 
            />
          </div>
        </div>

        <div className="flex items-center gap-4">
          {user ? (
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-700 ring-1 ring-amber-600/20">
                <span>🪙</span>
                <span>{points} 点</span>
              </div>
              
              <div className="relative">
                <button
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full ring-2 ring-transparent transition-all hover:ring-slate-200 focus:outline-none focus:ring-slate-200"
                >
                  <img src={user.avatar} alt="User avatar" className="h-full w-full object-cover bg-slate-100" />
                </button>

                {isDropdownOpen && (
                  <>
                    <div 
                      className="fixed inset-0 z-10" 
                      onClick={() => setIsDropdownOpen(false)}
                    />
                    <div className="absolute right-0 z-20 mt-2 w-48 origin-top-right rounded-xl bg-white py-1 shadow-lg ring-1 ring-black/5 focus:outline-none">
                      <div className="px-4 py-2 text-xs text-slate-500 border-b border-slate-100 truncate">
                        {user.email}
                      </div>
                      <button
                        onClick={() => {
                          logout();
                          setIsDropdownOpen(false);
                        }}
                        className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-slate-50 transition-colors"
                      >
                        <LogOut className="h-4 w-4" />
                        退出登录
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          ) : (
            <button
              onClick={() => openAuthModal(true)}
              className="rounded-full bg-slate-900 px-5 py-2 text-sm font-medium text-white transition-all hover:bg-slate-800 active:scale-95"
            >
              登录 / 注册
            </button>
          )}
        </div>
      </div>
    </nav>
  );
};
