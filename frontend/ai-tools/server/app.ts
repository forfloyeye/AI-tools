import 'dotenv/config';
import express from 'express';
import authRoutes from './routes/auth.js';
import removeBgRoutes from './routes/remove-bg.js';
import aiSceneRoutes from './routes/ai-scene.js';
import aiProductSetRoutes from './routes/ai-product-set.js';
import userRoutes from './routes/user.js';
import './db.js'; // 触发数据库初始化

const app = express();
app.use(express.json({ limit: '80mb' }));

app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/remove-bg', removeBgRoutes);
app.use('/api/ai-scene', aiSceneRoutes);
app.use('/api/ai-product-set', aiProductSetRoutes);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

export default app;
