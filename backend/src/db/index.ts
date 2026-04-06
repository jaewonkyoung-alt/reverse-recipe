import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';

// data 폴더 생성
const dataDir = path.join(__dirname, '../../../data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, 'reverse_recipe.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// 테이블 초기화
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE,
    name TEXT NOT NULL,
    password_hash TEXT,
    kakao_id TEXT UNIQUE,
    preferences TEXT DEFAULT '{"cuisine_weights":{"Korean":1.0,"Japanese":0.8,"Chinese":0.8,"Western":0.7}}',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS ingredients (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    quantity REAL,
    unit TEXT,
    category TEXT CHECK (category IN ('채소','과일','육류','해산물','유제품','조미료','소스','기타')),
    expiration_date TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS recipe_cache (
    id TEXT PRIMARY KEY,
    cache_key TEXT UNIQUE NOT NULL,
    recipe_data TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    expires_at TEXT
  );

  CREATE TABLE IF NOT EXISTS recipe_history (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    recipe_data TEXT NOT NULL,
    completed INTEGER DEFAULT 0,
    completed_at TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS shopping_list (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    ingredient_name TEXT NOT NULL,
    quantity REAL,
    unit TEXT,
    recipe_title TEXT,
    is_purchased INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS green_points (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    ingredient_name TEXT,
    points_earned REAL DEFAULT 0,
    reason TEXT,
    earned_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS purchase_imports (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    store_name TEXT,
    items TEXT,
    imported_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS email_verifications (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    code TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    verified INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_ingredients_user_id ON ingredients(user_id);
  CREATE INDEX IF NOT EXISTS idx_ingredients_expiration ON ingredients(expiration_date ASC);
  CREATE INDEX IF NOT EXISTS idx_green_points_user_id ON green_points(user_id);
  CREATE INDEX IF NOT EXISTS idx_email_verif_email ON email_verifications(email);

  INSERT OR IGNORE INTO users (id, email, name, password_hash)
  VALUES (
    '00000000-0000-0000-0000-000000000001',
    'guest@reverse-recipe.com',
    '게스트',
    '$2a$10$dummy.hash.for.guest.user.only'
  );
`);

export { randomUUID };
export default db;

/**
 * pg 호환 query 인터페이스
 * - $1, $2 → ? 변환
 * - NOW() → 현재 ISO 시각
 * - ILIKE → LIKE
 * - INTERVAL → JS Date 계산
 */
export const query = async (text: string, params?: unknown[]) => {
  // $1, $2... → ?
  let sql = text.replace(/\$\d+/g, '?');

  // NOW() +/- INTERVAL 'N days' → 계산된 날짜
  sql = sql.replace(/NOW\(\)\s*([\+\-])\s*INTERVAL\s*'(\d+)\s*days?'/gi, (_m, sign, d) => {
    const dt = new Date();
    const delta = parseInt(d) * (sign === '-' ? -1 : 1);
    dt.setDate(dt.getDate() + delta);
    return `'${dt.toISOString()}'`;
  });
  // NOW() +/- INTERVAL 'N hours' → 계산된 시각
  sql = sql.replace(/NOW\(\)\s*([\+\-])\s*INTERVAL\s*'(\d+)\s*hours?'/gi, (_m, sign, h) => {
    const dt = new Date();
    const delta = parseInt(h) * (sign === '-' ? -1 : 1);
    dt.setHours(dt.getHours() + delta);
    return `'${dt.toISOString()}'`;
  });
  // NOW() → 현재 시각
  sql = sql.replace(/NOW\(\)/gi, `'${new Date().toISOString()}'`);
  // ILIKE → LIKE
  sql = sql.replace(/ILIKE/gi, 'LIKE');

  const trimmed = text.trim().toUpperCase();
  const isSelect = trimmed.startsWith('SELECT') || trimmed.startsWith('WITH');
  const hasReturning = /RETURNING/i.test(text);

  try {
    if (isSelect) {
      const stmt = db.prepare(sql);
      const rows = (params ? stmt.all(...(params as [])) : stmt.all()) as Record<string, unknown>[];
      return { rows, rowCount: rows.length };
    } else if (hasReturning) {
      const stmt = db.prepare(sql);
      const row = params ? stmt.get(...(params as [])) : stmt.get();
      const rows = row ? [row as Record<string, unknown>] : [];
      return { rows, rowCount: rows.length };
    } else {
      const stmt = db.prepare(sql);
      const result = params ? stmt.run(...(params as [])) : stmt.run();
      return { rows: [], rowCount: result.changes };
    }
  } catch (err) {
    console.error('SQLite query error:', { sql, params, err });
    throw err;
  }
};
