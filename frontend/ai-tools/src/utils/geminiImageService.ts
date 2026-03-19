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

export async function generateProductScene(
  file: File,
  sceneId: string,
  customPrompt?: string,
  count: number = 1,
): Promise<string[]> {
  // Keep compatibility with existing app auth storage key.
  const token = localStorage.getItem('token') ?? localStorage.getItem('auth_token');
  if (!token) throw new Error('请先登录');

  const { base64, mimeType } = await fileToBase64(file);

  const res = await fetch('/api/ai-scene/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ imageBase64: base64, mimeType, sceneId, customPrompt, count }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error ?? 'AI 生成失败，请重试');
  }

  // 优先返回 imageDataList，兜底转化 imageData
  if (Array.isArray(data.imageDataList) && data.imageDataList.length > 0) {
    return data.imageDataList as string[];
  }
  return [data.imageData as string];
}
