import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '../store';
import { shoppingAPI } from '../services/api';
import type { ShoppingSearchResult } from '../types';
import toast from 'react-hot-toast';

const PLATFORM_CONFIG = {
  coupang: { label: '쿠팡', color: '#E53935', emoji: '🛍️' },
  naver: { label: '네이버쇼핑', color: '#03C75A', emoji: '🟢' },
  kurly: { label: '마켓컬리', color: '#5F0080', emoji: '🟣' },
};

export default function ShoppingPage() {
  const { shoppingItems, setShoppingItems, removeShoppingItem, markItemPurchased, purgeOldPurchased } = useAppStore();
  const [isLoading, setIsLoading] = useState(true);
  const [itemPrices, setItemPrices] = useState<Record<string, ShoppingSearchResult>>({});
  const [loadingPriceFor, setLoadingPriceFor] = useState<string | null>(null);
  const [expandedItem, setExpandedItem] = useState<string | null>(null);

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

  const handleRowTap = async (id: string, ingredientName: string) => {
    // Toggle collapse if already expanded
    if (expandedItem === id) {
      setExpandedItem(null);
      return;
    }

    // Expand immediately; if price already loaded or currently loading, no re-fetch
    setExpandedItem(id);

    if (itemPrices[id] || loadingPriceFor === id) {
      return;
    }

    setLoadingPriceFor(id);
    try {
      const res = await shoppingAPI.searchPrices([ingredientName]);
      const result: ShoppingSearchResult | undefined = res.data.results?.[0];
      if (result) {
        setItemPrices((prev) => ({ ...prev, [id]: result }));
      }
    } catch {
      toast.error('가격 정보를 불러오지 못했습니다.');
    } finally {
      setLoadingPriceFor(null);
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
            {unpurchased.map((item) => {
              const priceInfo = itemPrices[item.id];
              const isExpanded = expandedItem === item.id;
              const isFetchingThis = loadingPriceFor === item.id;

              return (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -50 }}
                  className="rounded-2xl border overflow-hidden"
                  style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
                >
                  {/* Tappable row */}
                  <div
                    className="p-4 cursor-pointer select-none"
                    onClick={() => handleRowTap(item.id, item.ingredient_name)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleRowTap(item.id, item.ingredient_name);
                      }
                    }}
                    aria-expanded={isExpanded}
                  >
                    <div className="flex items-center gap-3">
                      {/* Checkbox — stop propagation so tapping it only marks purchased */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePurchase(item.id, item.ingredient_name);
                        }}
                        className="w-6 h-6 rounded-full border-2 flex-shrink-0 transition-all"
                        style={{ borderColor: 'var(--primary)', minHeight: '24px' }}
                        aria-label="구매 완료"
                      />

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm" style={{ color: 'var(--text)' }}>
                          {item.ingredient_name}
                        </p>
                        {item.recipe_title && (
                          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                            📋 {item.recipe_title}
                          </p>
                        )}
                      </div>

                      {/* Expand indicator */}
                      <span
                        className="text-xs px-2 py-1 rounded-lg font-medium flex-shrink-0"
                        style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}
                      >
                        {isFetchingThis ? '⏳' : isExpanded ? '▲' : '💰'}
                      </span>
                      {/* Delete — far right */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemove(item.id);
                        }}
                        className="w-9 h-9 rounded-lg text-sm flex-shrink-0"
                        style={{ color: '#EF4444', background: '#FEF2F2', minHeight: 'unset' }}
                        aria-label="삭제"
                      >
                        ✕
                      </button>
                    </div>
                  </div>

                  {/* Expanded price area */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="px-4 pb-4 space-y-2">
                          <div className="h-px" style={{ background: 'var(--surface-2)' }} />

                          {/* Loading spinner */}
                          {isFetchingThis && (
                            <div className="flex items-center justify-center py-4 gap-2">
                              <svg
                                className="animate-spin h-5 w-5"
                                style={{ color: 'var(--primary)' }}
                                xmlns="http://www.w3.org/2000/svg"
                                fill="none"
                                viewBox="0 0 24 24"
                              >
                                <circle
                                  className="opacity-25"
                                  cx="12"
                                  cy="12"
                                  r="10"
                                  stroke="currentColor"
                                  strokeWidth="4"
                                />
                                <path
                                  className="opacity-75"
                                  fill="currentColor"
                                  d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                                />
                              </svg>
                              <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
                                가격 검색 중…
                              </span>
                            </div>
                          )}

                          {/* Price options (sorted low to high by backend) */}
                          {!isFetchingThis && priceInfo && priceInfo.options.map((opt) => {
                            const config =
                              PLATFORM_CONFIG[opt.platform as keyof typeof PLATFORM_CONFIG];
                            if (!config) return null;
                            return (
                              <a
                                key={opt.platform}
                                href={opt.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center justify-between p-3 rounded-xl no-underline"
                                style={{ background: 'var(--surface-2)' }}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <div className="flex items-center gap-2">
                                  <span>{config.emoji}</span>
                                  <div>
                                    <p
                                      className="text-sm font-medium"
                                      style={{ color: 'var(--text)' }}
                                    >
                                      {config.label}
                                    </p>
                                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                      {opt.name}
                                    </p>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <p
                                    className="font-bold text-sm"
                                    style={{ color: config.color }}
                                  >
                                    ₩{opt.price.toLocaleString()}
                                  </p>
                                  <p className="text-xs" style={{ color: 'var(--primary)' }}>
                                    구매하기 →
                                  </p>
                                </div>
                              </a>
                            );
                          })}

                          {/* No results after fetch */}
                          {!isFetchingThis && priceInfo && priceInfo.options.length === 0 && (
                            <p
                              className="text-sm text-center py-3"
                              style={{ color: 'var(--text-muted)' }}
                            >
                              가격 정보를 찾을 수 없어요
                            </p>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
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
