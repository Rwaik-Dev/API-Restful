import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    env: {
      NODE_ENV: 'test',
      LOG_LEVEL: 'silent',
      MONGODB_URI: 'mongodb://127.0.0.1:27017/task_management_test',
      JWT_ACCESS_SECRET: 'test-access-secret-with-at-least-32-characters!!',
      REFRESH_TOKEN_SECRET: 'test-refresh-secret-with-at-least-32-characters!',
      JWT_ISSUER: 'task-management-api',
      JWT_AUDIENCE: 'task-management-clients',
      CORS_ORIGINS: 'http://localhost:5173',
    },
  },
});
