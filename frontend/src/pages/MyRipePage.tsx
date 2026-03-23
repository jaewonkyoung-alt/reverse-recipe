import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '../store';
import { recipeAPI } from '../services/api';
import { CUISINE_LABELS, TYPE_LABELS } from '../types';
import toast from 'react-hot-toast';

const LEVELS = [
  { min: 0,    max: 49,        label: '🌾 새싹 요리사',  next: 50   },
  { min: 50,   max: 199,       label: '🌱 환경 지킴이',  next: 200  },
  { min: 200,  max: 499,       label: '🌿 에코 챔피언',  next: 500  },
  { min: 500,  max: 999,       label: '🌳 그린 마스터',  next: 1000 },
  { min: 1000, max: Infinity,  label: '🌲 지구 수호자',  next: null },
];

export default function MyRipePage() {
  const navigate = useNavigate();
  const {
    user, logout,
    greenPoints, setGreenPoints,
    savedRecipes, removeSavedRecipe, setSelectedRecipe,
  } = useAppStore();
  const [showAllSaved, setShowAllSaved] = useState(false);
  const [showHistorySheet, setShowHistorySheet] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(() => localStorage.getItem('rr_avatarUrl'));
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAvatarClick = () => fileInputRef.current?.click();
  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const url = ev.target?.result as string;
      setAvatarUrl(url);
      localStorage.setItem('rr_avatarUrl', url);
      window.dispatchEvent(new Event('rr_avatar_changed'));
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    if (!user) return;
    recipeAPI.getGreenPoints().then((res) => setGreenPoints(res.data)).catch(console.error);
  }, [user]);

  const handleLogout = () => {
    logout();
    toast.success('로그아웃되었습니다.');
    navigate('/');
  };

  if (!user) return null;

  const totalPoints = greenPoints?.total_points || 0;
  const weeklyPoints = greenPoints?.weekly_points || 0;
  const currentLevel = LEVELS.find((l) => totalPoints >= l.min && totalPoints <= l.max) || LEVELS[0];
  const levelLabel = currentLevel.label;
  const progressPct =
    currentLevel.next !== null
      ? Math.min(100, ((totalPoints - currentLevel.min) / (currentLevel.next - currentLevel.min)) * 100)
      : 100;

  return (
    <div className="py-6 space-y-5">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>🌿 마이리피</h1>
      </div>

      {/* ── Profile Card ── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl p-6"
        style={{ background: 'linear-gradient(135deg, #16A34A, #22C55E)' }}
      >
        <div className="flex items-center gap-4 mb-4">
          {/* 사진 업로드 가능한 아바타 */}
          <button
            onClick={handleAvatarClick}
            className="relative flex-shrink-0 overflow-hidden rounded-xl"
            style={{ width: 42, height: 42, background: 'white', minHeight: 'unset' }}
            aria-label="프로필 사진 변경"
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt="프로필" className="w-full h-full object-cover" />
            ) : (
              <span className="text-2xl">{user.isGuest ? '👻' : '😊'}</span>
            )}
            {/* Hover/tap overlay */}
            <span
              className="absolute inset-0 flex items-center justify-center text-white text-xs font-semibold rounded-xl opacity-0 hover:opacity-100 transition-opacity"
              style={{ background: 'rgba(0,0,0,0.4)' }}
            >
              📷
            </span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleAvatarChange}
          />
          <div>
            <h2 className="text-xl font-bold text-white">{user.name}</h2>
            <p className="text-white/70 text-sm">{user.email}</p>
            {user.isGuest && (
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-white/20 text-white">
                게스트 모드
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 bg-white/20 rounded-xl px-4 py-2">
          <span className="text-xl">{levelLabel.split(' ')[0]}</span>
          <span className="text-white font-medium">{levelLabel.split(' ').slice(1).join(' ')}</span>
        </div>
      </motion.div>

      {/* ── Green Points ── */}
      <div className="rounded-2xl border p-5" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
        <h3 className="font-bold mb-4" style={{ color: 'var(--text)' }}>🌿 그린포인트</h3>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="p-3 rounded-xl text-center" style={{ background: 'var(--primary-light)' }}>
            <div className="text-2xl font-bold" style={{ color: 'var(--primary)' }}>{Math.round(totalPoints)}</div>
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>총 포인트</div>
          </div>
          <div className="p-3 rounded-xl text-center" style={{ background: 'var(--primary-light)' }}>
            <div className="text-2xl font-bold" style={{ color: 'var(--primary)' }}>+{Math.round(weeklyPoints)}</div>
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>이번 주</div>
          </div>
        </div>

        {/* Level progress */}
        {currentLevel.next !== null && (
          <div className="mb-4">
            <div className="flex justify-between text-xs mb-1.5">
              <span style={{ color: 'var(--text-muted)' }}>다음 레벨까지</span>
              <span style={{ color: 'var(--primary)' }}>{currentLevel.next - Math.round(totalPoints)} 포인트 남음</span>
            </div>
            <div className="h-2.5 rounded-full overflow-hidden" style={{ background: 'var(--surface-2)' }}>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progressPct}%` }}
                transition={{ duration: 0.8, delay: 0.2 }}
                className="h-full rounded-full"
                style={{ background: 'linear-gradient(90deg, #16A34A, #22C55E)' }}
              />
            </div>
          </div>
        )}

        {/* Level ladder */}
        <div className="space-y-1.5">
          {LEVELS.map((lv) => {
            const isCurrent = totalPoints >= lv.min && totalPoints <= lv.max;
            const isPast = totalPoints > lv.max;
            return (
              <div
                key={lv.label}
                className="flex items-center gap-3 px-3 py-2 rounded-xl"
                style={{
                  background: isCurrent ? 'var(--primary-light)' : 'transparent',
                  border: isCurrent ? '1px solid var(--primary-medium)' : '1px solid transparent',
                }}
              >
                <span className="text-base">{lv.label.split(' ')[0]}</span>
                <span
                  className="text-sm flex-1"
                  style={{
                    color: isCurrent ? 'var(--primary)' : isPast ? 'var(--text-subtle)' : 'var(--border)',
                    fontWeight: isCurrent ? 700 : 400,
                  }}
                >
                  {lv.label.split(' ').slice(1).join(' ')}
                  {isCurrent && <span className="ml-2 text-xs">← 현재</span>}
                </span>
                <span className="text-xs" style={{ color: 'var(--text-subtle)' }}>
                  {lv.next ? `${lv.min}~${lv.max}` : `${lv.min}+`}p
                </span>
              </div>
            );
          })}
        </div>

      </div>

      {/* ── Saved Recipes ── */}
      <div>
        <h3 className="font-bold text-base mb-3" style={{ color: 'var(--text)' }}>
          📌 저장한 레시피 ({savedRecipes.length})
        </h3>

        {savedRecipes.length === 0 ? (
          <div
            className="p-8 rounded-2xl text-center"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
          >
            <div className="text-4xl mb-3">📋</div>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              레시피 상세에서 저장하면 여기에 모여요
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {(showAllSaved ? savedRecipes : savedRecipes.slice(0, 4)).map((recipe, idx) => (
              <motion.div
                key={`${recipe.recipe_title}-${idx}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="rounded-2xl border overflow-hidden"
                style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
              >
                <div className="h-0.5" style={{ background: 'linear-gradient(90deg, #16A34A, #22C55E)' }} />
                <div className="p-4 flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate" style={{ color: 'var(--text)' }}>
                      {recipe.recipe_title}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      {CUISINE_LABELS[recipe.cuisine_type]} · {TYPE_LABELS[recipe.recipe_type]} · {recipe.estimated_total_time_minutes}분
                    </p>
                    <div
                      className="inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-full text-xs font-medium"
                      style={{ background: 'var(--primary-light)', color: 'var(--primary)' }}
                    >
                      {Math.round((recipe.match_score || 0) * 100)}% 매칭
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => {
                        setSelectedRecipe(recipe);
                        navigate(`/recipe/${idx}`);
                      }}
                      className="px-3 py-1.5 rounded-xl text-xs font-medium"
                      style={{ background: 'var(--primary-light)', color: 'var(--primary)', minHeight: 'unset' }}
                    >
                      보기
                    </button>
                    <button
                      onClick={() => removeSavedRecipe(recipe.recipe_title)}
                      className="w-8 h-8 rounded-xl text-sm"
                      style={{ background: 'var(--surface-2)', color: 'var(--text-subtle)', minHeight: 'unset' }}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
            {savedRecipes.length > 4 && !showAllSaved && (
              <button
                onClick={() => setShowAllSaved(true)}
                className="w-full py-3.5 rounded-2xl text-sm font-semibold"
                style={{ background: 'var(--surface-2)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
              >
                더보기 (+{savedRecipes.length - 4}개)
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Settings ── */}
      <div className="rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
        {[
          { label: '최근 적립 내역', icon: '🌿', onClick: () => setShowHistorySheet(true) },
          { label: '앱 정보', icon: 'ℹ️', onClick: () => {} },
          { label: '개인정보 처리방침', icon: '🔒', onClick: () => {} },
          { label: '이용약관', icon: '📄', onClick: () => {} },
        ].map((item) => (
          <button
            key={item.label}
            onClick={item.onClick}
            className="w-full flex items-center gap-3 px-5 py-4 border-b last:border-0 text-left"
            style={{ background: 'var(--surface)', borderColor: 'var(--border-light)', color: 'var(--text)' }}
          >
            <span>{item.icon}</span>
            <span className="flex-1 text-sm">{item.label}</span>
          </button>
        ))}
      </div>

      {/* ── Auth buttons ── */}
      <button
        onClick={handleLogout}
        className="w-full py-4 rounded-2xl font-semibold border-2"
        style={{ borderColor: 'var(--danger)', color: 'var(--danger)', background: 'transparent' }}
      >
        로그아웃
      </button>

      {user.isGuest && (
        <button
          onClick={() => navigate('/login')}
          className="w-full py-4 rounded-2xl font-semibold text-white"
          style={{ background: 'var(--primary)' }}
        >
          회원가입하고 데이터 저장하기
        </button>
      )}

      {/* ── History Bottom Sheet ── */}
      <AnimatePresence>
        {showHistorySheet && (
          <>
            <motion.div
              className="bottom-sheet-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowHistorySheet(false)}
            />
            <motion.div
              className="bottom-sheet"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            >
              <div className="mx-auto mb-5 rounded-full" style={{ width: 40, height: 4, background: 'var(--border)' }} />
              <h2 className="text-lg font-bold mb-5" style={{ color: 'var(--text)' }}>🌿 최근 적립 내역</h2>

              {greenPoints?.history && greenPoints.history.length > 0 ? (
                <div className="max-h-72 overflow-y-auto">
                  {greenPoints.history.slice(0, 15).map((h, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between py-3"
                      style={{ borderBottom: '1px solid var(--border-light)' }}
                    >
                      <div>
                        <p className="text-sm" style={{ color: 'var(--text)' }}>{h.reason}</p>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                          {new Date(h.earned_at).toLocaleDateString('ko-KR')}
                        </p>
                      </div>
                      <span className="font-bold text-sm" style={{ color: 'var(--primary)' }}>
                        +{h.points_earned}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-10">
                  <div className="text-4xl mb-3">🌱</div>
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>아직 적립 내역이 없어요</p>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-subtle)' }}>요리를 완성하면 그린포인트가 쌓여요</p>
                </div>
              )}

              <button
                onClick={() => setShowHistorySheet(false)}
                className="w-full mt-5 py-4 rounded-2xl font-semibold"
                style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}
              >
                닫기
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
