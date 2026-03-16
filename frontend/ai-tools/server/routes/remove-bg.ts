import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import db from '../db.js';

const router = Router();
const REMOVE_BG_COST = 10;

interface RemoveBgBody {
  imageBase64?: unknown;
  filename?: unknown;
}

router.post('/process', authMiddleware, async (req: AuthRequest, res: Response) => {
  const apiKey = process.env.REMOVE_BG_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: '服务端未配置 REMOVE_BG_API_KEY' });
  }

  const { imageBase64, filename } = req.body as RemoveBgBody;
  if (typeof imageBase64 !== 'string' || imageBase64.length === 0) {
    return res.status(400).json({ error: '缺少图片数据' });
  }

  try {
    const user = db.prepare(
      'SELECT free_credits, paid_credits FROM users WHERE id = ?'
    ).get(req.userId) as { free_credits: number; paid_credits: number } | undefined;

    if (!user) {
      return res.status(404).json({ error: '用户不存在' });
    }
    if (user.free_credits + user.paid_credits < REMOVE_BG_COST) {
      return res.status(402).json({ error: '点数不足，请充值' });
    }

    const inputBuffer = Buffer.from(imageBase64, 'base64');
    if (inputBuffer.byteLength === 0) {
      return res.status(400).json({ error: '图片数据无效' });
    }
    if (inputBuffer.byteLength > 10 * 1024 * 1024) {
      return res.status(413).json({ error: '图片过大，请上传 10MB 以内图片' });
    }

    const formData = new FormData();
    formData.append('size', 'auto');
    formData.append('format', 'png');
    formData.append(
      'image_file',
      new Blob([inputBuffer], { type: 'application/octet-stream' }),
      typeof filename === 'string' && filename.trim() ? filename : 'upload.png'
    );

    const upstream = await fetch('https://api.remove.bg/v1.0/removebg', {
      method: 'POST',
      headers: {
        'X-Api-Key': apiKey,
      },
      body: formData,
    });

    if (!upstream.ok) {
      const contentType = upstream.headers.get('content-type') || '';
      let detail = '';
      if (contentType.includes('application/json')) {
        const json = await upstream.json() as { errors?: Array<{ title?: string }>; detail?: string };
        detail = json.errors?.[0]?.title || json.detail || '';
      } else {
        detail = await upstream.text();
      }
      return res.status(upstream.status).json({ error: detail || '抠图服务调用失败' });
    }

    // 仅在抠图成功后扣点，满足“失败不扣点、成功才扣点”。
    const doDeduct = db.transaction((userId: string, amount: number) => {
      const current = db.prepare(
        'SELECT free_credits, paid_credits FROM users WHERE id = ?'
      ).get(userId) as { free_credits: number; paid_credits: number } | undefined;

      if (!current) throw Object.assign(new Error('用户不存在'), { code: 'NOT_FOUND' });

      const total = current.free_credits + current.paid_credits;
      if (total < amount) throw Object.assign(new Error('点数不足，请充值'), { code: 'INSUFFICIENT' });

      let newFree = current.free_credits;
      let newPaid = current.paid_credits;
      if (newFree >= amount) {
        newFree -= amount;
      } else {
        const remaining = amount - newFree;
        newFree = 0;
        newPaid -= remaining;
      }

      db.prepare('UPDATE users SET free_credits = ?, paid_credits = ? WHERE id = ?')
        .run(newFree, newPaid, userId);

      return { totalPoints: newFree + newPaid, freeCredits: newFree, paidCredits: newPaid };
    });

    try {
      const points = doDeduct(req.userId!, REMOVE_BG_COST);
      res.setHeader('X-Points-Total', String(points.totalPoints));
      res.setHeader('X-Points-Free', String(points.freeCredits));
      res.setHeader('X-Points-Paid', String(points.paidCredits));
    } catch (err: unknown) {
      const e = err as { code?: string; message?: string };
      if (e.code === 'INSUFFICIENT') return res.status(402).json({ error: e.message });
      if (e.code === 'NOT_FOUND') return res.status(404).json({ error: e.message });
      return res.status(500).json({ error: '扣费失败，请稍后重试' });
    }

    const contentType = upstream.headers.get('content-type') || 'image/png';
    const outputBuffer = Buffer.from(await upstream.arrayBuffer());
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send(outputBuffer);
  } catch {
    return res.status(500).json({ error: '抠图失败，请稍后重试' });
  }
});

export default router;