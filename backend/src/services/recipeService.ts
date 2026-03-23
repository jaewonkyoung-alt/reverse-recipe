import axios from 'axios';
import { query } from '../db';
import { Recipe, RecipeRecommendRequest, DISPOSAL_SCORES, ENERGY_SCORES } from '../types';
import crypto from 'crypto';

const PERPLEXITY_API_URL = 'https://api.perplexity.ai/chat/completions';
const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY || '';

function buildPerplexityPrompt(req: RecipeRecommendRequest): string {
  const ingredientList = req.ingredients.join(', ');
  const weightsStr = JSON.stringify(req.expiration_weights, null, 2);
  const filters = req.filters || {};
  const count = req.count || 3;

  return `You are a professional chef AI assistant. The user has the following ingredients available:
${ingredientList}

Expiration priority (higher = must use soon):
${weightsStr}

${filters.cuisine ? `Preferred cuisine: ${filters.cuisine}` : ''}
${filters.type ? `Preferred meal type: ${filters.type}` : ''}
${filters.difficulty ? `Preferred difficulty: ${filters.difficulty}` : ''}

Please recommend exactly ${count} recipes using these ingredients.

For each recipe, return a JSON object with:
- recipe_title (string, in Korean)
- cuisine_type (Korean / Japanese / Chinese / Western)
- recipe_type (Main / Side / Soup / Snack / Dessert)
- difficulty (Easy / Medium / Hard)
- estimated_total_time_minutes (integer)
- ingredient_list: array of { name (Korean), quantity (string), unit (string) }
- missing_ingredients: array of ingredient names NOT in user's list
- steps: array of { step_number, instruction (Korean), time_seconds (null if no timer needed) }
- match_score (0.0 ~ 1.0, based on how many ingredients match)

Priority rule: Recipes that use more high-urgency expiring ingredients should rank higher.
Output ONLY valid JSON array. No prose, no markdown. Example format:
[{"recipe_title":"...", ...}, ...]`;
}

// ─── Dynamic Mock Recipe Pool ────────────────────────────────────────────────
type MockTemplate = Omit<Recipe, 'missing_ingredients' | 'match_score' | 'recommendation_score'>;

const MOCK_RECIPE_POOL: MockTemplate[] = [
  {
    recipe_title: '베이컨 계란 볶음밥',
    cuisine_type: 'Western',
    recipe_type: 'Main',
    difficulty: 'Easy',
    estimated_total_time_minutes: 15,
    ingredient_list: [
      { name: '베이컨', quantity: '3', unit: '줄' },
      { name: '계란', quantity: '2', unit: '개' },
      { name: '밥', quantity: '1', unit: '공기' },
      { name: '간장', quantity: '1', unit: '큰술' },
      { name: '대파', quantity: '0.5', unit: '뿌리' },
    ],
    steps: [
      { step_number: 1, instruction: '베이컨을 2cm 크기로 잘라주세요.', time_seconds: null },
      { step_number: 2, instruction: '팬에 베이컨을 기름 없이 바삭하게 볶아주세요.', time_seconds: 120 },
      { step_number: 3, instruction: '계란 2개를 넣고 스크램블해주세요.', time_seconds: 60 },
      { step_number: 4, instruction: '밥 1공기와 간장 1큰술을 추가해 볶아주세요.', time_seconds: 180 },
      { step_number: 5, instruction: '대파를 송송 썰어 넣고 마무리해주세요.', time_seconds: 30 },
    ],
  },
  {
    recipe_title: '참치 마요 덮밥',
    cuisine_type: 'Japanese',
    recipe_type: 'Main',
    difficulty: 'Easy',
    estimated_total_time_minutes: 10,
    ingredient_list: [
      { name: '참치캔', quantity: '1', unit: '캔' },
      { name: '마요네즈', quantity: '2', unit: '큰술' },
      { name: '밥', quantity: '1', unit: '공기' },
      { name: '간장', quantity: '0.5', unit: '큰술' },
    ],
    steps: [
      { step_number: 1, instruction: '참치캔의 기름을 완전히 빼주세요.', time_seconds: null },
      { step_number: 2, instruction: '참치에 마요네즈 2큰술, 간장 0.5큰술을 넣고 잘 섞어주세요.', time_seconds: null },
      { step_number: 3, instruction: '밥 위에 참치 마요를 올려 완성해주세요.', time_seconds: null },
    ],
  },
  {
    recipe_title: '시금치 된장국',
    cuisine_type: 'Korean',
    recipe_type: 'Soup',
    difficulty: 'Easy',
    estimated_total_time_minutes: 15,
    ingredient_list: [
      { name: '시금치', quantity: '100', unit: 'g' },
      { name: '된장', quantity: '1.5', unit: '큰술' },
      { name: '두부', quantity: '0.5', unit: '모' },
      { name: '마늘', quantity: '2', unit: '쪽' },
    ],
    steps: [
      { step_number: 1, instruction: '시금치 100g을 깨끗이 씻어 3cm 길이로 썰어주세요.', time_seconds: null },
      { step_number: 2, instruction: '두부 반 모를 깍둑썰기 해주세요.', time_seconds: null },
      { step_number: 3, instruction: '물 600ml에 된장 1.5큰술을 풀고 끓여주세요.', time_seconds: 300 },
      { step_number: 4, instruction: '두부와 마늘 2쪽을 넣고 5분간 끓여주세요.', time_seconds: 300 },
      { step_number: 5, instruction: '시금치를 넣고 1분 더 끓여 완성해주세요.', time_seconds: 60 },
    ],
  },
  {
    recipe_title: '데리야끼 닭볶음',
    cuisine_type: 'Japanese',
    recipe_type: 'Main',
    difficulty: 'Easy',
    estimated_total_time_minutes: 25,
    ingredient_list: [
      { name: '데리야끼소스', quantity: '3', unit: '큰술' },
      { name: '닭고기', quantity: '300', unit: 'g' },
      { name: '마늘', quantity: '3', unit: '쪽' },
      { name: '식용유', quantity: '1', unit: '큰술' },
    ],
    steps: [
      { step_number: 1, instruction: '닭고기 300g을 한 입 크기로 잘라주세요.', time_seconds: null },
      { step_number: 2, instruction: '식용유 1큰술을 두른 팬에 마늘 3쪽과 닭고기를 볶아주세요.', time_seconds: 300 },
      { step_number: 3, instruction: '닭이 익으면 데리야끼소스 3큰술을 넣고 졸여주세요.', time_seconds: 180 },
    ],
  },
  {
    recipe_title: '블루베리 요거트 볼',
    cuisine_type: 'Western',
    recipe_type: 'Dessert',
    difficulty: 'Easy',
    estimated_total_time_minutes: 5,
    ingredient_list: [
      { name: '블루베리', quantity: '80', unit: 'g' },
      { name: '요거트', quantity: '150', unit: 'g' },
      { name: '꿀', quantity: '1', unit: '큰술' },
      { name: '그래놀라', quantity: '30', unit: 'g' },
    ],
    steps: [
      { step_number: 1, instruction: '그릇에 요거트 150g을 담아주세요.', time_seconds: null },
      { step_number: 2, instruction: '블루베리 80g을 올려주세요.', time_seconds: null },
      { step_number: 3, instruction: '꿀 1큰술, 그래놀라 30g을 뿌려 완성해주세요.', time_seconds: null },
    ],
  },
  {
    recipe_title: '수박 화채',
    cuisine_type: 'Korean',
    recipe_type: 'Dessert',
    difficulty: 'Easy',
    estimated_total_time_minutes: 10,
    ingredient_list: [
      { name: '수박', quantity: '300', unit: 'g' },
      { name: '사이다', quantity: '200', unit: 'ml' },
      { name: '꿀', quantity: '1', unit: '큰술' },
    ],
    steps: [
      { step_number: 1, instruction: '수박 300g을 깍둑썰기해주세요.', time_seconds: null },
      { step_number: 2, instruction: '그릇에 수박을 담고 꿀 1큰술을 뿌려주세요.', time_seconds: null },
      { step_number: 3, instruction: '사이다 200ml를 부어 완성해주세요.', time_seconds: null },
    ],
  },
  {
    recipe_title: '두부 조림',
    cuisine_type: 'Korean',
    recipe_type: 'Side',
    difficulty: 'Easy',
    estimated_total_time_minutes: 20,
    ingredient_list: [
      { name: '두부', quantity: '1', unit: '모' },
      { name: '간장', quantity: '2', unit: '큰술' },
      { name: '고추장', quantity: '1', unit: '큰술' },
      { name: '마늘', quantity: '3', unit: '쪽' },
      { name: '참기름', quantity: '1', unit: '큰술' },
    ],
    steps: [
      { step_number: 1, instruction: '두부 1모를 1cm 두께로 잘라주세요.', time_seconds: null },
      { step_number: 2, instruction: '팬에 기름을 두르고 두부를 앞뒤로 노릇하게 구워주세요.', time_seconds: 300 },
      { step_number: 3, instruction: '간장 2큰술, 고추장 1큰술, 마늘 3쪽 다진 것으로 소스를 만들어주세요.', time_seconds: null },
      { step_number: 4, instruction: '소스를 두부에 부어 중불에서 3분간 졸여주세요.', time_seconds: 180 },
      { step_number: 5, instruction: '참기름 1큰술을 뿌려 마무리해주세요.', time_seconds: null },
    ],
  },
  {
    recipe_title: '감자 간장 조림',
    cuisine_type: 'Korean',
    recipe_type: 'Side',
    difficulty: 'Easy',
    estimated_total_time_minutes: 25,
    ingredient_list: [
      { name: '감자', quantity: '3', unit: '개' },
      { name: '간장', quantity: '3', unit: '큰술' },
      { name: '설탕', quantity: '1', unit: '큰술' },
      { name: '참기름', quantity: '1', unit: '작은술' },
    ],
    steps: [
      { step_number: 1, instruction: '감자 3개를 한 입 크기로 깍둑썰기 해주세요.', time_seconds: null },
      { step_number: 2, instruction: '팬에 감자, 간장 3큰술, 설탕 1큰술, 물 200ml를 넣어주세요.', time_seconds: null },
      { step_number: 3, instruction: '뚜껑을 덮고 중불에서 15분간 끓여주세요.', time_seconds: 900 },
      { step_number: 4, instruction: '뚜껑을 열고 양념을 졸인 후 참기름 1작은술로 마무리해주세요.', time_seconds: 300 },
    ],
  },
  {
    recipe_title: '토마토 계란 볶음',
    cuisine_type: 'Chinese',
    recipe_type: 'Side',
    difficulty: 'Easy',
    estimated_total_time_minutes: 10,
    ingredient_list: [
      { name: '토마토', quantity: '2', unit: '개' },
      { name: '계란', quantity: '3', unit: '개' },
      { name: '소금', quantity: '0.5', unit: '작은술' },
      { name: '설탕', quantity: '1', unit: '작은술' },
    ],
    steps: [
      { step_number: 1, instruction: '토마토 2개를 큼직하게 잘라주세요.', time_seconds: null },
      { step_number: 2, instruction: '계란 3개를 풀고 소금 0.5작은술을 넣어주세요.', time_seconds: null },
      { step_number: 3, instruction: '팬에 계란을 볶아 꺼내주세요.', time_seconds: 60 },
      { step_number: 4, instruction: '같은 팬에 토마토를 볶고 계란과 설탕 1작은술을 넣어 버무려주세요.', time_seconds: 120 },
    ],
  },
  {
    recipe_title: '계란 볶음밥',
    cuisine_type: 'Korean',
    recipe_type: 'Main',
    difficulty: 'Easy',
    estimated_total_time_minutes: 15,
    ingredient_list: [
      { name: '계란', quantity: '2', unit: '개' },
      { name: '밥', quantity: '1', unit: '공기' },
      { name: '양파', quantity: '0.5', unit: '개' },
      { name: '간장', quantity: '1', unit: '큰술' },
      { name: '참기름', quantity: '1', unit: '작은술' },
    ],
    steps: [
      { step_number: 1, instruction: '양파 반 개를 잘게 다져주세요.', time_seconds: null },
      { step_number: 2, instruction: '팬에 식용유를 두르고 양파를 중불에서 볶아주세요.', time_seconds: 120 },
      { step_number: 3, instruction: '계란 2개를 넣고 스크램블 해주세요.', time_seconds: 60 },
      { step_number: 4, instruction: '밥 1공기와 간장 1큰술을 넣어 함께 볶아주세요.', time_seconds: 180 },
      { step_number: 5, instruction: '참기름 1작은술을 넣고 마무리해주세요.', time_seconds: 30 },
    ],
  },
  {
    recipe_title: '양파 수프',
    cuisine_type: 'Western',
    recipe_type: 'Soup',
    difficulty: 'Medium',
    estimated_total_time_minutes: 40,
    ingredient_list: [
      { name: '양파', quantity: '3', unit: '개' },
      { name: '버터', quantity: '30', unit: 'g' },
      { name: '치즈', quantity: '50', unit: 'g' },
      { name: '육수', quantity: '500', unit: 'ml' },
      { name: '바게트', quantity: '2', unit: '조각' },
    ],
    steps: [
      { step_number: 1, instruction: '양파 3개를 얇게 슬라이스 해주세요.', time_seconds: null },
      { step_number: 2, instruction: '냄비에 버터 30g을 녹이고 양파를 약불에서 30분간 볶아주세요.', time_seconds: 1800 },
      { step_number: 3, instruction: '육수 500ml를 붓고 10분간 끓여주세요.', time_seconds: 600 },
      { step_number: 4, instruction: '바게트에 치즈 50g을 올리고 그라탱해 수프 위에 올려주세요.', time_seconds: 300 },
    ],
  },
];

function getMockRecipes(userIngredients: string[] = []): Recipe[] {
  const has = (name: string) =>
    userIngredients.some((i) => i.includes(name) || name.includes(i) || i === name);

  const scored = MOCK_RECIPE_POOL.map((r) => {
    const matchCount = r.ingredient_list.filter((i) => has(i.name)).length;
    const total = r.ingredient_list.length;
    const match_score = total > 0 ? Math.round((matchCount / total) * 100) / 100 : 0;
    const missing_ingredients = r.ingredient_list.filter((i) => !has(i.name)).map((i) => i.name);
    return { ...r, match_score, missing_ingredients } as Recipe;
  });

  scored.sort((a, b) => (b.match_score || 0) - (a.match_score || 0));

  // Prefer variety of recipe_types
  const picked: Recipe[] = [];
  const seenTypes = new Set<string>();
  for (const r of scored) {
    if (picked.length >= 3) break;
    if (!seenTypes.has(r.recipe_type)) { seenTypes.add(r.recipe_type); picked.push(r); }
  }
  for (const r of scored) {
    if (picked.length >= 3) break;
    if (!picked.includes(r)) picked.push(r);
  }
  return picked.slice(0, 3);
}

export function calculateRecommendationScore(
  recipe: Recipe,
  expirationWeights: Record<string, number>,
  userPreferences: Record<string, number>
): number {
  // Expiration urgency score
  let urgencySum = 0;
  let urgencyCount = 0;
  for (const ing of recipe.ingredient_list) {
    if (expirationWeights[ing.name] !== undefined) {
      urgencySum += expirationWeights[ing.name];
      urgencyCount++;
    }
  }
  const expiration_urgency = urgencyCount > 0 ? urgencySum / urgencyCount : 0;

  // Ingredient match ratio
  const ingredient_match_ratio = recipe.match_score;

  // User preference
  const cuisineKey = recipe.cuisine_type;
  const user_preference = userPreferences[cuisineKey] || 0.5;

  // Combined score
  const score =
    expiration_urgency * 0.5 +
    ingredient_match_ratio * 0.4 +
    user_preference * 0.1;

  return Math.min(1.0, score);
}

export function calculateGreenPoints(
  ingredientName: string,
  expirationUrgency: number
): number {
  const disposalScore = DISPOSAL_SCORES[ingredientName] || DISPOSAL_SCORES['default'];
  const energyScore = ENERGY_SCORES[ingredientName] || ENERGY_SCORES['default'];

  const basePoints = disposalScore * 0.5 + energyScore * 0.5;
  const urgencyMultiplier = expirationUrgency >= 0.8 ? 2.0 : expirationUrgency >= 0.5 ? 1.5 : 1.0;

  return Math.round(basePoints * urgencyMultiplier * 10) / 10;
}

async function callPerplexityAPIWithIngredients(prompt: string, userIngredients: string[]): Promise<Recipe[]> {
  if (!PERPLEXITY_API_KEY) {
    return getMockRecipes(userIngredients);
  }
  try {
    const response = await axios.post(
      PERPLEXITY_API_URL,
      {
        model: 'sonar-pro',
        messages: [
          { role: 'system', content: 'You are a professional chef AI. Always respond with valid JSON only, no markdown, no prose.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.3,
        max_tokens: 4000,
      },
      {
        headers: { Authorization: `Bearer ${PERPLEXITY_API_KEY}`, 'Content-Type': 'application/json' },
        timeout: 30000,
      }
    );
    const content = response.data.choices[0]?.message?.content || '[]';
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error('No JSON array found in response');
    const recipes = JSON.parse(jsonMatch[0]) as Recipe[];
    // Recompute missing_ingredients based on actual user ingredients
    return recipes.map((r) => {
      const has = (name: string) => userIngredients.some((i) => i.includes(name) || name.includes(i) || i === name);
      const matchCount = r.ingredient_list.filter((i) => has(i.name)).length;
      const total = r.ingredient_list.length;
      return {
        ...r,
        match_score: total > 0 ? Math.round((matchCount / total) * 100) / 100 : 0,
        missing_ingredients: r.ingredient_list.filter((i) => !has(i.name)).map((i) => i.name),
      };
    });
  } catch (error) {
    console.error('Perplexity API error, using mock data:', error);
    return getMockRecipes(userIngredients);
  }
}

export async function recommendRecipes(
  userId: string,
  req: RecipeRecommendRequest,
  userPreferences: Record<string, number>
): Promise<Recipe[]> {
  let recipes: Recipe[];

  if (PERPLEXITY_API_KEY) {
    // Use cache only when real API is available
    const cacheKey = crypto
      .createHash('md5')
      .update(JSON.stringify({ ingredients: req.ingredients.sort(), filters: req.filters }))
      .digest('hex');

    const cached = await query(
      'SELECT recipe_data FROM recipe_cache WHERE cache_key = $1 AND expires_at > NOW()',
      [cacheKey]
    );

    if (cached.rows.length > 0) {
      recipes = cached.rows[0].recipe_data as Recipe[];
    } else {
      const prompt = buildPerplexityPrompt(req);
      recipes = await callPerplexityAPIWithIngredients(prompt, req.ingredients);
      await query(
        `INSERT INTO recipe_cache (cache_key, recipe_data)
         VALUES ($1, $2)
         ON CONFLICT (cache_key) DO UPDATE SET recipe_data = $2, expires_at = NOW() + INTERVAL '24 hours'`,
        [cacheKey, JSON.stringify(recipes)]
      );
    }
  } else {
    // No API key — always fresh mock based on current ingredients (no caching)
    recipes = getMockRecipes(req.ingredients);
  }

  const scoredRecipes = recipes.map((recipe) => ({
    ...recipe,
    recommendation_score: calculateRecommendationScore(recipe, req.expiration_weights, userPreferences),
  }));

  scoredRecipes.sort((a, b) => (b.recommendation_score || 0) - (a.recommendation_score || 0));
  return scoredRecipes;
}

export async function saveRecipeHistory(userId: string, recipe: Recipe): Promise<string> {
  const result = await query(
    'INSERT INTO recipe_history (user_id, recipe_data) VALUES ($1, $2) RETURNING id',
    [userId, JSON.stringify(recipe)]
  );
  return result.rows[0].id;
}

export async function completeRecipe(historyId: string, userId: string): Promise<boolean> {
  const result = await query(
    `UPDATE recipe_history
     SET completed = TRUE, completed_at = NOW()
     WHERE id = $1 AND user_id = $2
     RETURNING recipe_data`,
    [historyId, userId]
  );
  return (result.rowCount || 0) > 0;
}
