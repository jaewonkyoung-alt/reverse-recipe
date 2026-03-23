import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { IngredientCategory, Ingredient } from '../types';
import { ingredientAPI } from '../services/api';
import { useAppStore } from '../store';
import { detectCategory, getExpirationDays, INGREDIENT_EXPIRATION_DB } from '../utils/ingredientDB';
import toast from 'react-hot-toast';

const CATEGORIES: IngredientCategory[] = [
  '채소', '과일', '육류', '해산물', '유제품', '조미료', '소스', '기타',
];

const CATEGORY_EMOJI: Record<IngredientCategory, string> = {
  채소: '🥦', 과일: '🍎', 육류: '🥩', 해산물: '🐟',
  유제품: '🥛', 조미료: '🧂', 소스: '🍶', 기타: '📦',
};

const COMMON_INGREDIENTS: Record<IngredientCategory, string[]> = {
  채소: ['양파', '마늘', '대파', '당근', '감자', '브로콜리', '시금치', '오이', '애호박', '콩나물'],
  과일: ['사과', '바나나', '귤', '토마토', '딸기', '아보카도', '레몬', '방울토마토'],
  육류: ['닭가슴살', '돼지고기', '소고기', '계란', '삼겹살', '베이컨', '냉동만두'],
  해산물: ['새우', '고등어', '연어', '오징어', '참치캔', '게맛살', '어묵'],
  유제품: ['우유', '치즈', '버터', '요거트', '생크림', '두부', '순두부'],
  조미료: ['간장', '된장', '고추장', '소금', '설탕', '참기름', '식용유', '식초'],
  소스: ['케첩', '마요네즈', '굴소스', '스리라차', '돈까스소스', '데리야끼소스'],
  기타: ['쌀', '밀가루', '파스타', '라면', '김치', '빵가루', '전분'],
};

interface Props {
  isOpen: boolean;
  onClose: () => void;
  editIngredient?: Ingredient | null;
}

export default function AddIngredientModal({ isOpen, onClose, editIngredient }: Props) {
  const [name, setName] = useState(editIngredient?.name || '');
  const [quantity, setQuantity] = useState(editIngredient?.quantity?.toString() || '');
  const [unit, setUnit] = useState(editIngredient?.unit || '');
  const [category, setCategory] = useState<IngredientCategory>(editIngredient?.category || '채소');
  const [expirationDate, setExpirationDate] = useState(
    editIngredient ? editIngredient.expiration_date.split('T')[0] : ''
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [autoDetected, setAutoDetected] = useState(false);

  const { addIngredient, updateIngredient } = useAppStore();

  // 이름 입력 시 카테고리 자동 감지
  useEffect(() => {
    if (!name.trim() || editIngredient) return;
    const detected = detectCategory(name.trim());
    if (detected && detected !== category) {
      setCategory(detected);
      setAutoDetected(true);
      setTimeout(() => setAutoDetected(false), 2000);
    }
  }, [name]);

  // 소비기한 힌트
  const expirationHint = (() => {
    const days = getExpirationDays(name.trim() || '_', category);
    if (days >= 365) return `평균 약 ${Math.round(days / 30)}개월`;
    if (days >= 30) return `평균 약 ${Math.round(days / 7)}주`;
    return `평균 약 ${days}일`;
  })();

  const suggestions = Object.keys(INGREDIENT_EXPIRATION_DB).filter(
    (s) => name.trim() && s.startsWith(name.trim()) && s !== name.trim()
  ).slice(0, 5);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setIsSubmitting(true);
    try {
      const data = {
        name: name.trim(),
        quantity: quantity ? parseFloat(quantity) : undefined,
        unit: unit.trim() || undefined,
        category,
        expiration_date: expirationDate || undefined,
      };
      if (editIngredient) {
        const res = await ingredientAPI.update(editIngredient.id, data);
        updateIngredient(editIngredient.id, res.data.ingredient);
        toast.success('재료가 수정되었습니다.');
      } else {
        const res = await ingredientAPI.add(data);
        addIngredient(res.data.ingredient);
        toast.success(`🧊 ${name} 추가 완료!`);
      }
      onClose();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      toast.error(e?.response?.data?.error || '오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <div
            onClick={onClose}
            className="fixed inset-0 z-40"
            style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="fixed bottom-0 z-50 rounded-t-3xl"
            style={{ background: 'var(--surface)', maxHeight: '88vh', overflowY: 'auto', width: '100%', maxWidth: '430px', left: '50%', transform: 'translateX(-50%)' }}
          >
            <div className="px-5 pt-4 pb-8">
              <div className="w-10 h-1 rounded-full mx-auto mb-5" style={{ background: 'var(--border)' }} />

              <div className="flex items-center justify-between mb-5">
                <h2 className="text-xl font-bold" style={{ color: 'var(--text)' }}>
                  {editIngredient ? '재료 수정' : '재료 추가'}
                </h2>
                <button onClick={onClose} className="w-10 h-10 rounded-xl text-lg" style={{ background: 'var(--bg)', color: 'var(--text-muted)', minHeight: 'unset' }}>
                  ✕
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* 재료 이름 */}
                <div className="relative">
                  <label className="block text-sm font-semibold mb-1.5" style={{ color: 'var(--text)' }}>
                    재료 이름 *
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => { setName(e.target.value); setShowSuggestions(true); }}
                    onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                    placeholder="예: 양파, 간장, 닭가슴살"
                    className="w-full px-4 py-3.5 rounded-2xl border text-base outline-none transition-all"
                    style={{
                      borderColor: name ? 'var(--primary)' : 'var(--border)',
                      background: 'var(--surface)',
                    }}
                    required
                    autoFocus
                  />
                  {showSuggestions && suggestions.length > 0 && (
                    <div className="absolute top-full left-0 right-0 rounded-2xl border mt-1 z-10 overflow-hidden"
                      style={{ background: 'var(--surface)', borderColor: 'var(--border)', boxShadow: 'var(--shadow-md)' }}>
                      {suggestions.map((s) => (
                        <button key={s} type="button" onMouseDown={() => { setName(s); setShowSuggestions(false); }}
                          className="w-full text-left px-4 py-3 text-sm border-b last:border-0 transition-colors hover:bg-gray-50"
                          style={{ color: 'var(--text)', borderColor: 'var(--border)' }}>
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* 카테고리 */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-sm font-semibold" style={{ color: 'var(--text)' }}>카테고리</label>
                    {autoDetected && (
                      <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--primary-light)', color: 'var(--primary)' }}>
                        ✨ 자동 감지됨
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {CATEGORIES.map((cat) => (
                      <button key={cat} type="button" onClick={() => setCategory(cat)}
                        className="flex flex-col items-center gap-1 py-2.5 rounded-xl text-xs font-medium transition-all"
                        style={{
                          background: category === cat ? 'var(--primary)' : 'var(--bg)',
                          color: category === cat ? 'white' : 'var(--text-muted)',
                          border: `1px solid ${category === cat ? 'var(--primary)' : 'var(--border)'}`,
                        }}>
                        <span className="text-base">{CATEGORY_EMOJI[cat]}</span>
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 빠른 선택 */}
                <div>
                  <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>자주 쓰는 재료</p>
                  <div className="flex flex-wrap gap-1.5">
                    {COMMON_INGREDIENTS[category].slice(0, 8).map((item) => (
                      <button key={item} type="button" onClick={() => setName(item)}
                        className="px-3 py-1.5 rounded-full text-xs transition-all"
                        style={{
                          background: name === item ? 'var(--primary-medium)' : 'var(--bg)',
                          color: name === item ? 'var(--primary-dark)' : 'var(--text-muted)',
                          border: `1px solid ${name === item ? 'var(--primary)' : 'var(--border)'}`,
                          fontWeight: name === item ? '600' : '400',
                        }}>
                        {item}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 수량 & 단위 */}
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="block text-sm font-semibold mb-1.5" style={{ color: 'var(--text)' }}>수량</label>
                    <input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)}
                      placeholder="0" min="0" step="0.1"
                      className="w-full px-4 py-3.5 rounded-2xl border text-base outline-none"
                      style={{ borderColor: 'var(--border)', background: 'var(--surface)' }} />
                  </div>
                  <div className="flex-1">
                    <label className="block text-sm font-semibold mb-1.5" style={{ color: 'var(--text)' }}>단위</label>
                    <select value={unit} onChange={(e) => setUnit(e.target.value)}
                      className="w-full px-4 py-3.5 rounded-2xl border text-base outline-none"
                      style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
                      <option value="">선택</option>
                      {['개', 'g', 'kg', 'ml', 'L', '컵', '큰술', '작은술', '팩', '봉', '묶음', '줄기', '쪽'].map(u => (
                        <option key={u} value={u}>{u}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* 소비기한 */}
                <div>
                  <label className="block text-sm font-semibold mb-1.5" style={{ color: 'var(--text)' }}>
                    소비기한{' '}
                    <span className="text-xs font-normal" style={{ color: 'var(--primary)' }}>({expirationHint})</span>
                  </label>
                  <input type="date" value={expirationDate} onChange={(e) => setExpirationDate(e.target.value)}
                    className="w-full px-4 py-3.5 rounded-2xl border text-base outline-none"
                    style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
                    min={new Date().toISOString().split('T')[0]} />
                  <p className="text-xs mt-1.5" style={{ color: 'var(--text-subtle)' }}>
                    비워두면 재료별 평균값으로 자동 설정돼요
                  </p>
                </div>

                <button type="submit" disabled={isSubmitting || !name.trim()}
                  className="w-full py-4 rounded-2xl text-white font-semibold text-base transition-all"
                  style={{ background: name.trim() ? 'var(--primary)' : '#D1D5DB', cursor: name.trim() ? 'pointer' : 'not-allowed' }}>
                  {isSubmitting ? '저장 중...' : editIngredient ? '수정 완료' : '냉장고에 추가하기'}
                </button>
              </form>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
