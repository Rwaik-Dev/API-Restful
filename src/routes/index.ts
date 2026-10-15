import { Router, type RequestHandler } from 'express';
import { createAuthRouter } from '../modules/auth/auth.routes.js';
import { createSessionRouter } from '../modules/sessions/session.routes.js';

export interface ApiRouterDeps {
  authLimiter: RequestHandler;
}

export function createApiRouter({ authLimiter }: ApiRouterDeps): Router {
  const router = Router();
  router.use('/auth', createAuthRouter(authLimiter));
  router.use('/sessions', createSessionRouter());
  return router;
}
