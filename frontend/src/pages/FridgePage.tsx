import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '../store';
import { ingredientAPI } from '../services/api';
import type { Ingredient, IngredientCategory } from '../types';
import IngredientCard from '../components/IngredientCard';
import AddIngredientModal from '../components/AddIngredientModal';
import toast from 'react-hot-toast';

const CATEGORIES: (IngredientCategory | '전체')[] = [
  '전체', '채소', '과일', '육류', '해산물', '유제품', '조미료', '소스', '기타',
];

export default function FridgePage() {
  const { ingredients, setIngredients } = useAppStore();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editIngredient, setEditIngredient] = useState<Ingredient | null>(null);
  const [activeCategory, setActiveCategory] = useState<IngredientCategory | '전체'>('전체');
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadIngredients();
  }, []);

  const loadIngredients = async () => {
    setIsLoading(true);
    try {
      const res = await ingredientAPI.getAll();
      setIngredients(res.data.ingredients);
    } catch {
      toast.error('재료를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (ingredient: Ingredient) => {
    setEditIngredient(ingredient);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditIngredient(null);
  };

  // Filter logic
  const filtered = ingredients.filter((ing) => {
    const matchCategory = activeCategory === '전체' || ing.category === activeCategory;
    const matchSearch = !searchQuery || ing.name.includes(searchQuery);
    return matchCategory && matchSearch;
  });

  // Group by urgency
  const redItems = filtered.filter((i) => i.urgency?.level === 'red');
  const yellowItems = filtered.filter((i) => i.urgency?.level === 'yellow');
  const greenItems = filtered.filter((i) => i.urgency?.level === 'green');

  const urgencyCounts = {
    red: ingredients.filter((i) => i.urgency?.level === 'red').length,
    yellow: ingredients.filter((i) => i.urgency?.level === 'yellow').length,
    green: ingredients.filter((i) => i.urgency?.level === 'green').length,
  };

  return (
    <div className="py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>
            🧊 나의 냉장고
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
            총 {ingredients.length}개의 재료
          </p>
        </div>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-white font-medium text-sm"
          style={{ background: 'var(--primary)' }}
        >
          <span>+</span> 추가
        </motion.button>
      </div>

      {/* Urgency Summary */}
      {ingredients.length > 0 && (
        <div className="flex gap-2 mb-4">
          {urgencyCounts.red > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl badge-red text-sm font-medium">
              🔴 {urgencyCounts.red}개 (2일내)
            </div>
          )}
          {urgencyCounts.yellow > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl badge-yellow text-sm font-medium">
              🟡 {urgencyCounts.yellow}개 (5일내)
            </div>
          )}
          {urgencyCounts.green > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl badge-green text-sm font-medium">
              🟢 {urgencyCounts.green}개
            </div>
          )}
        </div>
      )}

      {/* Search */}
      <div className="relative mb-4">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="재료 검색..."
          className="w-full pl-10 pr-4 py-3 rounded-2xl border text-sm outline-none"
          style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400"
          >
            ✕
          </button>
        )}
      </div>

      {/* Category Filter */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-5 scrollbar-hide">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat as IngredientCategory | '전체')}
            className="flex-shrink-0 px-5 py-2.5 rounded-full text-sm font-medium transition-all"
            style={{
              background: activeCategory === cat ? '#2563EB' : 'var(--surface-2)',
              color: activeCategory === cat ? 'white' : 'var(--text-muted)',
              whiteSpace: 'nowrap',
            }}
          >
            {' '}{cat}{' '}
          </button>
        ))}
      </div>

      {/* Loading skeleton */}
      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-24 rounded-2xl" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && ingredients.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-16"
        >
          <div className="text-6xl mb-4">🥦</div>
          <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--text)' }}>
            냉장고가 비어있어요!
          </h3>
          <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
            재료를 추가하면 AI가 레시피를 추천해드려요
          </p>
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-6 py-3 rounded-2xl text-white font-medium"
            style={{ background: 'var(--primary)' }}
          >
            + 첫 번째 재료 추가하기
          </button>
        </motion.div>
      )}

      {/* Ingredient groups */}
      {!isLoading && filtered.length > 0 && (
        <div className="space-y-4">
          {/* RED — urgent */}
          {redItems.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5" style={{ color: '#EF4444' }}>
                🔴 지금 바로 사용하세요 ({redItems.length}개)
              </h3>
              <AnimatePresence>
                <div className="space-y-3">
                  {redItems.map((ing) => (
                    <IngredientCard key={ing.id} ingredient={ing} onEdit={handleEdit} />
                  ))}
                </div>
              </AnimatePresence>
            </div>
          )}

          {/* YELLOW — soon */}
          {yellowItems.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5" style={{ color: '#D97706' }}>
                🟡 이번 주 안에 사용하세요 ({yellowItems.length}개)
              </h3>
              <div className="space-y-3">
                {yellowItems.map((ing) => (
                  <IngredientCard key={ing.id} ingredient={ing} onEdit={handleEdit} />
                ))}
              </div>
            </div>
          )}

          {/* GREEN — fine */}
          {greenItems.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5" style={{ color: '#10B981' }}>
                🟢 여유 있는 재료 ({greenItems.length}개)
              </h3>
              <div className="space-y-3">
                {greenItems.map((ing) => (
                  <IngredientCard key={ing.id} ingredient={ing} onEdit={handleEdit} />
                ))}
              </div>
            </div>
          )}

          {/* No filter results */}
          {filtered.length === 0 && (
            <div className="text-center py-10">
              <p style={{ color: 'var(--text-muted)' }}>
                "{searchQuery || activeCategory}" 검색 결과가 없어요
              </p>
            </div>
          )}
        </div>
      )}

      {/* Add Modal */}
      <AddIngredientModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        editIngredient={editIngredient}
      />
    </div>
  );
}
