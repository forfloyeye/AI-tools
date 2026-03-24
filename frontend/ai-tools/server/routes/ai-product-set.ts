import { randomUUID } from 'node:crypto';
import { Router, Response } from 'express';
import db from '../db.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';

const router = Router();

const BASE_MODEL_COST = 20;
const BATCH_RESULT_COST = 30;

const ALLOWED_FRAMING = new Set(['full', 'half', 'three-quarter', 'close-up']);
const ALLOWED_FACING = new Set(['front', 'side', 'three-quarter-side', 'back']);

const IMAGE_PROVIDER = (process.env.IMAGE_PROVIDER ?? 'hf').toLowerCase();
const HF_API_URL = process.env.HF_API_URL ?? 'https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-xl-base-1.0';
const HF_API_TOKEN = process.env.HF_API_TOKEN ?? '';
const HF_MAX_RETRIES = Number(process.env.HF_MAX_RETRIES ?? '4');

type ProductPayload = {
  angleLabel: string;
  imageBase64: string;
  mimeType: string;
};

type ModelConfigPayload = {
  gender: string;
  ageGroup: string;
  ethnicity: string;
  bodyType: string;
  appearanceNotes?: string;
};

type SceneSelectionPayload = {
  templateId: string;
  framing: string;
  facing: string;
};

type FavoriteModelRow = {
  id: string;
  imageData: string;
  modelConfigJson: string;
  createdAt: string;
};

function toDataUrl(base64: string, mimeType: string): string {
  return `data:${mimeType};base64,${base64}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function generateImageOrFallback(params: {
  fallbackDataUrl: string;
  prompt: string;
}): Promise<string> {
  if (IMAGE_PROVIDER !== 'hf' || !HF_API_URL) {
    return params.fallbackDataUrl;
  }

  try {
    const image = await generateImageWithHuggingFace(params.prompt);
    if (!image) {
      return params.fallbackDataUrl;
    }
    return image;
  } catch {
    return params.fallbackDataUrl;
  }
}

async function generateImageWithHuggingFace(prompt: string): Promise<string | null> {
  for (let attempt = 0; attempt < HF_MAX_RETRIES; attempt += 1) {
    const response = await fetch(HF_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(HF_API_TOKEN ? { Authorization: `Bearer ${HF_API_TOKEN}` } : {}),
      },
      body: JSON.stringify({
        inputs: prompt,
        options: { wait_for_model: true, use_cache: false },
      }),
    });

    const contentType = response.headers.get('content-type') ?? '';
    if (response.ok && contentType.startsWith('image/')) {
      const buffer = Buffer.from(await response.arrayBuffer());
      return toDataUrl(buffer.toString('base64'), contentType);
    }

    if (response.status === 429 || response.status === 503 || response.status >= 500) {
      await sleep(1000 * (attempt + 1));
      continue;
    }

    if (contentType.includes('application/json')) {
      const payload = (await response.json()) as { estimated_time?: number; error?: string };
      if (typeof payload.estimated_time === 'number' && payload.estimated_time > 0) {
        await sleep(Math.min(Math.ceil(payload.estimated_time * 1000), 10_000));
        continue;
      }
    }

    break;
  }

  return null;
}

function getUserCredits(userId: string): { freeCredits: number; paidCredits: number } | null {
  const user = db
    .prepare('SELECT free_credits, paid_credits FROM users WHERE id = ?')
    .get(userId) as { free_credits: number; paid_credits: number } | undefined;

  if (!user) {
    return null;
  }

  return { freeCredits: user.free_credits, paidCredits: user.paid_credits };
}

function isProductPayloadArray(input: unknown): input is ProductPayload[] {
  if (!Array.isArray(input) || input.length === 0) {
    return false;
  }

  return input.every((item) => {
    if (!item || typeof item !== 'object') {
      return false;
    }

    const product = item as Record<string, unknown>;
    return (
      typeof product.angleLabel === 'string' &&
      product.angleLabel.trim().length > 0 &&
      typeof product.imageBase64 === 'string' &&
      product.imageBase64.length > 0 &&
      typeof product.mimeType === 'string' &&
      product.mimeType.length > 0
    );
  });
}

function isModelConfig(input: unknown): input is ModelConfigPayload {
  if (!input || typeof input !== 'object') {
    return false;
  }
  const cfg = input as Record<string, unknown>;
  return (
    typeof cfg.gender === 'string' &&
    typeof cfg.ageGroup === 'string' &&
    typeof cfg.ethnicity === 'string' &&
    typeof cfg.bodyType === 'string'
  );
}

function isSceneSelectionArray(input: unknown): input is SceneSelectionPayload[] {
  if (!Array.isArray(input) || input.length === 0) {
    return false;
  }

  return input.every((item) => {
    if (!item || typeof item !== 'object') {
      return false;
    }

    const scene = item as Record<string, unknown>;
    return (
      typeof scene.templateId === 'string' &&
      scene.templateId.trim().length > 0 &&
      typeof scene.framing === 'string' &&
      ALLOWED_FRAMING.has(scene.framing) &&
      typeof scene.facing === 'string' &&
      ALLOWED_FACING.has(scene.facing)
    );
  });
}

function deductCreditsAtomic(userId: string, amount: number): { pointsFree: number; pointsPaid: number; pointsTotal: number } {
  const doDeduct = db.transaction((targetUserId: string, cost: number) => {
    const fresh = db
      .prepare('SELECT free_credits, paid_credits FROM users WHERE id = ?')
      .get(targetUserId) as { free_credits: number; paid_credits: number } | undefined;

    if (!fresh) {
      throw Object.assign(new Error('用户不存在'), { code: 'NOT_FOUND' });
    }

    const total = fresh.free_credits + fresh.paid_credits;
    if (total < cost) {
      throw Object.assign(new Error('点数不足，请充值'), { code: 'INSUFFICIENT' });
    }

    let remaining = cost;
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
      targetUserId,
    );

    return {
      pointsFree: newFree,
      pointsPaid: newPaid,
      pointsTotal: newFree + newPaid,
    };
  });

  return doDeduct(userId, amount);
}

function mapFavoriteModelRow(row: FavoriteModelRow) {
  return {
    id: row.id,
    imageUrl: row.imageData,
    modelConfig: JSON.parse(row.modelConfigJson),
    createdAt: row.createdAt,
  };
}

router.post('/base-models/generate', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { products, modelConfig, count } = req.body as {
    products?: unknown;
    modelConfig?: unknown;
    count?: unknown;
  };

  if (!isProductPayloadArray(products) || !isModelConfig(modelConfig)) {
    return res.status(400).json({ error: '请求参数不完整或格式错误' });
  }

  if (count !== 4 && count !== 6) {
    return res.status(400).json({ error: 'count 仅支持 4 或 6' });
  }

  const user = getUserCredits(req.userId!);
  if (!user) {
    return res.status(404).json({ error: '用户不存在' });
  }

  const totalCost = count * BASE_MODEL_COST;
  if (user.freeCredits + user.paidCredits < totalCost) {
    return res.status(402).json({ error: `点数不足，生成 ${count} 张需要 ${totalCost} 点` });
  }

  const first = products[0];
  const fallbackDataUrl = toDataUrl(first.imageBase64, first.mimeType);

  try {
    const prompt = [
      '生成电商服饰基准模特图，保持服饰款式、印花、材质准确。',
      `模特性别：${modelConfig.gender}，年龄段：${modelConfig.ageGroup}，人种/特征：${modelConfig.ethnicity}，体型：${modelConfig.bodyType}。`,
      `外貌细节：${modelConfig.appearanceNotes ?? ''}`,
      '输出干净背景的人像穿戴图，不要文字和水印。',
    ].join(' ');

    const modelImages = await Promise.all(
      Array.from({ length: count }).map(() =>
        generateImageOrFallback({
          fallbackDataUrl,
          prompt,
        })
      )
    );

    const points = deductCreditsAtomic(req.userId!, totalCost);
    return res.json({ modelImages, ...points });
  } catch (err) {
    const e = err as { code?: string; message?: string };
    if (e.code === 'INSUFFICIENT') {
      return res.status(402).json({ error: e.message ?? '点数不足，请充值' });
    }
    if (e.code === 'NOT_FOUND') {
      return res.status(404).json({ error: e.message ?? '用户不存在' });
    }
    return res.status(500).json({ error: '基础模特生成失败，请稍后重试' });
  }
});

router.post('/scenes/recommend', authMiddleware, (req: AuthRequest, res: Response) => {
  const { selectedModelImage } = req.body as { selectedModelImage?: unknown };
  if (typeof selectedModelImage !== 'string' || selectedModelImage.length === 0) {
    return res.status(400).json({ error: '缺少 selectedModelImage' });
  }

  const items = [
    {
      templateId: 'white-studio',
      group: '纯白棚拍',
      description: '自然站立双手轻搭裤缝，目光平视镜头，完整展示T恤版型与印花',
      framing: 'full',
      facing: 'front',
    },
    {
      templateId: 'city-street',
      group: '城市街头户外',
      description: '站立在街边手持咖啡，目光看向镜头，完整展示搭配效果',
      framing: 'full',
      facing: 'front',
    },
    {
      templateId: 'cafe',
      group: '城市街头户外',
      description: '侧身靠在咖啡桌边缘，单手搭在桌沿，突出下装与露腰版型',
      framing: 'three-quarter',
      facing: 'side',
    },
    {
      templateId: 'indoor-home',
      group: '家居起居室室内',
      description: '小步向前走自然甩动手臂，表情舒展，展示休闲穿着舒适感',
      framing: 'half',
      facing: 'front',
    },
    {
      templateId: 'art-park',
      group: '艺术公园',
      description: '轻侧身自然站姿，清晰呈现服装印花细节与材质纹理',
      framing: 'close-up',
      facing: 'three-quarter-side',
    },
  ];

  return res.json({ items });
});

router.post('/batches/generate', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { products, modelConfig, selectedModelImage, sceneSelections } = req.body as {
    products?: unknown;
    modelConfig?: unknown;
    selectedModelImage?: unknown;
    sceneSelections?: unknown;
  };

  if (!isProductPayloadArray(products) || !isModelConfig(modelConfig)) {
    return res.status(400).json({ error: '请求参数不完整或格式错误' });
  }
  if (typeof selectedModelImage !== 'string' || selectedModelImage.length === 0) {
    return res.status(400).json({ error: '缺少 selectedModelImage' });
  }
  if (!isSceneSelectionArray(sceneSelections)) {
    return res.status(400).json({ error: 'sceneSelections 不能为空且格式需合法' });
  }

  const user = getUserCredits(req.userId!);
  if (!user) {
    return res.status(404).json({ error: '用户不存在' });
  }

  const totalCost = sceneSelections.length * BATCH_RESULT_COST;
  if (user.freeCredits + user.paidCredits < totalCost) {
    return res.status(402).json({ error: `点数不足，生成 ${sceneSelections.length} 张需要 ${totalCost} 点` });
  }

  const batchId = randomUUID();
  const now = new Date().toISOString();

  try {
    const generatedImages = await Promise.all(
      sceneSelections.map((scene) => {
        const prompt = [
          `将模特置于场景 ${scene.templateId}，景别 ${scene.framing}，朝向 ${scene.facing}。`,
          '保持服装细节一致，画面自然真实，电商可用。',
          '输出纯图片，不要文字和水印。',
        ].join(' ');

        return generateImageOrFallback({
          fallbackDataUrl: selectedModelImage,
          prompt,
        });
      })
    );

    const results = sceneSelections.map((scene, index) => ({
      id: randomUUID(),
      sceneCode: scene.templateId,
      framing: scene.framing,
      facing: scene.facing,
      imageData: generatedImages[index],
      sortOrder: index,
      createdAt: now,
    }));

    const doSaveAndDeduct = db.transaction(() => {
      db.prepare(
        `INSERT INTO ai_product_set_batches (
          id,
          user_id,
          product_payload_json,
          model_config_json,
          selected_model_image,
          scene_selections_json,
          result_count,
          total_cost
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        batchId,
        req.userId,
        JSON.stringify(products),
        JSON.stringify(modelConfig),
        selectedModelImage,
        JSON.stringify(sceneSelections),
        results.length,
        totalCost,
      );

      const insertResult = db.prepare(
        `INSERT INTO ai_product_set_results (
          id,
          batch_id,
          scene_code,
          framing,
          facing,
          image_data,
          sort_order
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`
      );

      for (const row of results) {
        insertResult.run(
          row.id,
          batchId,
          row.sceneCode,
          row.framing,
          row.facing,
          row.imageData,
          row.sortOrder,
        );
      }

      return deductCreditsAtomic(req.userId!, totalCost);
    });

    const points = doSaveAndDeduct();

    return res.json({
      batchId,
      resultCount: results.length,
      totalCost,
      results,
      ...points,
    });
  } catch (err) {
    const e = err as { code?: string; message?: string };
    if (e.code === 'INSUFFICIENT') {
      return res.status(402).json({ error: e.message ?? '点数不足，请充值' });
    }
    if (e.code === 'NOT_FOUND') {
      return res.status(404).json({ error: e.message ?? '用户不存在' });
    }
    return res.status(500).json({ error: '场景图片生成失败，请稍后重试' });
  }
});

router.get('/favorite-models', authMiddleware, (req: AuthRequest, res: Response) => {
  const rows = db.prepare(
    `SELECT
        id,
        image_data AS imageData,
        model_config_json AS modelConfigJson,
        created_at AS createdAt
      FROM ai_product_set_favorite_models
      WHERE user_id = ?
      ORDER BY datetime(created_at) DESC`
  ).all(req.userId) as FavoriteModelRow[];

  return res.json({ items: rows.map(mapFavoriteModelRow) });
});

router.post('/favorite-models', authMiddleware, (req: AuthRequest, res: Response) => {
  const { imageUrl, modelConfig } = req.body as {
    imageUrl?: unknown;
    modelConfig?: unknown;
  };

  if (typeof imageUrl !== 'string' || imageUrl.length === 0 || !isModelConfig(modelConfig)) {
    return res.status(400).json({ error: '收藏模特参数不完整或格式错误' });
  }

  const existing = db.prepare(
    `SELECT
        id,
        image_data AS imageData,
        model_config_json AS modelConfigJson,
        created_at AS createdAt
      FROM ai_product_set_favorite_models
      WHERE user_id = ? AND image_data = ?
      LIMIT 1`
  ).get(req.userId, imageUrl) as FavoriteModelRow | undefined;

  if (existing) {
    return res.json({ item: mapFavoriteModelRow(existing), duplicated: true });
  }

  const id = randomUUID();
  db.prepare(
    `INSERT INTO ai_product_set_favorite_models (
      id,
      user_id,
      image_data,
      model_config_json
    ) VALUES (?, ?, ?, ?)`
  ).run(id, req.userId, imageUrl, JSON.stringify(modelConfig));

  const created = db.prepare(
    `SELECT
        id,
        image_data AS imageData,
        model_config_json AS modelConfigJson,
        created_at AS createdAt
      FROM ai_product_set_favorite_models
      WHERE id = ?`
  ).get(id) as FavoriteModelRow;

  return res.status(201).json({ item: mapFavoriteModelRow(created), duplicated: false });
});

router.get('/history', authMiddleware, (req: AuthRequest, res: Response) => {
  const rows = db.prepare(
    `SELECT
        id,
        result_count AS resultCount,
        total_cost AS totalCost,
        created_at AS createdAt
      FROM ai_product_set_batches
      WHERE user_id = ?
      ORDER BY datetime(created_at) DESC`
  ).all(req.userId) as Array<{
    id: string;
    resultCount: number;
    totalCost: number;
    createdAt: string;
  }>;

  return res.json({ items: rows });
});

router.get('/history/:batchId', authMiddleware, (req: AuthRequest, res: Response) => {
  const batch = db.prepare(
    `SELECT
        id,
        product_payload_json AS productPayloadJson,
        model_config_json AS modelConfigJson,
        selected_model_image AS selectedModelImage,
        scene_selections_json AS sceneSelectionsJson,
        result_count AS resultCount,
        total_cost AS totalCost,
        created_at AS createdAt
      FROM ai_product_set_batches
      WHERE id = ? AND user_id = ?`
  ).get(req.params.batchId, req.userId) as
    | {
        id: string;
        productPayloadJson: string;
        modelConfigJson: string;
        selectedModelImage: string;
        sceneSelectionsJson: string;
        resultCount: number;
        totalCost: number;
        createdAt: string;
      }
    | undefined;

  if (!batch) {
    return res.status(404).json({ error: '生成记录不存在' });
  }

  const results = db.prepare(
    `SELECT
        id,
        scene_code AS sceneCode,
        framing,
        facing,
        image_data AS imageData,
        sort_order AS sortOrder,
        created_at AS createdAt
      FROM ai_product_set_results
      WHERE batch_id = ?
      ORDER BY sort_order ASC, created_at ASC`
  ).all(req.params.batchId);

  return res.json({
    id: batch.id,
    products: JSON.parse(batch.productPayloadJson),
    modelConfig: JSON.parse(batch.modelConfigJson),
    selectedModelImage: batch.selectedModelImage,
    sceneSelections: JSON.parse(batch.sceneSelectionsJson),
    resultCount: batch.resultCount,
    totalCost: batch.totalCost,
    createdAt: batch.createdAt,
    results,
  });
});

export function createEmptyAiProductSetBatch(userId: string) {
  const batchId = randomUUID();
  db.prepare(
    `INSERT INTO ai_product_set_batches (
      id,
      user_id,
      product_payload_json,
      model_config_json,
      selected_model_image,
      scene_selections_json,
      result_count,
      total_cost
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(batchId, userId, '[]', '{}', '', '[]', 0, 0);

  return batchId;
}

export default router;
