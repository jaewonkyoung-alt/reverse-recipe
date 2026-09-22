import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthPayload } from '../types';

export interface AuthRequest extends Request {
  user?: AuthPayload;
}

const JWT_SECRET = process.env.JWT_SECRET || 'reverse-recipe-secret-key-change-in-production';

// httpOnly 쿠키에서 access_token 추출 (cookie-parser 없이 직접 파싱)
function extractCookieToken(cookieHeader: string | undefined): string | undefined {
  if (!cookieHeader) return undefined;
  const entry = cookieHeader.split(';').map((c) => c.trim()).find((c) => c.startsWith('access_token='));
  return entry ? entry.slice('access_token='.length) : undefined;
}

// 쿠키(우선) → Authorization 헤더(폴백) 순으로 토큰 탐색
function resolveToken(req: Request): string | undefined {
  return extractCookieToken(req.headers.cookie)
    ?? (req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.split(' ')[1]
      : undefined);
}

export const authenticate = (req: AuthRequest, res: Response, next: NextFunction): void => {
  const token = resolveToken(req);

  if (!token) {
    // 인증 없으면 게스트로 처리
    req.user = { userId: '00000000-0000-0000-0000-000000000001', email: 'guest@reverse-recipe.com' };
    next();
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthPayload;
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: '유효하지 않은 토큰입니다.' });
  }
};

export const requireAuth = (req: AuthRequest, res: Response, next: NextFunction): void => {
  const token = resolveToken(req);

  if (!token) {
    res.status(401).json({ error: '로그인이 필요합니다.' });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthPayload;
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: '유효하지 않은 토큰입니다.' });
  }
};

export const generateTokens = (userId: string, email: string) => {
  const accessToken = jwt.sign({ userId, email }, JWT_SECRET, { expiresIn: '7d' });
  const refreshToken = jwt.sign({ userId, email }, JWT_SECRET, { expiresIn: '30d' });
  return { accessToken, refreshToken };
};

const IS_PROD = process.env.NODE_ENV === 'production';

export const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: IS_PROD,
  sameSite: 'lax' as const,
  path: '/',
};

export const ACCESS_COOKIE_OPTS = {
  ...COOKIE_OPTIONS,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7일
};

export const REFRESH_COOKIE_OPTS = {
  ...COOKIE_OPTIONS,
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30일
};
