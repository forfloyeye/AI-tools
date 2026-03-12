import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { UploadCloud, Download, RefreshCw, AlertCircle, ArrowLeft } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

import { SIZE_PRESETS, type PresetId } from '../constants/presets';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type Status = 'idle' | 'processing' | 'success';

const SCENES = [
  { id: 'minimal', name: '极简桌面', image: 'https://images.unsplash.com/photo-1600607686527-6fb886090705?w=200&q=80' },
  { id: 'nature', name: '自然户外', image: 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=200&q=80' },
  { id: 'cozy', name: '温馨家居', image: 'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?w=200&q=80' },
  { id: 'studio', name: '影棚光影', image: 'https://images.unsplash.com/photo-1598300042247-d088f8ab3a91?w=200&q=80' },
  { id: 'marble', name: '大理石台', image: 'https://images.unsplash.com/photo-1598531401296-65415822f306?w=200&q=80' },
];

export const AiScene: React.FC = () => {
  const navigate = useNavigate();
  const { deductPoints, showToast } = useAppContext();
  const [status, setStatus] = useState<Status>('idle');
  const [selectedScene, setSelectedScene] = useState<string | null>(null);
  const [aspectRatio, setAspectRatio] = useState<PresetId>('original');
  const [image, setImage] = useState<string | null>(null);
  const [shake, setShake] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 500);
  };

  const handleSceneSelect = (sceneId: string) => {
    if (status === 'processing') return;
    setSelectedScene(sceneId);
    
    if (status === 'success' && image) {
      setStatus('processing');
      setTimeout(async () => {
        try {
          const success = await deductPoints(30);
          if (success) {
            setStatus('success');
          } else {
            navigate('/');
          }
        } catch {
          setStatus('idle');
          setImage(null);
          showToast('网络异常，请重试', 'error');
        }
      }, 2500);
    }
  };

  const handleFile = (file: File) => {
    if (!selectedScene) {
      triggerShake();
      return;
    }
    
    if (!file.type.startsWith('image/')) return;
    
    // In a real app, we'd upload the file. Here we just mock it.
    const url = URL.createObjectURL(file);
    setImage(url);
    setStatus('processing');

    // Mock processing delay
    setTimeout(async () => {
      try {
        const success = await deductPoints(30);
        if (success) {
          setStatus('success');
        } else {
          navigate('/');
        }
      } catch {
        setStatus('idle');
        setImage(null);
        showToast('网络异常，请重试', 'error');
      }
    }, 2500);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (status !== 'idle') return;
    
    if (!selectedScene) {
      triggerShake();
      return;
    }

    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const reset = () => {
    setStatus('idle');
    setImage(null);
    setAspectRatio('original');
  };

  const download = () => {
    const link = document.createElement('a');
    link.href = image || '';
    link.download = 'ai-scene-image.png';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const aspectRatioClass = SIZE_PRESETS.find(p => p.id === aspectRatio)?.ratioClass || 'aspect-auto';

  const selectedSceneData = SCENES.find(s => s.id === selectedScene);

  return (
    <div className="flex-1 w-full max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 flex flex-col h-full overflow-hidden">
      <div className="mb-4 flex items-center gap-4 shrink-0">
        <button 
          onClick={() => navigate('/')}
          className="group flex items-center justify-center w-10 h-10 rounded-full bg-white border border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm active:scale-95"
          title="返回工作台"
        >
          <ArrowLeft className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">AI 商品图</h1>
          <p className="text-sm text-slate-500 mt-1">将商品无缝融合至高级场景，提升视觉质感</p>
        </div>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row gap-6 min-h-0 pb-4">
        
        {/* Left Panel: Scene Selection */}
        <div className={cn(
          "w-full lg:w-48 flex flex-col gap-3 transition-opacity duration-300 shrink-0",
          status === 'processing' && "opacity-50 pointer-events-none"
        )}>
          <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider shrink-0">
            选择生成场景
          </h3>
          <div className="flex flex-row lg:flex-col gap-2 flex-1 min-h-0">
            {SCENES.map((scene) => (
              <button
                key={scene.id}
                onClick={() => handleSceneSelect(scene.id)}
                className={cn(
                  "flex-1 relative overflow-hidden rounded-xl group transition-all",
                  selectedScene === scene.id 
                    ? "ring-4 ring-violet-600 ring-offset-2 ring-offset-slate-50" 
                    : "ring-1 ring-slate-200 hover:ring-violet-400"
                )}
              >
                <img src={scene.image} alt={scene.name} className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                <span className="absolute bottom-3 left-3 text-sm font-medium text-white">{scene.name}</span>
                {selectedScene === scene.id && (
                  <div className="absolute top-2 right-2 h-5 w-5 bg-violet-600 rounded-full flex items-center justify-center">
                    <div className="h-2 w-2 bg-white rounded-full" />
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Main Canvas Area */}
        <div className="flex-1 relative rounded-3xl bg-slate-100 border-2 border-dashed border-slate-200 overflow-hidden flex items-center justify-center">
          <AnimatePresence mode="wait">
            {status === 'idle' && (
              <motion.div
                key="idle"
                animate={shake ? { x: [-10, 10, -10, 10, 0] } : {}}
                transition={{ duration: 0.4 }}
                className="absolute inset-0 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 transition-colors"
                onClick={() => {
                  if (!selectedScene) triggerShake();
                  else fileInputRef.current?.click();
                }}
                onDrop={onDrop}
                onDragOver={onDragOver}
              >
                <div className={cn(
                  "h-20 w-20 rounded-full shadow-sm flex items-center justify-center mb-6 transition-colors",
                  selectedScene ? "bg-white text-violet-600" : "bg-slate-200 text-slate-400"
                )}>
                  <UploadCloud className="h-10 w-10" />
                </div>
                
                {selectedScene ? (
                  <>
                    <h3 className="text-xl font-semibold text-slate-700 mb-2">点击或拖拽商品图片至此</h3>
                    <p className="text-slate-400 text-sm">支持 JPG, PNG 格式，最大 10MB</p>
                  </>
                ) : (
                  <div className="flex items-center gap-2 text-amber-600 bg-amber-50 px-4 py-2 rounded-full">
                    <AlertCircle className="h-5 w-5" />
                    <span className="font-medium">请先在左侧选择一个生成场景</span>
                  </div>
                )}
                
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                  accept="image/*"
                  className="hidden"
                />
              </motion.div>
            )}

            {status === 'processing' && (
              <motion.div
                key="processing"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 flex items-center justify-center bg-slate-900/40 backdrop-blur-md z-10"
              >
                {/* Background scene preview */}
                {selectedSceneData && (
                  <img src={selectedSceneData.image} alt="Scene" className="absolute inset-0 w-full h-full object-cover opacity-50" />
                )}
                
                <div className="relative z-20 bg-white/90 backdrop-blur px-6 py-4 rounded-2xl shadow-xl flex flex-col items-center gap-4">
                  <RefreshCw className="h-8 w-8 text-violet-600 animate-spin" />
                  <span className="font-medium text-slate-800">正在将商品融合至「{selectedSceneData?.name}」...</span>
                </div>
              </motion.div>
            )}

            {status === 'success' && (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="absolute inset-0 flex items-center justify-center p-8 bg-slate-900"
              >
                <div className={cn(
                  "relative w-full max-w-full max-h-full flex items-center justify-center shadow-2xl transition-all duration-300 overflow-hidden rounded-xl bg-slate-800",
                  aspectRatioClass
                )}>
                  {/* Mock AI generation result: Scene background with product image centered */}
                  {selectedSceneData && (
                    <img src={selectedSceneData.image} alt="Background" className="absolute inset-0 w-full h-full object-cover" />
                  )}
                  {image && (
                    <img src={image} alt="Product" className="relative z-10 w-2/3 h-2/3 object-contain drop-shadow-2xl" />
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right Panel: Control Panel (Only visible on success) */}
        {status === 'success' && (
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="w-full lg:w-80 flex flex-col gap-4 shrink-0"
          >
            <div className="bg-white rounded-3xl p-5 shadow-sm ring-1 ring-slate-200 shrink-0">
              <h3 className="text-sm font-semibold text-slate-900 mb-3 uppercase tracking-wider">尺寸预设</h3>
              <div className="grid grid-cols-4 gap-2">
                {SIZE_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => setAspectRatio(preset.id)}
                    className={cn(
                      "flex flex-col items-center justify-center gap-1.5 py-3 px-1 rounded-xl transition-all border-2",
                      aspectRatio === preset.id 
                        ? "border-violet-600 bg-violet-50 text-violet-600 shadow-sm" 
                        : "border-transparent bg-slate-50 text-slate-600 hover:bg-slate-100"
                    )}
                  >
                    <div className="h-6 flex items-center justify-center">
                      {preset.icon}
                    </div>
                    <span className="text-[10px] font-medium leading-tight text-center">{preset.name}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-auto flex flex-col gap-3 shrink-0 pt-2">
              <button
                onClick={download}
                className="w-full flex items-center justify-center gap-2 bg-violet-600 text-white py-4 rounded-2xl font-semibold text-lg hover:bg-violet-700 active:scale-[0.98] transition-all shadow-lg shadow-violet-600/20"
              >
                <Download className="h-6 w-6" />
                下载高清原图
              </button>
              <button
                onClick={reset}
                className="w-full flex items-center justify-center gap-2 bg-white text-slate-700 py-3 rounded-2xl font-medium hover:bg-slate-50 active:scale-[0.98] transition-all ring-1 ring-slate-200"
              >
                <RefreshCw className="h-4 w-4" />
                生成其它商品
              </button>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
};
