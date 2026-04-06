import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { authAPI } from '../services/api';
import { useAppStore } from '../store';

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

interface FieldErrors {
  email?: string;
  name?: string;
  password?: string;
  general?: string;
}

export default function LoginPage() {
  const navigate = useNavigate();
  const { setUser } = useAppStore();

  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});

  const switchTab = (t: 'login' | 'register') => {
    setTab(t);
    setErrors({});
  };

  const inputStyle = (hasError?: boolean) => ({
    background: 'var(--surface)',
    color: 'var(--text)',
    border: hasError ? '1.5px solid #DC2626' : '1.5px solid transparent',
  });

  // ─── 로그인 ──────────────────────────────────────────────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: FieldErrors = {};
    if (!email.trim()) newErrors.email = '이메일을 입력해주세요.';
    else if (!isValidEmail(email)) newErrors.email = '올바른 이메일 형식이 아닙니다. (예: user@example.com)';
    if (!password) newErrors.password = '비밀번호를 입력해주세요.';
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; }

    setErrors({});
    setIsLoading(true);
    try {
      const res = await authAPI.login({ email: email.trim(), password });
      setUser(res.data.user, res.data.accessToken);
      toast.success(`${res.data.user.name}님, 환영합니다!`);
      navigate('/');
    } catch (err: unknown) {
      const axiosErr = err as { response?: { status?: number; data?: { error?: string } } };
      const status = axiosErr?.response?.status;
      const serverMsg = axiosErr?.response?.data?.error;
      if (status === 401) {
        setErrors({ general: serverMsg || '이메일 또는 비밀번호가 올바르지 않습니다.' });
      } else {
        setErrors({ general: serverMsg || '로그인 중 오류가 발생했습니다.' });
      }
    } finally {
      setIsLoading(false);
    }
  };

  // ─── 회원가입 ─────────────────────────────────────────────────
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: FieldErrors = {};
    if (!name.trim()) newErrors.name = '이름을 입력해주세요.';
    else if (name.trim().length < 2) newErrors.name = '이름은 2자 이상 입력해주세요.';
    if (!email.trim()) newErrors.email = '이메일을 입력해주세요.';
    else if (!isValidEmail(email)) newErrors.email = '올바른 이메일 형식이 아닙니다. (예: user@example.com)';
    if (!password) newErrors.password = '비밀번호를 입력해주세요.';
    else if (password.length < 6) newErrors.password = '비밀번호는 6자 이상이어야 합니다.';
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; }

    setErrors({});
    setIsLoading(true);
    try {
      const res = await authAPI.register({ email: email.trim(), name: name.trim(), password });
      setUser(res.data.user, res.data.accessToken);
      toast.success('회원가입 완료! 환영합니다 🎉');
      navigate('/');
    } catch (err: unknown) {
      const axiosErr = err as { response?: { status?: number; data?: { error?: string } } };
      const status = axiosErr?.response?.status;
      const serverMsg = axiosErr?.response?.data?.error;
      if (status === 409) {
        setErrors({ email: serverMsg || '이미 가입된 이메일입니다. 로그인을 이용해주세요.' });
      } else {
        setErrors({ general: serverMsg || '회원가입 중 오류가 발생했습니다.' });
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        className="w-full max-w-sm"
      >
        {/* 헤더 */}
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🥗</div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>리버스 레시피</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            로그인하고 냉장고를 관리해보세요
          </p>
        </div>

        {/* 탭 */}
        <div className="flex rounded-2xl p-1 mb-6" style={{ background: 'var(--surface)' }}>
          {(['login', 'register'] as const).map((t) => (
            <button
              key={t}
              onClick={() => switchTab(t)}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all"
              style={tab === t ? { background: 'var(--primary)', color: 'white' } : { color: 'var(--text-muted)' }}
            >
              {t === 'login' ? '로그인' : '회원가입'}
            </button>
          ))}
        </div>

        {/* 일반 오류 */}
        <AnimatePresence>
          {errors.general && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mb-4 px-4 py-3 rounded-2xl text-sm font-medium flex items-center gap-2"
              style={{ background: '#FEE2E2', color: '#DC2626' }}
            >
              <span>⚠️</span><span>{errors.general}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── 로그인 폼 ── */}
        {tab === 'login' && (
          <form onSubmit={handleLogin} className="space-y-1" noValidate>
            <FieldWrap error={errors.email}>
              <input type="email" placeholder="이메일" value={email}
                onChange={(e) => { setEmail(e.target.value); setErrors((p) => ({ ...p, email: undefined, general: undefined })); }}
                className="w-full px-4 py-3.5 rounded-2xl text-sm outline-none"
                style={inputStyle(!!errors.email)} autoComplete="email" />
            </FieldWrap>
            <FieldWrap error={errors.password}>
              <input type="password" placeholder="비밀번호" value={password}
                onChange={(e) => { setPassword(e.target.value); setErrors((p) => ({ ...p, password: undefined, general: undefined })); }}
                className="w-full px-4 py-3.5 rounded-2xl text-sm outline-none"
                style={inputStyle(!!errors.password)} autoComplete="current-password" />
            </FieldWrap>
            <div className="pt-2">
              <button type="submit" disabled={isLoading}
                className="w-full py-4 rounded-2xl text-white font-bold text-base"
                style={{ background: isLoading ? '#9ca3af' : 'var(--primary)' }}>
                {isLoading ? '⏳ 로그인 중...' : '로그인'}
              </button>
            </div>
          </form>
        )}

        {/* ── 회원가입 폼 ── */}
        {tab === 'register' && (
          <form onSubmit={handleRegister} className="space-y-1" noValidate>
            <FieldWrap error={errors.name}>
              <input type="text" placeholder="이름 (2자 이상)" value={name}
                onChange={(e) => { setName(e.target.value); setErrors((p) => ({ ...p, name: undefined })); }}
                className="w-full px-4 py-3.5 rounded-2xl text-sm outline-none"
                style={inputStyle(!!errors.name)} />
            </FieldWrap>
            <FieldWrap error={errors.email}>
              <input type="email" placeholder="이메일" value={email}
                onChange={(e) => { setEmail(e.target.value); setErrors((p) => ({ ...p, email: undefined })); }}
                className="w-full px-4 py-3.5 rounded-2xl text-sm outline-none"
                style={inputStyle(!!errors.email)} autoComplete="email" />
            </FieldWrap>
            <FieldWrap error={errors.password}>
              <input type="password" placeholder="비밀번호 (6자 이상)" value={password}
                onChange={(e) => { setPassword(e.target.value); setErrors((p) => ({ ...p, password: undefined })); }}
                className="w-full px-4 py-3.5 rounded-2xl text-sm outline-none"
                style={inputStyle(!!errors.password)} autoComplete="new-password" />
            </FieldWrap>
            <div className="pt-2">
              <button type="submit" disabled={isLoading}
                className="w-full py-4 rounded-2xl text-white font-bold text-base"
                style={{ background: isLoading ? '#9ca3af' : 'var(--primary)' }}>
                {isLoading ? '⏳ 처리 중...' : '회원가입'}
              </button>
            </div>
          </form>
        )}

        <button onClick={() => navigate('/')}
          className="w-full mt-4 py-3 text-sm font-medium"
          style={{ color: 'var(--text-muted)' }}>
          ← 돌아가기
        </button>
      </motion.div>
    </div>
  );
}

function FieldWrap({ children, error }: { children: React.ReactNode; error?: string }) {
  return (
    <div className="space-y-1">
      {children}
      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="text-xs px-2 pb-1"
            style={{ color: '#DC2626' }}
          >
            ⚠ {error}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
