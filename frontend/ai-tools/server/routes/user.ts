import { Router, Response } from 'express';
import db from '../db.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';

const router = Router();

// GET /api/user/me — 获取当前登录用户信息（用于前端会话恢复）
router.get('/me', authMiddleware, (req: AuthRequest, res: Response) => {
  const user = db.prepare(
    'SELECT id, email, free_credits, paid_credits FROM users WHERE id = ?'
  ).get(req.userId) as {
    id: string;
    email: string;
    free_credits: number;
    paid_credits: number;
  } | undefined;

  if (!user) {
    return res.status(404).json({ error: '用户不存在' });
  }

  res.json({
    id: user.id,
    email: user.email,
    freeCredits: user.free_credits,
    paidCredits: user.paid_credits,
    totalPoints: user.free_credits + user.paid_credits,
  });
});

// POST /api/user/deduct — 原子扣费（优先扣 freeCredits，不足则扣 paidCredits）
router.post('/deduct', authMiddleware, (req: AuthRequest, res: Response) => {
  const { amount } = req.body as { amount?: unknown };

  if (typeof amount !== 'number' || amount <= 0 || !Number.isInteger(amount)) {
    return res.status(400).json({ error: '无效的扣费金额' });
  }

  // 使用 SQLite 事务保证原子性，防止并发导致点数负数
  const doDeduct = db.transaction((userId: string, amt: number) => {
    const user = db.prepare(
      'SELECT free_credits, paid_credits FROM users WHERE id = ?'
    ).get(userId) as { free_credits: number; paid_credits: number } | undefined;

    if (!user) throw Object.assign(new Error('用户不存在'), { code: 'NOT_FOUND' });

    const total = user.free_credits + user.paid_credits;
    if (total < amt) throw Object.assign(new Error('点数不足，请充值'), { code: 'INSUFFICIENT' });

    // 优先扣除免费积分
    let newFree = user.free_credits;
    let newPaid = user.paid_credits;
    if (newFree >= amt) {
      newFree -= amt;
    } else {
      const remaining = amt - newFree;
      newFree = 0;
      newPaid -= remaining;
    }

    db.prepare('UPDATE users SET free_credits = ?, paid_credits = ? WHERE id = ?')
      .run(newFree, newPaid, userId);

    return { freeCredits: newFree, paidCredits: newPaid, totalPoints: newFree + newPaid };
  });

  try {
    const result = doDeduct(req.userId!, amount);
    res.json(result);
  } catch (err: unknown) {
    const e = err as { code?: string; message?: string };
    if (e.code === 'INSUFFICIENT') return res.status(402).json({ error: e.message });
    if (e.code === 'NOT_FOUND') return res.status(404).json({ error: e.message });
    res.status(500).json({ error: '扣费失败，请稍后重试' });
  }
});

export default router;
