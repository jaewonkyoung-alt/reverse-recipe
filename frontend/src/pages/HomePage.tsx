import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '../store';
import { ingredientAPI, recipeAPI } from '../services/api';
import { authAPI } from '../services/api';
import toast from 'react-hot-toast';
// purge old shopping items on home mount

export default function HomePage() {
  const navigate = useNavigate();
  const {
    user, setUser, setIngredients, setGreenPoints,
    setAutoRecommendExpiring, purgeOldPurchased,
    cookingJustCompleted, setCookingJustCompleted,
  } = useAppStore();
  const [expiringCount, setExpiringCount] = useState(0);
  const [isLoadingGuest, setIsLoadingGuest] = useState(false);
  const [cookingCompletePoints, setCookingCompletePoints] = useState<number | null>(null);
  const cookingCompleteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Purge shopping items purchased > 7 days ago
  useEffect(() => {
    purgeOldPurchased();
  }, []);

  // Show cooking complete green points banner for 3 seconds
  useEffect(() => {
    if (cookingJustCompleted) {
      setCookingCompletePoints(cookingJustCompleted.points);
      setCookingJustCompleted(null);
      if (cookingCompleteTimer.current) clearTimeout(cookingCompleteTimer.current);
      cookingCompleteTimer.current = setTimeout(() => {
        setCookingCompletePoints(null);
      }, 3000);
    }
    return () => {
      if (cookingCompleteTimer.current) clearTimeout(cookingCompleteTimer.current);
    };
  }, [cookingJustCompleted]);

  useEffect(() => {
    if (!user) return;

    ingredientAPI.getAll().then((res) => {
      setIngredients(res.data.ingredients);
    }).catch(console.error);

    ingredientAPI.getExpiring(3).then((res) => {
      setExpiringCount(res.data.ingredients.length);
    }).catch(console.error);

    recipeAPI.getGreenPoints().then((res) => {
      setGreenPoints(res.data);
    }).catch(console.error);
  }, [user]);

  const handleGuestLogin = async () => {
    setIsLoadingGuest(true);
    try {
      const res = await authAPI.guestLogin();
      setUser(res.data.user, res.data.accessToken);
      toast.success('게스트로 시작합니다!');
    } catch {
      toast.error('게스트 로그인에 실패했습니다.');
    } finally {
      setIsLoadingGuest(false);
    }
  };

  // Not logged in
  if (!user) {
    return (
      <div className="min-h-screen flex flex-col px-6" style={{ background: 'var(--bg)' }}>
        {/* 중앙보다 살짝 위 — 제목 + 기능 카드 */}
        <div className="flex-1 flex flex-col items-center justify-center text-center" style={{ paddingBottom: '30px' }}>
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="w-full"
          >
            <h1 className="text-3xl font-bold text-center" style={{ color: 'var(--text)' }}>
              리버스 레시피
            </h1>

            {/* 제목-카드 간격 */}
            <div style={{ marginTop: '48px', display: 'flex', justifyContent: 'center', width: '100%' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', width: '100%', maxWidth: '380px' }}>
                {[
                  { title: '냉장고 관리', desc: '유통기한 자동 추적' },
                  { title: 'AI 추천', desc: 'Perplexity AI 기반' },
                  { title: '환경 점수', desc: '음식물 낭비 제로' },
                ].map((feature) => (
                  <div
                    key={feature.title}
                    style={{
                      background: '#e8f5e9',
                      borderRadius: '16px',
                      padding: '12px 8px',
                      textAlign: 'center',
                    }}
                  >
                    <p style={{ fontSize: '12px', fontWeight: 600, color: '#2d6a4f', margin: 0 }}>
                      {feature.title}
                    </p>
                    <p style={{ fontSize: '11px', color: '#888', marginTop: '4px', marginBottom: 0 }}>
                      {feature.desc}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>

        {/* 버튼 하단 고정 */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
          className="space-y-3 pb-12"
        >
          <button
            onClick={handleGuestLogin}
            disabled={isLoadingGuest}
            className="w-full py-4 rounded-2xl text-white font-semibold text-base"
            style={{ background: 'var(--primary)' }}
          >
            {isLoadingGuest ? '⏳ 시작 중...' : '🚀 지금 바로 시작하기 (게스트)'}
          </button>
          <button
            onClick={() => navigate('/login')}
            className="w-full py-4 rounded-2xl font-semibold text-base border-2"
            style={{ borderColor: 'var(--primary)', color: 'var(--primary)' }}
          >
            로그인 / 회원가입
          </button>
        </motion.div>
      </div>
    );
  }

  // Logged in — clean minimal home
  const handleExpiringBanner = () => {
    setAutoRecommendExpiring(true);
    navigate('/recommend');
  };

  return (
    <>
      {/* ── Core CTA — center ── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col items-center justify-center text-center px-4"
        style={{ minHeight: 'calc(100vh - 220px)' }}
      >
        <p className="text-sm mb-2 font-medium" style={{ color: 'var(--text-muted)' }}>
          안녕하세요, {user.name}님
        </p>
        <h2
          className="text-2xl font-bold mb-8 leading-snug"
          style={{ color: 'var(--text)' }}
        >
          오늘은 무엇을 드실래요?
        </h2>
        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => navigate('/recommend')}
          className="py-4 rounded-2xl text-white font-bold text-lg"
          style={{ background: 'linear-gradient(135deg, #F97316, #FBBF24)', width: '72%' }}
        >
          오늘의 식사
        </motion.button>
      </motion.div>

      {/* ── Fixed bottom banners — just above nav ── */}
      <div
        className="fixed z-30 space-y-2 px-4"
        style={{
          bottom: '60px',
          left: 'max(0px, calc((100vw - 430px) / 2))',
          right: 'max(0px, calc((100vw - 430px) / 2))',
        }}
      >
        <AnimatePresence>
          {cookingCompletePoints !== null ? (
            <motion.div
              key="cooking-complete"
              initial={{ opacity: 0, y: 10, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6, scale: 0.97 }}
              className="p-4 rounded-2xl flex items-center gap-3"
              style={{ background: 'linear-gradient(135deg, #10B981, #34D399)' }}
            >
              <span className="text-2xl">🎉</span>
              <div>
                <p className="font-bold text-sm text-white">
                  요리 완성! +{cookingCompletePoints} 그린포인트 적립!
                </p>
                <p className="text-xs text-white/80">
                  음식물 낭비를 줄여 지구를 지키고 있어요!
                </p>
              </div>
            </motion.div>
          ) : expiringCount > 0 ? (
            <motion.div
              key="expiring"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ delay: 0.15 }}
              onClick={handleExpiringBanner}
              className="p-4 rounded-2xl cursor-pointer flex items-center gap-3"
              style={{ background: '#FEF3C7', border: '1px solid #FDE68A' }}
            >
              <span className="text-xl">⚠️</span>
              <div className="flex-1">
                <p className="font-semibold text-sm" style={{ color: '#D97706' }}>
                  3일 내 만료 재료 {expiringCount}개 — 레시피 추천 받기
                </p>
                <p className="text-xs" style={{ color: '#92400E' }}>
                  만료 재료 활용 레시피를 바로 추천해드려요
                </p>
              </div>
              <span style={{ color: '#D97706' }}>→</span>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </>
  );
}
