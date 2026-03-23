import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../db';
import { generateTokens } from '../middleware/auth';

const router = Router();

// POST /api/auth/register
router.post('/register', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, name, password } = req.body;

    if (!email || !name || !password) {
      res.status(400).json({ error: '이메일, 이름, 비밀번호를 모두 입력해주세요.' });
      return;
    }

    const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      res.status(409).json({ error: '이미 사용 중인 이메일입니다.' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const result = await query(
      `INSERT INTO users (email, name, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, email, name, preferences, created_at`,
      [email, name, passwordHash]
    );

    const user = result.rows[0];
    const { accessToken, refreshToken } = generateTokens(user.id, user.email);

    res.status(201).json({
      user: { id: user.id, email: user.email, name: user.name },
      accessToken,
      refreshToken,
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: '회원가입 중 오류가 발생했습니다.' });
  }
});

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: '이메일과 비밀번호를 입력해주세요.' });
      return;
    }

    const result = await query(
      'SELECT id, email, name, password_hash, preferences FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      res.status(401).json({ error: '이메일 또는 비밀번호가 올바르지 않습니다.' });
      return;
    }

    const user = result.rows[0];
    const isValid = await bcrypt.compare(password, user.password_hash);

    if (!isValid) {
      res.status(401).json({ error: '이메일 또는 비밀번호가 올바르지 않습니다.' });
      return;
    }

    const { accessToken, refreshToken } = generateTokens(user.id, user.email);

    res.json({
      user: { id: user.id, email: user.email, name: user.name, preferences: user.preferences },
      accessToken,
      refreshToken,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: '로그인 중 오류가 발생했습니다.' });
  }
});

// POST /api/auth/guest
router.post('/guest', async (_req: Request, res: Response): Promise<void> => {
  const guestId = '00000000-0000-0000-0000-000000000001';
  const { accessToken } = generateTokens(guestId, 'guest@reverse-recipe.com');

  res.json({
    user: { id: guestId, email: 'guest@reverse-recipe.com', name: '게스트' },
    accessToken,
    isGuest: true,
  });
});

// POST /api/auth/kakao (Kakao OAuth)
router.post('/kakao', async (req: Request, res: Response): Promise<void> => {
  try {
    const { kakaoAccessToken } = req.body;

    if (!kakaoAccessToken) {
      res.status(400).json({ error: '카카오 액세스 토큰이 필요합니다.' });
      return;
    }

    // Fetch Kakao user info
    const kakaoRes = await fetch('https://kapi.kakao.com/v2/user/me', {
      headers: { Authorization: `Bearer ${kakaoAccessToken}` },
    });

    if (!kakaoRes.ok) {
      res.status(401).json({ error: '카카오 인증에 실패했습니다.' });
      return;
    }

    const kakaoUser = await kakaoRes.json() as {
      id: number;
      kakao_account?: { email?: string; profile?: { nickname?: string } };
    };
    const kakaoId = String(kakaoUser.id);
    const email = kakaoUser.kakao_account?.email;
    const name = kakaoUser.kakao_account?.profile?.nickname || '카카오 사용자';

    let user = await query('SELECT * FROM users WHERE kakao_id = $1', [kakaoId]);

    if (user.rows.length === 0) {
      // Create new user
      const newUser = await query(
        `INSERT INTO users (email, name, kakao_id)
         VALUES ($1, $2, $3)
         RETURNING id, email, name`,
        [email || `kakao_${kakaoId}@reverse-recipe.com`, name, kakaoId]
      );
      user = newUser;
    }

    const { accessToken, refreshToken } = generateTokens(user.rows[0].id, user.rows[0].email);

    res.json({
      user: { id: user.rows[0].id, email: user.rows[0].email, name: user.rows[0].name },
      accessToken,
      refreshToken,
    });
  } catch (error) {
    console.error('Kakao login error:', error);
    res.status(500).json({ error: '카카오 로그인 중 오류가 발생했습니다.' });
  }
});

export default router;
