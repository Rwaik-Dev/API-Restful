import cors from 'cors';
import type { RequestHandler } from 'express';
import helmet from 'helmet';

export function securityHeaders(isProduction: boolean): RequestHandler {
  return helmet({
    contentSecurityPolicy: {
      directives: {
        // Fora de produção a API roda em HTTP; o upgrade quebraria os assets do Swagger UI.
        upgradeInsecureRequests: isProduction ? [] : null,
      },
    },
  });
}

/** Requisições sem `Origin` (curl, servidores) passam; navegadores só nas origens configuradas. */
export function corsPolicy(allowedOrigins: string[]): RequestHandler {
  const allowlist = new Set(allowedOrigins);
  return cors({
    origin: (origin, callback) => {
      callback(null, origin === undefined || allowlist.has(origin));
    },
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    allowedHeaders: ['Authorization', 'Content-Type', 'X-Request-Id'],
    exposedHeaders: ['X-Request-Id', 'RateLimit', 'RateLimit-Policy', 'Retry-After'],
    credentials: false,
    maxAge: 600,
  });
}
