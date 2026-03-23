import pool from './index';

const migrations = `
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email           VARCHAR(255) UNIQUE,
  name            VARCHAR(100) NOT NULL,
  password_hash   VARCHAR(255),
  kakao_id        VARCHAR(100) UNIQUE,
  preferences     JSONB DEFAULT '{"cuisine_weights":{"Korean":1.0,"Japanese":0.8,"Chinese":0.8,"Western":0.7}}',
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW()
);

-- Ingredients table (나의 냉장고)
CREATE TABLE IF NOT EXISTS ingredients (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name            VARCHAR(100) NOT NULL,
  quantity        DECIMAL(10,2),
  unit            VARCHAR(20),
  category        VARCHAR(50) CHECK (category IN ('채소','과일','육류','해산물','유제품','조미료','소스','기타')),
  expiration_date DATE NOT NULL,
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW()
);

-- Recipe cache table (캐싱용)
CREATE TABLE IF NOT EXISTS recipe_cache (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key       VARCHAR(255) UNIQUE NOT NULL,
  recipe_data     JSONB NOT NULL,
  created_at      TIMESTAMP DEFAULT NOW(),
  expires_at      TIMESTAMP DEFAULT (NOW() + INTERVAL '24 hours')
);

-- User recipe history
CREATE TABLE IF NOT EXISTS recipe_history (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipe_data     JSONB NOT NULL,
  completed       BOOLEAN DEFAULT FALSE,
  completed_at    TIMESTAMP,
  created_at      TIMESTAMP DEFAULT NOW()
);

-- Green Points table (환경 점수)
CREATE TABLE IF NOT EXISTS green_points (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ingredient_name VARCHAR(100),
  points_earned   DECIMAL(6,2),
  reason          VARCHAR(200),
  earned_at       TIMESTAMP DEFAULT NOW()
);

-- Shopping list table
CREATE TABLE IF NOT EXISTS shopping_list (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ingredient_name VARCHAR(100) NOT NULL,
  quantity        DECIMAL(10,2),
  unit            VARCHAR(20),
  recipe_title    VARCHAR(200),
  is_purchased    BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMP DEFAULT NOW()
);

-- Purchase imports table (구매내역 자동등록 - Phase 3)
CREATE TABLE IF NOT EXISTS purchase_imports (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  platform            VARCHAR(20) CHECK (platform IN ('coupang','naver','kurly')),
  raw_product_name    VARCHAR(200),
  parsed_ingredient   VARCHAR(100),
  quantity            DECIMAL(10,2),
  unit                VARCHAR(20),
  imported_at         TIMESTAMP DEFAULT NOW()
);

-- Analytics events table
CREATE TABLE IF NOT EXISTS analytics_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  event_type  VARCHAR(100) NOT NULL,
  event_data  JSONB,
  created_at  TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_ingredients_user_id ON ingredients(user_id);
CREATE INDEX IF NOT EXISTS idx_ingredients_expiration ON ingredients(expiration_date ASC);
CREATE INDEX IF NOT EXISTS idx_recipe_history_user_id ON recipe_history(user_id);
CREATE INDEX IF NOT EXISTS idx_green_points_user_id ON green_points(user_id);
CREATE INDEX IF NOT EXISTS idx_shopping_list_user_id ON shopping_list(user_id);

-- Guest user for demo purposes
INSERT INTO users (id, email, name, password_hash)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'guest@reverse-recipe.com',
  '게스트',
  '$2a$10$dummy.hash.for.guest.user.only'
)
ON CONFLICT (email) DO NOTHING;
`;

async function runMigrations() {
  const client = await pool.connect();
  try {
    console.log('🚀 Running database migrations...');
    await client.query(migrations);
    console.log('✅ Migrations completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigrations();
