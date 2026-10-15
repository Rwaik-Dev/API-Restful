import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    globalSetup: ['tests/setup.ts'],
    testTimeout: 20_000,
    hookTimeout: 60_000,
    env: {
      NODE_ENV: 'test',
      LOG_LEVEL: 'silent',
      JWT_ACCESS_SECRET: 'test-access-secret-with-at-least-32-characters!!',
      REFRESH_TOKEN_SECRET: 'test-refresh-secret-with-at-least-32-characters!',
      JWT_ISSUER: 'task-management-api',
      JWT_AUDIENCE: 'task-management-clients',
      CORS_ORIGINS: 'http://localhost:5173',
      RATE_LIMIT_AUTH_MAX: '10000',
      RATE_LIMIT_GLOBAL_MAX: '10000',
    },
  },
});
