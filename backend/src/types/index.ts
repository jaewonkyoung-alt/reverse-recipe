export interface User {
  id: string;
  email: string;
  name: string;
  password_hash?: string;
  kakao_id?: string;
  preferences: UserPreferences;
  created_at: Date;
}

export interface UserPreferences {
  cuisine_weights: {
    Korean: number;
    Japanese: number;
    Chinese: number;
    Western: number;
  };
}

export interface Ingredient {
  id: string;
  user_id: string;
  name: string;
  quantity: number;
  unit: string;
  category: IngredientCategory;
  expiration_date: Date;
  created_at: Date;
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

export interface RecipeRecommendRequest {
  ingredients: string[];
  expiration_weights: Record<string, number>;
  filters?: {
    cuisine?: string;
    type?: string;
    difficulty?: string;
  };
  count?: number;
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

export interface GreenPoint {
  id: string;
  user_id: string;
  ingredient_name: string;
  points_earned: number;
  reason: string;
  earned_at: Date;
}

export interface ShoppingItem {
  ingredient_name: string;
  recipe_title: string;
  quantity?: string;
  unit?: string;
  platform_options?: PlatformOption[];
}

export interface PlatformOption {
  platform: 'coupang' | 'naver' | 'kurly';
  name: string;
  price: number;
  url: string;
  thumbnail_url?: string;
}

export interface PurchaseImport {
  id: string;
  user_id: string;
  platform: 'coupang' | 'naver' | 'kurly';
  raw_product_name: string;
  parsed_ingredient: string;
  quantity: number;
  unit: string;
  imported_at: Date;
}

export interface AuthPayload {
  userId: string;
  email: string;
}

export interface ExpirationUrgency {
  level: 'red' | 'yellow' | 'green';
  days_remaining: number;
  urgency_score: number;
}

// Disposal & Energy scores for Green Points
export const DISPOSAL_SCORES: Record<string, number> = {
  생선: 9.0,
  고기: 8.5,
  소고기: 8.5,
  돼지고기: 8.0,
  닭고기: 7.0,
  배추: 7.0,
  아보카도: 8.0,
  계란: 3.0,
  양파: 4.0,
  감자: 3.5,
  당근: 3.0,
  브로콜리: 4.0,
  시금치: 4.0,
  두부: 5.0,
  새우: 8.5,
  오징어: 8.0,
  default: 4.0,
};

export const ENERGY_SCORES: Record<string, number> = {
  아보카도: 9.5,
  소고기: 9.0,
  새우: 8.0,
  돼지고기: 7.0,
  닭고기: 5.0,
  연어: 6.0,
  채소: 2.0,
  채소류: 2.0,
  당근: 1.5,
  양파: 1.5,
  감자: 2.0,
  계란: 3.5,
  두부: 2.5,
  default: 3.0,
};

export const EXPIRATION_DAYS: Record<IngredientCategory, number> = {
  육류: 3,
  해산물: 3,
  채소: 7,
  과일: 7,
  유제품: 10,
  조미료: 180,
  소스: 180,
  기타: 7,
};
