import React, { useEffect, useMemo, useRef, useState } from 'react';
import { clsx, type ClassValue } from 'clsx';
import {
  Bookmark,
  Check,
  CheckCircle2,
  Download,
  ImagePlus,
  Layers3,
  Loader2,
  Sparkles,
  Trash2,
  UploadCloud,
} from 'lucide-react';
import { twMerge } from 'tailwind-merge';
import { useAppContext } from '../context/AppContext';
import {
  deriveAiProductSetStage,
  derivePrimaryActionLabel,
  getInitialAiProductSetState,
  resetAfterBaseModelReselect,
  resetAfterProductReplace,
  type AiProductSetWorkflowState,
} from './aiProductSetWorkflow';
import {
  buildProductReferencePayload,
  listFavoriteBaseModels,
  generateBaseModels,
  generateBatch,
  recommendScenes,
  saveFavoriteBaseModel,
  type FavoriteBaseModel,
} from '../utils/aiProductSetService';

export type ProductReferenceImage = {
  id: string;
  file: File;
  previewUrl: string;
  angleLabel: string;
};

export type ModelAttributeForm = {
  gender: 'female' | 'male' | 'neutral';
  ageGroup: 'teen' | 'young-adult' | 'adult' | 'mature';
  ethnicity: string;
  bodyType: string;
  appearanceNotes: string;
};

type Framing = 'full' | 'three-quarter' | 'half' | 'close-up';
type Facing = 'front' | 'side' | 'three-quarter-side' | 'back';

type BaseModelCandidate = {
  id: string;
  imageUrl: string;
  source: 'generated' | 'favorite';
};

type SceneRecommendation = {
  id: string;
  group: string;
  description: string;
  selected: boolean;
  framing: Framing;
  facing: Facing;
};

type GeneratedResult = {
  id: string;
  createdAt: string;
  previewUrl: string;
  sourceUrl: string;
  sceneLabel: string;
};

type BaseModelSelectionTab = 'customize' | 'favorites';

const ETHNICITY_OPTIONS = ['欧美白人', '中国人', '亚洲人', '东南亚人', '非裔'] as const;
const BODY_TYPE_OPTIONS = ['纤细', '标准', '肌肉', '微胖', '大码'] as const;

const DEFAULT_ANGLE_LABELS = ['正面', '背面', '侧面', '细节'];

const FRAMING_OPTIONS: Array<{ value: Framing; label: string }> = [
  { value: 'full', label: '全身' },
  { value: 'three-quarter', label: '四分之三' },
  { value: 'half', label: '半身' },
  { value: 'close-up', label: '特写' },
];

const FACING_OPTIONS: Array<{ value: Facing; label: string }> = [
  { value: 'front', label: '正面' },
  { value: 'side', label: '侧面' },
  { value: 'three-quarter-side', label: '四分之三侧' },
  { value: 'back', label: '背面' },
];

const STEP_META: Array<{ id: string; title: string; description: string }> = [
  { id: 'upload', title: '上传服装图', description: '至少上传 1 张服装参考图。' },
  { id: 'base-model', title: '生成基准模特', description: '根据属性生成可选模特。' },
  { id: 'scene-recommend', title: '推荐场景', description: '生成并选择可用场景模板。' },
  { id: 'scene-result', title: '生成场景图', description: '生成最终结果并下载。' },
];

const PREVIEW_CARDS = [
  {
    title: '多件混搭自动融合',
    tint: 'text-rose-500',
    sources: [
      'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=500&q=80',
      'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=500&q=80',
    ],
    outputs: [
      'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=700&q=80',
      'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?auto=format&fit=crop&w=700&q=80',
    ],
  },
  {
    title: '一件也能出大片',
    tint: 'text-amber-700',
    sources: [
      'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=500&q=80',
      'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=500&q=80',
    ],
    outputs: [
      'https://images.unsplash.com/photo-1464863979621-258859e62245?auto=format&fit=crop&w=700&q=80',
      'https://images.unsplash.com/photo-1487222477894-8943e31ef7b2?auto=format&fit=crop&w=700&q=80',
    ],
  },
  {
    title: '鞋帽饰品完美适配',
    tint: 'text-orange-700',
    sources: [
      'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=500&q=80',
      'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=500&q=80',
    ],
    outputs: [
      'https://images.unsplash.com/photo-1495385794356-15371f348c31?auto=format&fit=crop&w=700&q=80',
      'https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=700&q=80',
    ],
  },
] as const;

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function createReferenceImage(file: File, index: number): ProductReferenceImage {
  return {
    id: `${file.name}-${file.lastModified}-${index}`,
    file,
    previewUrl: URL.createObjectURL(file),
    angleLabel: DEFAULT_ANGLE_LABELS[index] ?? `角度 ${index + 1}`,
  };
}

function createFavoriteBaseModelCandidate(item: FavoriteBaseModel): BaseModelCandidate {
  return {
    id: item.id,
    imageUrl: item.imageUrl,
    source: 'favorite',
  };
}

function toFlowProgress(state: AiProductSetWorkflowState): number {
  const stage = deriveAiProductSetStage(state);
  if (stage === 'upload-empty') {
    return 0;
  }
  if (stage === 'upload-ready' || stage === 'base-model-generating') {
    return 1;
  }
  if (stage === 'base-model-ready' || stage === 'scene-recommend-generating') {
    return 2;
  }
  if (stage === 'scene-select-ready') {
    return 3;
  }
  return 4;
}

export const AiProductSet: React.FC = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { showToast, user } = useAppContext();

  const [workflowState, setWorkflowState] = useState<AiProductSetWorkflowState>(
    getInitialAiProductSetState()
  );
  const [productImages, setProductImages] = useState<ProductReferenceImage[]>([]);
  const [modelForm, setModelForm] = useState<ModelAttributeForm>({
    gender: 'female',
    ageGroup: 'young-adult',
    ethnicity: '欧美白人',
    bodyType: '标准',
    appearanceNotes: '',
  });
  const [baseModelSelectionTab, setBaseModelSelectionTab] = useState<BaseModelSelectionTab>('customize');
  const [baseModels, setBaseModels] = useState<BaseModelCandidate[]>([]);
  const [selectedBaseModelId, setSelectedBaseModelId] = useState<string | null>(null);
  const [favoriteBaseModels, setFavoriteBaseModels] = useState<FavoriteBaseModel[]>([]);
  const [isLoadingFavoriteBaseModels, setIsLoadingFavoriteBaseModels] = useState(false);
  const [isSavingFavoriteModel, setIsSavingFavoriteModel] = useState(false);
  const [sceneRecommendations, setSceneRecommendations] = useState<SceneRecommendation[]>([]);
  const [results, setResults] = useState<GeneratedResult[]>([]);
  const [selectedResultIds, setSelectedResultIds] = useState<string[]>([]);

  useEffect(() => {
    return () => {
      productImages.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    };
  }, [productImages]);

  useEffect(() => {
    let cancelled = false;

    if (!user) {
      setFavoriteBaseModels([]);
      setIsLoadingFavoriteBaseModels(false);
      return;
    }

    setIsLoadingFavoriteBaseModels(true);
    void listFavoriteBaseModels()
      .then((items) => {
        if (!cancelled) {
          setFavoriteBaseModels(items);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setFavoriteBaseModels([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingFavoriteBaseModels(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [user]);

  const flowStage = useMemo(() => deriveAiProductSetStage(workflowState), [workflowState]);
  const flowProgress = useMemo(() => toFlowProgress(workflowState), [workflowState]);

  const selectedBaseModel = useMemo(
    () => baseModels.find((item) => item.id === selectedBaseModelId) ?? null,
    [baseModels, selectedBaseModelId]
  );

  const selectedBaseModelIsFavorited = useMemo(() => {
    if (!selectedBaseModel) {
      return false;
    }

    return favoriteBaseModels.some((item) => item.imageUrl === selectedBaseModel.imageUrl);
  }, [favoriteBaseModels, selectedBaseModel]);

  const selectedSceneCount = useMemo(
    () => sceneRecommendations.filter((item) => item.selected).length,
    [sceneRecommendations]
  );

  const effectivePrimaryLabel = useMemo(() => {
    if (workflowState.isGeneratingResults) {
      return '场景图片生成中...';
    }

    if (flowStage === 'upload-ready' && baseModelSelectionTab === 'favorites') {
      return selectedBaseModel ? '生成推荐场景' : '请选择收藏模特';
    }

    return derivePrimaryActionLabel(flowStage, selectedSceneCount);
  }, [baseModelSelectionTab, flowStage, selectedBaseModel, selectedSceneCount, workflowState.isGeneratingResults]);

  const isPrimaryDisabled =
    flowStage === 'upload-empty' ||
    flowStage === 'base-model-generating' ||
    flowStage === 'scene-recommend-generating' ||
    workflowState.isGeneratingResults ||
    (flowStage === 'upload-ready' && baseModelSelectionTab === 'favorites' && !selectedBaseModel) ||
    (flowStage === 'scene-select-ready' && selectedSceneCount === 0) ||
    (flowStage === 'result-ready' && results.length === 0);

  const updateUploadedCount = (count: number) => {
    setWorkflowState((prev) => ({ ...prev, uploadedImageCount: count }));
  };

  const resetAfterProductChanged = (nextUploadedCount: number) => {
    setWorkflowState((prev) => {
      const resetState = resetAfterProductReplace({ ...prev, uploadedImageCount: nextUploadedCount });
      return { ...resetState, uploadedImageCount: nextUploadedCount };
    });
    setBaseModels([]);
    setSelectedBaseModelId(null);
    setSceneRecommendations([]);
    setResults([]);
    setSelectedResultIds([]);
  };

  const validateFiles = (files: File[]) => {
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

    return validFiles;
  };

  const appendFiles = (files: File[]) => {
    const validFiles = validateFiles(files);
    if (validFiles.length === 0) {
      return;
    }

    setProductImages((current) => {
      const nextItems = validFiles.map((file, index) => createReferenceImage(file, current.length + index));
      const next = [...current, ...nextItems];
      updateUploadedCount(next.length);
      resetAfterProductChanged(next.length);
      return next;
    });

    showToast(`已添加 ${validFiles.length} 张服装图`);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files ? Array.from<File>(event.target.files as ArrayLike<File>) : [];
    appendFiles(files);
    event.target.value = '';
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    appendFiles(Array.from<File>(event.dataTransfer.files as ArrayLike<File>));
  };

  const removeProductImage = (id: string) => {
    setProductImages((current) => {
      const target = current.find((item) => item.id === id);
      if (target) {
        URL.revokeObjectURL(target.previewUrl);
      }

      const next = current.filter((item) => item.id !== id);
      resetAfterProductChanged(next.length);
      updateUploadedCount(next.length);
      return next;
    });
  };

  const updateAngleLabel = (id: string, angleLabel: string) => {
    setProductImages((current) =>
      current.map((item) => (item.id === id ? { ...item, angleLabel } : item))
    );
  };

  const handleGenerateBaseModels = async () => {
    if (productImages.length === 0) {
      showToast('请先上传服装图', 'error');
      return;
    }

    setWorkflowState((prev) => ({ ...prev, isGeneratingBaseModels: true }));

    try {
      const products = await buildProductReferencePayload(
        productImages.map((item) => ({ file: item.file, angleLabel: item.angleLabel }))
      );
      const response = await generateBaseModels({
        products,
        modelConfig: modelForm,
        count: 4,
      });

      const generated = response.modelImages.map((imageUrl, index) => ({
        id: `base-model-${Date.now()}-${index}`,
        imageUrl,
        source: 'generated' as const,
      }));

      setBaseModels(generated);
      setSelectedBaseModelId(generated[0]?.id ?? null);
      setSceneRecommendations([]);
      setResults([]);
      setSelectedResultIds([]);

      setWorkflowState((prev) => ({
        ...prev,
        isGeneratingBaseModels: false,
        generatedBaseModelCount: generated.length,
        isGeneratingSceneRecommendations: false,
        recommendedSceneCount: 0,
        selectedSceneCount: 0,
        isGeneratingResults: false,
        generatedResultCount: 0,
      }));

      showToast(response.demoMode ? '已生成演示模特图，请继续推荐场景' : '基准模特已生成，请选择并继续生成推荐场景');
    } catch {
      setWorkflowState((prev) => ({ ...prev, isGeneratingBaseModels: false }));
      showToast('基准模特生成失败，请重试', 'error');
    }
  };

  const handleBaseModelSelect = (modelId: string) => {
    setSelectedBaseModelId(modelId);
    setSceneRecommendations([]);
    setResults([]);
    setSelectedResultIds([]);
    setWorkflowState((prev) => resetAfterBaseModelReselect(prev));
  };

  const handleFavoriteBaseModelSelect = (favoriteId: string) => {
    const selectedFavorite = favoriteBaseModels.find((item) => item.id === favoriteId);
    if (!selectedFavorite) {
      return;
    }

    const favoriteCandidate = createFavoriteBaseModelCandidate(selectedFavorite);
    setBaseModels([favoriteCandidate]);
    setSelectedBaseModelId(favoriteId);
    setSceneRecommendations([]);
    setResults([]);
    setSelectedResultIds([]);
    setWorkflowState((prev) => ({
      ...resetAfterBaseModelReselect(prev),
      generatedBaseModelCount: 1,
    }));
  };

  const handleBaseModelTabChange = (tab: BaseModelSelectionTab) => {
    if (tab === baseModelSelectionTab) {
      return;
    }

    setBaseModelSelectionTab(tab);
    setSceneRecommendations([]);
    setResults([]);
    setSelectedResultIds([]);

    if (tab === 'customize') {
      setBaseModels([]);
      setSelectedBaseModelId(null);
      setWorkflowState((prev) => ({
        ...resetAfterProductReplace(prev),
        uploadedImageCount: prev.uploadedImageCount,
      }));
      return;
    }

    setBaseModels([]);
    setSelectedBaseModelId(null);
    setWorkflowState((prev) => ({
      ...resetAfterProductReplace(prev),
      uploadedImageCount: prev.uploadedImageCount,
    }));
  };

  const handleSaveCurrentBaseModel = async () => {
    if (!selectedBaseModel) {
      showToast('请先选择一个基准模特', 'error');
      return;
    }

    if (selectedBaseModelIsFavorited) {
      showToast('该模特已收藏', 'success');
      return;
    }

    setIsSavingFavoriteModel(true);
    try {
      const response = await saveFavoriteBaseModel({
        imageUrl: selectedBaseModel.imageUrl,
        modelConfig: modelForm,
      });

      setFavoriteBaseModels((current) => [
        response.item,
        ...current.filter((item) => item.id !== response.item.id && item.imageUrl !== response.item.imageUrl),
      ]);
      showToast(response.duplicated ? '该模特已在收藏列表中' : '已收藏当前模特');
    } catch (error) {
      showToast(error instanceof Error ? error.message : '收藏模特失败，请稍后重试', 'error');
    } finally {
      setIsSavingFavoriteModel(false);
    }
  };

  const handleGenerateSceneRecommendations = async () => {
    if (!selectedBaseModelId || !selectedBaseModel) {
      showToast('请先选择基准模特', 'error');
      return;
    }

    setWorkflowState((prev) => ({ ...prev, isGeneratingSceneRecommendations: true }));

    try {
      const response = await recommendScenes(selectedBaseModel.imageUrl);
      const nextScenes: SceneRecommendation[] = response.items.map((item, index) => ({
        id: item.templateId,
        group: item.group,
        description: item.description,
        selected: index === 0,
        framing: item.framing,
        facing: item.facing,
      }));

      setSceneRecommendations(nextScenes);
      setResults([]);
      setSelectedResultIds([]);

      setWorkflowState((prev) => ({
        ...prev,
        isGeneratingSceneRecommendations: false,
        recommendedSceneCount: nextScenes.length,
        selectedSceneCount: nextScenes.filter((item) => item.selected).length,
        generatedResultCount: 0,
      }));

      showToast(response.demoMode ? '已生成演示场景，请勾选后继续生成图片' : '推荐场景已生成，请勾选后生成场景图片');
    } catch {
      setWorkflowState((prev) => ({ ...prev, isGeneratingSceneRecommendations: false }));
      showToast('推荐场景生成失败，请稍后重试', 'error');
    }
  };

  const updateSceneSelection = (id: string, selected: boolean) => {
    setSceneRecommendations((current) => {
      const next = current.map((item) => (item.id === id ? { ...item, selected } : item));
      const selectedCount = next.filter((item) => item.selected).length;
      setWorkflowState((prev) => ({ ...prev, selectedSceneCount: selectedCount, generatedResultCount: 0 }));
      return next;
    });
    setResults([]);
    setSelectedResultIds([]);
  };

  const updateSceneConfig = (id: string, key: 'framing' | 'facing', value: Framing | Facing) => {
    setSceneRecommendations((current) =>
      current.map((item) => (item.id === id ? { ...item, [key]: value } : item))
    );
  };

  const handleGenerateSceneImages = async () => {
    const selectedScenes = sceneRecommendations.filter((item) => item.selected);
    if (selectedScenes.length === 0) {
      showToast('请先选择至少一个场景', 'error');
      return;
    }
    if (!selectedBaseModel) {
      showToast('请先选择基准模特', 'error');
      return;
    }

    setWorkflowState((prev) => ({ ...prev, isGeneratingResults: true }));

    try {
      const products = await buildProductReferencePayload(
        productImages.map((item) => ({ file: item.file, angleLabel: item.angleLabel }))
      );
      const batch = await generateBatch({
        products,
        modelConfig: modelForm,
        selectedModelImage: selectedBaseModel.imageUrl,
        sceneSelections: selectedScenes.map((scene) => ({
          templateId: scene.id,
          framing: scene.framing,
          facing: scene.facing,
        })),
      });

      const generated: GeneratedResult[] = batch.results.map((result, index) => {
        const scene = selectedScenes[index];
        return {
          id: result.id,
          createdAt: new Date(result.createdAt).toLocaleString('zh-CN', { hour12: false }),
          previewUrl: result.imageData,
          sourceUrl: productImages[0]?.previewUrl ?? selectedBaseModel.imageUrl,
          sceneLabel: scene ? `${scene.group} · ${scene.description.slice(0, 10)}...` : result.sceneCode,
        };
      });

      setResults(generated);
      setSelectedResultIds(generated.map((item) => item.id));
      setWorkflowState((prev) => ({
        ...prev,
        isGeneratingResults: false,
        generatedResultCount: generated.length,
      }));

      showToast(batch.demoMode ? `演示模式已生成 ${generated.length} 张测试图` : `已生成 ${generated.length} 张场景图`);
    } catch {
      setWorkflowState((prev) => ({ ...prev, isGeneratingResults: false }));
      showToast('场景图片生成失败，请重试', 'error');
    }
  };

  const downloadByUrl = (url: string, filename: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
  };

  const downloadSelectedResults = () => {
    const targets = results.filter((item) => selectedResultIds.includes(item.id));
    if (targets.length === 0) {
      showToast('请先选择要下载的图片', 'error');
      return;
    }

    targets.forEach((item, index) => {
      downloadByUrl(item.previewUrl, `ai-product-set-${index + 1}.png`);
    });

    showToast(`已触发 ${targets.length} 张图片下载`);
  };

  const toggleResultSelection = (id: string, selected: boolean) => {
    setSelectedResultIds((current) => {
      if (selected) {
        return current.includes(id) ? current : [...current, id];
      }
      return current.filter((item) => item !== id);
    });
  };

  const toggleSelectAllResults = (selected: boolean) => {
    setSelectedResultIds(selected ? results.map((item) => item.id) : []);
  };

  const onPrimaryAction = () => {
    if (flowStage === 'upload-ready') {
      if (baseModelSelectionTab === 'favorites' && selectedBaseModel) {
        void handleGenerateSceneRecommendations();
        return;
      }

      void handleGenerateBaseModels();
      return;
    }

    if (flowStage === 'base-model-ready') {
      void handleGenerateSceneRecommendations();
      return;
    }

    if (flowStage === 'scene-select-ready') {
      void handleGenerateSceneImages();
      return;
    }

    if (flowStage === 'result-ready') {
      downloadSelectedResults();
    }
  };

  return (
    <div className="flex h-full w-full flex-1 flex-col overflow-hidden rounded-xl bg-white shadow-sm">
      <div className="flex min-h-0 flex-1 gap-5 p-4 sm:p-5 lg:p-6">
        <aside className="flex h-full w-[340px] shrink-0 flex-col gap-3 overflow-hidden px-[2px]">
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto subtle-scrollbar pr-1">
            <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <div className="mb-3 flex items-start gap-2.5">
                <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-violet-600 text-[11px] font-bold text-white">
                  1
                </span>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">上传服装图片</h3>
                  <p className="mt-1 text-[11px] leading-4 text-slate-400">支持整套搭配或同一件服装不同角度图，最多 5 张。</p>
                </div>
              </div>
            <div
              onDrop={handleDrop}
              onDragOver={(event) => event.preventDefault()}
              onClick={() => fileInputRef.current?.click()}
              className="cursor-pointer rounded-2xl border border-dashed border-violet-200 bg-violet-50/70 p-4 text-center transition hover:border-violet-300 hover:bg-violet-50"
            >
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-violet-100 text-violet-600 shadow-sm">
                <UploadCloud className="h-5 w-5" />
              </div>
              <p className="mt-2 text-sm font-medium text-slate-700">点击或拖拽上传商品图</p>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>

            {productImages.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {productImages.map((item) => (
                  <div key={item.id} className="group relative h-16 w-16 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                    <img src={item.previewUrl} alt={item.angleLabel} className="h-full w-full object-cover" />
                    <button
                      onClick={() => removeProductImage(item.id)}
                      className="absolute right-1 top-1 hidden rounded-full bg-white/90 p-0.5 text-rose-500 group-hover:block"
                      title="删除"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex h-16 w-16 items-center justify-center rounded-xl border border-dashed border-violet-200 bg-violet-50 text-violet-600 transition-colors hover:border-violet-300 hover:bg-violet-100"
                >
                  <ImagePlus className="h-4 w-4" />
                </button>
              </div>
            )}
            </section>

            <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <div className="mb-3 flex items-start gap-2.5">
                <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-violet-600 text-[11px] font-bold text-white">
                  2
                </span>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">定制专属模特</h3>
                  <p className="mt-1 text-[11px] leading-4 text-slate-400">通过 tab 二选一：立即定制新模特，或直接选择已收藏模特。</p>
                </div>
              </div>
            <div className="rounded-2xl bg-slate-100 p-1">
              <div className="grid grid-cols-2 gap-1">
                <button
                  type="button"
                  onClick={() => handleBaseModelTabChange('customize')}
                  className={cn(
                    'rounded-xl px-3 py-2 text-sm font-semibold transition',
                    baseModelSelectionTab === 'customize'
                      ? 'bg-white text-violet-700 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  )}
                >
                  立即定制模特
                </button>
                <button
                  type="button"
                  onClick={() => handleBaseModelTabChange('favorites')}
                  className={cn(
                    'rounded-xl px-3 py-2 text-sm font-semibold transition',
                    baseModelSelectionTab === 'favorites'
                      ? 'bg-white text-violet-700 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  )}
                >
                  选择收藏模特
                </button>
              </div>
            </div>

            {baseModelSelectionTab === 'customize' ? (
              <>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <select
                    value={modelForm.gender}
                    onChange={(event) => setModelForm((prev) => ({ ...prev, gender: event.target.value as ModelAttributeForm['gender'] }))}
                    className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-violet-300 focus:bg-white focus:ring-4 focus:ring-violet-100"
                  >
                    <option value="female">女</option>
                    <option value="male">男</option>
                    <option value="neutral">中性</option>
                  </select>
                  <select
                    value={modelForm.ageGroup}
                    onChange={(event) => setModelForm((prev) => ({ ...prev, ageGroup: event.target.value as ModelAttributeForm['ageGroup'] }))}
                    className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-violet-300 focus:bg-white focus:ring-4 focus:ring-violet-100"
                  >
                    <option value="teen">青少年</option>
                    <option value="young-adult">青年</option>
                    <option value="adult">成年</option>
                    <option value="mature">成熟</option>
                  </select>
                  <select
                    value={modelForm.ethnicity}
                    onChange={(event) => setModelForm((prev) => ({ ...prev, ethnicity: event.target.value }))}
                    className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-violet-300 focus:bg-white focus:ring-4 focus:ring-violet-100"
                  >
                    {ETHNICITY_OPTIONS.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                  <select
                    value={modelForm.bodyType}
                    onChange={(event) => setModelForm((prev) => ({ ...prev, bodyType: event.target.value }))}
                    className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-violet-300 focus:bg-white focus:ring-4 focus:ring-violet-100"
                  >
                    {BODY_TYPE_OPTIONS.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </div>
                <textarea
                  value={modelForm.appearanceNotes}
                  onChange={(event) => setModelForm((prev) => ({ ...prev, appearanceNotes: event.target.value }))}
                  className="mt-2 h-24 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-violet-300 focus:bg-white focus:ring-4 focus:ring-violet-100"
                  placeholder="补充气质、发型、妆容、拍摄感觉等细节（可选）"
                />
                <div className="mt-3 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-xs text-violet-700">
                  选择“立即定制模特”后，下一步会先生成一组新的基准模特供你挑选。
                </div>
              </>
            ) : (
              <div className="mt-3 rounded-2xl border border-dashed border-violet-200 bg-violet-50/60 p-3">
                <div>
                  <p className="text-sm font-semibold text-violet-700">已收藏模特</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">选中一个收藏模特后，下一步会直接进入“生成推荐场景”，不会再重新生成基准模特。</p>
                </div>

                {isLoadingFavoriteBaseModels ? (
                  <div className="mt-3 flex items-center rounded-xl bg-white/80 px-3 py-2 text-xs text-slate-500">
                    <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> 正在加载收藏模特...
                  </div>
                ) : favoriteBaseModels.length > 0 ? (
                  <div className="mt-3 grid grid-cols-4 gap-2">
                    {favoriteBaseModels.slice(0, 8).map((item) => {
                      const active = selectedBaseModelId === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleFavoriteBaseModelSelect(item.id)}
                          className={cn(
                            'relative overflow-hidden rounded-xl border bg-white transition-all',
                            active ? 'border-violet-500 ring-2 ring-violet-500/20' : 'border-slate-200 hover:border-violet-300'
                          )}
                          title="选择收藏模特"
                        >
                          <img src={item.imageUrl} alt="收藏模特" className="h-20 w-full object-cover" />
                          <span className="absolute left-1.5 top-1.5 inline-flex items-center gap-1 rounded-full bg-white/90 px-1.5 py-0.5 text-[10px] font-semibold text-violet-700 shadow-sm">
                            <Bookmark className="h-2.5 w-2.5 fill-current" /> 收藏
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="mt-3 rounded-xl bg-white/80 px-3 py-2 text-xs text-slate-500">
                    当前还没有收藏模特，先切回“立即定制模特”生成并收藏后，下次可在这里直接复用。
                  </div>
                )}
              </div>
            )}
            </section>

          {(flowStage === 'base-model-generating' || baseModels.length > 0) && (
            <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-violet-600 text-[11px] font-bold text-white">
                    3
                  </span>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">基准模特图</h3>
                    <p className="mt-1 text-[11px] leading-4 text-slate-400">从候选模特里选择最贴近服装调性的基准图，可将满意结果收藏后复用。</p>
                  </div>
                </div>
                {selectedBaseModel && (
                  <button
                    type="button"
                    onClick={() => void handleSaveCurrentBaseModel()}
                    disabled={selectedBaseModelIsFavorited || isSavingFavoriteModel}
                    className={cn(
                      'inline-flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition',
                      selectedBaseModelIsFavorited
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'border border-violet-200 bg-white text-violet-700 hover:border-violet-300 hover:bg-violet-50',
                      isSavingFavoriteModel ? 'cursor-wait' : '',
                      selectedBaseModelIsFavorited ? '' : 'shadow-sm',
                    )}
                  >
                    {isSavingFavoriteModel ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Bookmark className={cn('h-3.5 w-3.5', selectedBaseModelIsFavorited ? 'fill-current' : '')} />
                    )}
                    {selectedBaseModelIsFavorited ? '已收藏' : '收藏当前模特'}
                  </button>
                )}
              </div>
              {flowStage === 'base-model-generating' ? (
                <div className="flex h-32 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-500">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 生成中...
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {baseModels.map((item) => {
                    const active = item.id === selectedBaseModelId;
                    const favorited = favoriteBaseModels.some((favorite) => favorite.imageUrl === item.imageUrl);
                    return (
                      <button
                        key={item.id}
                        onClick={() => handleBaseModelSelect(item.id)}
                        className={cn(
                          'relative overflow-hidden rounded-2xl border bg-white shadow-sm transition-all',
                          active ? 'border-violet-500 ring-2 ring-violet-500/20' : 'border-slate-200 hover:border-violet-300'
                        )}
                      >
                        <img src={item.imageUrl} alt="基准模特" className="h-28 w-full object-cover" />
                        {favorited && (
                          <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-white/90 px-1.5 py-0.5 text-[10px] font-semibold text-violet-700 shadow-sm">
                            <Bookmark className="h-2.5 w-2.5 fill-current" /> 收藏
                          </span>
                        )}
                        {active && (
                          <span className="absolute left-2 top-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-violet-600 text-white shadow-sm">
                            <Check className="h-3 w-3" />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          {(flowStage === 'scene-recommend-generating' || sceneRecommendations.length > 0 || flowStage === 'scene-select-ready' || flowStage === 'result-ready') && (
            <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <div className="mb-3 flex items-start gap-2.5">
                <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-violet-600 text-[11px] font-bold text-white">
                  4
                </span>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">选择场景</h3>
                  <p className="mt-1 text-[11px] leading-4 text-slate-400">推荐场景可多选，选中后再微调景别和朝向。</p>
                </div>
              </div>
              {flowStage === 'scene-recommend-generating' ? (
                <div className="flex h-44 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-500">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 生成中...
                </div>
              ) : (
                <div className="space-y-2">
                  {sceneRecommendations.map((scene) => (
                    <div
                      key={scene.id}
                      className={cn(
                        'rounded-2xl border bg-white p-3 shadow-sm transition-all',
                        scene.selected ? 'border-violet-300 ring-2 ring-violet-500/10' : 'border-slate-200'
                      )}
                    >
                      <label className="flex items-start gap-2 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          checked={scene.selected}
                          onChange={(event) => updateSceneSelection(scene.id, event.target.checked)}
                          className="mt-0.5"
                        />
                        <span>
                          <span className="block font-semibold text-slate-800">{scene.group}</span>
                          <span className="text-xs text-slate-500">{scene.description}</span>
                        </span>
                      </label>
                      {scene.selected && (
                        <div className="mt-2 grid grid-cols-2 gap-2">
                          <select
                            value={scene.framing}
                            onChange={(event) => updateSceneConfig(scene.id, 'framing', event.target.value as Framing)}
                            className="rounded-xl border border-slate-200 bg-slate-50 px-2 py-1.5 text-sm outline-none transition focus:border-violet-300 focus:bg-white focus:ring-4 focus:ring-violet-100"
                          >
                            {FRAMING_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                          </select>
                          <select
                            value={scene.facing}
                            onChange={(event) => updateSceneConfig(scene.id, 'facing', event.target.value as Facing)}
                            className="rounded-xl border border-slate-200 bg-slate-50 px-2 py-1.5 text-sm outline-none transition focus:border-violet-300 focus:bg-white focus:ring-4 focus:ring-violet-100"
                          >
                            {FACING_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}
          </div>

          <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <button
              onClick={onPrimaryAction}
              disabled={isPrimaryDisabled}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white shadow-md shadow-violet-600/20 transition-all hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-violet-200 disabled:shadow-none"
            >
              {(flowStage === 'base-model-generating' || flowStage === 'scene-recommend-generating' || workflowState.isGeneratingResults) && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              {effectivePrimaryLabel}
            </button>
            <p className="mt-2 text-center text-[11px] leading-4 text-slate-400">
              生成完成后可批量勾选结果并一键下载。
            </p>
          </div>
        </aside>

        <main className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
          <div className="flex h-full min-h-0 flex-col p-5">
            <div className="shrink-0 rounded-[28px] border border-white/70 bg-[radial-gradient(circle_at_top_left,_rgba(139,92,246,0.08),_rgba(255,255,255,0.96)_52%,_rgba(248,250,252,1)_100%)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
              <div className="grid gap-3 md:grid-cols-4">
              {STEP_META.map((step, index) => {
                const isActive = flowProgress >= index + 1;
                return (
                  <div
                    key={step.id}
                    className={cn(
                      'rounded-2xl border px-4 py-3 transition-all',
                      isActive
                        ? 'border-violet-200 bg-violet-50 text-violet-700 shadow-sm'
                        : 'border-slate-200 bg-white/75 text-slate-500'
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          'inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold',
                          isActive ? 'bg-violet-600 text-white' : 'bg-slate-200 text-slate-600'
                        )}
                      >
                        {index + 1}
                      </span>
                      <p className="text-sm font-semibold">{step.title}</p>
                    </div>
                    <p className="mt-1 text-xs leading-5">{step.description}</p>
                  </div>
                );
              })}
              </div>
            </div>

            <div className="mt-5 min-h-0 flex-1 overflow-y-auto subtle-scrollbar">

          {flowStage !== 'result-ready' ? (
            <div className="rounded-[32px] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <Sparkles className="h-4 w-4 text-violet-600" />
                  工作台预览
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500">
                  当前阶段：<span className="font-semibold text-slate-800">{flowStage}</span>
                </span>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                {PREVIEW_CARDS.map((item) => (
                  <div key={item.title} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <p className={["text-center text-sm font-bold", item.tint].join(' ')}>{item.title}</p>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      {item.sources.map((src, index) => (
                        <img
                          key={`${item.title}-source-${index}`}
                          src={src}
                          alt={`${item.title}-素材-${index + 1}`}
                          className="h-24 w-full rounded-xl bg-white object-cover"
                        />
                      ))}
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      {item.outputs.map((src, index) => (
                        <img
                          key={`${item.title}-output-${index}`}
                          src={src}
                          alt={`${item.title}-结果-${index + 1}`}
                          className="h-32 w-full rounded-xl bg-slate-300 object-cover"
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 grid gap-3 lg:grid-cols-[1.4fr_1fr]">
                <div className="rounded-2xl border border-violet-100 bg-violet-50/70 p-4 text-sm text-violet-800">
                  <div className="flex items-center gap-2 font-semibold">
                    <Layers3 className="h-4 w-4" />
                    操作建议
                  </div>
                  <p className="mt-2 text-xs leading-5 text-violet-700/80">
                    先保证商品图角度标签清晰，再生成或选择收藏模特，并继续推荐场景。这样出的套图稳定性会更高，也更接近抠图页“上传后直接在工作台内完成处理”的使用体验。
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">已选择场景</p>
                  <p className="mt-2 text-2xl font-bold text-slate-900">{selectedSceneCount}</p>
                  <p className="mt-1 text-xs text-slate-500">生成前可继续勾选或修改景别、朝向。</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-[32px] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-2xl font-bold text-slate-900">生成结果：</h3>
                <div className="flex items-center gap-4 text-sm text-slate-600">
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={results.length > 0 && selectedResultIds.length === results.length}
                      onChange={(event) => toggleSelectAllResults(event.target.checked)}
                    />
                    全选
                  </label>
                  <button
                    onClick={downloadSelectedResults}
                    className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-3 py-2 font-semibold text-white transition hover:bg-violet-700"
                  >
                    <Download className="h-4 w-4" /> 下载
                  </button>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {results.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-3 shadow-sm">
                    <label className="mb-2 inline-flex items-center gap-2 text-sm text-slate-600">
                      <input
                        type="checkbox"
                        checked={selectedResultIds.includes(item.id)}
                        onChange={(event) => toggleResultSelection(item.id, event.target.checked)}
                      />
                      {item.createdAt}
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <img src={item.sourceUrl} alt="服装图" className="h-44 w-full rounded-xl object-cover" />
                      <img src={item.previewUrl} alt={item.sceneLabel} className="h-44 w-full rounded-xl object-cover" />
                    </div>
                    <p className="mt-2 text-xs text-slate-500">{item.sceneLabel}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {flowStage === 'upload-empty' && (
            <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 shadow-sm">
              请先上传服装图片。
            </div>
          )}

          {flowStage === 'upload-ready' && (
            <div className="mt-6 rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-700 shadow-sm">
              服装图片已准备完成，请点击左下角“生成基准模特”。
            </div>
          )}

          {flowStage === 'base-model-ready' && (
            <div className="mt-6 rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-700 shadow-sm">
              基准模特已就绪，请点击左下角“生成推荐场景”。
            </div>
          )}

          {flowStage === 'scene-select-ready' && (
            <div className="mt-6 rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-700 shadow-sm">
              已可选择场景，请点击左下角“生成场景图片”。
            </div>
          )}

          {flowStage === 'result-ready' && (
            <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700 shadow-sm">
              <CheckCircle2 className="h-4 w-4" /> 已完成生成，可下载到本地。
            </div>
          )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};
