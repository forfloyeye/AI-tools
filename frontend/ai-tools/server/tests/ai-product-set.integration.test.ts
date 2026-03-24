import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import app from '../app.js';

type RegisterResponse = {
  token: string;
  user: {
    id: string;
    email: string;
    freeCredits: number;
    paidCredits: number;
    totalPoints: number;
  };
};

type HistoryResponse = {
  items: Array<{
    id: string;
    resultCount: number;
    totalCost: number;
    createdAt: string;
  }>;
};

type ErrorResponse = {
  error?: string;
};

type BaseModelResponse = {
  modelImages: string[];
  pointsTotal: number;
  pointsFree: number;
  pointsPaid: number;
};

type SceneRecommendResponse = {
  items: Array<{
    templateId: string;
    group: string;
    description: string;
    framing: 'full' | 'half' | 'three-quarter' | 'close-up';
    facing: 'front' | 'side' | 'three-quarter-side' | 'back';
  }>;
};

type BatchGenerateResponse = {
  batchId: string;
  resultCount: number;
  totalCost: number;
  results: Array<{
    id: string;
    sceneCode: string;
    framing: string;
    facing: string;
    imageData: string;
    sortOrder: number;
    createdAt: string;
  }>;
  pointsTotal: number;
  pointsFree: number;
  pointsPaid: number;
};

type HistoryDetailResponse = {
  id: string;
  resultCount: number;
  totalCost: number;
  sceneSelections: Array<{
    templateId: string;
    framing: string;
    facing: string;
  }>;
  results: Array<{
    id: string;
    sceneCode: string;
    framing: string;
    facing: string;
    imageData: string;
    sortOrder: number;
  }>;
};

const SAMPLE_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/P5wW6QAAAABJRU5ErkJggg==';

const sampleProducts = [
  {
    angleLabel: '正面',
    imageBase64: SAMPLE_BASE64,
    mimeType: 'image/png',
  },
];

const sampleModelConfig = {
  gender: 'female',
  ageGroup: 'young-adult',
  ethnicity: '欧美白人',
  bodyType: '标准',
  appearanceNotes: '自然微笑',
};

async function requestJson<T>(
  url: string,
  options: {
    method?: 'GET' | 'POST';
    body?: unknown;
    token?: string;
  } = {},
): Promise<{ status: number; data: T }> {
  const res = await fetch(url, {
    method: options.method ?? 'GET',
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  const data = (await res.json()) as T;
  return { status: res.status, data };
}

async function run(): Promise<void> {
  const server = app.listen(0);
  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    const email = `ai_product_set_it_${Date.now()}_${Math.floor(Math.random() * 10_000)}@test.com`;
    const password = 'Password123!';

    const register = await requestJson<RegisterResponse>(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      body: { email, password },
    });

    assert.equal(register.status, 201, 'register should return 201');
    assert.ok(register.data.token, 'register should return token');

    const unauthorizedBaseModel = await requestJson<ErrorResponse>(
      `${baseUrl}/api/ai-product-set/base-models/generate`,
      {
        method: 'POST',
        body: {},
      }
    );

    assert.equal(unauthorizedBaseModel.status, 401, 'missing token on base model should return 401');

    const unauthorizedBatch = await requestJson<ErrorResponse>(
      `${baseUrl}/api/ai-product-set/batches/generate`,
      {
        method: 'POST',
        body: {},
      }
    );

    assert.equal(unauthorizedBatch.status, 401, 'missing token on batch generate should return 401');

    const invalidBaseModel = await requestJson<ErrorResponse>(
      `${baseUrl}/api/ai-product-set/base-models/generate`,
      {
        method: 'POST',
        token: register.data.token,
        body: {
          products: [],
          modelConfig: {},
          count: 4,
        },
      }
    );
    assert.equal(invalidBaseModel.status, 400, 'invalid base model payload should return 400');

    const baseModel = await requestJson<BaseModelResponse>(
      `${baseUrl}/api/ai-product-set/base-models/generate`,
      {
        method: 'POST',
        token: register.data.token,
        body: {
          products: sampleProducts,
          modelConfig: sampleModelConfig,
          count: 4,
        },
      }
    );
    assert.equal(baseModel.status, 200, 'base model generation should return 200');
    assert.equal(baseModel.data.modelImages.length, 4, 'base model response should return 4 images');
    assert.ok(baseModel.data.pointsTotal < register.data.user.totalPoints, 'points should be deducted after base model generation');

    const recommend = await requestJson<SceneRecommendResponse>(
      `${baseUrl}/api/ai-product-set/scenes/recommend`,
      {
        method: 'POST',
        token: register.data.token,
        body: {
          selectedModelImage: baseModel.data.modelImages[0],
        },
      }
    );
    assert.equal(recommend.status, 200, 'scene recommend should return 200');
    assert.ok(recommend.data.items.length > 0, 'scene recommend should return scene items');

    const insufficientBatch = await requestJson<ErrorResponse>(
      `${baseUrl}/api/ai-product-set/batches/generate`,
      {
        method: 'POST',
        token: register.data.token,
        body: {
          products: sampleProducts,
          modelConfig: sampleModelConfig,
          selectedModelImage: baseModel.data.modelImages[0],
          sceneSelections: Array.from({ length: 12 }).map((_, idx) => ({
            templateId: `too-many-${idx}`,
            framing: 'full',
            facing: 'front',
          })),
        },
      }
    );
    assert.equal(insufficientBatch.status, 402, 'insufficient credits batch should return 402');

    const selectedScenes = recommend.data.items.slice(0, 2).map((item) => ({
      templateId: item.templateId,
      framing: item.framing,
      facing: item.facing,
    }));

    const batchGenerate = await requestJson<BatchGenerateResponse>(
      `${baseUrl}/api/ai-product-set/batches/generate`,
      {
        method: 'POST',
        token: register.data.token,
        body: {
          products: sampleProducts,
          modelConfig: sampleModelConfig,
          selectedModelImage: baseModel.data.modelImages[0],
          sceneSelections: selectedScenes,
        },
      }
    );
    assert.equal(batchGenerate.status, 200, 'batch generation should return 200');
    assert.equal(batchGenerate.data.results.length, selectedScenes.length, 'batch generation should return selected scene count');
    assert.ok(batchGenerate.data.batchId, 'batch generation should return batch id');

    const emptyHistory = await requestJson<HistoryResponse>(`${baseUrl}/api/ai-product-set/history`, {
      token: register.data.token,
    });

    assert.equal(emptyHistory.status, 200, 'history should return 200 for logged-in user');
    assert.ok(emptyHistory.data.items.length >= 1, 'history should contain at least one batch after generation');

    const detail = await requestJson<HistoryDetailResponse>(
      `${baseUrl}/api/ai-product-set/history/${batchGenerate.data.batchId}`,
      {
        token: register.data.token,
      }
    );
    assert.equal(detail.status, 200, 'history detail should return 200');
    assert.equal(detail.data.id, batchGenerate.data.batchId, 'history detail should match batch id');
    assert.equal(detail.data.results.length, selectedScenes.length, 'history detail should return generated results');

    // eslint-disable-next-line no-console
    console.log('ai-product-set integration test passed');
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    });
  }
}

run().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('ai-product-set integration test failed:', err);
  process.exitCode = 1;
});
