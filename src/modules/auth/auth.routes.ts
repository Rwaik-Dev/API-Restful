import { Router, type RequestHandler } from 'express';
import { authenticate } from '../../shared/middlewares/authenticate.js';
import { validate } from '../../shared/middlewares/validate.js';
import { authController } from './auth.controller.js';
import { loginSchema, refreshSchema, registerSchema } from './auth.validation.js';

export function createAuthRouter(authLimiter: RequestHandler): Router {
  const router = Router();

  router.post(
    '/register',
    authLimiter,
    validate({ body: registerSchema }),
    authController.register,
  );
  router.post('/login', authLimiter, validate({ body: loginSchema }), authController.login);
  router.post('/refresh', authLimiter, validate({ body: refreshSchema }), authController.refresh);
  router.post('/logout', authController.logout);
  router.post('/logout-all', authenticate, authController.logoutAll);
  router.get('/me', authenticate, authController.me);

  return router;
}
