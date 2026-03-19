import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { UploadCloud, Download, RefreshCw, AlertCircle, ArrowLeft, X, Sparkles, CheckCircle2, ImageIcon } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { generateProductScene } from '../utils/geminiImageService';

import { SIZE_PRESETS, type PresetId } from '../constants/presets';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type Status = 'idle' | 'processing' | 'success';

function formatAiSceneError(err: unknown): string {
  const message = err instanceof Error ? err.message : 'AI 生成失败，请重试';

  if (message.includes('连接 Gemini 服务超时')) {
    return '当前服务器连接 Gemini 超时。请稍后重试，或检查当前网络环境是否可访问 Google API。';
  }

  if (message.includes('无法连接 Gemini 服务')) {
    return '当前服务器无法连接 Gemini 服务。通常是本机网络、代理或防火墙限制导致。';
  }

  return message;
}

const SCENES = [
  {
    id: 'festival',
    name: '节日氛围',
    desc: '暖黄色调 · 灯笼礼盒 · 温馨治愈',
    image: 'https://images.unsplash.com/photo-1512389142860-9c449e58a543?w=400&q=80',
  },
  {
    id: 'modern-home',
    name: '现代简约家居',
    desc: '浅灰色调 · 自然漫射光 · 高质感',
    image: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=400&q=80',
  },
  {
    id: 'retro',
    name: '复古文艺',
    desc: '暖棕色调 · 复古书籍干花 · 电影感',
    image: 'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=400&q=80',
  },
  {
    id: 'plain-grey',
    name: '纯浅灰无缝背景',
    desc: '产品占 85% · 柔光 · 商业纯色',
    image: 'https://images.unsplash.com/photo-1607082349566-187342175e2f?w=400&q=80',
  },
  {
    id: 'daily-life',
    name: '日常居家生活',
    desc: '自然窗光 · 咖啡手机道具 · 生活化',
    image: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400&q=80',
  },
];

const COUNT_OPTIONS = [1, 2, 4] as const;
type CountOption = (typeof COUNT_OPTIONS)[number];

export const AiScene: React.FC = () => {
  const navigate = useNavigate();
  const { refreshProfile, showToast } = useAppContext();
  const [status, setStatus] = useState<Status>('idle');
  const [selectedScene, setSelectedScene] = useState<string | null>(null);
  const [aspectRatio, setAspectRatio] = useState<PresetId>('ratio-1-1');
  const [genCount, setGenCount] = useState<CountOption>(1);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadedPreview, setUploadedPreview] = useState<string | null>(null);
  const [resultImages, setResultImages] = useState<string[]>([]);
  const [errorHint, setErrorHint] = useState<string | null>(null);
  const [shake, setShake] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (uploadedPreview) {
        URL.revokeObjectURL(uploadedPreview);
      }
    };
  }, [uploadedPreview]);

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 500);
  };

  const handleFileSelect = (file: File) => {
    if (!file.type.startsWith('image/')) {
      showToast('仅支持图片文件', 'error');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      showToast('图片大小不能超过 10MB', 'error');
      return;
    }

    if (uploadedPreview) {
      URL.revokeObjectURL(uploadedPreview);
    }
    const url = URL.createObjectURL(file);
    setUploadedPreview(url);
    setUploadedFile(file);
    setResultImages([]);
    setErrorHint(null);
    setStatus('idle');
  };

  const handleGenerate = async () => {
    if (!uploadedFile) { triggerShake(); return; }
    if (!selectedScene) { triggerShake(); return; }

    setResultImages([]);
    setErrorHint(null);
    setStatus('processing');

    try {
      const images = await generateProductScene(uploadedFile, selectedScene, undefined, genCount);
      setResultImages(images);
      setStatus('success');
      await refreshProfile();
    } catch (err) {
      setStatus('idle');
      const message = formatAiSceneError(err);
      setErrorHint(message);
      showToast(message, 'error');
    }
  };

  const handleRetry = async () => {
    if (!uploadedFile || !selectedScene || status === 'processing') return;
    await handleGenerate();
  };

  const handleReset = () => {
    if (uploadedPreview) {
      URL.revokeObjectURL(uploadedPreview);
    }
    setStatus('idle');
    setUploadedFile(null);
    setUploadedPreview(null);
    setResultImages([]);
    setErrorHint(null);
    setSelectedScene(null);
    setAspectRatio('ratio-1-1');
    setGenCount(1);
  };

  const downloadImage = (dataUrl: string, index: number) => {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `ai-scene-${index + 1}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadAll = () => {
    resultImages.forEach((img, i) => downloadImage(img, i));
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  };

  const selectedSceneData = SCENES.find(s => s.id === selectedScene);
  const costPerGen = 30 * genCount;
  const isReady = !!uploadedFile && !!selectedScene;

  return (
    <div className="flex-1 w-full max-w-7xl mx-auto p-4 sm:p-6 flex flex-col h-full min-h-0 overflow-hidden">
      {/* Header */}
      <div className="mb-5 flex items-center gap-4 shrink-0">
        <button
          onClick={() => navigate('/')}
          className="group flex items-center justify-center w-10 h-10 rounded-full bg-white border border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm active:scale-95"
          title="返回工作台"
        >
          <ArrowLeft className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">AI 商品图</h1>
          <p className="text-sm text-slate-500 mt-0.5">选择场景，一键将商品融合至高级背景</p>
        </div>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row gap-5 min-h-0 overflow-hidden">

        {/* ===== Left: Control Panel ===== */}
        <div className={cn(
          "w-full lg:w-[380px] shrink-0 flex flex-col min-h-0",
          status === 'processing' && "pointer-events-none opacity-60"
        )}>

          <div className="flex-1 min-h-0 overflow-y-auto subtle-scrollbar pr-1 pb-4">

          {/* Step 1: Upload */}
          <div className="bg-white rounded-2xl ring-1 ring-slate-200 shadow-sm overflow-hidden">
            <div className="px-4 pt-4 pb-3 border-b border-slate-100 flex items-center gap-2">
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-violet-600 text-white text-[11px] font-bold shrink-0">1</span>
              <span className="text-sm font-semibold text-slate-800">上传商品图片</span>
              {uploadedFile && <CheckCircle2 className="w-4 h-4 text-emerald-500 ml-auto shrink-0" />}
            </div>

            <motion.div
              animate={shake && !uploadedFile ? { x: [-6, 6, -6, 6, 0] } : {}}
              transition={{ duration: 0.3 }}
              className="p-3"
            >
              {uploadedPreview ? (
                <div className="relative group rounded-xl overflow-hidden bg-slate-50 ring-1 ring-slate-100">
                  <img src={uploadedPreview} alt="商品预览" className="w-full max-h-44 object-contain" />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-1.5 text-xs bg-white text-slate-800 px-3 py-1.5 rounded-full font-medium shadow"
                    >
                      <UploadCloud className="w-3.5 h-3.5" />
                      更换
                    </button>
                    <button
                      onClick={() => {
                        if (uploadedPreview) {
                          URL.revokeObjectURL(uploadedPreview);
                        }
                        setUploadedFile(null);
                        setUploadedPreview(null);
                        setResultImages([]);
                        setStatus('idle');
                      }}
                      className="flex items-center gap-1.5 text-xs bg-white text-rose-600 px-3 py-1.5 rounded-full font-medium shadow"
                    >
                      <X className="w-3.5 h-3.5" />
                      删除
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDrop={onDrop}
                  onDragOver={(e) => e.preventDefault()}
                  className="flex flex-col items-center justify-center gap-2 py-6 rounded-xl border-2 border-dashed border-slate-200 hover:border-violet-400 hover:bg-violet-50/40 cursor-pointer transition-colors"
                >
                  <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                    <UploadCloud className="w-5 h-5" />
                  </div>
                  <p className="text-sm text-slate-600 font-medium">点击上传 / 拖拽到此处</p>
                  <p className="text-xs text-slate-400">JPG · PNG · WEBP，最大 10MB</p>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
              />
            </motion.div>
          </div>

          {/* Step 2: Scene Selection */}
          <div className="mt-4 bg-white rounded-2xl ring-1 ring-slate-200 shadow-sm overflow-hidden">
            <div className="px-4 pt-4 pb-3 border-b border-slate-100 flex items-center gap-2">
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-violet-600 text-white text-[11px] font-bold shrink-0">2</span>
              <span className="text-sm font-semibold text-slate-800">选择生成场景</span>
              {selectedScene && <CheckCircle2 className="w-4 h-4 text-emerald-500 ml-auto shrink-0" />}
            </div>
            <motion.div
              animate={shake && !selectedScene ? { x: [-6, 6, -6, 6, 0] } : {}}
              transition={{ duration: 0.3 }}
              className="p-3 grid grid-cols-1 gap-2"
            >
              {SCENES.map((scene) => (
                <button
                  key={scene.id}
                  onClick={() => setSelectedScene(scene.id)}
                  className={cn(
                    "flex items-center gap-3 p-2.5 rounded-xl ring-2 transition-all text-left group",
                    selectedScene === scene.id
                      ? "ring-violet-600 bg-violet-50"
                      : "ring-transparent hover:ring-slate-200 hover:bg-slate-50"
                  )}
                >
                  <div className="relative w-14 h-14 rounded-lg overflow-hidden shrink-0">
                    <img src={scene.image} alt={scene.name} className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={cn("text-sm font-semibold leading-tight", selectedScene === scene.id ? "text-violet-700" : "text-slate-800")}>
                      {scene.name}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5 leading-snug">{scene.desc}</p>
                  </div>
                  {selectedScene === scene.id && (
                    <div className="shrink-0 w-5 h-5 rounded-full bg-violet-600 flex items-center justify-center">
                      <div className="w-2 h-2 bg-white rounded-full" />
                    </div>
                  )}
                </button>
              ))}
            </motion.div>
          </div>

          {/* Step 3: Size + Count */}
          <div className="mt-4 bg-white rounded-2xl ring-1 ring-slate-200 shadow-sm overflow-hidden">
            <div className="px-4 pt-4 pb-3 border-b border-slate-100 flex items-center gap-2">
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-violet-600 text-white text-[11px] font-bold shrink-0">3</span>
              <span className="text-sm font-semibold text-slate-800">生成尺寸 & 数量</span>
            </div>
            <div className="p-4 flex flex-col gap-4">
              {/* Size */}
              <div>
                <p className="text-xs font-medium text-slate-500 mb-2 uppercase tracking-wide">输出尺寸</p>
                <div className="grid grid-cols-4 gap-1.5">
                  {SIZE_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      onClick={() => setAspectRatio(preset.id)}
                      className={cn(
                        "flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-xl transition-all border-2 text-[10px] font-medium",
                        aspectRatio === preset.id
                          ? "border-violet-600 bg-violet-50 text-violet-600 shadow-sm"
                          : "border-transparent bg-slate-50 text-slate-600 hover:bg-slate-100"
                      )}
                    >
                      <div className="h-5 flex items-center justify-center">{preset.icon}</div>
                      <span className="leading-tight text-center">{preset.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Count */}
              <div>
                <p className="text-xs font-medium text-slate-500 mb-2 uppercase tracking-wide">生成数量</p>
                <div className="flex gap-2">
                  {COUNT_OPTIONS.map((n) => (
                    <button
                      key={n}
                      onClick={() => setGenCount(n)}
                      className={cn(
                        "flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all border-2",
                        genCount === n
                          ? "border-violet-600 bg-violet-50 text-violet-700"
                          : "border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 hover:bg-slate-100"
                      )}
                    >
                      {n} 张
                    </button>
                  ))}
                </div>
                <p className="text-xs text-slate-400 mt-2">每次生成消耗 <span className="font-semibold text-violet-600">{costPerGen}</span> 点（{genCount} 张 × 30 点）</p>
              </div>
            </div>
          </div>

          </div>

          <div className="shrink-0 pt-4">
            {/* Generate Button */}
            <button
              onClick={handleGenerate}
              disabled={status === 'processing'}
              className={cn(
                "w-full flex items-center justify-center gap-2.5 py-4 rounded-2xl text-base font-bold transition-all shadow-lg active:scale-[0.98]",
                isReady
                  ? "bg-violet-600 text-white hover:bg-violet-700 shadow-violet-600/30"
                  : "bg-slate-100 text-slate-400 cursor-not-allowed shadow-none",
                status === 'processing' && "animate-pulse"
              )}
            >
              {status === 'processing' ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  正在生成中…
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  确认生成
                  {!isReady && <span className="text-sm font-normal ml-1 opacity-70">（请先上传图片并选择场景）</span>}
                </>
              )}
            </button>

            {errorHint && (
              <div className="mt-3 flex items-start gap-2.5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errorHint}</span>
              </div>
            )}
          </div>
        </div>

        {/* ===== Right: Canvas / Result ===== */}
        <div className="flex-1 min-h-0 flex flex-col">

          {/* Result Area */}
          <div className="flex-1 rounded-3xl bg-slate-100 border-2 border-dashed border-slate-200 overflow-hidden relative flex items-center justify-center">
            <AnimatePresence mode="wait">

              {/* Idle state */}
              {status === 'idle' && resultImages.length === 0 && (
                <motion.div
                  key="idle"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col items-center justify-center gap-4 p-8 text-center"
                >
                  <div className="w-20 h-20 rounded-full bg-white shadow-sm flex items-center justify-center text-slate-300">
                    <ImageIcon className="w-10 h-10" />
                  </div>
                  <div>
                    <p className="text-slate-400 font-medium">生成结果将在此展示</p>
                    <p className="text-sm text-slate-300 mt-1">请在左侧完成配置后点击"确认生成"</p>
                  </div>
                  {selectedSceneData && uploadedPreview && (
                    <div className="mt-2 flex items-center gap-2 bg-white px-4 py-2 rounded-full shadow-sm text-sm text-slate-600">
                      <img src={selectedSceneData.image} alt="" className="w-5 h-5 rounded-full object-cover" />
                      <span>已选 <strong className="text-violet-600">{selectedSceneData.name}</strong> · {genCount} 张</span>
                    </div>
                  )}
                </motion.div>
              )}

              {/* Processing state */}
              {status === 'processing' && (
                <motion.div
                  key="processing"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm z-10"
                >
                  {selectedSceneData && (
                    <img src={selectedSceneData.image} alt="" className="absolute inset-0 w-full h-full object-cover opacity-30" />
                  )}
                  <div className="relative z-20 bg-white/95 backdrop-blur px-8 py-6 rounded-2xl shadow-2xl flex flex-col items-center gap-4">
                    <div className="relative w-12 h-12">
                      <RefreshCw className="w-12 h-12 text-violet-200 absolute inset-0" />
                      <RefreshCw className="w-12 h-12 text-violet-600 absolute inset-0 animate-spin" style={{ clipPath: 'inset(0 50% 0 0)' }} />
                    </div>
                    <div className="text-center">
                      <p className="font-semibold text-slate-800">正在生成「{selectedSceneData?.name}」</p>
                      <p className="text-sm text-slate-500 mt-1">生成 {genCount} 张，请稍候…</p>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Success state */}
              {status === 'success' && resultImages.length > 0 && (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="absolute inset-0 p-4 bg-slate-900 flex flex-col gap-3 overflow-hidden"
                >
                  <div className={cn(
                    "flex-1 grid gap-3 min-h-0",
                    resultImages.length === 1 && "grid-cols-1",
                    resultImages.length === 2 && "grid-cols-2",
                    resultImages.length >= 3 && "grid-cols-2",
                  )}>
                    {resultImages.map((img, i) => {
                      const ratioClass = SIZE_PRESETS.find(p => p.id === aspectRatio)?.ratioClass ?? 'aspect-auto';
                      return (
                        <div key={i} className="relative group min-h-0 overflow-hidden rounded-xl bg-slate-800">
                          <div className={cn("w-full overflow-hidden", ratioClass)}>
                            <img src={img} alt={`生成结果 ${i + 1}`} className="w-full h-full object-cover" />
                          </div>
                          <button
                            onClick={() => downloadImage(img, i)}
                            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1.5 bg-black/60 text-white text-xs px-2.5 py-1.5 rounded-full font-medium backdrop-blur-sm hover:bg-black/80"
                          >
                            <Download className="w-3.5 h-3.5" />
                            下载
                          </button>
                          {resultImages.length > 1 && (
                            <span className="absolute bottom-2 left-2 text-xs text-white/70 bg-black/40 px-2 py-0.5 rounded-full backdrop-blur-sm">
                              {i + 1}/{resultImages.length}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Action Buttons (shown on success) */}
          <div className="shrink-0 min-h-[72px] pt-4">
            {status === 'success' && resultImages.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-wrap gap-3 shrink-0"
              >
                {resultImages.length > 1 && (
                <button
                  onClick={downloadAll}
                  className="flex-1 flex items-center justify-center gap-2 bg-violet-600 text-white py-3.5 rounded-2xl font-semibold hover:bg-violet-700 active:scale-[0.98] transition-all shadow-lg shadow-violet-600/20"
                >
                  <Download className="w-5 h-5" />
                  下载全部 ({resultImages.length} 张)
                </button>
              )}
              {resultImages.length === 1 && (
                <button
                  onClick={() => downloadImage(resultImages[0], 0)}
                  className="flex-1 flex items-center justify-center gap-2 bg-violet-600 text-white py-3.5 rounded-2xl font-semibold hover:bg-violet-700 active:scale-[0.98] transition-all shadow-lg shadow-violet-600/20"
                >
                  <Download className="w-5 h-5" />
                  下载高清原图
                </button>
              )}
              <button
                onClick={handleRetry}
                className="flex items-center justify-center gap-2 bg-white text-slate-700 px-5 py-3.5 rounded-2xl font-medium hover:bg-slate-50 active:scale-[0.98] transition-all ring-1 ring-slate-200"
              >
                <RefreshCw className="w-4 h-4" />
                重新生成
              </button>
              <button
                onClick={handleReset}
                className="flex items-center justify-center gap-2 bg-white text-slate-700 px-5 py-3.5 rounded-2xl font-medium hover:bg-slate-50 active:scale-[0.98] transition-all ring-1 ring-slate-200"
              >
                <X className="w-4 h-4" />
                换商品
              </button>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
