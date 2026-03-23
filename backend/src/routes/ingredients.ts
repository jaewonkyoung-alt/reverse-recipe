import { Router, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import {
  getAllIngredients,
  getExpiringIngredients,
  addIngredient,
  updateIngredient,
  deleteIngredient,
  deductIngredients,
  getExpirationUrgency,
} from '../services/ingredientService';
import { IngredientCategory } from '../types';

const router = Router();

// GET /api/ingredients
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const ingredients = await getAllIngredients(userId);

    const enriched = ingredients.map((ing) => ({
      ...ing,
      urgency: getExpirationUrgency(new Date(ing.expiration_date)),
    }));

    res.json({ ingredients: enriched });
  } catch (error) {
    console.error('Get ingredients error:', error);
    res.status(500).json({ error: '재료 목록을 불러오는 중 오류가 발생했습니다.' });
  }
});

// GET /api/ingredients/expiring
router.get('/expiring', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const days = parseInt(req.query.days as string) || 3;
    const ingredients = await getExpiringIngredients(userId, days);

    const enriched = ingredients.map((ing) => ({
      ...ing,
      urgency: getExpirationUrgency(new Date(ing.expiration_date)),
    }));

    res.json({ ingredients: enriched });
  } catch (error) {
    console.error('Get expiring ingredients error:', error);
    res.status(500).json({ error: '만료 임박 재료를 불러오는 중 오류가 발생했습니다.' });
  }
});

// POST /api/ingredients
router.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const { name, quantity, unit, category, expiration_date } = req.body;

    if (!name || !category) {
      res.status(400).json({ error: '재료 이름과 카테고리는 필수입니다.' });
      return;
    }

    const validCategories: IngredientCategory[] = ['채소', '과일', '육류', '해산물', '유제품', '조미료', '소스', '기타'];
    if (!validCategories.includes(category as IngredientCategory)) {
      res.status(400).json({ error: '유효하지 않은 카테고리입니다.' });
      return;
    }

    const ingredient = await addIngredient(userId, {
      name,
      quantity: quantity ? parseFloat(quantity) : undefined,
      unit,
      category: category as IngredientCategory,
      expiration_date: expiration_date ? new Date(expiration_date) : undefined,
    });

    const enriched = {
      ...ingredient,
      urgency: getExpirationUrgency(new Date(ingredient.expiration_date)),
    };

    res.status(201).json({ ingredient: enriched });
  } catch (error) {
    console.error('Add ingredient error:', error);
    res.status(500).json({ error: '재료 추가 중 오류가 발생했습니다.' });
  }
});

// PUT /api/ingredients/:id
router.put('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;
    const { name, quantity, unit, category, expiration_date } = req.body;

    const ingredient = await updateIngredient(id, userId, {
      name,
      quantity: quantity ? parseFloat(quantity) : undefined,
      unit,
      category: category as IngredientCategory,
      expiration_date: expiration_date ? new Date(expiration_date) : undefined,
    });

    if (!ingredient) {
      res.status(404).json({ error: '재료를 찾을 수 없습니다.' });
      return;
    }

    const enriched = {
      ...ingredient,
      urgency: getExpirationUrgency(new Date(ingredient.expiration_date)),
    };

    res.json({ ingredient: enriched });
  } catch (error) {
    console.error('Update ingredient error:', error);
    res.status(500).json({ error: '재료 수정 중 오류가 발생했습니다.' });
  }
});

// POST /api/ingredients/deduct
router.post('/deduct', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const { ingredients: usedIngredients } = req.body;

    if (!Array.isArray(usedIngredients) || usedIngredients.length === 0) {
      res.status(400).json({ error: '재료 목록이 필요합니다.' });
      return;
    }

    await deductIngredients(userId, usedIngredients);
    res.json({ success: true, message: '재료가 차감되었습니다.' });
  } catch (error) {
    console.error('Deduct ingredients error:', error);
    res.status(500).json({ error: '재료 차감 중 오류가 발생했습니다.' });
  }
});

// DELETE /api/ingredients/:id
router.delete('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;

    const deleted = await deleteIngredient(id, userId);

    if (!deleted) {
      res.status(404).json({ error: '재료를 찾을 수 없습니다.' });
      return;
    }

    res.json({ success: true, message: '재료가 삭제되었습니다.' });
  } catch (error) {
    console.error('Delete ingredient error:', error);
    res.status(500).json({ error: '재료 삭제 중 오류가 발생했습니다.' });
  }
});

export default router;
