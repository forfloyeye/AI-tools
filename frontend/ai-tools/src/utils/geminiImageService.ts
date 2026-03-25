import { createDemoSceneImagesFromFiles } from './demoImageFactory';
import type { OutputSizeOption } from '../constants/presets';

function fileToBase64(file: File): Promise<{ base64: string; mimeType: string }> {
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

export interface SceneSourceImagePayload {
  imageBase64: string;
  mimeType: string;
}

export interface GenerateProductSceneResult {
  imageDataList: string[];
  demoMode?: boolean;
}

export async function generateProductScene(
  files: File[],
  sceneId: string,
  customPrompt?: string,
  count: number = 1,
  outputSize?: OutputSizeOption,
): Promise<GenerateProductSceneResult> {
  const token = localStorage.getItem('token') ?? localStorage.getItem('auth_token');
  const useDemoFallback = async () => ({
    imageDataList: await createDemoSceneImagesFromFiles(files, customPrompt?.trim() || sceneId, count),
    demoMode: true,
  });

  if (!token) {
    return useDemoFallback();
  }

  const sourceImages = await Promise.all(files.map((file) => fileToBase64(file)));
  const primaryImage = sourceImages[0];

  try {
    const res = await fetch('/api/ai-scene/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        imageBase64: primaryImage?.base64,
        mimeType: primaryImage?.mimeType,
        imageBase64List: sourceImages.map((item) => item.base64),
        sourceImages: sourceImages.map((item) => ({ imageBase64: item.base64, mimeType: item.mimeType })),
        sceneId,
        customPrompt,
        count,
        outputSize,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      return useDemoFallback();
    }

    if (Array.isArray(data.imageDataList) && data.imageDataList.length > 0) {
      return { imageDataList: data.imageDataList as string[] };
    }

    return { imageDataList: [data.imageData as string] };
  } catch {
    return useDemoFallback();
  }
}
