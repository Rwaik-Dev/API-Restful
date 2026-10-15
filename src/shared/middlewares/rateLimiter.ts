import type { RequestHandler } from 'express';
import { rateLimit } from 'express-rate-limit';
import { logger } from '../../config/logger.js';

interface LimiterOptions {
  name: string;
  windowMs: number;
  limit: number;
}

export function createRateLimiter({ name, windowMs, limit }: LimiterOptions): RequestHandler {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    identifier: name,
    handler: (req, res) => {
      logger.warn(
        { event: 'security.rate_limited', limiter: name, requestId: req.id, path: req.path },
        'Rate limit exceeded',
      );
      res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMITED',
          message: 'Muitas requisições. Tente novamente mais tarde.',
          requestId: req.id,
        },
      });
    },
  });
}
