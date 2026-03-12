import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import db from '../db.js';
import { signToken } from '../middleware/auth.js';

const router = Router();

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };

  if (!email || !password) {
    return res.status(400).json({ error: '邮箱和密码不能为空' });
  }
  if (!EMAIL_REGEX.test(email)) {
    return res.status(400).json({ error: '请输入正确的邮箱格式' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: '密码至少需要6位' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) {
    return res.status(409).json({ error: '该邮箱已注册，请直接登录' });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const id = randomUUID().replace(/-/g, '');

  db.prepare(`
    INSERT INTO users (id, email, password_hash, free_credits, paid_credits, last_login_date)
    VALUES (?, ?, ?, 300, 0, date('now'))
  `).run(id, email, passwordHash);

  const token = signToken(id);

  res.status(201).json({
    token,
    user: { id, email, freeCredits: 300, paidCredits: 0, totalPoints: 300 },
  });
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };

  if (!email || !password) {
    return res.status(400).json({ error: '邮箱和密码不能为空' });
  }

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as {
    id: string;
    email: string;
    password_hash: string;
    free_credits: number;
    paid_credits: number;
    last_login_date: string;
  } | undefined;

  if (!user) {
    return res.status(401).json({ error: '邮箱或密码错误' });
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    return res.status(401).json({ error: '邮箱或密码错误' });
  }

  // 每日免费积分重置：如果上次登录不是今天，将 free_credits 重置为 300
  const today = new Date().toISOString().slice(0, 10);
  let freeCredits = user.free_credits;
  if (user.last_login_date !== today) {
    db.prepare('UPDATE users SET free_credits = 300, last_login_date = ? WHERE id = ?')
      .run(today, user.id);
    freeCredits = 300;
  }

  const token = signToken(user.id);
  const totalPoints = freeCredits + user.paid_credits;

  res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      freeCredits,
      paidCredits: user.paid_credits,
      totalPoints,
    },
  });
});

export default router;
