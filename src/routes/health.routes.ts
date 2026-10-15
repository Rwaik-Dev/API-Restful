import { Router } from 'express';
import { isDatabaseReady } from '../config/database.js';

export const healthRouter = Router();

healthRouter.get('/health', (_req, res) => {
  res.status(200).json({ success: true, data: { status: 'ok' } });
});

healthRouter.get('/ready', (req, res) => {
  if (isDatabaseReady()) {
    res.status(200).json({ success: true, data: { status: 'ready' } });
    return;
  }
  res.status(503).json({
    success: false,
    error: {
      code: 'SERVICE_UNAVAILABLE',
      message: 'Dependências essenciais indisponíveis.',
      requestId: req.id,
    },
  });
});
