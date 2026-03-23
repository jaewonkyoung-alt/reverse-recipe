import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import type { Recipe } from '../types';
import { CUISINE_LABELS, TYPE_LABELS, DIFFICULTY_LABELS } from '../types';
import { useAppStore } from '../store';

interface RecipeCardProps {
  recipe: Recipe;
  index: number;
}

const CUISINE_EMOJIS: Record<string, string> = {
  Korean: '🇰🇷',
  Japanese: '🇯🇵',
  Chinese: '🇨🇳',
  Western: '🌍',
};

const DIFFICULTY_COLORS: Record<string, string> = {
  Easy: '#16A34A',
  Medium: '#F59E0B',
  Hard: '#EF4444',
};

// Deterministic calorie estimate based on recipe type + title hash
function estimateCalories(recipe: Recipe): number {
  const base: Record<string, number> = {
    Main: 580, Side: 270, Soup: 200, Snack: 220, Dessert: 310,
  };
  const b = base[recipe.recipe_type] ?? 400;
  const hash = recipe.recipe_title.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const variance = (hash % 201) - 100; // -100 to +100
  return Math.round((b + variance) / 10) * 10;
}


export default function RecipeCard({ recipe, index }: RecipeCardProps) {
  const navigate = useNavigate();
  const setSelectedRecipe = useAppStore((s) => s.setSelectedRecipe);

  const matchPercent = Math.round((recipe.match_score || 0) * 100);
  const scorePercent = Math.round((recipe.recommendation_score || recipe.match_score) * 100);
  const missingCount = recipe.missing_ingredients?.length || 0;
  const calories = estimateCalories(recipe);

  const handleClick = () => {
    setSelectedRecipe(recipe);
    navigate(`/recipe/${index}`);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      onClick={handleClick}
      className="recipe-card rounded-3xl border cursor-pointer"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      {/* Color accent bar */}
      <div
        className="h-1"
        style={{ background: 'linear-gradient(90deg, #16A34A, #22C55E)' }}
      />

      <div className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>
                {CUISINE_EMOJIS[recipe.cuisine_type]} {CUISINE_LABELS[recipe.cuisine_type]}
              </span>
            </div>
            <h3 className="text-lg font-bold" style={{ color: 'var(--text)' }}>
              {recipe.recipe_title}
            </h3>
          </div>

          {/* Score Circle */}
          <div
            className="w-14 h-14 rounded-2xl flex flex-col items-center justify-center flex-shrink-0"
            style={{ background: 'var(--primary-light)' }}
          >
            <span className="text-lg font-bold" style={{ color: 'var(--primary)' }}>
              {scorePercent}
            </span>
            <span className="text-xs" style={{ color: 'var(--primary)' }}>점</span>
          </div>
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          <span
            className="px-2.5 py-1 rounded-full text-xs font-medium"
            style={{ background: 'var(--primary-light)', color: 'var(--primary)' }}
          >
            {TYPE_LABELS[recipe.recipe_type]}
          </span>
          <span
            className="px-2.5 py-1 rounded-full text-xs font-medium"
            style={{
              background: `${DIFFICULTY_COLORS[recipe.difficulty]}20`,
              color: DIFFICULTY_COLORS[recipe.difficulty],
            }}
          >
            {DIFFICULTY_LABELS[recipe.difficulty]}
          </span>
          <span
            className="px-2.5 py-1 rounded-full text-xs font-medium"
            style={{ background: '#F3F4F6', color: 'var(--text-muted)' }}
          >
            ⏱️ {recipe.estimated_total_time_minutes}분
          </span>
          <span
            className="px-2.5 py-1 rounded-full text-xs font-medium"
            style={{ background: '#F3F4F6', color: 'var(--text-muted)' }}
          >
            ~{calories} kcal
          </span>
        </div>

        {/* Match bar */}
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>재료 매칭률</span>
            <span className="text-xs font-semibold" style={{ color: 'var(--primary)' }}>
              {matchPercent}%
            </span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: '#F3F4F6' }}>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${matchPercent}%` }}
              transition={{ delay: index * 0.1 + 0.3, duration: 0.6 }}
              className="h-full rounded-full"
              style={{ background: 'linear-gradient(90deg, #16A34A, #22C55E)' }}
            />
          </div>
        </div>

        {/* Missing ingredients warning */}
        {missingCount > 0 && (
          <div
            className="flex items-center gap-2 px-3 py-2 rounded-xl"
            style={{ background: '#FEF3C7' }}
          >
            <span className="text-sm">⚠️</span>
            <span className="text-sm" style={{ color: '#D97706' }}>
              부족한 재료 {missingCount}개:{' '}
              {recipe.missing_ingredients.slice(0, 3).join(', ')}
              {missingCount > 3 && ' ...'}
            </span>
          </div>
        )}

        {/* CTA */}
        <div
          className="mt-4 flex items-center justify-between py-3 px-4 rounded-2xl"
          style={{ background: 'var(--primary-light)' }}
        >
          <span className="text-sm font-medium" style={{ color: 'var(--primary)' }}>
            레시피 보기
          </span>
          <span style={{ color: 'var(--primary)' }}>→</span>
        </div>
      </div>
    </motion.div>
  );
}
