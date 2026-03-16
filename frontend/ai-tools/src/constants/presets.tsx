import React from 'react';
import { Image as ImageIcon, Crop } from 'lucide-react';

export type PresetId =
  | 'original'
  | 'crop'
  | 'tb-1-1'
  | 'tb-3-4'
  | 'pdd'
  | 'ratio-1-1'
  | 'ratio-2-3'
  | 'ratio-3-4'
  | 'ratio-9-16';

export interface SizePreset {
  id: PresetId;
  name: string;
  icon: React.ReactNode;
  ratioClass: string;
}

export const SIZE_PRESETS: SizePreset[] = [
  { 
    id: 'original', 
    name: '原尺寸', 
    icon: <ImageIcon className="w-6 h-6 stroke-[1.5]" />, 
    ratioClass: 'aspect-auto' 
  },
  { 
    id: 'crop', 
    name: '裁剪到边缘', 
    icon: <Crop className="w-6 h-6 stroke-[1.5]" />, 
    ratioClass: 'aspect-auto' 
  },
  { 
    id: 'tb-1-1', 
    name: '淘宝1:1主图', 
    icon: (
      <div className="relative flex items-center justify-center w-6 h-6">
        <div className="w-5 h-5 border-[1.5px] border-current rounded-sm" />
        <span className="absolute -bottom-1 -right-1 text-[10px] font-bold leading-none bg-inherit">淘</span>
      </div>
    ), 
    ratioClass: 'aspect-square' 
  },
  { 
    id: 'tb-3-4', 
    name: '淘宝3:4主图', 
    icon: (
      <div className="relative flex items-center justify-center w-6 h-6">
        <div className="w-4 h-5 border-[1.5px] border-current rounded-sm" />
        <span className="absolute -bottom-1 -right-1 text-[10px] font-bold leading-none bg-inherit">淘</span>
      </div>
    ), 
    ratioClass: 'aspect-[3/4]' 
  },
  { 
    id: 'pdd', 
    name: '拼多多主图', 
    icon: <span className="text-xl font-black tracking-tighter leading-none">拼</span>, 
    ratioClass: 'aspect-square' 
  },
  {
    id: 'ratio-1-1',
    name: '1:1',
    icon: <div className="w-5 h-5 border-[1.5px] border-current rounded-sm" />,
    ratioClass: 'aspect-square'
  },
  {
    id: 'ratio-2-3',
    name: '2:3',
    icon: <div className="w-4 h-6 border-[1.5px] border-current rounded-sm" />,
    ratioClass: 'aspect-[2/3]'
  },
  {
    id: 'ratio-3-4',
    name: '3:4',
    icon: <div className="w-4 h-5 border-[1.5px] border-current rounded-sm" />,
    ratioClass: 'aspect-[3/4]'
  },
  {
    id: 'ratio-9-16',
    name: '9:16',
    icon: <div className="w-3 h-6 border-[1.5px] border-current rounded-sm" />,
    ratioClass: 'aspect-[9/16]'
  },
];
