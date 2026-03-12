import 'dotenv/config';
import express from 'express';
import db from './db.js';       // 触发数据库初始化
import authRoutes from './routes/auth.js';
import userRoutes from './routes/user.js';

const app = express();
const PORT = Number(process.env.PORT) || 3001;

app.use(express.json());

// API 路由
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);

// 健康检查
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`🚀 API Server running on http://localhost:${PORT}`);
  console.log(`   - POST /api/auth/register`);
  console.log(`   - POST /api/auth/login`);
  console.log(`   - GET  /api/user/me`);
  console.log(`   - POST /api/user/deduct`);
});
