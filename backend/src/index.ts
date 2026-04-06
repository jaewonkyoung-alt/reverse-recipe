import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import path from 'path';

import authRoutes from './routes/auth';
import ingredientRoutes from './routes/ingredients';
import recipeRoutes from './routes/recipes';
import shoppingRoutes from './routes/shopping';
import visionRoutes from './routes/vision';
import purchaseRoutes from './routes/purchases';
import { authenticate } from './middleware/auth';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// Security middleware
app.use(helmet({ contentSecurityPolicy: false })); // CSP 비활성화 (static 서빙 시 필요)
const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:3000',
  'https://kaila-untempering-reconditely.ngrok-free.dev',
  /\.ngrok-free\.app$/,
  /\.ngrok-free\.dev$/,
];
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true); // 같은 서버(static 서빙)
    const allowed = allowedOrigins.some((o) =>
      typeof o === 'string' ? o === origin : o.test(origin)
    );
    callback(null, allowed);
  },
  credentials: true,
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: { error: '너무 많은 요청입니다. 잠시 후 다시 시도해주세요.' },
});

const aiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30,
  message: { error: 'AI 추천 요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' },
});

app.use(limiter);
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    service: 'Reverse Recipe API',
  });
});

// API routes (all require authentication)
app.use('/api/auth', authRoutes);
app.use('/api/ingredients', authenticate, ingredientRoutes);
app.use('/api/recipes', authenticate, aiLimiter, recipeRoutes);
app.use('/api/shopping', authenticate, shoppingRoutes);
app.use('/api/vision', authenticate, visionRoutes);    // Phase 2
app.use('/api/ocr', authenticate, visionRoutes);       // Phase 2
app.use('/api/purchases', authenticate, purchaseRoutes); // Phase 3

// ── Static frontend serving ──────────────────────────────────────────────
const distPath = path.join(__dirname, '../../frontend/dist');
app.use(express.static(distPath));
// React Router catch-all — serve index.html for any non-API path
app.get(/^(?!\/api|\/health).*/, (_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

// 404 handler (API only)
app.use((_req, res) => {
  res.status(404).json({ error: '요청한 리소스를 찾을 수 없습니다.' });
});

// Global error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: '서버 오류가 발생했습니다.' });
});

app.listen(PORT, () => {
  console.log(`
🥗 Reverse Recipe API Server
  ✅ Running on: http://localhost:${PORT}
  📊 Health check: http://localhost:${PORT}/health
  🔑 JWT Auth: Enabled
  🤖 Gemini AI: ${process.env.GEMINI_API_KEY ? 'Connected (gemini-2.5-flash)' : 'Mock Mode (no API key)'}
  `);
});

export default app;
