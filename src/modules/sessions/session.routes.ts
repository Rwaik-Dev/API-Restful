import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../../shared/middlewares/authenticate.js';
import { objectIdSchema, validate } from '../../shared/middlewares/validate.js';
import { sessionController } from './session.controller.js';

const sessionParamsSchema = z.strictObject({ sessionId: objectIdSchema });

export function createSessionRouter(): Router {
  const router = Router();

  router.use(authenticate);
  router.get('/', sessionController.list);
  router.delete('/:sessionId', validate({ params: sessionParamsSchema }), sessionController.revoke);

  return router;
}
