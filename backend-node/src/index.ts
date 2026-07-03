import 'dotenv/config';
import 'express-async-errors';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';

import { config } from './config';
import { connectDatabase } from './config/database';
import { logger } from './utils/logger';
import { errorMiddleware } from './middleware/error.middleware';

import { authRouter } from './modules/auth/auth.routes';
import { documentsRouter } from './modules/documents/documents.routes';
import { chatRouter } from './modules/chat/chat.routes';
import { marketRouter } from './modules/market/market.routes';
import { analysisRouter } from './modules/analysis/analysis.routes';
import strategiesRouter from './modules/strategies/strategies.routes';
import agentRouter      from './modules/agent/agent.routes';
import backtestRouter     from './modules/backtest/backtest.routes';
import paperTradesRouter  from './modules/paper-trades/paper-trades.routes';
import journalRouter      from './modules/journal/journal.routes';
import brokerRouter           from './modules/broker/broker.routes';
import recommendationsRouter  from './modules/recommendations/recommendations.routes';

const app = express();

// ─── Security ────────────────────────────────────────────────────────────────
app.use(helmet());
app.use(
  cors({
    origin: config.CLIENT_URL,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// ─── Parsing ─────────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ─── Logging ─────────────────────────────────────────────────────────────────
app.use(
  morgan('combined', {
    stream: { write: (msg) => logger.http(msg.trim()) },
    skip: (_req, res) => res.statusCode < 400 && config.IS_PRODUCTION,
  })
);

// ─── Rate limiting ────────────────────────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again later' },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many auth attempts, please try again later' },
});

app.use('/api/', globalLimiter);
app.use('/api/auth/', authLimiter);

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth',     authRouter);
app.use('/api/documents', documentsRouter);
app.use('/api/chat',     chatRouter);
app.use('/api/market',     marketRouter);
app.use('/api/analysis',   analysisRouter);
app.use('/api/strategies', strategiesRouter);
app.use('/api/agent',      agentRouter);
app.use('/api/backtest',     backtestRouter);
app.use('/api/paper-trades', paperTradesRouter);
app.use('/api/journal',      journalRouter);
app.use('/api/broker',           brokerRouter);
app.use('/api/recommendations',  recommendationsRouter);

// ─── Health ───────────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'trade-analyser-node', timestamp: new Date().toISOString() });
});

// ─── 404 ──────────────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// ─── Error handler ────────────────────────────────────────────────────────────
app.use(errorMiddleware);

// ─── Boot ─────────────────────────────────────────────────────────────────────
const start = async (): Promise<void> => {
  await connectDatabase();
  app.listen(config.PORT, () => {
    logger.info(`🚀 Node backend running on http://localhost:${config.PORT}`);
    logger.info(`   Environment: ${config.NODE_ENV}`);
    logger.info(`   Python AI service: ${config.PYTHON_SERVICE_URL}`);
  });
};

start().catch((err) => {
  logger.error('Fatal startup error:', err);
  process.exit(1);
});
