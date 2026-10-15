import { z } from 'zod';

const durationPattern = /^\d+[smhd]$/;

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    API_PREFIX: z.string().startsWith('/').default('/api/v1'),
    MONGODB_URI: z.string().regex(/^mongodb(\+srv)?:\/\//, 'Deve ser uma URI MongoDB válida'),
    JWT_ACCESS_SECRET: z.string().min(32, 'Use pelo menos 32 caracteres'),
    REFRESH_TOKEN_SECRET: z.string().min(32, 'Use pelo menos 32 caracteres'),
    JWT_ISSUER: z.string().min(1),
    JWT_AUDIENCE: z.string().min(1),
    ACCESS_TOKEN_TTL: z
      .string()
      .regex(durationPattern, 'Use o formato <número><s|m|h|d>, ex.: 15m')
      .default('15m'),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(365).default(30),
    CORS_ORIGINS: z
      .string()
      .default('')
      .transform((value) =>
        value
          .split(',')
          .map((origin) => origin.trim())
          .filter(Boolean),
      )
      .pipe(z.array(z.url())),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
    JSON_BODY_LIMIT: z.string().default('100kb'),
    REQUEST_TIMEOUT_MS: z.coerce.number().int().min(1000).default(10000),
    TRUST_PROXY: z.stringbool().default(false),
    RATE_LIMIT_WINDOW_MS: z.coerce
      .number()
      .int()
      .positive()
      .default(15 * 60 * 1000),
    RATE_LIMIT_AUTH_MAX: z.coerce.number().int().positive().default(10),
    RATE_LIMIT_GLOBAL_MAX: z.coerce.number().int().positive().default(300),
  })
  .refine((env) => env.JWT_ACCESS_SECRET !== env.REFRESH_TOKEN_SECRET, {
    message: 'JWT_ACCESS_SECRET e REFRESH_TOKEN_SECRET devem ser diferentes',
    path: ['REFRESH_TOKEN_SECRET'],
  });

export type Env = z.infer<typeof envSchema>;

export function parseEnv(source: NodeJS.ProcessEnv): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    throw new Error(`Configuração de ambiente inválida:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}

function loadDotEnv(): void {
  if (process.env.NODE_ENV === 'test') return;
  try {
    process.loadEnvFile();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
}

loadDotEnv();

export const env = parseEnv(process.env);
