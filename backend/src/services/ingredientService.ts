import { query } from '../db';
import type { Ingredient, IngredientCategory, ExpirationUrgency } from '../types';

/** 식품별 정밀 소비기한 DB (단위: 일) */
const INGREDIENT_EXPIRATION_DB: Record<string, number> = {
  양파:30, 마늘:14, 대파:7, 파:7, 당근:14, 감자:21, 고구마:21,
  브로콜리:5, 시금치:3, 배추:14, 오이:5, 애호박:5, 가지:5,
  피망:7, 파프리카:7, 양배추:14, 상추:3, 깻잎:3, 부추:5,
  콩나물:3, 숙주:2, 버섯:5, 팽이버섯:5, 새송이버섯:7,
  느타리버섯:5, 표고버섯:7, 단호박:14, 무:14, 생강:21, 고추:7,
  사과:14, 배:14, 바나나:4, 귤:14, 오렌지:14, 딸기:3, 포도:5,
  토마토:5, 방울토마토:5, 아보카도:3, 레몬:14, 키위:7, 망고:4,
  닭고기:2, 닭가슴살:2, 소고기:3, 쇠고기:3, 돼지고기:3,
  삼겹살:3, 베이컨:7, 햄:7, 소시지:7, 스팸:7,
  계란:21, 달걀:21, 냉동만두:90,
  생선:2, 고등어:2, 연어:2, 참치:2, 새우:2, 오징어:2,
  낙지:2, 조개:2, 굴:2, 게맛살:7, 어묵:5,
  참치캔:730, 고등어캔:730,
  우유:7, 두유:7, 치즈:14, 버터:30, 요거트:7, 생크림:5,
  크림치즈:14, 두부:3, 순두부:3, 연두부:3,
  소금:730, 설탕:730, 후추:365,
  간장:365, 진간장:365, 국간장:365, 양조간장:365,
  된장:365, 고추장:365, 쌈장:180,
  식초:730, 참기름:180, 들기름:90, 올리브오일:365, 식용유:365,
  고춧가루:180, 다진마늘:14, 카레가루:365, 통깨:180,
  케첩:180, 마요네즈:90, 굴소스:180, 스리라차:365,
  핫소스:365, 돈까스소스:180, 떡볶이소스:30, 데리야끼소스:90,
  쌀:365, 현미:365, 밀가루:180, 부침가루:180, 전분:365,
  라면:180, 파스타:365, 빵:3, 식빵:5, 빵가루:90, 김치:30,
};

const CATEGORY_DEFAULTS: Record<IngredientCategory, number> = {
  육류: 3, 해산물: 2, 채소: 7, 과일: 7,
  유제품: 10, 조미료: 180, 소스: 180, 기타: 7,
};

export function calculateExpirationDate(name: string, category: IngredientCategory): Date {
  // 정확히 일치
  let days = INGREDIENT_EXPIRATION_DB[name];
  // 부분 일치
  if (days === undefined) {
    for (const [key, d] of Object.entries(INGREDIENT_EXPIRATION_DB)) {
      if (name.includes(key) || key.includes(name)) { days = d; break; }
    }
  }
  // 카테고리 기본값
  if (days === undefined) days = CATEGORY_DEFAULTS[category] ?? 7;
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
}

export function getExpirationUrgency(expirationDate: Date): ExpirationUrgency {
  const now = new Date();
  const diffMs = expirationDate.getTime() - now.getTime();
  const days_remaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  let level: 'red' | 'yellow' | 'green';
  let urgency_score: number;

  if (days_remaining <= 2) {
    level = 'red';
    urgency_score = days_remaining <= 1 ? 1.0 : 0.8;
  } else if (days_remaining <= 5) {
    level = 'yellow';
    urgency_score = 0.5;
  } else {
    level = 'green';
    urgency_score = 0.2;
  }

  return { level, days_remaining, urgency_score };
}

export async function getAllIngredients(userId: string): Promise<Ingredient[]> {
  const result = await query(
    'SELECT * FROM ingredients WHERE user_id = $1 ORDER BY expiration_date ASC',
    [userId]
  );
  return result.rows;
}

export async function getExpiringIngredients(userId: string, daysThreshold = 3): Promise<Ingredient[]> {
  const result = await query(
    `SELECT * FROM ingredients
     WHERE user_id = $1
     AND expiration_date <= NOW() + INTERVAL '${daysThreshold} days'
     ORDER BY expiration_date ASC`,
    [userId]
  );
  return result.rows;
}

export async function addIngredient(
  userId: string,
  data: {
    name: string;
    quantity?: number;
    unit?: string;
    category: IngredientCategory;
    expiration_date?: Date;
  }
): Promise<Ingredient> {
  const expDate = data.expiration_date || calculateExpirationDate(data.name, data.category);

  const result = await query(
    `INSERT INTO ingredients (user_id, name, quantity, unit, category, expiration_date)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [userId, data.name, data.quantity || null, data.unit || null, data.category, expDate]
  );
  return result.rows[0];
}

export async function updateIngredient(
  id: string,
  userId: string,
  data: Partial<{
    name: string;
    quantity: number;
    unit: string;
    category: IngredientCategory;
    expiration_date: Date;
  }>
): Promise<Ingredient | null> {
  const fields: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (data.name !== undefined) { fields.push(`name = $${idx++}`); values.push(data.name); }
  if (data.quantity !== undefined) { fields.push(`quantity = $${idx++}`); values.push(data.quantity); }
  if (data.unit !== undefined) { fields.push(`unit = $${idx++}`); values.push(data.unit); }
  if (data.category !== undefined) { fields.push(`category = $${idx++}`); values.push(data.category); }
  if (data.expiration_date !== undefined) { fields.push(`expiration_date = $${idx++}`); values.push(data.expiration_date); }

  if (fields.length === 0) return null;

  fields.push(`updated_at = NOW()`);
  values.push(id, userId);

  const result = await query(
    `UPDATE ingredients SET ${fields.join(', ')} WHERE id = $${idx++} AND user_id = $${idx} RETURNING *`,
    values
  );
  return result.rows[0] || null;
}

export async function deleteIngredient(id: string, userId: string): Promise<boolean> {
  const result = await query(
    'DELETE FROM ingredients WHERE id = $1 AND user_id = $2',
    [id, userId]
  );
  return (result.rowCount || 0) > 0;
}

export async function deductIngredients(
  userId: string,
  usedIngredients: Array<{ name: string; quantity?: number }>
): Promise<void> {
  for (const used of usedIngredients) {
    // Find matching ingredient (exact name first, then partial)
    let result = await query(
      'SELECT * FROM ingredients WHERE user_id = $1 AND name = $2 LIMIT 1',
      [userId, used.name]
    );
    if (result.rows.length === 0) {
      result = await query(
        'SELECT * FROM ingredients WHERE user_id = $1 AND name ILIKE $2 LIMIT 1',
        [userId, `%${used.name}%`]
      );
    }
    const ing = result.rows[0];
    if (!ing) continue;

    if (used.quantity && ing.quantity !== null && ing.quantity !== undefined) {
      const remaining = parseFloat(ing.quantity) - used.quantity;
      if (remaining <= 0) {
        await query('DELETE FROM ingredients WHERE id = $1 AND user_id = $2', [ing.id, userId]);
      } else {
        await query(
          'UPDATE ingredients SET quantity = $1, updated_at = NOW() WHERE id = $2 AND user_id = $3',
          [remaining, ing.id, userId]
        );
      }
    } else {
      // No quantity info — remove the ingredient entirely
      await query('DELETE FROM ingredients WHERE id = $1 AND user_id = $2', [ing.id, userId]);
    }
  }
}

export function buildExpirationWeights(ingredients: Ingredient[]): Record<string, number> {
  const weights: Record<string, number> = {};
  for (const ing of ingredients) {
    const { urgency_score } = getExpirationUrgency(new Date(ing.expiration_date));
    weights[ing.name] = urgency_score;
  }
  return weights;
}
