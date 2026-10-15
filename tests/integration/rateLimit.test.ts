import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { useTestDatabase } from '../helpers/database.js';

useTestDatabase();

describe('rate limiting', () => {
  it.each(['/api/v1/auth/login', '/api/v1/auth/register', '/api/v1/auth/refresh'])(
    'returns 429 on %s after the auth limit is exceeded',
    async (url) => {
      const app = createApp({ rateLimit: { authMax: 3 } });
      for (let attempt = 0; attempt < 3; attempt++) {
        const res = await request(app).post(url).send({});
        expect(res.status).not.toBe(429);
      }
      const blocked = await request(app).post(url).send({});
      expect(blocked.status).toBe(429);
      expect(blocked.body.error.code).toBe('RATE_LIMITED');
      expect(blocked.headers['retry-after']).toBeDefined();
      expect(blocked.headers.ratelimit).toBeDefined();
    },
  );

  it('shares the auth budget between login and register', async () => {
    const app = createApp({ rateLimit: { authMax: 2 } });
    await request(app).post('/api/v1/auth/login').send({});
    await request(app).post('/api/v1/auth/register').send({});
    expect((await request(app).post('/api/v1/auth/refresh').send({})).status).toBe(429);
  });

  it('applies a global limit to the API', async () => {
    const app = createApp({ rateLimit: { globalMax: 2 } });
    await request(app).get('/api/v1/sessions');
    await request(app).get('/api/v1/sessions');
    expect((await request(app).get('/api/v1/sessions')).status).toBe(429);
  });

  it('does not rate limit healthchecks', async () => {
    const app = createApp({ rateLimit: { globalMax: 1 } });
    for (let attempt = 0; attempt < 3; attempt++) {
      expect((await request(app).get('/health')).status).toBe(200);
    }
  });
});
