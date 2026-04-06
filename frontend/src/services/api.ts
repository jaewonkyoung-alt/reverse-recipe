import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 70000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor — attach JWT token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor — handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('user');
      window.location.href = '/';
    }
    return Promise.reject(error);
  }
);

// ─── AUTH ───────────────────────────────────────────────
export const authAPI = {
  register: (data: { email: string; name: string; password: string }) =>
    api.post('/auth/register', data),

  login: (data: { email: string; password: string }) =>
    api.post('/auth/login', data),

  guestLogin: () =>
    api.post('/auth/guest'),

  kakaoLogin: (kakaoAccessToken: string) =>
    api.post('/auth/kakao', { kakaoAccessToken }),
};

// ─── INGREDIENTS ────────────────────────────────────────
export const ingredientAPI = {
  getAll: () => api.get('/ingredients'),

  getExpiring: (days = 3) => api.get(`/ingredients/expiring?days=${days}`),

  add: (data: {
    name: string;
    quantity?: number;
    unit?: string;
    category: string;
    expiration_date?: string;
  }) => api.post('/ingredients', data),

  update: (
    id: string,
    data: {
      name?: string;
      quantity?: number;
      unit?: string;
      category?: string;
      expiration_date?: string;
    }
  ) => api.put(`/ingredients/${id}`, data),

  delete: (id: string) => api.delete(`/ingredients/${id}`),

  deduct: (ingredients: Array<{ name: string; quantity?: number }>) =>
    api.post('/ingredients/deduct', { ingredients }),
};

// ─── RECIPES ────────────────────────────────────────────
export const recipeAPI = {
  recommend: (filters?: {
    cuisine?: string;
    type?: string;
    difficulty?: string;
  }) => api.post('/recipes/recommend', { filters, count: 3 }),

  save: (recipe: object) => api.post('/recipes/save', { recipe }),

  complete: (
    historyId: string,
    usedIngredients: Array<{ name: string; urgency: number }>
  ) =>
    api.post(`/recipes/${historyId}/complete`, {
      used_ingredients: usedIngredients,
    }),

  getHistory: () => api.get('/recipes/history'),

  getGreenPoints: () => api.get('/recipes/green-points'),
};

// ─── SHOPPING ───────────────────────────────────────────
export const shoppingAPI = {
  getList: () => api.get('/shopping'),

  addItem: (data: {
    ingredient_name: string;
    quantity?: string;
    unit?: string;
    recipe_title?: string;
  }) => api.post('/shopping', data),

  bulkAdd: (
    items: Array<{
      ingredient_name: string;
      quantity?: string;
      unit?: string;
      recipe_title?: string;
    }>
  ) => api.post('/shopping/bulk', { items }),

  markPurchased: (id: string) => api.put(`/shopping/${id}/purchase`),

  removeItem: (id: string) => api.delete(`/shopping/${id}`),

  searchPrices: (ingredients: string[]) =>
    api.post('/shopping/search', { ingredients }),
};

export default api;
