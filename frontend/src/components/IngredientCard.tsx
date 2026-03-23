import { useState } from 'react';
import { motion } from 'framer-motion';
import type { Ingredient } from '../types';
import { CATEGORY_COLORS } from '../types';
import { ingredientAPI } from '../services/api';
import { useAppStore } from '../store';
import toast from 'react-hot-toast';

interface IngredientCardProps {
  ingredient: Ingredient;
  onEdit?: (ingredient: Ingredient) => void;
}

export default function IngredientCard({ ingredient, onEdit }: IngredientCardProps) {
  const [deleting, setDeleting] = useState(false);
  const removeIngredient = useAppStore((s) => s.removeIngredient);

  const urgency = ingredient.urgency;
  const urgencyConfig = {
    red: {
      bg: '#FEF2F2',
      border: '#FECACA',
      badge: 'badge-red',
      emoji: '🔴',
      label: `${urgency?.days_remaining}일 남음`,
    },
    yellow: {
      bg: '#FFFBEB',
      border: '#FDE68A',
      badge: 'badge-yellow',
      emoji: '🟡',
      label: `${urgency?.days_remaining}일 남음`,
    },
    green: {
      bg: '#F0FDF4',
      border: '#BBF7D0',
      badge: 'badge-green',
      emoji: '🟢',
      label: `${urgency?.days_remaining}일 남음`,
    },
  };

  const config = urgencyConfig[urgency?.level || 'green'];

  const handleDelete = async () => {
    if (!window.confirm(`"${ingredient.name}"을(를) 삭제하시겠어요?`)) return;
    setDeleting(true);
    try {
      await ingredientAPI.delete(ingredient.id);
      removeIngredient(ingredient.id);
      toast.success(`${ingredient.name}이(가) 삭제되었습니다.`);
    } catch {
      toast.error('삭제 중 오류가 발생했습니다.');
    } finally {
      setDeleting(false);
    }
  };

  const expirationDate = new Date(ingredient.expiration_date).toLocaleDateString('ko-KR', {
    month: 'short',
    day: 'numeric',
  });

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="rounded-2xl p-5 border"
      style={{
        background: config.bg,
        borderColor: config.border,
      }}
    >
      <div className="flex items-start justify-between gap-3">
        {/* Left: Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-bold text-lg" style={{ color: 'var(--text)' }}>
              {ingredient.name}
            </h3>
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-medium ${CATEGORY_COLORS[ingredient.category]}`}
            >
              {ingredient.category}
            </span>
          </div>

          {(ingredient.quantity || ingredient.unit) && (
            <p className="text-base mt-1" style={{ color: 'var(--text-muted)' }}>
              {ingredient.quantity && `${ingredient.quantity}`}
              {ingredient.unit && ` ${ingredient.unit}`}
            </p>
          )}

          <div className="flex items-center gap-2 mt-2.5">
            <span className="text-base">{config.emoji}</span>
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${config.badge}`}>
              {config.label}
            </span>
            <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
              · {expirationDate}
            </span>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex gap-1">
          <button
            onClick={() => onEdit?.(ingredient)}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-sm transition-colors"
            style={{ background: 'white', color: 'var(--text-muted)' }}
            aria-label="수정"
          >
            ✏️
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-sm transition-colors"
            style={{ background: 'white', color: '#EF4444' }}
            aria-label="삭제"
          >
            {deleting ? '⏳' : '🗑️'}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
