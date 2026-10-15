import express, { type Express } from 'express';
import { env } from './config/env.js';
import { errorHandler, notFoundHandler } from './shared/errors/errorHandler.js';
import { requestId } from './shared/middlewares/requestId.js';
import { requestLogger } from './shared/middlewares/requestLogger.js';
import { healthRouter } from './routes/health.routes.js';
import { createApiRouter } from './routes/index.js';

export function createApp(): Express {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', env.TRUST_PROXY);

  app.use(requestId);
  app.use(requestLogger);
  app.use(express.json({ limit: env.JSON_BODY_LIMIT }));

  app.use(healthRouter);
  app.use(env.API_PREFIX, createApiRouter());

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
