import { Router, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { getAllIngredients, buildExpirationWeights } from '../services/ingredientService';
import {
  recommendRecipes,
  saveRecipeHistory,
  completeRecipe,
  calculateGreenPoints,
} from '../services/recipeService';
import { query, randomUUID } from '../db';
import { RecipeRecommendRequest } from '../types';

const router = Router();

// POST /api/recipes/recommend
router.post('/recommend', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;

    // Get user's ingredients
    const ingredients = await getAllIngredients(userId);

    if (ingredients.length === 0) {
      res.json({
        recipes: [],
        message: '냉장고에 재료를 먼저 추가해주세요.',
      });
      return;
    }

    // Build expiration weights
    const expirationWeights = buildExpirationWeights(ingredients);

    // Get user preferences
    const userResult = await query('SELECT preferences FROM users WHERE id = $1', [userId]);
    let rawPrefs = userResult.rows[0]?.preferences;
    if (typeof rawPrefs === 'string') {
      try { rawPrefs = JSON.parse(rawPrefs); } catch { rawPrefs = {}; }
    }
    const userPrefs = rawPrefs?.cuisine_weights || {
      Korean: 1.0,
      Japanese: 0.8,
      Chinese: 0.8,
      Western: 0.7,
    };

    const {
      filters,
      count = 3,
      custom_ingredients,
    } = req.body as RecipeRecommendRequest & { custom_ingredients?: string[] };

    const ingredientNames = custom_ingredients || ingredients.map((i) => i.name);

    const recommendRequest: RecipeRecommendRequest = {
      ingredients: ingredientNames,
      expiration_weights: expirationWeights,
      filters,
      count,
    };

    const recipes = await recommendRecipes(userId, recommendRequest, userPrefs);

    res.json({ recipes });
  } catch (error) {
    console.error('Recipe recommend error:', error);
    res.status(500).json({ error: '레시피 추천 중 오류가 발생했습니다.' });
  }
});

// POST /api/recipes/save
router.post('/save', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const { recipe } = req.body;

    if (!recipe) {
      res.status(400).json({ error: '레시피 데이터가 필요합니다.' });
      return;
    }

    const historyId = await saveRecipeHistory(userId, recipe);
    res.status(201).json({ id: historyId, message: '레시피가 저장되었습니다.' });
  } catch (error) {
    console.error('Save recipe error:', error);
    res.status(500).json({ error: '레시피 저장 중 오류가 발생했습니다.' });
  }
});

// POST /api/recipes/:id/complete
router.post('/:id/complete', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;
    const { used_ingredients } = req.body as { used_ingredients?: Array<{ name: string; urgency: number }> };

    const success = await completeRecipe(id, userId);

    if (!success) {
      res.status(404).json({ error: '레시피를 찾을 수 없습니다.' });
      return;
    }

    // Award green points
    let totalPoints = 0;
    if (used_ingredients && used_ingredients.length > 0) {
      for (const ing of used_ingredients) {
        const points = calculateGreenPoints(ing.name, ing.urgency);
        totalPoints += points;

        await query(
          `INSERT INTO green_points (id, user_id, ingredient_name, points_earned, reason)
           VALUES ($1, $2, $3, $4, $5)`,
          [randomUUID(), userId, ing.name, points, `레시피 완성: ${ing.name} 사용`]
        );
      }
    }

    res.json({
      success: true,
      message: '레시피를 완성했습니다!',
      green_points_earned: Math.round(totalPoints * 10) / 10,
    });
  } catch (error) {
    console.error('Complete recipe error:', error);
    res.status(500).json({ error: '레시피 완성 처리 중 오류가 발생했습니다.' });
  }
});

// GET /api/recipes/history
router.get('/history', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const result = await query(
      `SELECT id, recipe_data, completed, completed_at, created_at
       FROM recipe_history
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 20`,
      [userId]
    );

    const history = result.rows.map((row) => ({
      ...row,
      recipe_data: typeof row.recipe_data === 'string' ? JSON.parse(row.recipe_data) : row.recipe_data,
    }));
    res.json({ history });
  } catch (error) {
    console.error('Recipe history error:', error);
    res.status(500).json({ error: '레시피 히스토리를 불러오는 중 오류가 발생했습니다.' });
  }
});

// GET /api/recipes/green-points
router.get('/green-points', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;

    const totalResult = await query(
      'SELECT COALESCE(SUM(points_earned), 0) as total FROM green_points WHERE user_id = $1',
      [userId]
    );

    const weeklyResult = await query(
      `SELECT COALESCE(SUM(points_earned), 0) as weekly
       FROM green_points
       WHERE user_id = $1 AND earned_at >= NOW() - INTERVAL '7 days'`,
      [userId]
    );

    const historyResult = await query(
      `SELECT ingredient_name, points_earned, reason, earned_at
       FROM green_points
       WHERE user_id = $1
       ORDER BY earned_at DESC
       LIMIT 10`,
      [userId]
    );

    res.json({
      total_points: parseFloat(totalResult.rows[0].total),
      weekly_points: parseFloat(weeklyResult.rows[0].weekly),
      history: historyResult.rows,
    });
  } catch (error) {
    console.error('Green points error:', error);
    res.status(500).json({ error: '그린포인트를 불러오는 중 오류가 발생했습니다.' });
  }
});

export default router;
