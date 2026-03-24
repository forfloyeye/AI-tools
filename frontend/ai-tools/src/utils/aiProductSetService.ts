import type { ModelAttributeForm } from '../pages/AiProductSet';
import { createDemoBaseModelImages, createDemoBatchImages } from './demoImageFactory';

export type ProductReferenceImagePayload = {
  angleLabel: string;
  imageBase64: string;
  mimeType: string;
};

export type GenerateBaseModelsPayload = {
  products: ProductReferenceImagePayload[];
  modelConfig: ModelAttributeForm;
  count: 4 | 6;
};

export type SceneTemplateSelectionPayload = {
  templateId: string;
  framing: 'full' | 'half' | 'three-quarter' | 'close-up';
  facing: 'front' | 'side' | 'three-quarter-side' | 'back';
};

export type FavoriteBaseModel = {
  id: string;
  imageUrl: string;
  modelConfig: ModelAttributeForm;
  createdAt: string;
};

export type GenerateBatchPayload = {
  products: ProductReferenceImagePayload[];
  modelConfig: ModelAttributeForm;
  selectedModelImage: string;
  sceneSelections: SceneTemplateSelectionPayload[];
};

export async function buildProductReferencePayload(
  files: Array<{ file: File; angleLabel: string }>
): Promise<ProductReferenceImagePayload[]> {
  return Promise.all(
    files.map(async ({ file, angleLabel }) => {
      const { base64, mimeType } = await fileToBase64(file);
      return {
        angleLabel,
        imageBase64: base64,
        mimeType,
      };
    })
  );
}

type RequestOptions = Omit<RequestInit, 'headers' | 'body'> & {
  body?: unknown;
  headers?: Record<string, string>;
};

export async function fileToBase64(file: File): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const [prefix, data] = result.split(',');
      const mimeType = prefix.replace('data:', '').replace(';base64', '');
      resolve({ base64: data, mimeType });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function getAuthToken(): string {
  const token = localStorage.getItem('token') ?? localStorage.getItem('auth_token');
  if (!token) {
    throw new Error('请先登录');
  }

  return token;
}

function hasAuthToken(): boolean {
  return Boolean(localStorage.getItem('token') ?? localStorage.getItem('auth_token'));
}

function buildDemoSceneRecommendations() {
  return {
    items: [
      {
        templateId: 'white-studio',
        group: '纯白棚拍',
        description: '自然站立双手轻搭裤缝，完整展示服装版型',
        framing: 'full' as const,
        facing: 'front' as const,
      },
      {
        templateId: 'city-street',
        group: '城市街头',
        description: '街头漫步氛围，突出穿搭层次与生活感',
        framing: 'three-quarter' as const,
        facing: 'side' as const,
      },
      {
        templateId: 'indoor-home',
        group: '居家空间',
        description: '柔和室内光，适合演示舒适轻松的卖点',
        framing: 'half' as const,
        facing: 'front' as const,
      },
    ],
    demoMode: true,
  };
}

export async function authorizedJsonFetch<T>(url: string, options: RequestOptions = {}): Promise<T> {
  const token = getAuthToken();
  const { body, headers, ...rest } = options;
  const response = await fetch(url, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const data = (await response.json()) as T & { error?: string };
  if (!response.ok) {
    throw new Error(data.error ?? '请求失败，请稍后重试');
  }

  return data;
}

export async function generateBaseModels(payload: GenerateBaseModelsPayload) {
  try {
    return await authorizedJsonFetch<{
      modelImages: string[];
      pointsTotal: number;
      pointsFree: number;
      pointsPaid: number;
      demoMode?: boolean;
    }>('/api/ai-product-set/base-models/generate', {
      method: 'POST',
      body: payload,
    });
  } catch {
    return {
      modelImages: await createDemoBaseModelImages(payload.products, payload.count),
      pointsTotal: 0,
      pointsFree: 0,
      pointsPaid: 0,
      demoMode: true,
    };
  }
}

export async function recommendScenes(selectedModelImage: string) {
  try {
    return await authorizedJsonFetch<{
      items: Array<{
        templateId: string;
        group: string;
        description: string;
        framing: 'full' | 'half' | 'three-quarter' | 'close-up';
        facing: 'front' | 'side' | 'three-quarter-side' | 'back';
      }>;
      demoMode?: boolean;
    }>('/api/ai-product-set/scenes/recommend', {
      method: 'POST',
      body: { selectedModelImage },
    });
  } catch {
    return buildDemoSceneRecommendations();
  }
}

export async function generateBatch(payload: GenerateBatchPayload) {
  try {
    return await authorizedJsonFetch<{
      batchId: string;
      resultCount: number;
      totalCost: number;
      results: Array<{
        id: string;
        sceneCode: string;
        framing: 'full' | 'half' | 'three-quarter' | 'close-up';
        facing: 'front' | 'side' | 'three-quarter-side' | 'back';
        imageData: string;
        sortOrder: number;
        createdAt: string;
      }>;
      pointsTotal: number;
      pointsFree: number;
      pointsPaid: number;
      demoMode?: boolean;
    }>('/api/ai-product-set/batches/generate', {
      method: 'POST',
      body: payload,
    });
  } catch {
    const images = await createDemoBatchImages(payload.selectedModelImage, payload.sceneSelections);
    const createdAt = new Date().toISOString();
    return {
      batchId: `demo-batch-${Date.now()}`,
      resultCount: images.length,
      totalCost: 0,
      results: images.map((imageData, index) => ({
        id: `demo-result-${Date.now()}-${index}`,
        sceneCode: payload.sceneSelections[index]?.templateId ?? `demo-${index + 1}`,
        framing: payload.sceneSelections[index]?.framing ?? 'full',
        facing: payload.sceneSelections[index]?.facing ?? 'front',
        imageData,
        sortOrder: index,
        createdAt,
      })),
      pointsTotal: 0,
      pointsFree: 0,
      pointsPaid: 0,
      demoMode: true,
    };
  }
}

export async function listFavoriteBaseModels(): Promise<FavoriteBaseModel[]> {
  if (!hasAuthToken()) {
    return [];
  }

  const response = await authorizedJsonFetch<{ items: FavoriteBaseModel[] }>('/api/ai-product-set/favorite-models');
  return response.items;
}

export async function saveFavoriteBaseModel(payload: {
  imageUrl: string;
  modelConfig: ModelAttributeForm;
}): Promise<{ item: FavoriteBaseModel; duplicated: boolean }> {
  return authorizedJsonFetch<{ item: FavoriteBaseModel; duplicated: boolean }>('/api/ai-product-set/favorite-models', {
    method: 'POST',
    body: payload,
  });
}
