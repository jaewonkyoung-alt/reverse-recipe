import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, Ingredient, Recipe, ShoppingItem, GreenPointData, CookingSession } from '../types';

interface AppState {
  // Auth
  user: User | null;
  accessToken: string | null;
  setUser: (user: User | null, token: string | null) => void;
  logout: () => void;

  // Ingredients (Fridge)
  ingredients: Ingredient[];
  setIngredients: (ingredients: Ingredient[]) => void;
  addIngredient: (ingredient: Ingredient) => void;
  updateIngredient: (id: string, ingredient: Ingredient) => void;
  removeIngredient: (id: string) => void;

  // Recipes
  recommendedRecipes: Recipe[];
  selectedRecipe: Recipe | null;
  recipeFilters: { cuisine: string; type: string; difficulty: string };
  isLoadingRecipes: boolean;
  setRecommendedRecipes: (recipes: Recipe[]) => void;
  setSelectedRecipe: (recipe: Recipe | null) => void;
  setRecipeFilters: (filters: { cuisine: string; type: string; difficulty: string }) => void;
  setIsLoadingRecipes: (loading: boolean) => void;

  // Saved Recipes
  savedRecipes: Recipe[];
  addSavedRecipe: (recipe: Recipe) => void;
  removeSavedRecipe: (title: string) => void;

  // Cooking Session (persistent, survives navigation)
  cookingSession: CookingSession | null;
  startCooking: (recipe: Recipe) => void;
  updateCookingProgress: (completedSteps: number[], activeStep: number | null) => void;
  clearCookingSession: () => void;

  // Auto-recommend with expiring ingredients
  autoRecommendExpiring: boolean;
  setAutoRecommendExpiring: (v: boolean) => void;

  // Post-cooking notification (transient, not persisted)
  cookingJustCompleted: { points: number } | null;
  setCookingJustCompleted: (data: { points: number } | null) => void;

  // Shopping List
  shoppingItems: ShoppingItem[];
  setShoppingItems: (items: ShoppingItem[]) => void;
  addShoppingItem: (item: ShoppingItem) => void;
  removeShoppingItem: (id: string) => void;
  markItemPurchased: (id: string) => void;
  purgeOldPurchased: () => void; // remove items purchased > 7 days ago

  // Green Points
  greenPoints: GreenPointData | null;
  setGreenPoints: (data: GreenPointData) => void;

  // UI State
  activeTab: string;
  setActiveTab: (tab: string) => void;

  // Theme
  darkMode: boolean;
  toggleDarkMode: () => void;
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      // Auth
      user: null,
      accessToken: null,
      setUser: (user, accessToken) => {
        if (accessToken) localStorage.setItem('accessToken', accessToken);
        set({ user, accessToken });
      },
      logout: () => {
        localStorage.removeItem('accessToken');
        set({ user: null, accessToken: null, ingredients: [], recommendedRecipes: [] });
      },

      // Ingredients
      ingredients: [],
      setIngredients: (ingredients) => set({ ingredients }),
      addIngredient: (ingredient) =>
        set((state) => ({ ingredients: [...state.ingredients, ingredient] })),
      updateIngredient: (id, ingredient) =>
        set((state) => ({
          ingredients: state.ingredients.map((i) => (i.id === id ? ingredient : i)),
        })),
      removeIngredient: (id) =>
        set((state) => ({
          ingredients: state.ingredients.filter((i) => i.id !== id),
        })),

      // Recipes
      recommendedRecipes: [],
      selectedRecipe: null,
      recipeFilters: { cuisine: '전체', type: '전체', difficulty: '전체' },
      isLoadingRecipes: false,
      setRecommendedRecipes: (recipes) => set({ recommendedRecipes: recipes }),
      setSelectedRecipe: (recipe) => set({ selectedRecipe: recipe }),
      setRecipeFilters: (filters) => set({ recipeFilters: filters }),
      setIsLoadingRecipes: (loading) => set({ isLoadingRecipes: loading }),

      // Saved Recipes
      savedRecipes: [],
      addSavedRecipe: (recipe) =>
        set((state) => ({
          savedRecipes: state.savedRecipes.some((r) => r.recipe_title === recipe.recipe_title)
            ? state.savedRecipes
            : [recipe, ...state.savedRecipes],
        })),
      removeSavedRecipe: (title) =>
        set((state) => ({
          savedRecipes: state.savedRecipes.filter((r) => r.recipe_title !== title),
        })),

      // Cooking Session
      cookingSession: null,
      startCooking: (recipe) =>
        set({
          cookingSession: {
            recipe,
            completedSteps: [],
            activeStep: 1,
            startedAt: new Date().toISOString(),
          },
        }),
      updateCookingProgress: (completedSteps, activeStep) =>
        set((state) =>
          state.cookingSession
            ? { cookingSession: { ...state.cookingSession, completedSteps, activeStep } }
            : {}
        ),
      clearCookingSession: () => set({ cookingSession: null }),

      // Auto-recommend with expiring
      autoRecommendExpiring: false,
      setAutoRecommendExpiring: (v) => set({ autoRecommendExpiring: v }),

      // Post-cooking notification
      cookingJustCompleted: null,
      setCookingJustCompleted: (data) => set({ cookingJustCompleted: data }),

      // Shopping
      shoppingItems: [],
      setShoppingItems: (items) => set({ shoppingItems: items }),
      addShoppingItem: (item) =>
        set((state) => ({ shoppingItems: [...state.shoppingItems, item] })),
      removeShoppingItem: (id) =>
        set((state) => ({
          shoppingItems: state.shoppingItems.filter((i) => i.id !== id),
        })),
      markItemPurchased: (id) =>
        set((state) => ({
          shoppingItems: state.shoppingItems.map((i) =>
            i.id === id ? { ...i, is_purchased: true, purchased_at: new Date().toISOString() } : i
          ),
        })),
      purgeOldPurchased: () =>
        set((state) => ({
          shoppingItems: state.shoppingItems.filter((item) => {
            if (!item.is_purchased || !item.purchased_at) return true;
            return Date.now() - new Date(item.purchased_at).getTime() < SEVEN_DAYS_MS;
          }),
        })),

      // Green Points
      greenPoints: null,
      setGreenPoints: (data) => set({ greenPoints: data }),

      // UI
      activeTab: 'home',
      setActiveTab: (tab) => set({ activeTab: tab }),

      // Theme
      darkMode: false,
      toggleDarkMode: () => set((state) => ({ darkMode: !state.darkMode })),
    }),
    {
      name: 'reverse-recipe-storage',
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        ingredients: state.ingredients,
        savedRecipes: state.savedRecipes,
        darkMode: state.darkMode,
        cookingSession: state.cookingSession,
        shoppingItems: state.shoppingItems,
      }),
    }
  )
);
