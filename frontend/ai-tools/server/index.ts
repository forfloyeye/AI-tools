import app from './app.js';

const PORT = Number(process.env.PORT) || 3001;

app.listen(PORT, () => {
  console.log(`🚀 API Server running on http://localhost:${PORT}`);
  console.log(`   - POST /api/auth/register`);
  console.log(`   - POST /api/auth/login`);
  console.log(`   - GET  /api/user/me`);
  console.log(`   - POST /api/user/deduct`);
  console.log(`   - POST /api/ai-product-set/base-models/generate`);
  console.log(`   - POST /api/ai-product-set/scenes/recommend`);
  console.log(`   - POST /api/ai-product-set/batches/generate`);
  console.log(`   - GET  /api/ai-product-set/history`);
  console.log(`   - GET  /api/ai-product-set/history/:batchId`);
});
