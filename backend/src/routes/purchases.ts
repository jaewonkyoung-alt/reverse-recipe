/**
 * Phase 3: 구매내역 자동 등록
 * - POST /api/purchases/import/:platform → 플랫폼별 구매내역 불러오기
 * - GET  /api/purchases/history           → 불러온 내역 조회
 */
import { Router, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { query } from '../db';

const router = Router();

// NLP ingredient extraction from product name
function parseIngredientFromProduct(productName: string): {
  name: string;
  quantity: number;
  unit: string;
} | null {
  const rules: Array<{
    pattern: RegExp;
    extract: (match: RegExpMatchArray) => { name: string; quantity: number; unit: string };
  }> = [
    {
      pattern: /(.+?)\s*(\d+(?:\.\d+)?)\s*(g|kg|ml|L|개|팩|봉|묶음|판)/,
      extract: (m) => ({
        name: m[1].trim(),
        quantity: parseFloat(m[2]),
        unit: m[3],
      }),
    },
    {
      pattern: /(.+?)\s*(\d+)개입/,
      extract: (m) => ({
        name: m[1].trim(),
        quantity: parseInt(m[2]),
        unit: '개',
      }),
    },
  ];

  // Known brand → ingredient mappings
  const brandMappings: Record<string, string> = {
    '풀무원 두부': '두부',
    '비비고 왕교자': '냉동만두',
    'CJ 햇반': '즉석밥',
    '오뚜기 진라면': '라면',
    '하림 닭가슴살': '닭가슴살',
    '에그 계란': '계란',
    '서울우유': '우유',
  };

  for (const [brand, ingredient] of Object.entries(brandMappings)) {
    if (productName.includes(brand)) {
      const weightMatch = productName.match(/(\d+(?:\.\d+)?)\s*(g|kg|ml|L)/);
      return {
        name: ingredient,
        quantity: weightMatch ? parseFloat(weightMatch[1]) : 1,
        unit: weightMatch ? weightMatch[2] : '개',
      };
    }
  }

  for (const rule of rules) {
    const match = productName.match(rule.pattern);
    if (match) return rule.extract(match);
  }

  return null;
}

// POST /api/purchases/import/mock — Demo import (no real OAuth needed)
router.post('/import/mock', async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId;
  const { platform = 'coupang' } = req.body;

  // Mock purchase history
  const mockOrders = [
    { raw_product_name: '풀무원 두부 300g 2팩', platform },
    { raw_product_name: '하림 닭가슴살 200g', platform },
    { raw_product_name: '계란 30개입 특란', platform },
    { raw_product_name: '당근 500g', platform },
    { raw_product_name: '서울우유 1L', platform },
    { raw_product_name: '오뚜기 진라면 5개입', platform },
  ];

  const parsed = [];

  for (const order of mockOrders) {
    const ingredient = parseIngredientFromProduct(order.raw_product_name);
    if (!ingredient) continue;

    const result = await query(
      `INSERT INTO purchase_imports (user_id, platform, raw_product_name, parsed_ingredient, quantity, unit)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT DO NOTHING
       RETURNING *`,
      [userId, platform, order.raw_product_name, ingredient.name, ingredient.quantity, ingredient.unit]
    );

    if (result.rows.length > 0) {
      parsed.push({
        raw: order.raw_product_name,
        parsed: ingredient,
      });
    }
  }

  res.json({
    imported: parsed.length,
    items: parsed,
    message: `${parsed.length}개의 재료를 구매내역에서 불러왔습니다.`,
  });
});

// GET /api/purchases/history
router.get('/history', async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId;

  const result = await query(
    `SELECT * FROM purchase_imports WHERE user_id = $1 ORDER BY imported_at DESC LIMIT 50`,
    [userId]
  );

  res.json({ history: result.rows });
});

export default router;
