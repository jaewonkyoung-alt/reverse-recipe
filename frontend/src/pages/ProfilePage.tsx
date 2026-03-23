import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store';
import { recipeAPI } from '../services/api';
import toast from 'react-hot-toast';

export default function ProfilePage() {
  const navigate = useNavigate();
  const { user, logout, greenPoints, setGreenPoints } = useAppStore();

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

  // 5-level system
  const LEVELS = [
    { min: 0,    max: 49,   label: '🌾 새싹 요리사',  next: 50   },
    { min: 50,   max: 199,  label: '🌱 환경 지킴이',  next: 200  },
    { min: 200,  max: 499,  label: '🌿 에코 챔피언',  next: 500  },
    { min: 500,  max: 999,  label: '🌳 그린 마스터',  next: 1000 },
    { min: 1000, max: Infinity, label: '🌲 지구 수호자', next: null },
  ];
  const currentLevel = LEVELS.find(l => totalPoints >= l.min && totalPoints <= l.max) || LEVELS[0];
  const level = currentLevel.label;

  return (
    <div className="py-6 space-y-5">
      <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>👤 내 프로필</h1>

      {/* Profile card */}
      <div
        className="rounded-3xl p-6"
        style={{ background: 'linear-gradient(135deg, #10B981, #34D399)' }}
      >
        <div className="flex items-center gap-4 mb-4">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl"
            style={{ background: 'white' }}
          >
            {user.isGuest ? '👻' : '😊'}
          </div>
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
          <span className="text-xl">{level.split(' ')[0]}</span>
          <span className="text-white font-medium">{level.split(' ').slice(1).join(' ')}</span>
        </div>
      </div>

      {/* Green Points Dashboard */}
      <div className="rounded-2xl border p-5" style={{ background: 'white', borderColor: '#e5e7eb' }}>
        <h3 className="font-bold mb-4" style={{ color: 'var(--text)' }}>🌿 환경 점수 (그린포인트)</h3>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="p-3 rounded-xl text-center" style={{ background: '#F0FDF4' }}>
            <div className="text-2xl font-bold" style={{ color: 'var(--primary)' }}>
              {Math.round(totalPoints)}
            </div>
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>총 포인트</div>
          </div>
          <div className="p-3 rounded-xl text-center" style={{ background: '#F0FDF4' }}>
            <div className="text-2xl font-bold" style={{ color: 'var(--primary)' }}>
              {Math.round(weeklyPoints)}
            </div>
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>이번 주</div>
          </div>
        </div>

        {/* Level ladder */}
        <div className="space-y-2 mb-4">
          {LEVELS.map((lv) => {
            const isCurrentLevel = totalPoints >= lv.min && totalPoints <= lv.max;
            const isPast = totalPoints > lv.max;
            return (
              <div
                key={lv.label}
                className="flex items-center gap-3 px-3 py-2 rounded-xl"
                style={{
                  background: isCurrentLevel ? '#F0FDF4' : isPast ? '#F9FAFB' : 'transparent',
                  border: isCurrentLevel ? '1px solid #BBF7D0' : '1px solid transparent',
                }}
              >
                <span className="text-lg">{lv.label.split(' ')[0]}</span>
                <span
                  className="text-sm flex-1"
                  style={{
                    color: isCurrentLevel ? 'var(--primary)' : isPast ? '#9CA3AF' : '#D1D5DB',
                    fontWeight: isCurrentLevel ? 700 : 400,
                  }}
                >
                  {lv.label.split(' ').slice(1).join(' ')}
                  {isCurrentLevel && <span className="ml-2 text-xs">← 현재</span>}
                </span>
                <span className="text-xs" style={{ color: '#9CA3AF' }}>
                  {lv.min === 0 ? '~49' : lv.next ? `${lv.min}~${lv.max}` : `${lv.min}+`}p
                </span>
              </div>
            );
          })}
        </div>

        {/* Progress to next level */}
        {currentLevel.next !== null && (
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span style={{ color: 'var(--text-muted)' }}>다음 레벨까지</span>
              <span style={{ color: 'var(--primary)' }}>
                {currentLevel.next - Math.round(totalPoints)} 포인트 남음
              </span>
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ background: '#F3F4F6' }}>
              <div
                className="h-full rounded-full"
                style={{
                  background: 'linear-gradient(90deg, var(--primary), #34D399)',
                  width: `${Math.min(100, ((totalPoints - currentLevel.min) / (currentLevel.next - currentLevel.min)) * 100)}%`,
                }}
              />
            </div>
          </div>
        )}

        {/* Recent history */}
        {greenPoints?.history && greenPoints.history.length > 0 && (
          <div className="mt-4">
            <p className="text-sm font-medium mb-2" style={{ color: 'var(--text)' }}>최근 적립 내역</p>
            {greenPoints.history.slice(0, 5).map((h, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b last:border-0" style={{ borderColor: '#f3f4f6' }}>
                <div>
                  <p className="text-sm" style={{ color: 'var(--text)' }}>{h.reason}</p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {new Date(h.earned_at).toLocaleDateString('ko-KR')}
                  </p>
                </div>
                <span className="font-bold text-sm" style={{ color: 'var(--primary)' }}>
                  +{h.points_earned}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Settings */}
      <div className="rounded-2xl border overflow-hidden" style={{ borderColor: '#e5e7eb' }}>
        {[
          { label: '앱 정보', icon: 'ℹ️' },
          { label: '개인정보 처리방침', icon: '🔒' },
          { label: '이용약관', icon: '📄' },
        ].map((item) => (
          <button
            key={item.label}
            className="w-full flex items-center gap-3 px-5 py-4 border-b last:border-0 text-left"
            style={{ background: 'white', borderColor: '#f3f4f6', color: 'var(--text)' }}
          >
            <span>{item.icon}</span>
            <span className="flex-1 text-sm">{item.label}</span>
            <span style={{ color: '#9CA3AF' }}>→</span>
          </button>
        ))}
      </div>

      {/* Logout */}
      <button
        onClick={handleLogout}
        className="w-full py-4 rounded-2xl font-semibold border-2"
        style={{ borderColor: '#EF4444', color: '#EF4444' }}
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
    </div>
  );
}
