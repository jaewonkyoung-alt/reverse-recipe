import { useState, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '../store';

interface NavItem { path: string; label: string; icon: string; }

const navItems: NavItem[] = [
  { path: '/',         label: '홈',     icon: '🏠' },
  { path: '/recommend', label: '레시피',  icon: '🍽️' },
  { path: '/shopping',  label: '쇼핑',   icon: '🛒' },
  { path: '/myripe',   label: '마이리피', icon: '🌿' },
];

export default function Layout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(() => localStorage.getItem('rr_avatarUrl'));
  const { ingredients, darkMode, toggleDarkMode, cookingSession, setSelectedRecipe } = useAppStore();

  // Sync avatar when updated in MyRipePage (same tab)
  useEffect(() => {
    const onAvatarChanged = () => setAvatarUrl(localStorage.getItem('rr_avatarUrl'));
    window.addEventListener('rr_avatar_changed', onAvatarChanged);
    return () => window.removeEventListener('rr_avatar_changed', onAvatarChanged);
  }, []);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = Math.abs(e.changedTouches[0].clientY - touchStartY.current);
    if (dx > 80 && dy < 60 && touchStartX.current < 60 && !drawerOpen) {
      setDrawerOpen(true);
    }
  };

  // Apply dark / light theme to document root
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: 'var(--bg)' }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >

      {/* ───────── Fridge Drawer ───────── */}
      <AnimatePresence>
        {drawerOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-[60]"
              style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(2px)' }}
              onClick={() => setDrawerOpen(false)}
            />

            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 320 }}
              className="fixed top-0 bottom-0 z-[70] flex flex-col"
              style={{
                left: 'max(0px, calc((100vw - 430px) / 2))',
                width: '288px',
                background: 'var(--surface)',
                boxShadow: '6px 0 32px rgba(0,0,0,0.25)',
              }}
            >
              <div className="px-5 pt-12 pb-4 border-b" style={{ borderColor: 'var(--border)' }}>
                <div className="flex items-center justify-between mb-1">
                  <h2 className="text-lg font-bold" style={{ color: 'var(--text)' }}>
                    🧊 나의 냉장고
                  </h2>
                  <button
                    onClick={() => setDrawerOpen(false)}
                    className="w-8 h-8 rounded-xl text-base"
                    style={{ background: 'var(--surface-2)', color: 'var(--text-muted)', minHeight: 'unset' }}
                  >
                    ✕
                  </button>
                </div>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  총 {ingredients.length}개 재료
                </p>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {ingredients.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="text-4xl mb-3">🥦</div>
                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>재료를 추가해보세요</p>
                  </div>
                ) : (
                  ingredients.map((ing) => {
                    const urgency = ing.urgency?.level;
                    const daysLeft = ing.urgency?.days_remaining;
                    return (
                      <div
                        key={ing.id}
                        className="flex items-center justify-between px-3 py-3.5 rounded-xl"
                        style={{
                          background:
                            urgency === 'red' ? (darkMode ? 'rgba(248,113,113,0.12)' : '#FEF2F2')
                            : urgency === 'yellow' ? (darkMode ? 'rgba(251,191,36,0.12)' : '#FFFBEB')
                            : (darkMode ? 'rgba(52,211,153,0.1)' : '#F0FDF4'),
                        }}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2.5">
                            <span
                              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                              style={{
                                background:
                                  urgency === 'red' ? '#EF4444' :
                                  urgency === 'yellow' ? '#F59E0B' :
                                  '#22C55E',
                              }}
                            />
                            <p className="text-base font-semibold truncate" style={{ color: 'var(--text)' }}>
                              {ing.name}
                              {(ing.quantity || ing.unit) && (
                                <span className="text-sm" style={{ color: 'var(--text-muted)', fontWeight: 400 }}>
                                  {' '}{ing.quantity ? Math.floor(Number(ing.quantity)) : ''}{ing.unit || ''}
                                </span>
                              )}
                            </p>
                          </div>
                        </div>
                        {daysLeft !== undefined && daysLeft <= 3 && (
                          <span
                            className="text-xs px-2 py-1 rounded-full font-bold ml-2 flex-shrink-0"
                            style={{ background: darkMode ? 'rgba(248,113,113,0.2)' : '#FEE2E2', color: '#F87171' }}
                          >
                            D-{daysLeft}
                          </span>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              <div className="p-4 border-t" style={{ borderColor: 'var(--border)' }}>
                <Link
                  to="/fridge"
                  onClick={() => setDrawerOpen(false)}
                  className="w-full py-3 rounded-2xl text-white font-semibold text-sm"
                  style={{ background: 'var(--primary)', minHeight: 'unset' }}
                >
                  ➕ 재료 관리하기
                </Link>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ───────── Top Header ───────── */}
      <header
        className="sticky top-0 z-50 border-b"
        style={{
          background: 'var(--glass-bg)',
          backdropFilter: 'blur(12px)',
          borderColor: 'var(--border)',
          boxShadow: '0 1px 0 rgba(0,0,0,0.06)',
        }}
      >
        <div className="px-4 py-3 flex items-center gap-3">
          {/* Hamburger */}
          <button
            onClick={() => setDrawerOpen(true)}
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors"
            style={{
              background: 'var(--surface-2)',
              border: '1px solid var(--border)',
              color: 'var(--text)',
              minHeight: 'unset',
            }}
            aria-label="냉장고 메뉴"
          >
            <svg width="17" height="13" viewBox="0 0 17 13" fill="none">
              <rect width="17" height="2" rx="1" fill="currentColor"/>
              <rect y="5.5" width="17" height="2" rx="1" fill="currentColor"/>
              <rect y="11" width="17" height="2" rx="1" fill="currentColor"/>
            </svg>
          </button>

          {/* Logo / Cooking session indicator */}
          {cookingSession && location.pathname !== '/recipe/0' ? (
            <button
              onClick={() => { setSelectedRecipe(cookingSession.recipe); navigate('/recipe/0'); }}
              className="flex-1 flex flex-col items-center justify-center gap-0.5 px-3 py-1.5 rounded-2xl"
              style={{
                minHeight: 'unset',
                background: 'linear-gradient(135deg, #16A34A, #22C55E)',
                boxShadow: '0 2px 8px rgba(22, 163, 74, 0.35)',
              }}
            >
              <span
                className="text-xs font-bold w-full text-center overflow-hidden text-white"
                style={{ maxWidth: '160px', display: 'block', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}
              >
                🍳 {cookingSession.recipe.recipe_title}
              </span>
              <span className="text-xs text-white/80">
                {cookingSession.completedSteps.length}/{cookingSession.recipe.steps.length}단계 진행 중 →
              </span>
            </button>
          ) : (
            <Link to="/" className="flex flex-col items-center no-underline flex-1" style={{ minHeight: 'unset' }}>
              <h1 className="text-base font-bold leading-none tracking-tight" style={{ color: 'var(--text)' }}>
                리버스 레시피
              </h1>
              <p className="text-xs mt-0.5 leading-none" style={{ color: 'var(--text-muted)' }}>
                냉장고에서 시작되는 나의 요리
              </p>
            </Link>
          )}

          {/* Dark mode toggle */}
          <button
            onClick={toggleDarkMode}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-base transition-colors flex-shrink-0"
            style={{
              background: 'var(--surface-2)',
              color: 'var(--text-muted)',
              border: '1px solid var(--border)',
              minHeight: 'unset',
            }}
            aria-label="다크모드 토글"
          >
            {darkMode ? '☀️' : '🌙'}
          </button>

          {/* Profile */}
          <Link
            to="/myripe"
            className="w-9 h-9 rounded-xl overflow-hidden flex items-center justify-center text-sm font-bold transition-colors flex-shrink-0"
            style={{
              background: 'var(--surface-2)',
              color: 'var(--text-muted)',
              border: '1px solid var(--border)',
              minHeight: 'unset',
            }}
          >
            {avatarUrl
              ? <img src={avatarUrl} alt="프로필" className="w-full h-full object-cover" />
              : '👤'
            }
          </Link>
        </div>
      </header>

      {/* ───────── Main Content ───────── */}
      <main className="flex-1 px-4 pb-24">
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18 }}
        >
          {children}
        </motion.div>
      </main>

      {/* ───────── Bottom Navigation ───────── */}
      <nav
        className="fixed bottom-0 z-50 border-t"
        style={{
          background: 'var(--glass-nav)',
          backdropFilter: 'blur(12px)',
          borderColor: 'var(--border)',
          width: '100%',
          maxWidth: '430px',
          left: '50%',
          transform: 'translateX(-50%)',
        }}
      >
        <div className="flex">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path ||
              (item.path === '/myripe' && location.pathname === '/profile');
            const isRecipeTab = item.path === '/recommend';

            const handleNavClick = (e: React.MouseEvent) => {
              // 레시피 탭을 누를 때 진행중인 요리가 있으면 해당 레시피 페이지로 이동
              if (isRecipeTab && cookingSession && location.pathname !== '/recipe/0') {
                e.preventDefault();
                setSelectedRecipe(cookingSession.recipe);
                navigate('/recipe/0');
              }
            };

            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={handleNavClick}
                className="flex-1 flex flex-col items-center justify-center py-2.5 gap-0.5 transition-colors relative"
                style={{
                  color: isActive ? 'var(--primary)' : 'var(--text-subtle)',
                  minHeight: '56px',
                  textDecoration: 'none',
                }}
              >
                {isActive && (
                  <motion.div
                    layoutId="navBg"
                    className="absolute inset-x-3 inset-y-1 rounded-xl"
                    style={{ background: 'var(--primary-light)' }}
                  />
                )}
                {/* 요리 진행중이면 레시피 탭에 인디케이터 표시 */}
                {isRecipeTab && cookingSession && (
                  <span className="absolute top-1 right-3 w-2 h-2 rounded-full" style={{ background: '#F97316' }} />
                )}
                <span className="text-xl relative z-10">{item.icon}</span>
                <span className="text-xs font-medium relative z-10">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
