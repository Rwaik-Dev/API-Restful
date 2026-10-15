import express, { type Express } from 'express';
import { env } from './config/env.js';
import { errorHandler, notFoundHandler } from './shared/errors/errorHandler.js';
import { createRateLimiter } from './shared/middlewares/rateLimiter.js';
import { requestId } from './shared/middlewares/requestId.js';
import { requestLogger } from './shared/middlewares/requestLogger.js';
import { healthRouter } from './routes/health.routes.js';
import { createApiRouter } from './routes/index.js';

export interface AppOptions {
  rateLimit?: {
    windowMs?: number;
    authMax?: number;
    globalMax?: number;
  };
}

export function createApp(options: AppOptions = {}): Express {
  const app = express();
  const windowMs = options.rateLimit?.windowMs ?? env.RATE_LIMIT_WINDOW_MS;

  app.disable('x-powered-by');
  app.set('trust proxy', env.TRUST_PROXY);

  app.use(requestId);
  app.use(requestLogger);
  app.use(express.json({ limit: env.JSON_BODY_LIMIT }));

  app.use(healthRouter);
  app.use(
    env.API_PREFIX,
    createRateLimiter({
      name: 'global',
      windowMs,
      limit: options.rateLimit?.globalMax ?? env.RATE_LIMIT_GLOBAL_MAX,
    }),
    createApiRouter({
      authLimiter: createRateLimiter({
        name: 'auth',
        windowMs,
        limit: options.rateLimit?.authMax ?? env.RATE_LIMIT_AUTH_MAX,
      }),
    }),
  );

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
