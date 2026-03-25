import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { UploadCloud, Download, RefreshCw } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

import { OUTPUT_SIZE_OPTIONS, type PresetId } from '../constants/presets';
import { createDemoCutoutBlob } from '../utils/demoImageFactory';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type Status = 'idle' | 'processing' | 'success';
type BgColor = 'transparent' | 'white' | 'black';
type EditMode = 'size' | 'ratio' | null;
type SizeOptionId = 'original' | 'size-800' | 'size-1000' | 'size-480' | 'custom';

type AlphaBounds = { x: number; y: number; width: number; height: number };

const SIZE_OPTIONS: Array<{ id: SizeOptionId; label: string; width?: number; height?: number }> = [
  { id: 'original', label: '原始大小' },
  { id: 'size-800', label: '800*800', width: 800, height: 800 },
  { id: 'size-1000', label: '1000*1000', width: 1000, height: 1000 },
  { id: 'size-480', label: '480*480', width: 480, height: 480 },
  { id: 'custom', label: '自定义' },
];

const PRESET_TARGET_SIZE: Partial<Record<PresetId, { width: number; height: number }>> = {
  'tb-1-1': { width: 1440, height: 1440 },
  'tb-3-4': { width: 1440, height: 1920 },
  pdd: { width: 800, height: 800 },
  'ratio-1-1': { width: 1440, height: 1440 },
  'ratio-3-2': { width: 1200, height: 800 },
  'ratio-2-3': { width: 800, height: 1200 },
  'ratio-4-3': { width: 1920, height: 1440 },
  'ratio-3-4': { width: 1440, height: 1920 },
  'ratio-16-9': { width: 1422, height: 800 },
  'ratio-9-16': { width: 800, height: 1422 },
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

function drawImageContain(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  targetWidth: number,
  targetHeight: number
) {
  const scale = Math.min(targetWidth / img.naturalWidth, targetHeight / img.naturalHeight);
  const drawWidth = Math.max(1, Math.round(img.naturalWidth * scale));
  const drawHeight = Math.max(1, Math.round(img.naturalHeight * scale));
  const dx = Math.floor((targetWidth - drawWidth) / 2);
  const dy = Math.floor((targetHeight - drawHeight) / 2);

  ctx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight, dx, dy, drawWidth, drawHeight);
}

function drawBoundedImageWithScale(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  bounds: AlphaBounds,
  targetWidth: number,
  targetHeight: number,
  scalePercent: number
) {
  const containScale = Math.min(targetWidth / bounds.width, targetHeight / bounds.height);
  const adjustedScale = containScale * (Math.max(10, Math.min(200, scalePercent)) / 100);
  const drawWidth = Math.max(1, Math.round(bounds.width * adjustedScale));
  const drawHeight = Math.max(1, Math.round(bounds.height * adjustedScale));
  const dx = Math.floor((targetWidth - drawWidth) / 2);
  const dy = Math.floor((targetHeight - drawHeight) / 2);

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
}

function parseDimension(value: string): number | null {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return Math.round(parsed);
}

function getSizeTarget(
  naturalWidth: number,
  naturalHeight: number,
  sizeOption: SizeOptionId,
  customWidth: string,
  customHeight: string
): { width: number; height: number } | null {
  const matchedPreset = SIZE_OPTIONS.find((option) => option.id === sizeOption);
  const baseWidth = sizeOption === 'custom' ? parseDimension(customWidth) : matchedPreset?.width ?? naturalWidth;
  const baseHeight = sizeOption === 'custom' ? parseDimension(customHeight) : matchedPreset?.height ?? naturalHeight;

  if (!baseWidth || !baseHeight) {
    return null;
  }

  return {
    width: Math.max(1, Math.round(baseWidth)),
    height: Math.max(1, Math.round(baseHeight)),
  };
}

async function buildSizeAdjustedBlob(
  sourceUrl: string,
  sizeOption: SizeOptionId,
  customWidth: string,
  customHeight: string,
  scalePercent: number,
  bgColor: BgColor
): Promise<Blob> {
  const img = await loadImage(sourceUrl);
  const bounds = detectAlphaBounds(img);
  const target = getSizeTarget(
    img.naturalWidth,
    img.naturalHeight,
    sizeOption,
    customWidth,
    customHeight
  );

  if (!target) {
    throw new Error('请输入有效的宽高尺寸');
  }

  const canvas = document.createElement('canvas');
  canvas.width = target.width;
  canvas.height = target.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('画布初始化失败');

  fillBackground(ctx, canvas.width, canvas.height, bgColor);
  drawBoundedImageWithScale(ctx, img, bounds, canvas.width, canvas.height, scalePercent);

  return canvasToPngBlob(canvas);
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
  const { refreshProfile, showToast } = useAppContext();
  const [status, setStatus] = useState<Status>('idle');
  const [editMode, setEditMode] = useState<EditMode>(null);
  const [aspectRatio, setAspectRatio] = useState<PresetId>('ratio-1-1');
  const [sizeOption, setSizeOption] = useState<SizeOptionId>('original');
  const [customWidth, setCustomWidth] = useState('');
  const [customHeight, setCustomHeight] = useState('');
  const [scalePercent, setScalePercent] = useState(100);
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

    if (editMode !== 'ratio' && sizeOption === 'custom' && (!parseDimension(customWidth) || !parseDimension(customHeight))) {
      return;
    }

    let cancelled = false;

    const buildBlob =
      editMode === 'ratio'
        ? buildPresetBlob(rawResultImageUrl, aspectRatio, bgColor)
        : buildSizeAdjustedBlob(rawResultImageUrl, sizeOption, customWidth, customHeight, scalePercent, bgColor);

    buildBlob
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
  }, [aspectRatio, bgColor, customHeight, customWidth, editMode, rawResultImageUrl, scalePercent, sizeOption, status]);

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

  const [sliderPosition, setSliderPosition] = useState(50);
  const hasResult = status === 'success' && !!(renderedImageUrl || rawResultImageUrl);
  const hasSourceImage = !!sourceImageUrl;
  const isSizeMode = editMode === 'size';
  const isRatioMode = editMode === 'ratio';
  const hasValidCustomSize = !!parseDimension(customWidth) && !!parseDimension(customHeight);

  const handleScalePercentChange = (value: number) => {
    setEditMode('size');
    setScalePercent(value);
  };
  
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

    if (sourceImageUrl) URL.revokeObjectURL(sourceImageUrl);
    if (rawResultImageUrl) URL.revokeObjectURL(rawResultImageUrl);
    if (renderedImageUrl) URL.revokeObjectURL(renderedImageUrl);

    const previewUrl = URL.createObjectURL(file);
    setSourceImageUrl(previewUrl);
    setRawResultImageUrl(null);
    setRenderedImageUrl(null);
    setStatus('processing');

    try {
      if (!token) {
        throw new Error('DEMO_MODE');
      }

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
        throw new Error('DEMO_MODE');
      }

      const blob = await res.blob();
      const outputUrl = URL.createObjectURL(blob);
      setRawResultImageUrl(outputUrl);

      await refreshProfile();

      setStatus('success');
      showToast('抠图成功，已扣除 10 点', 'success');
    } catch (err: unknown) {
      try {
        const demoBlob = await createDemoCutoutBlob(file);
        const outputUrl = URL.createObjectURL(demoBlob);
        setRawResultImageUrl(outputUrl);
        setStatus('success');
        showToast('已切换为演示模式测试图', 'success');
      } catch {
        setStatus('idle');
        setRawResultImageUrl(null);
        setRenderedImageUrl(null);
        const msg = err instanceof Error ? err.message : '网络异常，请重试';
        showToast(msg, 'error');
      }
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (status === 'processing') return;
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
    setEditMode(null);
    setAspectRatio('ratio-1-1');
    setSizeOption('original');
    setCustomWidth('');
    setCustomHeight('');
    setScalePercent(100);
    setBgColor('transparent');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const download = () => {
    if (editMode === 'size' && sizeOption === 'custom' && !hasValidCustomSize) {
      showToast('请输入有效的宽高尺寸后再下载', 'error');
      return;
    }

    const downloadUrl = renderedImageUrl || rawResultImageUrl;
    if (!downloadUrl) {
      showToast('暂无可下载图片', 'error');
      return;
    }

    const downloadSuffix =
      editMode === 'ratio'
        ? aspectRatio
        : sizeOption === 'custom'
          ? `${customWidth}x${customHeight}-${scalePercent}`
          : `${sizeOption}-${scalePercent}`;

    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = `cutout-${downloadSuffix}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const activePreviewUrl = renderedImageUrl || rawResultImageUrl;
  const finalExportAspectRatio = isRatioMode ? getPresetAspectRatio(aspectRatio) ?? previewAspectRatio : previewAspectRatio;

  const bgColorClass = {
    'transparent': 'bg-grid-pattern',
    'white': 'bg-white',
    'black': 'bg-black',
  }[bgColor];

  return (
    <div className="flex-1 w-full flex flex-col h-full overflow-hidden bg-white rounded-xl shadow-sm">
        <div className="flex-1 w-full p-4 sm:p-5 lg:p-6 flex flex-col h-full overflow-hidden">
          <div className="flex-1 flex gap-5 min-h-0 h-full relative">
            
            {/* Left Control Panel: Dimensions and List */}
            <div className="w-[232px] px-[2px] flex flex-col gap-3 transition-opacity duration-300 shrink-0 h-full overflow-visible">
              <div className="bg-white rounded-2xl p-3 shadow-sm ring-1 ring-slate-200 shrink-0">
                <h3 className="text-sm font-semibold text-slate-900 mb-2.5">图片信息</h3>
                <div className="flex gap-2">
                  <button className="flex-1 py-1.5 text-xs font-medium text-violet-600 bg-violet-50 rounded-lg border border-violet-200">
                    本地上传
                  </button>
                  <button className="flex-1 py-1.5 text-xs font-medium text-slate-600 bg-slate-50 rounded-lg border border-slate-200 hover:bg-slate-100">
                    商品主图
                  </button>
                </div>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-2.5 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-violet-200 bg-violet-50 px-3 py-2 text-sm font-medium text-violet-600 transition-colors hover:border-violet-300 hover:bg-violet-100"
                >
                  <UploadCloud className="h-4 w-4" />
                  {hasSourceImage ? '重新上传图片' : '上传图片'}
                </button>
                <p className="mt-2 text-[11px] leading-4 text-slate-400">支持 JPG、PNG 格式，单张图片不超过 10MB</p>
                <div className="mt-2.5 grid grid-cols-3 gap-2">
                  <div className="aspect-square rounded-lg border-2 border-dashed border-slate-200 overflow-hidden relative bg-slate-50">
                    {sourceImageUrl ? (
                      <img src={sourceImageUrl} alt="source preview" className="w-full h-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[11px] text-slate-400">待上传</div>
                    )}
                  </div>
                </div>
              </div>

              <div
                className={cn(
                  'bg-white rounded-2xl p-3 shadow-sm ring-1 ring-slate-200 shrink-0 transition-all duration-300',
                  isSizeMode && 'ring-2 ring-violet-500/20 border-violet-200',
                  hasResult ? 'opacity-100' : 'opacity-40 pointer-events-none'
                )}
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-slate-900">改图片尺寸</h3>
                  <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium', isSizeMode ? 'bg-violet-100 text-violet-700' : 'bg-slate-100 text-slate-500')}>
                    {isSizeMode ? '已启用' : '可切换'}
                  </span>
                </div>
                <p className="mb-2.5 text-[11px] leading-4 text-slate-400">选择尺寸后会自动关闭比例调整，下载按当前尺寸导出。</p>
                <div className="grid grid-cols-2 gap-2 mb-2.5">
                  {SIZE_OPTIONS.map((option) => (
                    <button
                      key={option.id}
                      onClick={() => {
                        setEditMode('size');
                        setSizeOption(option.id);
                      }}
                      className={cn(
                        'rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors',
                        isSizeMode && sizeOption === option.id
                          ? 'border-violet-600 bg-violet-50 text-violet-600'
                          : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2 mb-2.5">
                  <input
                    type="number"
                    inputMode="numeric"
                    value={customWidth}
                    onFocus={() => {
                      setEditMode('size');
                      setSizeOption('custom');
                    }}
                    onChange={(e) => {
                      setEditMode('size');
                      setSizeOption('custom');
                      setCustomWidth(e.target.value);
                    }}
                    placeholder="宽(PX)"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-violet-500"
                  />
                  <span className="text-slate-400">×</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={customHeight}
                    onFocus={() => {
                      setEditMode('size');
                      setSizeOption('custom');
                    }}
                    onChange={(e) => {
                      setEditMode('size');
                      setSizeOption('custom');
                      setCustomHeight(e.target.value);
                    }}
                    placeholder="高(PX)"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-violet-500"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500 w-10">缩放</span>
                  <input
                    type="range"
                    min="10"
                    max="200"
                    value={scalePercent}
                    onInput={(e) => handleScalePercentChange(Number((e.target as HTMLInputElement).value))}
                    onChange={(e) => handleScalePercentChange(Number(e.target.value))}
                    className="flex-1 accent-violet-600"
                  />
                  <span className="text-xs text-slate-500 w-9 text-right">{scalePercent}%</span>
                </div>
                {sizeOption === 'custom' && !hasValidCustomSize && isSizeMode && (
                  <p className="mt-2 text-[11px] text-amber-600">请输入有效宽高后再下载。</p>
                )}
              </div>

              <div
                className={cn(
                  'bg-white rounded-2xl p-3 shadow-sm ring-1 ring-slate-200 shrink-0 transition-all duration-300',
                  isRatioMode && 'ring-2 ring-violet-500/20 border-violet-200',
                  hasResult ? 'opacity-100' : 'opacity-40 pointer-events-none'
                )}
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-slate-900">改图片比例</h3>
                  <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium', isRatioMode ? 'bg-violet-100 text-violet-700' : 'bg-slate-100 text-slate-500')}>
                    {isRatioMode ? '已启用' : '可切换'}
                  </span>
                </div>
                <p className="mb-2.5 text-[11px] leading-4 text-slate-400">选择比例后会自动关闭尺寸调整，下载按当前比例导出。</p>
                <select
                  value={aspectRatio}
                  onChange={(event) => {
                    setEditMode('ratio');
                    setAspectRatio(event.target.value as PresetId);
                  }}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-violet-300 focus:bg-white focus:ring-4 focus:ring-violet-100"
                >
                  {OUTPUT_SIZE_OPTIONS.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Main Canvas Area */}
            <div
              className="flex-1 relative rounded-2xl bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center h-full"
              onDrop={onDrop}
              onDragOver={onDragOver}
            >
              <AnimatePresence mode="wait">
                {status === 'idle' && (
                  <motion.div
                    key="idle"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 flex items-center justify-center p-6"
                  >
                    <div className="flex h-full w-full max-w-3xl flex-col items-center justify-center rounded-[28px] border border-dashed border-slate-300 bg-white/75 px-6 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] backdrop-blur-sm">
                      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-violet-100 text-violet-600 shadow-sm">
                        <UploadCloud className="h-10 w-10" />
                      </div>
                      <h2 className="text-3xl font-bold tracking-tight text-slate-900">直接上传图片开始抠图</h2>
                      <p className="mt-3 max-w-xl text-sm leading-6 text-slate-500">
                        无需先进入功能引导页，上传后会直接在当前编辑区完成抠图、比例调整与背景切换。
                      </p>
                      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          className="flex items-center gap-2 rounded-xl bg-violet-600 px-6 py-3 text-sm font-medium text-white shadow-lg shadow-violet-600/20 transition-colors hover:bg-violet-700"
                        >
                          <UploadCloud className="h-5 w-5" />
                          上传图片
                        </button>
                        <button
                          onClick={() => showToast('批量上传功能开发中...', 'success')}
                          className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                        >
                          批量上传
                        </button>
                      </div>
                      <p className="mt-4 text-xs text-slate-400">支持拖拽上传，支持 JPG、PNG 格式，单张图片不超过 10MB</p>
                    </div>
                  </motion.div>
                )}

                {status === 'processing' && (
                  <motion.div
                    key="processing"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50/90 backdrop-blur-sm z-10"
                  >
                    {sourceImageUrl && (
                      <div className="w-48 h-48 relative mb-6 rounded-2xl overflow-hidden shadow-lg border-2 border-white">
                        <img src={sourceImageUrl} alt="Original" className="w-full h-full object-cover opacity-80" />
                        {/* Scanning line animation */}
                        <motion.div 
                          className="absolute left-0 right-0 h-1 bg-violet-500 shadow-[0_0_15px_rgba(139,92,246,1)]"
                          animate={{ top: ['0%', '100%', '0%'] }}
                          transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                        />
                      </div>
                    )}
                    <div className="flex items-center gap-3 mb-4">
                      <RefreshCw className="h-5 w-5 text-violet-600 animate-spin" />
                      <span className="font-medium text-slate-800 text-lg">正在进行智能分析...</span>
                    </div>
                    <div className="w-64 bg-slate-200 rounded-full h-2 overflow-hidden mb-6">
                      <motion.div 
                        className="bg-violet-600 h-full" 
                        initial={{ width: "0%" }} 
                        animate={{ width: "85%" }} 
                        transition={{ duration: 2, ease: "easeOut" }} 
                      />
                    </div>
                    <button 
                      onClick={reset}
                      className="px-6 py-2 bg-white text-slate-600 rounded-full border border-slate-200 hover:bg-slate-50 font-medium transition-colors"
                    >
                      取消处理
                    </button>
                  </motion.div>
                )}

                {status === 'success' && (
                  <motion.div
                    key="success"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="absolute inset-0 flex items-center justify-center p-6"
                  >
                    <div className="relative flex h-full w-full items-center justify-center">
                      <div
                        className="relative flex max-h-full max-w-full items-center justify-center overflow-hidden rounded-xl border border-slate-300 shadow-sm transition-all duration-300"
                        style={finalExportAspectRatio ? { aspectRatio: String(finalExportAspectRatio), height: '100%' } : undefined}
                      >
                        <div className={cn("absolute inset-0", bgColorClass)} />
                        {activePreviewUrl && (
                          <img 
                            src={activePreviewUrl} 
                            alt="Cutout result" 
                            className="relative z-10 h-full w-full object-contain drop-shadow-md" 
                          />
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Right Control Panel: Tools & Output */}
            <div className={cn(
              "w-64 flex flex-col gap-4 transition-opacity duration-300 shrink-0 h-full",
              hasResult ? "opacity-100" : "opacity-40 pointer-events-none"
            )}>
              <div className="bg-white rounded-2xl p-4 shadow-sm ring-1 ring-slate-200 shrink-0">
                <h3 className="text-sm font-semibold text-slate-900 mb-3">背景颜色</h3>
                <div className="grid grid-cols-4 gap-2 mb-3">
                  <button
                    onClick={() => setBgColor('transparent')}
                    className={cn(
                      "aspect-square rounded-lg border transition-all bg-grid-pattern",
                      bgColor === 'transparent' ? "border-violet-600 ring-2 ring-violet-600/20" : "border-slate-200 hover:border-slate-300"
                    )}
                    title="透明"
                  />
                  <button
                    onClick={() => setBgColor('white')}
                    className={cn(
                      "aspect-square rounded-lg border transition-all bg-white",
                      bgColor === 'white' ? "border-violet-600 ring-2 ring-violet-600/20" : "border-slate-200 hover:border-slate-300"
                    )}
                    title="纯白"
                  />
                  <button
                    onClick={() => setBgColor('black')}
                    className={cn(
                      "aspect-square rounded-lg border transition-all bg-black",
                      bgColor === 'black' ? "border-violet-600 ring-2 ring-violet-600/20" : "border-slate-200 hover:border-slate-700"
                    )}
                    title="纯黑"
                  />
                  <button
                    className="aspect-square rounded-lg border border-slate-200 transition-all bg-slate-200 hover:border-slate-300"
                    title="灰色"
                  />
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-red-500 via-green-500 to-blue-500 cursor-pointer border-2 border-white shadow-sm ring-1 ring-slate-200" title="自定义色盘"></div>
                  <input type="text" placeholder="#FFFFFF" className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-violet-500" />
                </div>
                <button className="w-full mt-3 flex items-center justify-center gap-1.5 bg-violet-50 text-violet-600 py-2 rounded-lg text-sm font-medium border border-violet-100 hover:bg-violet-100 transition-colors">
                  <span className="text-lg leading-none pt-0.5">✨</span> 一键生成AI背景
                </button>
              </div>

              <div className="mt-auto bg-white rounded-2xl p-4 shadow-sm ring-1 ring-slate-200 flex flex-col gap-3 shrink-0">
                <button
                  onClick={download}
                  className="w-full flex items-center justify-center gap-2 bg-violet-600 text-white py-3 rounded-xl font-medium hover:bg-violet-700 active:scale-[0.98] transition-all shadow-md shadow-violet-600/20"
                >
                  <Download className="h-5 w-5" />
                  {isSizeMode ? '按尺寸下载' : isRatioMode ? '按比例下载' : '下载图片'}
                </button>
                <button
                  onClick={() => showToast('已保存至商品库', 'success')}
                  className="w-full flex items-center justify-center gap-2 bg-slate-900 text-white py-3 rounded-xl font-medium hover:bg-slate-800 active:scale-[0.98] transition-all shadow-md"
                >
                  保存到商品
                </button>
                <button
                  onClick={reset}
                  className="w-full flex items-center justify-center gap-2 bg-white text-slate-700 py-3 rounded-xl font-medium border border-slate-200 hover:bg-slate-50 active:scale-[0.98] transition-all"
                >
                  再次上传
                </button>
              </div>
            </div>
          </div>

          <input
            type="file"
            ref={fileInputRef}
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            accept="image/*"
            className="hidden"
          />
        </div>
    </div>
  );
};
