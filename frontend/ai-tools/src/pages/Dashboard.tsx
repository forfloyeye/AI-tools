import React from 'react';
import { motion } from 'motion/react';
import { Wand2 } from 'lucide-react';

export const Dashboard: React.FC = () => {
  return (
    <div className="flex-1 w-full h-full flex flex-col items-center justify-center bg-white rounded-xl shadow-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="text-center"
      >
        <div className="w-20 h-20 bg-violet-50 text-violet-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-inner ring-1 ring-violet-100">
          <Wand2 className="w-10 h-10" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 mb-4">
          欢迎使用破军星AI工具箱
        </h1>
        <p className="text-base text-slate-500 max-w-md mx-auto leading-relaxed">
          请在左侧菜单选择或切换所需的功能模块。
          <br/>
          一键精准处理，全方位提升您的商品图转化率与视觉质感。
        </p>
      </motion.div>
    </div>
  );
};
