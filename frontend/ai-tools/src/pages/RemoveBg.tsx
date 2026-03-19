import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { UploadCloud, Download, RefreshCw, ArrowLeft } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

import { SIZE_PRESETS, type PresetId } from '../constants/presets';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type Status = 'idle' | 'processing' | 'success';
type BgColor = 'transparent' | 'white' | 'black';

type AlphaBounds = { x: number; y: number; width: number; height: number };

const PRESET_TARGET_SIZE: Partial<Record<PresetId, { width: number; height: number }>> = {
  'tb-1-1': { width: 800, height: 800 },
  'tb-3-4': { width: 900, height: 1200 },
  pdd: { width: 1000, height: 1000 },
  'ratio-1-1': { width: 1080, height: 1080 },
  'ratio-2-3': { width: 1200, height: 1800 },
  'ratio-3-4': { width: 1080, height: 1440 },
  'ratio-9-16': { width: 1080, height: 1920 },
};

function getPresetAspectRatio(preset: PresetId): number | null {
  const target = PRESET_TARGET_SIZE[preset];
  if (!target) return null;
  return target.width / target.height;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('图片加载失败'));
    img.src = url;
  });
}

function detectAlphaBounds(img: HTMLImageElement): AlphaBounds {
  const width = img.naturalWidth;
  const height = img.naturalHeight;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return { x: 0, y: 0, width, height };
  }

  ctx.drawImage(img, 0, 0, width, height);
  const { data } = ctx.getImageData(0, 0, width, height);

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const alpha = data[(y * width + x) * 4 + 3];
      if (alpha > 8) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX === -1 || maxY === -1) {
    return { x: 0, y: 0, width, height };
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
}

function fillBackground(ctx: CanvasRenderingContext2D, width: number, height: number, bgColor: BgColor) {
  if (bgColor === 'transparent') return;
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, width, height);
}

function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('图片生成失败'));
        return;
      }
      resolve(blob);
    }, 'image/png');
  });
}

async function buildPresetBlob(sourceUrl: string, preset: PresetId, bgColor: BgColor): Promise<Blob> {
  const img = await loadImage(sourceUrl);
  const naturalWidth = img.naturalWidth;
  const naturalHeight = img.naturalHeight;
  const bounds = detectAlphaBounds(img);

  const target = PRESET_TARGET_SIZE[preset];
  const canvas = document.createElement('canvas');

  if (preset === 'original') {
    // 原尺寸: 保持原始分辨率与比例，不裁切不缩放。
    canvas.width = naturalWidth;
    canvas.height = naturalHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('画布初始化失败');
    fillBackground(ctx, canvas.width, canvas.height, bgColor);
    ctx.drawImage(img, 0, 0, naturalWidth, naturalHeight);
    return canvasToPngBlob(canvas);
  }

  if (preset === 'crop') {
    // 裁剪到边缘: 基于 alpha 通道识别主体边界并去除空白。
    canvas.width = bounds.width;
    canvas.height = bounds.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('画布初始化失败');
    fillBackground(ctx, canvas.width, canvas.height, bgColor);
    ctx.drawImage(
      img,
      bounds.x,
      bounds.y,
      bounds.width,
      bounds.height,
      0,
      0,
      bounds.width,
      bounds.height
    );
    return canvasToPngBlob(canvas);
  }

  if (!target) {
    throw new Error('未知尺寸预设');
  }

  // 平台尺寸: 先裁到主体边缘，再按目标比例等比放大并居中铺满。
  canvas.width = target.width;
  canvas.height = target.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('画布初始化失败');

  fillBackground(ctx, canvas.width, canvas.height, bgColor);

  const scale = Math.min(canvas.width / bounds.width, canvas.height / bounds.height);
  const drawWidth = Math.round(bounds.width * scale);
  const drawHeight = Math.round(bounds.height * scale);
  const dx = Math.floor((canvas.width - drawWidth) / 2);
  const dy = Math.floor((canvas.height - drawHeight) / 2);

  ctx.drawImage(
    img,
    bounds.x,
    bounds.y,
    bounds.width,
    bounds.height,
    dx,
    dy,
    drawWidth,
    drawHeight
  );

  return canvasToPngBlob(canvas);
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('读取图片失败'));
        return;
      }
      const base64 = result.split(',')[1];
      if (!base64) {
        reject(new Error('图片格式不支持'));
        return;
      }
      resolve(base64);
    };
    reader.onerror = () => reject(new Error('读取图片失败'));
    reader.readAsDataURL(file);
  });
}

export const RemoveBg: React.FC = () => {
  const navigate = useNavigate();
  const { refreshProfile, showToast } = useAppContext();
  const [status, setStatus] = useState<Status>('idle');
  const [aspectRatio, setAspectRatio] = useState<PresetId>('original');
  const [bgColor, setBgColor] = useState<BgColor>('transparent');
  const [sourceImageUrl, setSourceImageUrl] = useState<string | null>(null);
  const [rawResultImageUrl, setRawResultImageUrl] = useState<string | null>(null);
  const [renderedImageUrl, setRenderedImageUrl] = useState<string | null>(null);
  const [previewAspectRatio, setPreviewAspectRatio] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const showToastRef = useRef(showToast);

  useEffect(() => {
    showToastRef.current = showToast;
  }, [showToast]);

  useEffect(() => {
    if (status !== 'success' || !rawResultImageUrl) {
      return;
    }

    let cancelled = false;

    buildPresetBlob(rawResultImageUrl, aspectRatio, bgColor)
      .then((blob) => {
        if (cancelled) return;
        const nextUrl = URL.createObjectURL(blob);
        setRenderedImageUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return nextUrl;
        });
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : '尺寸处理失败';
        showToastRef.current(msg, 'error');
      });

    return () => {
      cancelled = true;
    };
  }, [aspectRatio, bgColor, rawResultImageUrl, status]);

  useEffect(() => {
    const previewUrl = renderedImageUrl || rawResultImageUrl;
    if (!previewUrl || status !== 'success') {
      setPreviewAspectRatio(null);
      return;
    }

    let cancelled = false;

    loadImage(previewUrl)
      .then((img) => {
        if (cancelled) return;
        if (img.naturalWidth > 0 && img.naturalHeight > 0) {
          setPreviewAspectRatio(img.naturalWidth / img.naturalHeight);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPreviewAspectRatio(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [rawResultImageUrl, renderedImageUrl, status]);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      showToast('仅支持图片文件', 'error');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      showToast('请上传 10MB 以内图片', 'error');
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) {
      showToast('请先登录后再抠图', 'error');
      navigate('/');
      return;
    }

    if (sourceImageUrl) URL.revokeObjectURL(sourceImageUrl);
    if (rawResultImageUrl) URL.revokeObjectURL(rawResultImageUrl);
    if (renderedImageUrl) URL.revokeObjectURL(renderedImageUrl);

    const previewUrl = URL.createObjectURL(file);
    setSourceImageUrl(previewUrl);
    setRawResultImageUrl(null);
    setRenderedImageUrl(null);
    setStatus('processing');

    try {
      const imageBase64 = await fileToBase64(file);
      const res = await fetch('/api/remove-bg/process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          imageBase64,
          filename: file.name,
        }),
      });

      if (!res.ok) {
        let msg = '抠图失败，请稍后重试';
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const err = await res.json() as { error?: string };
          msg = err.error || msg;
        } else {
          const text = await res.text();
          if (text) msg = text;
        }
        throw new Error(msg);
      }

      const blob = await res.blob();
      const outputUrl = URL.createObjectURL(blob);
      setRawResultImageUrl(outputUrl);

      await refreshProfile();

      setStatus('success');
      showToast('抠图成功，已扣除 10 点', 'success');
    } catch (err: unknown) {
      setStatus('idle');
      setRawResultImageUrl(null);
      setRenderedImageUrl(null);
      const msg = err instanceof Error ? err.message : '网络异常，请重试';
      showToast(msg, 'error');
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (status !== 'idle') return;
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const reset = () => {
    if (sourceImageUrl) URL.revokeObjectURL(sourceImageUrl);
    if (rawResultImageUrl) URL.revokeObjectURL(rawResultImageUrl);
    if (renderedImageUrl) URL.revokeObjectURL(renderedImageUrl);
    setStatus('idle');
    setSourceImageUrl(null);
    setRawResultImageUrl(null);
    setRenderedImageUrl(null);
    setAspectRatio('original');
    setBgColor('transparent');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const download = () => {
    const downloadUrl = renderedImageUrl || rawResultImageUrl;
    if (!downloadUrl) {
      showToast('暂无可下载图片', 'error');
      return;
    }
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = `cutout-${aspectRatio}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Calculate container aspect ratio classes
  const aspectRatioClass = SIZE_PRESETS.find(p => p.id === aspectRatio)?.ratioClass || 'aspect-auto';
  const activePreviewUrl = renderedImageUrl || rawResultImageUrl;
  const finalExportAspectRatio = getPresetAspectRatio(aspectRatio) ?? previewAspectRatio;

  const bgColorClass = {
    'transparent': 'bg-grid-pattern',
    'white': 'bg-white',
    'black': 'bg-black',
  }[bgColor];

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
          <h1 className="text-2xl font-bold text-slate-900">智能抠图</h1>
          <p className="text-sm text-slate-500 mt-1">精准提取商品主体，支持多尺寸与底色切换</p>
        </div>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row gap-6 min-h-0 pb-4">
        {/* Main Canvas Area */}
        <div className="flex-1 relative rounded-3xl bg-slate-100 border-2 border-dashed border-slate-200 overflow-hidden flex items-center justify-center">
          
          <AnimatePresence mode="wait">
            {status === 'idle' && (
              <motion.div
                key="idle"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 transition-colors"
                onClick={() => fileInputRef.current?.click()}
                onDrop={onDrop}
                onDragOver={onDragOver}
              >
                <div className="h-20 w-20 rounded-full bg-white shadow-sm flex items-center justify-center mb-6 text-indigo-600">
                  <UploadCloud className="h-10 w-10" />
                </div>
                <h3 className="text-xl font-semibold text-slate-700 mb-2">点击或拖拽商品图片至此</h3>
                <p className="text-slate-400 text-sm">支持 JPG, PNG 格式，最大 10MB</p>
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
                className="absolute inset-0 flex items-center justify-center bg-slate-900/10 backdrop-blur-sm z-10"
              >
                {sourceImageUrl && (
                  <img src={sourceImageUrl} alt="Original" className="absolute inset-0 w-full h-full object-contain opacity-30" />
                )}
                {/* Scanning line animation */}
                <motion.div 
                  className="absolute left-0 right-0 h-1 bg-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.8)]"
                  animate={{ top: ['0%', '100%', '0%'] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                />
                <div className="relative z-20 bg-white/90 backdrop-blur px-6 py-3 rounded-full shadow-lg flex items-center gap-3">
                  <RefreshCw className="h-5 w-5 text-indigo-600 animate-spin" />
                  <span className="font-medium text-slate-800">正在精准提取商品主体...</span>
                </div>
              </motion.div>
            )}

            {status === 'success' && (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="absolute inset-0 flex items-center justify-center p-8 bg-slate-200/50"
              >
                <div className="relative flex h-full w-full items-center justify-center rounded-[28px] bg-sky-50/70 p-4 shadow-inner">
                  <div className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-[24px] bg-white/35">
                    <div
                      className="relative flex max-h-full max-w-full items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-sky-400/90 bg-white shadow-[0_0_0_1px_rgba(56,189,248,0.14),0_0_24px_rgba(56,189,248,0.12)] transition-all duration-300"
                      style={finalExportAspectRatio ? { aspectRatio: String(finalExportAspectRatio), height: '100%' } : undefined}
                    >
                      <div className={cn("absolute inset-0 rounded-2xl", bgColorClass)} />
                      <div className="pointer-events-none absolute inset-0 rounded-2xl bg-sky-400/5" />
                      {activePreviewUrl && (
                        <img 
                          src={activePreviewUrl} 
                          alt="Cutout result" 
                          className="relative z-10 h-full w-full object-contain drop-shadow-xl" 
                        />
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Control Panel */}
        <div className={cn(
          "w-full lg:w-80 flex flex-col gap-4 transition-opacity duration-300 shrink-0",
          status === 'success' ? "opacity-100" : "opacity-30 pointer-events-none"
        )}>
          <div className="bg-white rounded-3xl p-5 shadow-sm ring-1 ring-slate-200 shrink-0">
            <h3 className="text-sm font-semibold text-slate-900 mb-3 uppercase tracking-wider">尺寸预设</h3>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {SIZE_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => setAspectRatio(preset.id)}
                  className={cn(
                    "flex flex-col items-center justify-center gap-1.5 py-3 px-1 rounded-xl transition-all border-2",
                    aspectRatio === preset.id 
                      ? "border-indigo-600 bg-indigo-50 text-indigo-600 shadow-sm" 
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

          <div className="bg-white rounded-3xl p-5 shadow-sm ring-1 ring-slate-200 shrink-0">
            <h3 className="text-sm font-semibold text-slate-900 mb-3 uppercase tracking-wider">背景底色</h3>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => setBgColor('transparent')}
                className={cn(
                  "h-12 rounded-xl border-2 transition-all bg-grid-pattern",
                  bgColor === 'transparent' ? "border-indigo-600 ring-2 ring-indigo-600/20" : "border-transparent hover:border-slate-300"
                )}
                title="透明网格"
              />
              <button
                onClick={() => setBgColor('white')}
                className={cn(
                  "h-12 rounded-xl border-2 transition-all bg-white shadow-sm",
                  bgColor === 'white' ? "border-indigo-600 ring-2 ring-indigo-600/20" : "border-slate-200 hover:border-slate-300"
                )}
                title="纯白"
              />
              <button
                onClick={() => setBgColor('black')}
                className={cn(
                  "h-12 rounded-xl border-2 transition-all bg-black",
                  bgColor === 'black' ? "border-indigo-600 ring-2 ring-indigo-600/20" : "border-transparent hover:border-slate-700"
                )}
                title="纯黑"
              />
            </div>
          </div>

          <div className="mt-auto flex flex-col gap-3 shrink-0 pt-2">
            <button
              onClick={download}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white py-4 rounded-2xl font-semibold text-lg hover:bg-indigo-700 active:scale-[0.98] transition-all shadow-lg shadow-indigo-600/20"
            >
              <Download className="h-6 w-6" />
              下载高清原图
            </button>
            <button
              onClick={reset}
              className="w-full flex items-center justify-center gap-2 bg-white text-slate-700 py-3 rounded-2xl font-medium hover:bg-slate-50 active:scale-[0.98] transition-all ring-1 ring-slate-200"
            >
              <RefreshCw className="h-4 w-4" />
              上传新图片
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
