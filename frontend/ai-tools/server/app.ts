import 'dotenv/config';
import express from 'express';
import authRoutes from './routes/auth.js';
import removeBgRoutes from './routes/remove-bg.js';
import userRoutes from './routes/user.js';
import './db.js'; // 触发数据库初始化

const app = express();
app.use(express.json({ limit: '15mb' }));

app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/remove-bg', removeBgRoutes);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

export default app;
