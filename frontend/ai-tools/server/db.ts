import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 在 Vercel 上使用 /tmp（可写目录），本地使用 data/ 目录
const dataDir = process.env.VERCEL
  ? '/tmp/app-data'
  : path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const DB_PATH = path.join(dataDir, 'app.db');
const db = new Database(DB_PATH);

// WAL 模式提高并发性能，同时开启外键约束
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// 建表（已存在则跳过）
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id           TEXT PRIMARY KEY,
    email        TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    free_credits  INTEGER DEFAULT 300,
    paid_credits  INTEGER DEFAULT 0,
    last_login_date TEXT DEFAULT (date('now')),
    created_at   TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS redeem_codes (
    id           TEXT PRIMARY KEY,
    code         TEXT UNIQUE NOT NULL,
    credit_value INTEGER NOT NULL,
    is_used      INTEGER DEFAULT 0,
    used_at      TEXT,
    used_by_id   TEXT REFERENCES users(id),
    created_at   TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS ai_product_set_batches (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    product_payload_json TEXT NOT NULL,
    model_config_json TEXT NOT NULL,
    selected_model_image TEXT NOT NULL,
    scene_selections_json TEXT NOT NULL,
    result_count INTEGER NOT NULL,
    total_cost INTEGER NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS ai_product_set_results (
    id TEXT PRIMARY KEY,
    batch_id TEXT NOT NULL REFERENCES ai_product_set_batches(id) ON DELETE CASCADE,
    scene_code TEXT NOT NULL,
    framing TEXT NOT NULL,
    facing TEXT NOT NULL,
    image_data TEXT NOT NULL,
    sort_order INTEGER NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS ai_product_set_favorite_models (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    image_data TEXT NOT NULL,
    model_config_json TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_ai_product_set_favorite_models_user_created
    ON ai_product_set_favorite_models(user_id, created_at DESC);
`);

console.log(`✅ SQLite 数据库已就绪：${DB_PATH}`);

export default db;
