import { Router, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { query } from '../db';
import axios from 'axios';

const router = Router();

// GET /api/shopping
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const result = await query(
      `SELECT * FROM shopping_list
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId]
    );
    res.json({ items: result.rows });
  } catch (error) {
    console.error('Get shopping list error:', error);
    res.status(500).json({ error: '쇼핑 리스트를 불러오는 중 오류가 발생했습니다.' });
  }
});

// POST /api/shopping
router.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const { ingredient_name, quantity, unit, recipe_title } = req.body;

    if (!ingredient_name) {
      res.status(400).json({ error: '재료 이름이 필요합니다.' });
      return;
    }

    // Check if already in list
    const existing = await query(
      'SELECT id FROM shopping_list WHERE user_id = $1 AND ingredient_name = $2 AND is_purchased = FALSE',
      [userId, ingredient_name]
    );

    if (existing.rows.length > 0) {
      res.status(409).json({ error: '이미 쇼핑 리스트에 있는 재료입니다.' });
      return;
    }

    const result = await query(
      `INSERT INTO shopping_list (user_id, ingredient_name, quantity, unit, recipe_title)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [userId, ingredient_name, quantity || null, unit || null, recipe_title || null]
    );

    res.status(201).json({ item: result.rows[0] });
  } catch (error) {
    console.error('Add shopping item error:', error);
    res.status(500).json({ error: '쇼핑 리스트 추가 중 오류가 발생했습니다.' });
  }
});

// POST /api/shopping/bulk
router.post('/bulk', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const { items } = req.body as {
      items: Array<{ ingredient_name: string; quantity?: string; unit?: string; recipe_title?: string }>;
    };

    if (!items || items.length === 0) {
      res.status(400).json({ error: '추가할 재료가 없습니다.' });
      return;
    }

    const added = [];
    for (const item of items) {
      const existing = await query(
        'SELECT id FROM shopping_list WHERE user_id = $1 AND ingredient_name = $2 AND is_purchased = FALSE',
        [userId, item.ingredient_name]
      );

      if (existing.rows.length === 0) {
        const result = await query(
          `INSERT INTO shopping_list (user_id, ingredient_name, quantity, unit, recipe_title)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING *`,
          [userId, item.ingredient_name, item.quantity || null, item.unit || null, item.recipe_title || null]
        );
        added.push(result.rows[0]);
      }
    }

    res.status(201).json({ added, count: added.length });
  } catch (error) {
    console.error('Bulk add shopping error:', error);
    res.status(500).json({ error: '쇼핑 리스트 일괄 추가 중 오류가 발생했습니다.' });
  }
});

// PUT /api/shopping/:id/purchase
router.put('/:id/purchase', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;

    const result = await query(
      `UPDATE shopping_list
       SET is_purchased = TRUE
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: '쇼핑 리스트 항목을 찾을 수 없습니다.' });
      return;
    }

    res.json({ item: result.rows[0] });
  } catch (error) {
    console.error('Purchase item error:', error);
    res.status(500).json({ error: '구매 완료 처리 중 오류가 발생했습니다.' });
  }
});

// DELETE /api/shopping/:id
router.delete('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;

    await query('DELETE FROM shopping_list WHERE id = $1 AND user_id = $2', [id, userId]);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete shopping item error:', error);
    res.status(500).json({ error: '쇼핑 리스트 삭제 중 오류가 발생했습니다.' });
  }
});

// POST /api/shopping/search — Platform price comparison (Phase 3)
router.post('/search', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { ingredients } = req.body as { ingredients: string[] };

    if (!ingredients || ingredients.length === 0) {
      res.status(400).json({ error: '검색할 재료를 입력해주세요.' });
      return;
    }

    // Deterministic price seeding based on ingredient name hash
    const seededRandom = (seed: string): number => {
      let hash = 2166136261;
      for (let i = 0; i < seed.length; i++) {
        hash ^= seed.charCodeAt(i);
        hash = (hash * 16777619) >>> 0;
      }
      return (hash % 10000) / 10000;
    };

    const results = ingredients.map((ingredient) => ({
      ingredient,
      options: [
        {
          platform: 'coupang',
          name: `${ingredient} (쿠팡)`,
          price: Math.floor(seededRandom(ingredient + '_coupang') * 4000) + 2000,
          url: `https://www.coupang.com/search?q=${encodeURIComponent(ingredient)}`,
          thumbnail_url: null,
        },
        {
          platform: 'naver',
          name: `${ingredient} (네이버쇼핑)`,
          price: Math.floor(seededRandom(ingredient + '_naver') * 3500) + 1800,
          url: `https://search.shopping.naver.com/search/all?query=${encodeURIComponent(ingredient)}`,
          thumbnail_url: null,
        },
        {
          platform: 'kurly',
          name: `${ingredient} (마켓컬리)`,
          price: Math.floor(seededRandom(ingredient + '_kurly') * 4500) + 2500,
          url: `https://www.kurly.com/search?sword=${encodeURIComponent(ingredient)}`,
          thumbnail_url: null,
        },
      ].sort((a, b) => a.price - b.price), // 가격 낮은 순 정렬
    }));

    // Track analytics
    await query(
      `INSERT INTO analytics_events (user_id, event_type, event_data)
       VALUES ($1, 'shopping_search', $2)`,
      [req.user!.userId, JSON.stringify({ ingredients })]
    );

    res.json({ results });
  } catch (error) {
    console.error('Shopping search error:', error);
    res.status(500).json({ error: '가격 비교 검색 중 오류가 발생했습니다.' });
  }
});

export default router;
