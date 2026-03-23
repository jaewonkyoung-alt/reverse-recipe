import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '../store';
import { recipeAPI } from '../services/api';
import type { RecipeFilter, Recipe, RecipeIngredient } from '../types';
import RecipeCard from '../components/RecipeCard';
import toast from 'react-hot-toast';

const CUISINE_OPTIONS = ['전체', '한식', '일식', '중식', '양식'];
const TYPE_OPTIONS = ['전체', '메인', '반찬', '수프', '디저트', '간식'];
const DIFFICULTY_OPTIONS = ['전체', '초급', '중급', '고급'];

const CUISINE_MAP: Record<string, string> = {
  한식: 'Korean', 일식: 'Japanese', 중식: 'Chinese', 양식: 'Western',
};
const TYPE_MAP: Record<string, string> = {
  메인: 'Main', 반찬: 'Side', 수프: 'Soup', 디저트: 'Dessert', 간식: 'Snack',
};
const DIFFICULTY_MAP: Record<string, string> = {
  초급: 'Easy', 중급: 'Medium', 고급: 'Hard',
};

export default function RecommendPage() {
  const {
    ingredients,
    recommendedRecipes,
    setRecommendedRecipes,
    recipeFilters,
    setRecipeFilters,
    isLoadingRecipes,
    setIsLoadingRecipes,
    autoRecommendExpiring,
    setAutoRecommendExpiring,
  } = useAppStore();

  const [hasSearched, setHasSearched] = useState(recommendedRecipes.length > 0);
  const [selectedIngredients, setSelectedIngredients] = useState<string[]>([]);
  const [displayOffset, setDisplayOffset] = useState(0);
  const didAutoRecommend = useRef(false);

  useEffect(() => {
    if (autoRecommendExpiring && ingredients.length > 0 && !didAutoRecommend.current) {
      didAutoRecommend.current = true;
      setAutoRecommendExpiring(false);
      handleExpiringRecommend();
    }
  }, [autoRecommendExpiring, ingredients.length]);

  const handleExpiringRecommend = async () => {
    setIsLoadingRecipes(true);
    setHasSearched(true);
    try {
      const res = await recipeAPI.recommend({ cuisine: '', type: '', difficulty: '' });
      setRecommendedRecipes(res.data.recipes);
      const expiringNames = ingredients
        .filter((i) => i.urgency?.level === 'red' || i.urgency?.level === 'yellow')
        .map((i) => i.name)
        .slice(0, 3)
        .join(', ');
      toast.success(`${expiringNames} 활용 레시피 ${res.data.recipes.length}개!`, { duration: 3000 });
    } catch {
      toast.error('레시피 추천 중 오류가 발생했습니다.');
    } finally {
      setIsLoadingRecipes(false);
    }
  };

  const handleRecommend = async () => {
    if (ingredients.length === 0) {
      toast.error('냉장고에 재료를 먼저 추가해주세요!');
      return;
    }
    setIsLoadingRecipes(true);
    setHasSearched(true);
    try {
      const filters: RecipeFilter = {
        cuisine: recipeFilters.cuisine !== '전체' ? CUISINE_MAP[recipeFilters.cuisine] : '',
        type: recipeFilters.type !== '전체' ? TYPE_MAP[recipeFilters.type] : '',
        difficulty: recipeFilters.difficulty !== '전체' ? DIFFICULTY_MAP[recipeFilters.difficulty] : '',
      };
      const res = await recipeAPI.recommend(filters);
      let results = res.data.recipes;
      if (selectedIngredients.length > 0) {
        results = results.filter((recipe: Recipe) =>
          selectedIngredients.every((name: string) =>
            recipe.ingredient_list.some((ing: RecipeIngredient) => ing.name === name)
          )
        );
      }

      // On re-recommend (already has results), rotate to show different 3
      if (hasSearched && results.length > 3) {
        const newOffset = (displayOffset + 3) % results.length;
        setDisplayOffset(newOffset);
        const rotated = [...results.slice(newOffset), ...results.slice(0, newOffset)].slice(0, 3);
        setRecommendedRecipes(rotated);
      } else {
        setDisplayOffset(0);
        setRecommendedRecipes(results);
      }

      if (results.length === 0) {
        toast('필터를 변경해서 다시 시도해보세요.', { icon: '🔍' });
      } else {
        toast.success(hasSearched ? '다른 레시피를 찾았어요!' : `레시피 ${results.length}개를 찾았어요!`);
      }
    } catch {
      toast.error('레시피 추천 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setIsLoadingRecipes(false);
    }
  };

  const toggleIngredient = (name: string) => {
    setSelectedIngredients((prev) => {
      if (prev.includes(name)) return prev.filter((n) => n !== name);
      if (prev.length >= 3) return prev;
      return [...prev, name];
    });
  };

  const sortedIngredients = [
    ...ingredients.filter((i) => i.urgency?.level === 'red'),
    ...ingredients.filter((i) => i.urgency?.level === 'yellow'),
    ...ingredients.filter((i) => i.urgency?.level === 'green'),
  ];

  return (
    <div className="py-6 space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>AI 레시피 추천</h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
          냉장고 재료 {ingredients.length}개 기반으로 추천해드려요
        </p>
      </div>

      {/* Fridge status */}
      {ingredients.length > 0 && (
        <div className="p-4 rounded-2xl border" style={{ background: 'var(--primary-light)', borderColor: 'var(--primary-medium)' }}>
          <p className="text-sm font-semibold mb-2" style={{ color: 'var(--primary)' }}>
            현재 냉장고 재료
          </p>
          <div className="flex flex-wrap gap-1.5">
            {sortedIngredients.slice(0, 10).map((ing) => (
              <span
                key={ing.id}
                className="px-2.5 py-1 rounded-full text-xs font-medium"
                style={{
                  background:
                    ing.urgency?.level === 'red' ? '#FEE2E2' :
                    ing.urgency?.level === 'yellow' ? '#FEF3C7' :
                    'var(--surface)',
                  color:
                    ing.urgency?.level === 'red' ? '#EF4444' :
                    ing.urgency?.level === 'yellow' ? '#D97706' :
                    'var(--text)',
                }}
              >
                {ing.name}
              </span>
            ))}
            {ingredients.length > 10 && (
              <span className="px-2.5 py-1 rounded-full text-xs" style={{ color: 'var(--text-muted)' }}>
                +{ingredients.length - 10}개 더
              </span>
            )}
          </div>
        </div>
      )}

      {/* Empty fridge warning */}
      {ingredients.length === 0 && (
        <div className="p-4 rounded-2xl" style={{ background: '#FEF3C7', border: '1px solid #FDE68A' }}>
          <div className="flex items-center gap-3">
            <span className="text-2xl">⚠️</span>
            <div>
              <p className="font-semibold text-sm" style={{ color: '#D97706' }}>냉장고가 비어있어요</p>
              <p className="text-xs" style={{ color: '#92400E' }}>재료를 추가하면 레시피를 추천해드려요</p>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="p-4 rounded-2xl border" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
        <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text)' }}>필터</h3>

        <div className="space-y-4">
          {/* Cuisine */}
          <div>
            <p className="text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>요리 종류</p>
            <div className="flex gap-1.5 flex-wrap">
              {CUISINE_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  onClick={() => setRecipeFilters({ ...recipeFilters, cuisine: opt })}
                  className="px-5 py-2.5 rounded-full text-sm font-medium transition-all"
                  style={{
                    background: recipeFilters.cuisine === opt ? '#2563EB' : 'var(--surface-2)',
                    color: recipeFilters.cuisine === opt ? 'white' : 'var(--text-muted)',
                    minHeight: 'unset',
                  }}
                >
                  {' '}{opt}{' '}
                </button>
              ))}
            </div>
          </div>

          {/* Type */}
          <div>
            <p className="text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>식사 유형</p>
            <div className="flex gap-1.5 flex-wrap">
              {TYPE_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  onClick={() => setRecipeFilters({ ...recipeFilters, type: opt })}
                  className="px-5 py-2.5 rounded-full text-sm font-medium transition-all"
                  style={{
                    background: recipeFilters.type === opt ? '#2563EB' : 'var(--surface-2)',
                    color: recipeFilters.type === opt ? 'white' : 'var(--text-muted)',
                    minHeight: 'unset',
                  }}
                >
                  {' '}{opt}{' '}
                </button>
              ))}
            </div>
          </div>

          {/* Difficulty */}
          <div>
            <p className="text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>난이도</p>
            <div className="flex gap-1.5 flex-wrap">
              {DIFFICULTY_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  onClick={() => setRecipeFilters({ ...recipeFilters, difficulty: opt })}
                  className="px-5 py-2.5 rounded-full text-sm font-medium transition-all"
                  style={{
                    background: recipeFilters.difficulty === opt ? '#2563EB' : 'var(--surface-2)',
                    color: recipeFilters.difficulty === opt ? 'white' : 'var(--text-muted)',
                    minHeight: 'unset',
                  }}
                >
                  {' '}{opt}{' '}
                </button>
              ))}
            </div>
          </div>

          {/* Ingredient filter — fridge items, max 3 */}
          {sortedIngredients.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                  재료 선택{selectedIngredients.length > 0 ? ` (${selectedIngredients.length}/3)` : ' (최대 3개)'}
                </p>
                {selectedIngredients.length > 0 && (
                  <button
                    onClick={() => setSelectedIngredients([])}
                    className="text-xs"
                    style={{ color: 'var(--primary)', minHeight: 'unset' }}
                  >
                    초기화
                  </button>
                )}
              </div>
              <div className="flex gap-1.5 flex-wrap">
                {sortedIngredients.slice(0, 18).map((ing) => {
                  const isSelected = selectedIngredients.includes(ing.name);
                  const maxReached = !isSelected && selectedIngredients.length >= 3;
                  return (
                    <button
                      key={ing.id}
                      onClick={() => !maxReached && toggleIngredient(ing.name)}
                      className="px-5 py-2.5 rounded-full text-sm font-medium transition-all"
                      style={{
                        background: isSelected ? '#2563EB' : 'var(--surface-2)',
                        color: isSelected ? 'white' : maxReached ? 'var(--text-subtle)' : 'var(--text-muted)',
                        opacity: maxReached ? 0.5 : 1,
                        minHeight: 'unset',
                      }}
                    >
                      {' '}{ing.name}{' '}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* CTA */}
      <div className="space-y-2">
        <p className="text-center text-sm font-medium" style={{ color: 'var(--text-muted)' }}>
          오늘은 무엇을 드실래요?
        </p>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleRecommend}
          disabled={isLoadingRecipes || ingredients.length === 0}
          className="w-full py-4 rounded-2xl text-white font-bold text-lg flex items-center justify-center gap-2 transition-all"
          style={{
            background:
              isLoadingRecipes || ingredients.length === 0
                ? '#d1d5db'
                : 'linear-gradient(135deg, #F97316, #FBBF24)',
          }}
        >
          {isLoadingRecipes ? (
            <>
              <motion.span
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              >
                ⏳
              </motion.span>
              AI가 레시피를 분석 중이에요...
            </>
          ) : (
            hasSearched ? '다른 레시피 추천받기' : '오늘의 식사'
          )}
        </motion.button>
      </div>

      {/* Loading skeleton */}
      {isLoadingRecipes && (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-48 rounded-3xl" />
          ))}
        </div>
      )}

      {/* Recipe Results */}
      {!isLoadingRecipes && hasSearched && (
        <AnimatePresence>
          {recommendedRecipes.length === 0 ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-10">
              <div className="text-5xl mb-4">🔍</div>
              <p className="font-semibold" style={{ color: 'var(--text)' }}>추천할 레시피를 찾지 못했어요</p>
              <p className="text-sm mt-2" style={{ color: 'var(--text-muted)' }}>
                필터를 변경하거나 재료를 더 추가해보세요
              </p>
            </motion.div>
          ) : (
            <div className="space-y-4">
              <h3 className="font-bold text-base" style={{ color: 'var(--text)' }}>
                추천 레시피 {recommendedRecipes.length}개
              </h3>
              {recommendedRecipes.map((recipe, index) => (
                <RecipeCard key={`${recipe.recipe_title}-${index}`} recipe={recipe} index={index} />
              ))}
            </div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
}
