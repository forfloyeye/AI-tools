import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { LogOut, HelpCircle, Clock } from 'lucide-react';
import { motion } from 'motion/react';
import { useAppContext } from '../context/AppContext';

export const Navbar: React.FC = () => {
  const { user, openAuthModal, logout, showToast } = useAppContext();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-40 w-full border-b border-slate-200 bg-white shadow-sm">
      <div className="mx-auto flex h-16 w-full px-4 sm:px-6 lg:px-8 relative justify-between items-center">
        <Link to="/" className="flex items-center gap-2 transition-opacity hover:opacity-80">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white shadow-sm">
            <span className="font-bold text-lg">破</span>
          </div>
          <span className="text-xl font-bold tracking-tight text-slate-900">破军星AI工具箱</span>
        </Link>

        {/* Middle Navigation */}
        <div className="hidden md:flex items-center gap-8 absolute left-1/2 -translate-x-1/2 h-full">
          <div className="text-base font-semibold text-violet-600 relative h-full flex items-center cursor-default">
            AI工具
            <motion.div 
              className="absolute bottom-0 left-0 right-0 h-0.5 bg-violet-600" 
              layoutId="activeTab" 
            />
          </div>
          <button 
            onClick={() => showToast('商品管理模块开发中...', 'success')} 
            className="text-base font-medium text-slate-600 hover:text-violet-600 transition-colors h-full flex items-center"
          >
            商品管理
          </button>
          <button 
            onClick={() => showToast('商品检测模块开发中...', 'success')} 
            className="text-base font-medium text-slate-600 hover:text-violet-600 transition-colors h-full flex items-center"
          >
            商品检测
          </button>
        </div>

        <div className="flex items-center gap-6">
          <button
            onClick={() => showToast('联系客服', 'success')}
            className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900 transition-colors group relative"
          >
            <HelpCircle className="w-4 h-4" />
            <span>客服</span>
            {/* Hover tooltip for QR could go here */}
            <div className="absolute right-0 top-full mt-2 w-32 p-2 bg-white border border-slate-200 shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all rounded-lg flex flex-col items-center z-50">
              <div className="w-24 h-24 bg-slate-100 mb-2 flex items-center justify-center text-xs text-slate-400">二维码</div>
              <span className="text-xs text-slate-600">扫码联系客服</span>
            </div>
          </button>

          <div className="flex items-center gap-3 bg-amber-50/50 pl-3 pr-1.5 py-1.5 rounded-full border border-amber-100">
            <div className="flex items-center gap-1.5 text-sm">
              <Clock className="w-4 h-4 text-amber-600" />
              <span className="text-slate-600">服务有效期</span>
              <span className="text-amber-600 font-medium">剩余 23 天</span>
            </div>
            <button className="bg-violet-600 hover:bg-violet-700 text-white text-xs px-3 py-1 rounded-full transition-colors font-medium">
              续费
            </button>
          </div>

          {user ? (
            <div className="flex items-center gap-4 ml-2">
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
