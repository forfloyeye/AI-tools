import { Router, Response } from 'express';
import { GoogleGenAI, Modality } from '@google/genai';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import db from '../db.js';

const router = Router();
const AI_SCENE_COST = 30;

const SCENE_PROMPTS: Record<string, string> = {
  festival:
    'Place this product on a light-colored wooden surface in a warm festive atmosphere. ' +
    'Use warm golden tones with soft natural lighting. Add tasteful festive decorations in the background — ' +
    'such as red lanterns, wrapped gift boxes, and small green plants. ' +
    'Center the product with a beautiful depth-of-field effect to highlight its texture and quality. ' +
    'Create a warm, cozy, and inviting holiday mood. Commercial-grade composition, ' +
    'ultra-high definition, photorealistic style, no watermarks.',
  'modern-home':
    'Place this product in a modern minimalist living room or bedroom with a soft light-grey color palette. ' +
    'Use natural diffused lighting. Naturally integrate the product with elegant home accessories nearby — ' +
    'such as a neatly arranged cushion, a small stack of books, or a potted plant. ' +
    'Shoot at a 45-degree angle to clearly display all product details. ' +
    'High-quality material rendering, comfortable and refined home atmosphere. ' +
    'Commercial e-commerce photography style, ultra-high definition.',
  retro:
    'Place this product on a vintage wooden desk or an aged rustic-styled background. ' +
    'Use warm brown tones with soft directional side lighting to create a nostalgic, moody atmosphere. ' +
    'Add vintage props around the product — antique books, a retro desk lamp, dried flowers. ' +
    'Highlight the product\'s texture and craftsmanship with a close-up composition. ' +
    'Apply a subtle cinematic vintage film look. Retro aesthetics, ' +
    'commercial-grade composition, ultra-high definition, photorealistic style.',
  'plain-grey':
    'Place this product centered on a pure seamless light-grey background, ' +
    'with the product occupying approximately 85% of the frame. ' +
    'Shoot straight-on from a direct front view at eye level. ' +
    'Use softbox lighting from multiple angles to produce soft, clean shadows with no harsh lines. ' +
    'Clearly display the complete product with no extra decorations or distractions. ' +
    'Accurate color reproduction, commercial-grade product photography, ' +
    'ultra-high definition with no noise, no watermarks, no text.',
  'daily-life':
    'Place this product in a natural daily-life scene with warm soft natural light streaming through a nearby window. ' +
    'The product rests naturally in a real-life setting, surrounded by casual everyday props — ' +
    'for example a coffee cup, a smartphone, and a notebook placed nearby. ' +
    'Use a shallow depth of field to make the product the clear focal point. ' +
    'Create an authentic, warm, and lifestyle-oriented atmosphere with true-to-life natural colors. ' +
    'Commercial e-commerce style, ultra-high definition, photorealistic.',
  // legacy scene ids kept for backwards compatibility
  minimal:
    'Place this product on a clean white minimalist desk with soft diffused studio lighting. ' +
    'The product is the main focal point. The result should look like a professional e-commerce product photo.',
  nature:
    'Place this product in a natural outdoor environment with lush green vegetation, dappled sunlight, ' +
    'and a soft bokeh background. The product should look natural and inviting in this outdoor setting.',
  cozy:
    'Place this product in a cozy home interior setting with warm ambient lighting, wooden textures, ' +
    'and a comfortable, lived-in aesthetic. The product should look at home in this warm environment.',
  studio:
    'Place this product in a professional photography studio with dramatic directional lighting, ' +
    'subtle shadows, and a clean seamless dark backdrop. The image should look like a high-end commercial product shot.',
  marble:
    'Place this product on a luxurious white and grey marble surface with elegant soft studio lighting. ' +
    'The product should look premium and aspirational, suitable for a luxury brand listing.',
};

interface AiSceneBody {
  imageBase64?: unknown;
  imageBase64List?: unknown;
  mimeType?: unknown;
  sourceImages?: unknown;
  sceneId?: unknown;
  customPrompt?: unknown;
  count?: unknown;
}

interface SourceImagePayload {
  imageBase64: string;
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
}

type RouteError = Error & { code?: string; cause?: { code?: string } };

function getErrorMessage(err: unknown): { status: number; message: string } {
  if (!(err instanceof Error)) {
    return { status: 500, message: '服务异常，请稍后重试' };
  }

  const routeError = err as RouteError;
  const cause = routeError.cause;
  if (routeError.code === 'INSUFFICIENT') {
    return { status: 402, message: routeError.message || '点数不足，请充值' };
  }
  if (cause?.code === 'UND_ERR_CONNECT_TIMEOUT') {
    return { status: 504, message: '连接 Gemini 服务超时，请稍后重试或检查网络环境' };
  }

  if (err.message.includes('fetch failed')) {
    return { status: 502, message: '无法连接 Gemini 服务，请检查当前网络是否可访问 Google API' };
  }

  return { status: 500, message: err.message || '服务异常，请稍后重试' };
}

router.post('/generate', authMiddleware, async (req: AuthRequest, res: Response) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: '服务端未配置 GEMINI_API_KEY' });
  }

  const { imageBase64, imageBase64List, mimeType, sourceImages, sceneId, customPrompt, count: countRaw } = req.body as AiSceneBody;

  if (typeof sceneId !== 'string' && typeof customPrompt !== 'string') {
    return res.status(400).json({ error: '请提供场景ID或自定义描述' });
  }

  const normalizeMimeType = (value: unknown): SourceImagePayload['mimeType'] =>
    value === 'image/png' || value === 'image/webp' ? value : 'image/jpeg';

  const normalizedSources: SourceImagePayload[] = Array.isArray(sourceImages)
    ? sourceImages.flatMap((item) => {
        if (!item || typeof item !== 'object') {
          return [];
        }

        const payload = item as Record<string, unknown>;
        if (typeof payload.imageBase64 !== 'string' || payload.imageBase64.length === 0) {
          return [];
        }

        return [{ imageBase64: payload.imageBase64, mimeType: normalizeMimeType(payload.mimeType) }];
      })
    : Array.isArray(imageBase64List)
      ? imageBase64List.flatMap((item) =>
          typeof item === 'string' && item.length > 0
            ? [{ imageBase64: item, mimeType: normalizeMimeType(mimeType) }]
            : []
        )
      : typeof imageBase64 === 'string' && imageBase64.length > 0
        ? [{ imageBase64, mimeType: normalizeMimeType(mimeType) }]
        : [];

  if (normalizedSources.length === 0) {
    return res.status(400).json({ error: '缺少图片数据' });
  }

  if (normalizedSources.length > 6) {
    return res.status(400).json({ error: '最多支持 6 张商品图' });
  }

  const count = typeof countRaw === 'number'
    ? Math.min(Math.max(1, Math.floor(countRaw)), 4)
    : 1;
  const totalCost = normalizedSources.length * count * AI_SCENE_COST;

  try {
    const user = db
      .prepare('SELECT free_credits, paid_credits FROM users WHERE id = ?')
      .get(req.userId) as { free_credits: number; paid_credits: number } | undefined;

    if (!user) {
      return res.status(404).json({ error: '用户不存在' });
    }
    if (user.free_credits + user.paid_credits < totalCost) {
      return res.status(402).json({ error: `点数不足，生成 ${count} 张需要 ${totalCost} 点` });
    }

    // 构建 prompt：优先使用自定义描述，否则使用预设场景
    const scenePrompt =
      typeof customPrompt === 'string' && customPrompt.trim()
        ? customPrompt.trim()
        : SCENE_PROMPTS[sceneId as string] ?? SCENE_PROMPTS.minimal;

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        timeout: 60_000,
        retryOptions: { attempts: 4 },
      },
    });

    const generateOne = async (source: SourceImagePayload): Promise<{ data: string; mime: string }> => {
      const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash-exp-image-generation',
        contents: [
          {
            role: 'user',
            parts: [
              {
                text:
                  `You are a professional e-commerce product photographer. ` +
                  `${scenePrompt} ` +
                  `Keep the product clearly visible and well-lit. ` +
                  `Output only the final composite product photo with no extra text or borders.`,
              },
              {
                inlineData: { mimeType: source.mimeType, data: source.imageBase64 },
              },
            ],
          },
        ],
        config: {
          responseModalities: [Modality.IMAGE, Modality.TEXT],
        },
      });

      const parts = response.candidates?.[0]?.content?.parts ?? [];
      for (const part of parts) {
        if (part.inlineData?.data) {
          return { data: part.inlineData.data, mime: part.inlineData.mimeType ?? 'image/png' };
        }
      }
      throw new Error('AI 未返回图像结果，请稍后重试');
    };

    const results: Array<{ data: string; mime: string }> = [];
    for (const source of normalizedSources) {
      const batch = await Promise.all(Array.from({ length: count }, () => generateOne(source)));
      results.push(...batch);
    }

    // 成功后统一扣点
    const doDeduct = db.transaction(() => {
      const fresh = db
        .prepare('SELECT free_credits, paid_credits FROM users WHERE id = ?')
        .get(req.userId) as { free_credits: number; paid_credits: number };

      const total = fresh.free_credits + fresh.paid_credits;
      if (total < totalCost) {
        throw Object.assign(new Error(`点数不足，生成 ${normalizedSources.length * count} 张需要 ${totalCost} 点`), {
          code: 'INSUFFICIENT',
        });
      }

      let remaining = totalCost;
      let newFree = fresh.free_credits;
      let newPaid = fresh.paid_credits;

      if (newFree >= remaining) {
        newFree -= remaining;
        remaining = 0;
      } else {
        remaining -= newFree;
        newFree = 0;
        newPaid -= remaining;
      }

      db.prepare('UPDATE users SET free_credits = ?, paid_credits = ? WHERE id = ?').run(
        newFree,
        newPaid,
        req.userId
      );

      return { newFree, newPaid };
    });

    const { newFree, newPaid } = doDeduct() as { newFree: number; newPaid: number };

    const imageDataList = results.map(r => `data:${r.mime};base64,${r.data}`);

    return res.json({
      imageData: imageDataList[0],        // 向后兼容
      imageDataList,
      sourceImageCount: normalizedSources.length,
      pointsTotal: newFree + newPaid,
      pointsFree: newFree,
      pointsPaid: newPaid,
    });
  } catch (err) {
    console.error('[ai-scene] error:', err);
    const { status, message } = getErrorMessage(err);
    return res.status(status).json({ error: message });
  }
});

export default router;
