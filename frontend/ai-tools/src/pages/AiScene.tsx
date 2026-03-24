import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  UploadCloud,
  Download,
  RefreshCw,
  AlertCircle,
  X,
  Sparkles,
  CheckCircle2,
  ImageIcon,
  ImagePlus,
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

import { useAppContext } from '../context/AppContext';
import { SIZE_PRESETS, type PresetId } from '../constants/presets';
import { generateProductScene } from '../utils/geminiImageService';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type Status = 'idle' | 'processing' | 'success';

type SceneMode = 'preset' | 'custom';

interface UploadedImageItem {
  id: string;
  file: File;
  previewUrl: string;
}

interface SceneResultItem {
  id: string;
  imageUrl: string;
  sourceIndex: number;
  variantIndex: number;
}

const MAX_UPLOAD_IMAGES = 6;

function formatAiSceneError(err: unknown): string {
  const message = err instanceof Error ? err.message : 'AI 生成失败，请稍后重试';

  if (message.includes('连接 Gemini 服务超时')) {
    return '当前服务器连接 Gemini 超时，请稍后重试，或检查当前网络环境是否可访问 Google API。';
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
    desc: '暖黄色调 · 灯串礼盒 · 温馨治愈',
    image: 'https://images.unsplash.com/photo-1512389142860-9c449e58a543?w=400&q=80',
  },
  {
    id: 'modern-home',
    name: '现代简约家居',
    desc: '浅灰色调 · 自然漫射光 · 高级质感',
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
    desc: '产品占比 85% · 柔光 · 商业纯色',
    image: 'https://images.unsplash.com/photo-1607082349566-187342175e2f?w=400&q=80',
  },
  {
    id: 'daily-life',
    name: '日常居家生活',
    desc: '自然窗光 · 咖啡手机道具 · 生活化',
    image: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400&q=80',
  },
] as const;

const COUNT_OPTIONS = [1, 2, 4] as const;
type CountOption = (typeof COUNT_OPTIONS)[number];

export const AiScene: React.FC = () => {
  const { refreshProfile, showToast } = useAppContext();
  const [status, setStatus] = useState<Status>('idle');
  const [sceneMode, setSceneMode] = useState<SceneMode>('preset');
  const [selectedScene, setSelectedScene] = useState<string | null>(null);
  const [customScenePrompt, setCustomScenePrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState<PresetId>('ratio-1-1');
  const [genCount, setGenCount] = useState<CountOption>(1);
  const [uploadedImages, setUploadedImages] = useState<UploadedImageItem[]>([]);
  const [resultImages, setResultImages] = useState<SceneResultItem[]>([]);
  const [errorHint, setErrorHint] = useState<string | null>(null);
  const [shake, setShake] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadedImagesRef = useRef<UploadedImageItem[]>([]);

  useEffect(() => {
    uploadedImagesRef.current = uploadedImages;
  }, [uploadedImages]);

  useEffect(() => {
    return () => {
      uploadedImagesRef.current.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    };
  }, []);

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 500);
  };

  const clearUploadedImage = () => {
    uploadedImages.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    setUploadedImages([]);
    setResultImages([]);
    setErrorHint(null);
    setStatus('idle');
  };

  const appendFiles = (files: File[]) => {
    const validFiles: File[] = [];

    for (const file of files) {
      if (!file.type.startsWith('image/')) {
        showToast(`文件 ${file.name} 不是支持的图片格式`, 'error');
        continue;
      }

      if (file.size > 10 * 1024 * 1024) {
        showToast(`文件 ${file.name} 超过 10MB 限制`, 'error');
        continue;
      }

      validFiles.push(file);
    }

    if (validFiles.length === 0) {
      return;
    }

    const availableSlots = MAX_UPLOAD_IMAGES - uploadedImages.length;
    if (availableSlots <= 0) {
      showToast(`最多上传 ${MAX_UPLOAD_IMAGES} 张商品图`, 'error');
      return;
    }

    const acceptedCount = Math.min(validFiles.length, availableSlots);

    setUploadedImages((current) => {
      const acceptedFiles = validFiles.slice(0, MAX_UPLOAD_IMAGES - current.length);
      if (acceptedFiles.length < validFiles.length) {
        showToast(`最多上传 ${MAX_UPLOAD_IMAGES} 张商品图`, 'error');
      }

      const nextItems = acceptedFiles.map((file, index) => ({
        id: `source-${Date.now()}-${current.length + index}`,
        file,
        previewUrl: URL.createObjectURL(file),
      }));

      setResultImages([]);
      setErrorHint(null);
      setStatus('idle');
      return [...current, ...nextItems];
    });

    showToast(`已添加 ${acceptedCount} 张商品图`);
  };

  const removeUploadedImage = (id: string) => {
    setUploadedImages((current) => {
      const target = current.find((item) => item.id === id);
      if (target) {
        URL.revokeObjectURL(target.previewUrl);
      }

      const next = current.filter((item) => item.id !== id);
      setResultImages([]);
      setErrorHint(null);
      setStatus('idle');
      return next;
    });
  };

  const handleGenerate = async () => {
    const customPrompt = customScenePrompt.trim();
    const activeSceneId = sceneMode === 'preset' ? selectedScene : 'custom';

    if (uploadedImages.length === 0 || (sceneMode === 'preset' ? !selectedScene : customPrompt.length === 0)) {
      triggerShake();
      return;
    }

    setResultImages([]);
    setErrorHint(null);
    setStatus('processing');

    try {
      const response = await generateProductScene(
        uploadedImages.map((item) => item.file),
        activeSceneId,
        sceneMode === 'custom' ? customPrompt : undefined,
        genCount
      );
      const mappedResults = response.imageDataList.map((imageUrl, index) => ({
        id: `result-${Date.now()}-${index}`,
        imageUrl,
        sourceIndex: Math.floor(index / genCount),
        variantIndex: index % genCount,
      }));
      setResultImages(mappedResults);
      setStatus('success');
      if (!response.demoMode) {
        await refreshProfile();
      }
      if (response.demoMode) {
        showToast('已切换为演示模式测试图', 'success');
      }
    } catch (err) {
      setStatus('idle');
      const message = formatAiSceneError(err);
      setErrorHint(message);
      showToast(message, 'error');
    }
  };

  const handleRetry = async () => {
    const customPrompt = customScenePrompt.trim();
    if (
      uploadedImages.length === 0 ||
      status === 'processing' ||
      (sceneMode === 'preset' ? !selectedScene : customPrompt.length === 0)
    ) {
      return;
    }

    await handleGenerate();
  };

  const handleReset = () => {
    clearUploadedImage();
    setSelectedScene(null);
    setSceneMode('preset');
    setCustomScenePrompt('');
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
    resultImages.forEach((item, index) => downloadImage(item.imageUrl, index));
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    appendFiles(Array.from(e.dataTransfer.files));
  };

  const selectedSceneData = SCENES.find((scene) => scene.id === selectedScene);
  const activeSceneName = sceneMode === 'preset' ? selectedSceneData?.name : customScenePrompt.trim() || '自定义场景';
  const totalOutputCount = uploadedImages.length * genCount;
  const costPerGen = 30 * totalOutputCount;
  const isReady = uploadedImages.length > 0 && (sceneMode === 'preset' ? !!selectedScene : customScenePrompt.trim().length > 0);

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-7xl flex-1 flex-col overflow-y-auto p-4 sm:p-6 md:overflow-hidden">
      <div className="flex min-h-0 flex-1 flex-col gap-5 md:overflow-hidden md:flex-row">
        <div
          className={cn(
            'w-full shrink-0 min-h-0 md:w-[380px]',
            status === 'processing' && 'pointer-events-none opacity-60'
          )}
        >
          <div className="flex h-full min-h-0 flex-col pr-1">
            <div className="min-h-0 flex-1 overflow-y-auto subtle-scrollbar">
              <div className="space-y-4 pr-1">
              <div className="bg-white overflow-hidden rounded-2xl shadow-sm ring-1 ring-slate-200">
                <div className="flex items-center gap-2 border-b border-slate-100 px-4 pb-3 pt-4">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-violet-600 text-[11px] font-bold text-white">
                    1
                  </span>
                  <span className="text-sm font-semibold text-slate-800">上传商品图片</span>
                  {uploadedImages.length > 0 && <CheckCircle2 className="ml-auto h-4 w-4 shrink-0 text-emerald-500" />}
                </div>

                <motion.div
                  animate={shake && uploadedImages.length === 0 ? { x: [-6, 6, -6, 6, 0] } : {}}
                  transition={{ duration: 0.3 }}
                  className="p-3"
                >
                  {uploadedImages.length > 0 ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-3 gap-2">
                        {uploadedImages.map((item, index) => (
                          <div key={item.id} className="group relative overflow-hidden rounded-xl bg-slate-50 ring-1 ring-slate-100">
                            <img src={item.previewUrl} alt={`商品图 ${index + 1}`} className="h-24 w-full object-cover" />
                            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-900/60 to-transparent px-2 py-1 text-[11px] font-medium text-white">
                              商品图 {index + 1}
                            </div>
                            <button
                              onClick={() => removeUploadedImage(item.id)}
                              className="absolute right-1.5 top-1.5 rounded-full bg-white/90 p-1 text-rose-500 opacity-0 shadow-sm transition-opacity group-hover:opacity-100"
                              title="删除"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                        {uploadedImages.length < MAX_UPLOAD_IMAGES && (
                          <button
                            onClick={() => fileInputRef.current?.click()}
                            className="flex h-24 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-slate-200 bg-slate-50 text-slate-400 transition-colors hover:border-violet-300 hover:bg-violet-50/40"
                          >
                            <ImagePlus className="h-4 w-4" />
                            <span className="text-[11px] font-medium">继续添加</span>
                          </button>
                        )}
                      </div>
                      <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-500">
                        <span>已上传 {uploadedImages.length}/{MAX_UPLOAD_IMAGES} 张</span>
                        <button
                          onClick={clearUploadedImage}
                          className="font-medium text-rose-500 transition-colors hover:text-rose-600"
                        >
                          清空全部
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      onDrop={onDrop}
                      onDragOver={(e) => e.preventDefault()}
                      className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 py-6 transition-colors hover:border-violet-400 hover:bg-violet-50/40"
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                        <UploadCloud className="h-5 w-5" />
                      </div>
                      <p className="text-sm font-medium text-slate-600">点击上传 / 拖拽到此处</p>
                      <p className="text-xs text-slate-400">支持 JPG / PNG / WEBP，单张最大 10MB，最多 6 张</p>
                    </div>
                  )}

                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const files = e.target.files ? Array.from<File>(e.target.files as ArrayLike<File>) : [];
                      appendFiles(files);
                      e.target.value = '';
                    }}
                  />
                </motion.div>
              </div>

              <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
                <div className="flex items-center gap-2 border-b border-slate-100 px-4 pb-3 pt-4">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-violet-600 text-[11px] font-bold text-white">
                    2
                  </span>
                  <span className="text-sm font-semibold text-slate-800">选择生成场景</span>
                  {(sceneMode === 'preset' ? selectedScene : customScenePrompt.trim()) && <CheckCircle2 className="ml-auto h-4 w-4 shrink-0 text-emerald-500" />}
                </div>
                <motion.div
                  animate={shake && !(sceneMode === 'preset' ? selectedScene : customScenePrompt.trim()) ? { x: [-6, 6, -6, 6, 0] } : {}}
                  transition={{ duration: 0.3 }}
                  className="space-y-3 p-3"
                >
                  <div className="inline-flex rounded-full bg-slate-100 p-1">
                    <button
                      onClick={() => setSceneMode('preset')}
                      className={cn(
                        'rounded-full px-4 py-2 text-sm font-medium transition-all',
                        sceneMode === 'preset' ? 'bg-white text-violet-700 shadow-sm' : 'text-slate-500'
                      )}
                    >
                      风格推荐
                    </button>
                    <button
                      onClick={() => setSceneMode('custom')}
                      className={cn(
                        'rounded-full px-4 py-2 text-sm font-medium transition-all',
                        sceneMode === 'custom' ? 'bg-white text-violet-700 shadow-sm' : 'text-slate-500'
                      )}
                    >
                      自定义
                    </button>
                  </div>

                  {sceneMode === 'preset' ? (
                    <>
                      <div>
                        <p className="mb-2 text-sm font-medium text-slate-700">AI 推荐</p>
                        <p className="text-xs leading-5 text-slate-400">人工智能识别图片信息，快速生成</p>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {SCENES.map((scene) => (
                          <button
                            key={scene.id}
                            onClick={() => setSelectedScene(scene.id)}
                            className={cn(
                              'group overflow-hidden rounded-xl text-left ring-2 transition-all',
                              selectedScene === scene.id
                                ? 'bg-violet-50 ring-violet-600'
                                : 'bg-white ring-transparent hover:bg-slate-50 hover:ring-slate-200'
                            )}
                          >
                            <div className="relative aspect-square w-full overflow-hidden">
                              <img
                                src={scene.image}
                                alt={scene.name}
                                className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                              />
                            </div>
                            <div className="p-2">
                              <p className={cn('truncate text-xs font-semibold', selectedScene === scene.id ? 'text-violet-700' : 'text-slate-700')}>
                                {scene.name}
                              </p>
                            </div>
                          </button>
                        ))}
                      </div>
                      {selectedSceneData && (
                        <div className="rounded-xl bg-violet-50 px-3 py-2 text-xs leading-5 text-violet-700">
                          {selectedSceneData.desc}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-slate-700">自定义场景</p>
                      <textarea
                        value={customScenePrompt}
                        onChange={(e) => setCustomScenePrompt(e.target.value)}
                        placeholder="例如：将商品放置于木质桌子上，背景为暖色客厅，带有自然窗光和绿植点缀"
                        className="min-h-28 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700 outline-none transition focus:border-violet-300 focus:bg-white focus:ring-4 focus:ring-violet-100"
                        maxLength={300}
                      />
                      <div className="flex items-center justify-between text-xs text-slate-400">
                        <span>支持输入你想要的摆放位置、环境细节和背景氛围</span>
                        <span>{customScenePrompt.trim().length}/300</span>
                      </div>
                    </div>
                  )}
                </motion.div>
              </div>

              <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
                <div className="flex items-center gap-2 border-b border-slate-100 px-4 pb-3 pt-4">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-violet-600 text-[11px] font-bold text-white">
                    3
                  </span>
                  <span className="text-sm font-semibold text-slate-800">生成尺寸与数量</span>
                </div>
                <div className="flex flex-col gap-4 p-4">
                  <div>
                    <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">输出尺寸</p>
                    <div className="grid grid-cols-4 gap-1.5">
                      {SIZE_PRESETS.map((preset) => (
                        <button
                          key={preset.id}
                          onClick={() => setAspectRatio(preset.id)}
                          className={cn(
                            'flex flex-col items-center justify-center gap-1 rounded-xl border-2 px-1 py-2 text-[10px] font-medium transition-all',
                            aspectRatio === preset.id
                              ? 'border-violet-600 bg-violet-50 text-violet-600 shadow-sm'
                              : 'border-transparent bg-slate-50 text-slate-600 hover:bg-slate-100'
                          )}
                        >
                          <div className="flex h-5 items-center justify-center">{preset.icon}</div>
                          <span className="text-center leading-tight">{preset.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">生成数量</p>
                    <div className="flex gap-2">
                      {COUNT_OPTIONS.map((count) => (
                        <button
                          key={count}
                          onClick={() => setGenCount(count)}
                          className={cn(
                            'flex-1 rounded-xl border-2 py-2.5 text-sm font-semibold transition-all',
                            genCount === count
                              ? 'border-violet-600 bg-violet-50 text-violet-700'
                              : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 hover:bg-slate-100'
                          )}
                        >
                          {count} 张
                        </button>
                      ))}
                    </div>
                    <p className="mt-2 text-xs text-slate-400">
                      本次预计消耗
                      <span className="font-semibold text-violet-600"> {costPerGen} 点</span>
                      （{uploadedImages.length || 0} 张商品图 × {genCount} 张 × 30 点）
                    </p>
                  </div>
                </div>
              </div>
              </div>
            </div>

              <div className="shrink-0 pt-4 pb-1">
                <div className="mb-3 flex items-center justify-between rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-sm shadow-sm">
                  <span className="text-slate-500">预计消耗</span>
                  <span className="font-semibold text-violet-600">{costPerGen} 点</span>
                </div>
                <button
                  onClick={handleGenerate}
                  disabled={status === 'processing'}
                  className={cn(
                    'flex w-full items-center justify-center gap-2.5 rounded-2xl py-4 text-base font-bold shadow-lg transition-all active:scale-[0.98]',
                    isReady
                      ? 'bg-violet-600 text-white shadow-violet-600/30 hover:bg-violet-700'
                      : 'cursor-not-allowed bg-slate-100 text-slate-400 shadow-none',
                    status === 'processing' && 'animate-pulse'
                  )}
                >
                  {status === 'processing' ? (
                    <>
                      <RefreshCw className="h-5 w-5 animate-spin" />
                      正在生成...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-5 w-5" />
                      确认生成
                    </>
                  )}
                </button>

                {errorHint && (
                  <div className="mt-3 flex items-start gap-2.5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{errorHint}</span>
                  </div>
                )}
              </div>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 justify-center">
          <div className="flex min-h-0 w-full max-w-[980px] flex-col">
            <div className="relative flex flex-1 items-center justify-center overflow-hidden rounded-3xl border-2 border-dashed border-slate-200 bg-slate-100">
              <AnimatePresence mode="wait">
                {status === 'idle' && resultImages.length === 0 && (
                  <motion.div
                    key="idle"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-col items-center justify-center gap-4 p-8 text-center"
                  >
                    <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white text-slate-300 shadow-sm">
                      <ImageIcon className="h-10 w-10" />
                    </div>
                    <div>
                      <p className="font-medium text-slate-400">生成结果将在此展示</p>
                      <p className="mt-1 text-sm text-slate-300">请在左侧完成配置后点击“确认生成”</p>
                    </div>
                    {activeSceneName && uploadedImages.length > 0 && (
                      <div className="mt-2 flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm text-slate-600 shadow-sm">
                        {sceneMode === 'preset' && selectedSceneData ? (
                          <img src={selectedSceneData.image} alt="" className="h-5 w-5 rounded-full object-cover" />
                        ) : (
                          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-violet-100 text-violet-600">
                            <Sparkles className="h-3 w-3" />
                          </div>
                        )}
                        <span>
                          已选择
                          <strong className="text-violet-600">{activeSceneName}</strong>
                          {' · '}
                          {uploadedImages.length} 张商品图 / {totalOutputCount} 张结果
                        </span>
                      </div>
                    )}
                  </motion.div>
                )}

                {status === 'processing' && (
                  <motion.div
                    key="processing"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 z-10 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm"
                  >
                    {selectedSceneData && (
                      <img
                        src={selectedSceneData.image}
                        alt=""
                        className="absolute inset-0 h-full w-full object-cover opacity-30"
                      />
                    )}
                    <div className="relative z-20 flex flex-col items-center gap-4 rounded-2xl bg-white/95 px-8 py-6 shadow-2xl backdrop-blur">
                      <div className="relative h-12 w-12">
                        <RefreshCw className="absolute inset-0 h-12 w-12 text-violet-200" />
                        <RefreshCw
                          className="absolute inset-0 h-12 w-12 animate-spin text-violet-600"
                          style={{ clipPath: 'inset(0 50% 0 0)' }}
                        />
                      </div>
                      <div className="text-center">
                        <p className="font-semibold text-slate-800">正在生成「{activeSceneName}」</p>
                        <p className="mt-1 text-sm text-slate-500">{uploadedImages.length} 张商品图，共 {totalOutputCount} 张结果，请稍候...</p>
                      </div>
                    </div>
                  </motion.div>
                )}

                {status === 'success' && resultImages.length > 0 && (
                  <motion.div
                    key="success"
                    initial={{ opacity: 0, scale: 0.97 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="absolute inset-0 flex flex-col gap-3 overflow-hidden bg-slate-900 p-4"
                  >
                    <div
                      className={cn(
                        'grid min-h-0 flex-1 gap-3',
                        resultImages.length === 1 && 'grid-cols-1',
                        resultImages.length === 2 && 'grid-cols-2',
                        resultImages.length >= 3 && 'grid-cols-2 lg:grid-cols-3'
                      )}
                    >
                      {resultImages.map((item, index) => {
                        const ratioClass = SIZE_PRESETS.find((preset) => preset.id === aspectRatio)?.ratioClass ?? 'aspect-auto';

                        return (
                          <div key={item.id} className="group relative min-h-0 overflow-hidden rounded-xl bg-slate-800">
                            <div className={cn('w-full overflow-hidden', ratioClass)}>
                              <img src={item.imageUrl} alt={`生成结果 ${index + 1}`} className="h-full w-full object-cover" />
                            </div>
                            <button
                              onClick={() => downloadImage(item.imageUrl, index)}
                              className="absolute right-2 top-2 flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1.5 text-xs font-medium text-white opacity-0 backdrop-blur-sm transition-opacity hover:bg-black/80 group-hover:opacity-100"
                            >
                              <Download className="h-3.5 w-3.5" />
                              下载
                            </button>
                            {uploadedImages.length > 1 && (
                              <span className="absolute left-2 top-2 rounded-full bg-black/40 px-2 py-0.5 text-[11px] text-white/80 backdrop-blur-sm">
                                商品图 {item.sourceIndex + 1}
                              </span>
                            )}
                            {resultImages.length > 1 && (
                              <span className="absolute bottom-2 left-2 rounded-full bg-black/40 px-2 py-0.5 text-xs text-white/70 backdrop-blur-sm">
                                {item.variantIndex + 1}/{genCount}
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

            {status === 'success' && resultImages.length > 0 && (
              <div className="shrink-0 pt-4">
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap gap-3">
                {resultImages.length > 1 && (
                  <button
                    onClick={downloadAll}
                    className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-violet-600 py-3.5 font-semibold text-white shadow-lg shadow-violet-600/20 transition-all hover:bg-violet-700 active:scale-[0.98]"
                  >
                    <Download className="h-5 w-5" />
                    下载全部（{resultImages.length} 张）
                  </button>
                )}
                {resultImages.length === 1 && (
                  <button
                    onClick={() => downloadImage(resultImages[0].imageUrl, 0)}
                    className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-violet-600 py-3.5 font-semibold text-white shadow-lg shadow-violet-600/20 transition-all hover:bg-violet-700 active:scale-[0.98]"
                  >
                    <Download className="h-5 w-5" />
                    下载高清原图
                  </button>
                )}
                <button
                  onClick={handleRetry}
                  className="flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3.5 font-medium text-slate-700 ring-1 ring-slate-200 transition-all hover:bg-slate-50 active:scale-[0.98]"
                >
                  <RefreshCw className="h-4 w-4" />
                  重新生成
                </button>
                <button
                  onClick={handleReset}
                  className="flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3.5 font-medium text-slate-700 ring-1 ring-slate-200 transition-all hover:bg-slate-50 active:scale-[0.98]"
                >
                  <X className="h-4 w-4" />
                  换个商品
                </button>
                </motion.div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
