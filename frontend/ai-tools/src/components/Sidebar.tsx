import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  Palette, 
  Image as ImageIcon, 
  Scissors, 
  User, 
  Shirt, 
  Footprints,
  Droplet,
  ImagePlus,
  Wand2,
  Copyright
} from 'lucide-react';
import { motion } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useAppContext } from '../context/AppContext';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const MENU_ITEMS = [
  { path: '/tools/ai-scene', label: 'AI图片风格', icon: Palette },
  { path: '/tools/ai-product-set', label: 'AI穿戴套图', icon: ImageIcon },
  { path: '/tools/remove-bg', label: '透明底图/抠图', icon: Scissors },
  { path: '/tools/ai-model', label: 'AI模特', icon: User, disabled: true },
  { path: '/tools/ai-clothes', label: 'AI穿衣', icon: Shirt, disabled: true },
  { path: '/tools/ai-shoes', label: 'AI试鞋', icon: Footprints, disabled: true },
  { path: '/tools/recolor', label: 'AI服装换色', icon: Droplet, disabled: true },
  { path: '/tools/blur-bg', label: '虚化背景', icon: Wand2, disabled: true },
  { path: '/tools/expand', label: 'AI扩图', icon: ImagePlus, disabled: true },
  { path: '/tools/watermark', label: '添加水印', icon: Copyright, disabled: true },
];

export const Sidebar: React.FC = () => {
  const { showToast } = useAppContext();

  return (
    <aside className="w-64 h-full bg-slate-50 flex flex-col pt-4 border-r border-slate-200 shrink-0">
      <div className="px-4 pb-2 text-xs font-medium text-slate-400">
        功能列表
      </div>
      <nav className="flex-1 px-3 space-y-1 overflow-y-auto pb-4">
        {MENU_ITEMS.map((item) => {
          const Icon = item.icon;
          
          if (item.disabled) {
            return (
              <button
                key={item.label}
                type="button"
                onClick={() => showToast(`${item.label}功能开发中，敬请期待`, 'success')}
                className="flex w-full items-center gap-3 px-3 py-2.5 text-sm font-medium text-slate-500 rounded-lg opacity-70 transition-colors hover:bg-slate-100 hover:text-slate-700"
              >
                <Icon className="w-5 h-5" />
                {item.label}
              </button>
            );
          }

          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => cn(
                "relative flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors",
                isActive 
                  ? "text-violet-600 bg-violet-100/50" 
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              )}
            >
              {({ isActive }) => (
                <>
                  <Icon className={cn("w-5 h-5", isActive ? "text-violet-600" : "text-slate-400")} />
                  {item.label}
                  {isActive && (
                    <motion.div
                      layoutId="sidebar-active"
                      className="absolute inset-0 border-l-4 border-violet-600 rounded-lg bg-violet-50/50"
                      initial={false}
                      transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    />
                  )}
                </>
              )}
            </NavLink>
          );
        })}
      </nav>
    </aside>
  );
};
