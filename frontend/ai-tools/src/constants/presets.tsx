import React from 'react';
import { Image as ImageIcon, Crop } from 'lucide-react';

export type PresetId =
  | 'original'
  | 'crop'
  | 'tb-1-1'
  | 'tb-3-4'
  | 'pdd'
  | 'ratio-1-1'
  | 'ratio-3-2'
  | 'ratio-2-3'
  | 'ratio-4-3'
  | 'ratio-3-4'
  | 'ratio-16-9'
  | 'ratio-9-16';

export interface SizePreset {
  id: PresetId;
  name: string;
  icon: React.ReactNode;
  ratioClass: string;
}

export interface OutputSizeOption {
  id: Exclude<PresetId, 'original' | 'crop'>;
  name: string;
  label: string;
  width: number;
  height: number;
  ratioClass: string;
}

export const SIZE_PRESETS: SizePreset[] = [
  {
    id: 'original',
    name: '原尺寸',
    icon: <ImageIcon className="h-6 w-6 stroke-[1.5]" />,
    ratioClass: 'aspect-auto',
  },
  {
    id: 'crop',
    name: '裁剪到边缘',
    icon: <Crop className="h-6 w-6 stroke-[1.5]" />,
    ratioClass: 'aspect-auto',
  },
  {
    id: 'tb-1-1',
    name: '淘宝 1:1 主图',
    icon: (
      <div className="relative flex h-6 w-6 items-center justify-center">
        <div className="h-5 w-5 rounded-sm border-[1.5px] border-current" />
        <span className="absolute -bottom-1 -right-1 text-[10px] font-bold leading-none">淘</span>
      </div>
    ),
    ratioClass: 'aspect-square',
  },
  {
    id: 'tb-3-4',
    name: '淘宝 3:4 主图',
    icon: (
      <div className="relative flex h-6 w-6 items-center justify-center">
        <div className="h-5 w-4 rounded-sm border-[1.5px] border-current" />
        <span className="absolute -bottom-1 -right-1 text-[10px] font-bold leading-none">淘</span>
      </div>
    ),
    ratioClass: 'aspect-[3/4]',
  },
  {
    id: 'pdd',
    name: '拼多多主图',
    icon: <span className="text-xl font-black leading-none tracking-tighter">拼</span>,
    ratioClass: 'aspect-square',
  },
  {
    id: 'ratio-1-1',
    name: '1:1',
    icon: <div className="h-5 w-5 rounded-sm border-[1.5px] border-current" />,
    ratioClass: 'aspect-square',
  },
  {
    id: 'ratio-3-2',
    name: '3:2',
    icon: <div className="h-4 w-6 rounded-sm border-[1.5px] border-current" />,
    ratioClass: 'aspect-[3/2]',
  },
  {
    id: 'ratio-2-3',
    name: '2:3',
    icon: <div className="h-6 w-4 rounded-sm border-[1.5px] border-current" />,
    ratioClass: 'aspect-[2/3]',
  },
  {
    id: 'ratio-4-3',
    name: '4:3',
    icon: <div className="h-4 w-5 rounded-sm border-[1.5px] border-current" />,
    ratioClass: 'aspect-[4/3]',
  },
  {
    id: 'ratio-3-4',
    name: '3:4',
    icon: <div className="h-5 w-4 rounded-sm border-[1.5px] border-current" />,
    ratioClass: 'aspect-[3/4]',
  },
  {
    id: 'ratio-16-9',
    name: '16:9',
    icon: <div className="h-3 w-6 rounded-sm border-[1.5px] border-current" />,
    ratioClass: 'aspect-video',
  },
  {
    id: 'ratio-9-16',
    name: '9:16',
    icon: <div className="h-6 w-3 rounded-sm border-[1.5px] border-current" />,
    ratioClass: 'aspect-[9/16]',
  },
];

export const OUTPUT_SIZE_OPTIONS: OutputSizeOption[] = [
  {
    id: 'ratio-1-1',
    name: '1:1',
    label: '1:1：1440*1440',
    width: 1440,
    height: 1440,
    ratioClass: 'aspect-square',
  },
  {
    id: 'ratio-3-2',
    name: '3:2',
    label: '3:2：1200*800',
    width: 1200,
    height: 800,
    ratioClass: 'aspect-[3/2]',
  },
  {
    id: 'ratio-2-3',
    name: '2:3',
    label: '2:3：800*1200',
    width: 800,
    height: 1200,
    ratioClass: 'aspect-[2/3]',
  },
  {
    id: 'ratio-4-3',
    name: '4:3',
    label: '4:3：1920*1440',
    width: 1920,
    height: 1440,
    ratioClass: 'aspect-[4/3]',
  },
  {
    id: 'ratio-3-4',
    name: '3:4',
    label: '3:4：1440*1920',
    width: 1440,
    height: 1920,
    ratioClass: 'aspect-[3/4]',
  },
  {
    id: 'ratio-16-9',
    name: '16:9',
    label: '16:9：1422*800',
    width: 1422,
    height: 800,
    ratioClass: 'aspect-video',
  },
  {
    id: 'ratio-9-16',
    name: '9:16',
    label: '9:16：800*1422',
    width: 800,
    height: 1422,
    ratioClass: 'aspect-[9/16]',
  },
  {
    id: 'tb-1-1',
    name: '淘宝方图',
    label: '淘宝方图：1440*1440',
    width: 1440,
    height: 1440,
    ratioClass: 'aspect-square',
  },
  {
    id: 'tb-3-4',
    name: '淘宝竖图',
    label: '淘宝竖图：1440*1920',
    width: 1440,
    height: 1920,
    ratioClass: 'aspect-[3/4]',
  },
  {
    id: 'pdd',
    name: '拼多多',
    label: '拼多多：800*800',
    width: 800,
    height: 800,
    ratioClass: 'aspect-square',
  },
];
