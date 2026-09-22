import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '../store';
import { shoppingAPI } from '../services/api';
import toast from 'react-hot-toast';


export default function ShoppingPage() {
  const { shoppingItems, setShoppingItems, removeShoppingItem, markItemPurchased, purgeOldPurchased } = useAppStore();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    purgeOldPurchased(); // auto-remove items purchased > 7 days ago
    loadShoppingList();
  }, []);

  const loadShoppingList = async () => {
    setIsLoading(true);
    try {
      const res = await shoppingAPI.getList();
      setShoppingItems(res.data.items);
    } catch {
      setShoppingItems([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePurchase = async (id: string, name: string) => {
    try {
      await shoppingAPI.markPurchased(id);
      markItemPurchased(id);
      toast.success(`${name} 구매 완료!`);
    } catch {
      toast.error('처리 중 오류가 발생했습니다.');
    }
  };

  const handleRemove = async (id: string) => {
    try {
      await shoppingAPI.removeItem(id);
      removeShoppingItem(id);
    } catch {
      toast.error('삭제 중 오류가 발생했습니다.');
    }
  };

  const unpurchased = shoppingItems.filter((i) => !i.is_purchased);

  return (
    <div className="py-6 space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>
          🛒 쇼핑 리스트
        </h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
          {unpurchased.length > 0 ? `${unpurchased.length}개 항목` : '쇼핑할 항목 없음'}
        </p>
      </div>

      {/* Loading skeleton */}
      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-16 rounded-2xl" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && shoppingItems.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-16"
        >
          <div className="text-6xl mb-4">🛒</div>
          <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--text)' }}>
            쇼핑 리스트가 비어있어요
          </h3>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            레시피 추천에서 부족한 재료를<br />쇼핑 리스트에 추가할 수 있어요
          </p>
        </motion.div>
      )}

      {/* Unpurchased items */}
      {!isLoading && unpurchased.length > 0 && (
        <div className="space-y-2">
          <AnimatePresence>
            {unpurchased.map((item) => (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -50 }}
                  className="rounded-2xl border overflow-hidden"
                  style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
                >
                  <div className="p-4">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => handlePurchase(item.id, item.ingredient_name)}
                        className="w-6 h-6 rounded-full border-2 flex-shrink-0 transition-all"
                        style={{ borderColor: 'var(--primary)', minHeight: '24px' }}
                        aria-label="구매 완료"
                      />

                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm" style={{ color: 'var(--text)' }}>
                          {item.ingredient_name}
                        </p>
                        {item.recipe_title && (
                          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                            {item.recipe_title}
                          </p>
                        )}
                      </div>

                      <button
                        onClick={() => handleRemove(item.id)}
                        className="w-9 h-9 rounded-lg text-sm flex-shrink-0"
                        style={{ color: '#EF4444', background: '#FEF2F2', minHeight: 'unset' }}
                        aria-label="삭제"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
          </AnimatePresence>

          {/* Hint text below unpurchased items */}
          <p className="text-xs text-center pt-1" style={{ color: 'var(--text-muted)' }}>
            장보기 완료 후 냉장고에 자동 추가 예정
          </p>
        </div>
      )}

    </div>
  );
}
