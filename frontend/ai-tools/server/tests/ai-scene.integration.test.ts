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

type ErrorResponse = {
  error?: string;
};

async function postJson<T>(
  url: string,
  body: unknown,
  token?: string,
): Promise<{ status: number; data: T }> {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });

  const data = (await res.json()) as T;
  return { status: res.status, data };
}

async function run(): Promise<void> {
  process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'test-key';

  const server = app.listen(0);
  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    const email = `ai_scene_it_${Date.now()}_${Math.floor(Math.random() * 10_000)}@test.com`;
    const password = 'Password123!';

    const register = await postJson<RegisterResponse>(
      `${baseUrl}/api/auth/register`,
      { email, password },
    );

    assert.equal(register.status, 201, 'register should return 201');
    assert.ok(register.data.token, 'register should return token');

    const token = register.data.token;

    const deduct = await postJson<{ totalPoints: number } | ErrorResponse>(
      `${baseUrl}/api/user/deduct`,
      { amount: 280 },
      token,
    );

    assert.equal(deduct.status, 200, 'deduct should return 200');

    const unauthorized = await postJson<ErrorResponse>(
      `${baseUrl}/api/ai-scene/generate`,
      {
        imageBase64: 'dGVzdA==',
        mimeType: 'image/jpeg',
        sceneId: 'minimal',
        count: 2,
      },
    );

    assert.equal(unauthorized.status, 401, 'missing token should return 401');

    const insufficient = await postJson<ErrorResponse>(
      `${baseUrl}/api/ai-scene/generate`,
      {
        imageBase64: 'dGVzdA==',
        mimeType: 'image/jpeg',
        sceneId: 'minimal',
        count: 2,
      },
      token,
    );

    assert.equal(insufficient.status, 402, 'insufficient credits should return 402');
    assert.match(
      insufficient.data.error ?? '',
      /60/,
      'insufficient error should include required credits for count=2',
    );

    const clampedCount = await postJson<ErrorResponse>(
      `${baseUrl}/api/ai-scene/generate`,
      {
        imageBase64: 'dGVzdA==',
        mimeType: 'image/jpeg',
        sceneId: 'minimal',
        count: 999,
      },
      token,
    );

    assert.equal(clampedCount.status, 402, 'count clamped path should still return 402');
    assert.match(
      clampedCount.data.error ?? '',
      /120/,
      'insufficient error should include clamped required credits (4 * 30 = 120)',
    );

    // eslint-disable-next-line no-console
    console.log('ai-scene integration test passed');
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
  console.error('ai-scene integration test failed:', err);
  process.exitCode = 1;
});
