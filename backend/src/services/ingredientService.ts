import { kyselyDb, randomUUID } from '../db';
import type { Ingredient, IngredientCategory, ExpirationUrgency } from '../types';
import { INGREDIENT_EXPIRATION_DB, CATEGORY_DEFAULTS } from '../data/ingredientExpirationDB';

export function calculateExpirationDate(name: string, category: IngredientCategory): Date {
  // 정확히 일치
  let days = INGREDIENT_EXPIRATION_DB[name];
  // 부분 일치 (우측 최장일치)
  if (days === undefined) {
    const sortedKeys = Object.keys(INGREDIENT_EXPIRATION_DB).sort((a, b) => b.length - a.length);
    for (const key of sortedKeys) {
      if (name.endsWith(key)) { days = INGREDIENT_EXPIRATION_DB[key]; break; }
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
  const rows = await kyselyDb
    .selectFrom('ingredients')
    .selectAll()
    .where('user_id', '=', userId)
    .orderBy('expiration_date', 'asc')
    .execute();
  return rows as unknown as Ingredient[];
}

export async function getExpiringIngredients(userId: string, daysThreshold = 3): Promise<Ingredient[]> {
  // 날짜 계산을 JS에서 수행해 바운드 파라미터로 전달 (SQL 인터폴레이션 없음)
  const threshold = new Date();
  threshold.setDate(threshold.getDate() + daysThreshold);
  const thresholdStr = threshold.toISOString();

  const rows = await kyselyDb
    .selectFrom('ingredients')
    .selectAll()
    .where('user_id', '=', userId)
    .where('expiration_date', '<=', thresholdStr)
    .orderBy('expiration_date', 'asc')
    .execute();
  return rows as unknown as Ingredient[];
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
  const expDateStr = expDate instanceof Date ? expDate.toISOString() : expDate;

  const row = await kyselyDb
    .insertInto('ingredients')
    .values({
      id: randomUUID(),
      user_id: userId,
      name: data.name,
      quantity: data.quantity ?? null,
      unit: data.unit ?? null,
      category: data.category,
      expiration_date: expDateStr,
    })
    .returningAll()
    .executeTakeFirstOrThrow();
  return row as unknown as Ingredient;
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
  const updates: Record<string, unknown> = {};

  if (data.name !== undefined) updates.name = data.name;
  if (data.quantity !== undefined) updates.quantity = data.quantity;
  if (data.unit !== undefined) updates.unit = data.unit;
  if (data.category !== undefined) updates.category = data.category;
  if (data.expiration_date !== undefined) {
    updates.expiration_date = data.expiration_date instanceof Date
      ? data.expiration_date.toISOString()
      : data.expiration_date;
  }

  if (Object.keys(updates).length === 0) return null;

  updates.updated_at = new Date().toISOString();

  const row = await kyselyDb
    .updateTable('ingredients')
    .set(updates)
    .where('id', '=', id)
    .where('user_id', '=', userId)
    .returningAll()
    .executeTakeFirst();
  return row ? (row as unknown as Ingredient) : null;
}

export async function deleteIngredient(id: string, userId: string): Promise<boolean> {
  const result = await kyselyDb
    .deleteFrom('ingredients')
    .where('id', '=', id)
    .where('user_id', '=', userId)
    .executeTakeFirst();
  return (result.numDeletedRows ?? BigInt(0)) > BigInt(0);
}

export async function deductIngredients(
  userId: string,
  usedIngredients: Array<{ name: string; quantity?: number }>
): Promise<void> {
  for (const used of usedIngredients) {
    // 정확 일치 먼저, 없으면 부분 일치
    let ing = await kyselyDb
      .selectFrom('ingredients')
      .selectAll()
      .where('user_id', '=', userId)
      .where('name', '=', used.name)
      .limit(1)
      .executeTakeFirst();

    if (!ing) {
      ing = await kyselyDb
        .selectFrom('ingredients')
        .selectAll()
        .where('user_id', '=', userId)
        .where('name', 'like', `%${used.name}%`)
        .limit(1)
        .executeTakeFirst();
    }

    if (!ing) continue;

    if (used.quantity && ing.quantity !== null && ing.quantity !== undefined) {
      const remaining = ing.quantity - used.quantity;
      if (remaining <= 0) {
        await kyselyDb
          .deleteFrom('ingredients')
          .where('id', '=', ing.id)
          .where('user_id', '=', userId)
          .execute();
      } else {
        await kyselyDb
          .updateTable('ingredients')
          .set({ quantity: remaining, updated_at: new Date().toISOString() })
          .where('id', '=', ing.id)
          .where('user_id', '=', userId)
          .execute();
      }
    } else {
      // 수량 정보 없으면 재료 전체 삭제
      await kyselyDb
        .deleteFrom('ingredients')
        .where('id', '=', ing.id)
        .where('user_id', '=', userId)
        .execute();
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
