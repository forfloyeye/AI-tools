import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { 
  Scissors, 
  Wand2, 
  ArrowRight, 
  Layers, 
  Languages, 
  Palette, 
  Sparkles, 
  Maximize, 
  Video 
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const TOOLS = [
  {
    id: 'remove-bg',
    title: '智能抠图',
    description: '一键精准提取商品主体，支持透明、纯色背景切换，适配多平台尺寸。',
    icon: Scissors,
    path: '/tools/remove-bg',
    points: 10,
    bgLight: 'bg-gradient-to-br from-indigo-50 to-blue-100',
    textDark: 'text-indigo-600',
    ringLight: 'ring-indigo-200/50',
    hoverRing: 'hover:ring-indigo-500/50',
    hoverBg: 'group-hover:bg-gradient-to-r group-hover:from-indigo-600 group-hover:to-blue-600',
  },
  {
    id: 'ai-scene',
    title: 'AI 商品图',
    description: '将白底商品图无缝融合至多种预设的高级场景中，提升视觉质感。',
    icon: Wand2,
    path: '/tools/ai-scene',
    points: 30,
    bgLight: 'bg-gradient-to-br from-violet-50 to-purple-100',
    textDark: 'text-violet-600',
    ringLight: 'ring-violet-200/50',
    hoverRing: 'hover:ring-violet-500/50',
    hoverBg: 'group-hover:bg-gradient-to-r group-hover:from-violet-600 group-hover:to-purple-600',
  },
  {
    id: 'ai-set',
    title: 'AI商品套图',
    description: '一键生成多角度、多场景的商品展示套图，丰富详情页素材。',
    icon: Layers,
    path: '#',
    points: 50,
    bgLight: 'bg-gradient-to-br from-fuchsia-50 to-pink-100',
    textDark: 'text-fuchsia-600',
    ringLight: 'ring-fuchsia-200/50',
    hoverRing: 'hover:ring-fuchsia-500/50',
    hoverBg: 'group-hover:bg-gradient-to-r group-hover:from-fuchsia-600 group-hover:to-pink-600',
  },
  {
    id: 'img-translate',
    title: '图片翻译',
    description: '自动识别并翻译图片中的文字，保留原图排版与字体风格。',
    icon: Languages,
    path: '#',
    points: 15,
    bgLight: 'bg-gradient-to-br from-emerald-50 to-teal-100',
    textDark: 'text-emerald-600',
    ringLight: 'ring-emerald-200/50',
    hoverRing: 'hover:ring-emerald-500/50',
    hoverBg: 'group-hover:bg-gradient-to-r group-hover:from-emerald-600 group-hover:to-teal-600',
  },
  {
    id: 'color-change',
    title: '服装换色',
    description: '智能识别服装区域，一键替换为目标颜色，自然保留褶皱与光影。',
    icon: Palette,
    path: '#',
    points: 20,
    bgLight: 'bg-gradient-to-br from-rose-50 to-orange-100',
    textDark: 'text-rose-600',
    ringLight: 'ring-rose-200/50',
    hoverRing: 'hover:ring-rose-500/50',
    hoverBg: 'group-hover:bg-gradient-to-r group-hover:from-rose-600 group-hover:to-orange-600',
  },
  {
    id: 'upscale',
    title: '变清晰',
    description: 'AI 增强画质，修复模糊、噪点，将低分辨率商品图提升至超清画质。',
    icon: Sparkles,
    path: '#',
    points: 15,
    bgLight: 'bg-gradient-to-br from-cyan-50 to-blue-100',
    textDark: 'text-cyan-600',
    ringLight: 'ring-cyan-200/50',
    hoverRing: 'hover:ring-cyan-500/50',
    hoverBg: 'group-hover:bg-gradient-to-r group-hover:from-cyan-600 group-hover:to-blue-600',
  },
  {
    id: 'outpaint',
    title: 'AI扩图',
    description: '智能延伸图片边缘，无缝补全背景，适配不同平台的尺寸比例要求。',
    icon: Maximize,
    path: '#',
    points: 25,
    bgLight: 'bg-gradient-to-br from-amber-50 to-yellow-100',
    textDark: 'text-amber-600',
    ringLight: 'ring-amber-200/50',
    hoverRing: 'hover:ring-amber-500/50',
    hoverBg: 'group-hover:bg-gradient-to-r group-hover:from-amber-600 group-hover:to-yellow-600',
  },
  {
    id: 'video-gen',
    title: 'AI带货视频生成',
    description: '输入商品图与卖点，一键生成带配音、转场的高转化短视频。',
    icon: Video,
    path: '#',
    points: 100,
    bgLight: 'bg-gradient-to-br from-blue-50 to-indigo-100',
    textDark: 'text-blue-600',
    ringLight: 'ring-blue-200/50',
    hoverRing: 'hover:ring-blue-500/50',
    hoverBg: 'group-hover:bg-gradient-to-r group-hover:from-blue-600 group-hover:to-indigo-600',
  },
];

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user, openAuthModal, showToast } = useAppContext();

  const handleToolClick = (path: string) => {
    if (path === '#') {
      showToast('功能开发中，敬请期待...', 'success');
      return;
    }
    if (!user) {
      openAuthModal(false);
      return;
    }
    navigate(path);
  };

  return (
    <div className="flex-1 w-full max-w-7xl mx-auto px-4 py-12 sm:px-6 lg:px-8 flex flex-col justify-center">
      <div className="text-center mb-16 relative">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl mb-6">
            电商图片处理，<span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-500">一步到位</span>
          </h1>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
            专为电商卖家设计的轻量级 AI 工具箱，极简操作，即用即走。
            <br className="hidden sm:block" />
            全方位提升您的商品图转化率与视觉质感。
          </p>
        </motion.div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {TOOLS.map((tool, index) => {
          const Icon = tool.icon;
          return (
            <motion.div
              key={tool.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: index * 0.05 }}
              whileHover={{ y: -4, scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleToolClick(tool.path)}
              className={cn(
                "group relative cursor-pointer overflow-hidden rounded-3xl bg-white/80 backdrop-blur-sm p-6 shadow-sm ring-1 ring-slate-200/60 transition-all hover:shadow-xl",
                tool.hoverRing
              )}
            >
              {/* Background Icon Decoration */}
              <div className="absolute -top-4 -right-4 p-6 opacity-[0.03] transition-opacity group-hover:opacity-10 pointer-events-none">
                <Icon className={cn("w-32 h-32", tool.textDark)} />
              </div>
              
              <div className="relative z-10 flex flex-col h-full">
                <div className={cn(
                  "mb-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl ring-1 transition-transform group-hover:scale-110",
                  tool.bgLight,
                  tool.textDark,
                  tool.ringLight
                )}>
                  <Icon className="h-6 w-6" />
                </div>
                
                <h2 className="text-xl font-bold text-slate-900 mb-2">
                  {tool.title}
                </h2>
                
                <p className="text-sm text-slate-500 mb-6 flex-1 leading-relaxed">
                  {tool.description}
                </p>
                
                <div className="flex items-center justify-between mt-auto pt-4 border-t border-slate-100">
                  <div className="flex items-center gap-1.5 rounded-full bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-500">
                    <span>🪙</span>
                    <span>{tool.points} 点</span>
                  </div>
                  <div className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full bg-slate-50 text-slate-400 transition-colors group-hover:text-white",
                    tool.hoverBg
                  )}>
                    <ArrowRight className="h-4 w-4" />
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};
