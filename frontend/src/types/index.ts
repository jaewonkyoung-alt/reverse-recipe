export interface User {
  id: string;
  email: string;
  name: string;
  isGuest?: boolean;
  preferences?: UserPreferences;
}

export interface UserPreferences {
  cuisine_weights: {
    Korean: number;
    Japanese: number;
    Chinese: number;
    Western: number;
  };
}

export type IngredientCategory =
  | '채소'
  | '과일'
  | '육류'
  | '해산물'
  | '유제품'
  | '조미료'
  | '소스'
  | '기타';

export interface ExpirationUrgency {
  level: 'red' | 'yellow' | 'green';
  days_remaining: number;
  urgency_score: number;
}

export interface Ingredient {
  id: string;
  user_id: string;
  name: string;
  quantity: number | null;
  unit: string | null;
  category: IngredientCategory;
  expiration_date: string;
  created_at: string;
  urgency?: ExpirationUrgency;
}

export interface RecipeIngredient {
  name: string;
  quantity: string;
  unit: string;
}

export interface RecipeStep {
  step_number: number;
  instruction: string;
  time_seconds: number | null;
}

export interface Recipe {
  id?: string;
  recipe_title: string;
  cuisine_type: 'Korean' | 'Japanese' | 'Chinese' | 'Western';
  recipe_type: 'Main' | 'Side' | 'Soup' | 'Snack' | 'Dessert';
  difficulty: 'Easy' | 'Medium' | 'Hard';
  estimated_total_time_minutes: number;
  ingredient_list: RecipeIngredient[];
  missing_ingredients: string[];
  steps: RecipeStep[];
  match_score: number;
  recommendation_score?: number;
}

export interface ShoppingItem {
  id: string;
  user_id: string;
  ingredient_name: string;
  quantity: number | null;
  unit: string | null;
  recipe_title: string | null;
  is_purchased: boolean;
  created_at: string;
  purchased_at?: string; // ISO timestamp set when marked purchased
}

export interface CookingSession {
  recipe: Recipe;
  completedSteps: number[];
  activeStep: number | null;
  startedAt: string;
}

export interface GreenPointData {
  total_points: number;
  weekly_points: number;
  history: Array<{
    ingredient_name: string;
    points_earned: number;
    reason: string;
    earned_at: string;
  }>;
}

export interface PlatformOption {
  platform: 'coupang' | 'naver' | 'kurly';
  name: string;
  price: number;
  url: string;
  thumbnail_url?: string;
}

export interface ShoppingSearchResult {
  ingredient: string;
  options: PlatformOption[];
}

export type RecipeFilter = {
  cuisine: string;
  type: string;
  difficulty: string;
};

export const CUISINE_LABELS: Record<string, string> = {
  Korean: '한식',
  Japanese: '일식',
  Chinese: '중식',
  Western: '양식',
};

export const TYPE_LABELS: Record<string, string> = {
  Main: '메인',
  Side: '반찬',
  Soup: '수프',
  Snack: '간식',
  Dessert: '디저트',
};

export const DIFFICULTY_LABELS: Record<string, string> = {
  Easy: '초급',
  Medium: '중급',
  Hard: '고급',
};

export const CATEGORY_COLORS: Record<IngredientCategory, string> = {
  채소: 'bg-green-100 text-green-700',
  과일: 'bg-orange-100 text-orange-700',
  육류: 'bg-red-100 text-red-700',
  해산물: 'bg-blue-100 text-blue-700',
  유제품: 'bg-yellow-100 text-yellow-700',
  조미료: 'bg-purple-100 text-purple-700',
  소스: 'bg-pink-100 text-pink-700',
  기타: 'bg-gray-100 text-gray-700',
};
