import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app.js';
import { taskService } from '../../src/modules/tasks/task.service.js';
import { useTestDatabase } from '../helpers/database.js';
import { createLoggedInUser, type LoggedInUser } from '../helpers/auth.js';

useTestDatabase();
const app = createApp();

describe('HTTP hardening', () => {
  describe('security headers', () => {
    it('sets Helmet headers and hides the framework', async () => {
      const res = await request(app).get('/health');
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['content-security-policy']).toBeDefined();
      expect(res.headers['strict-transport-security']).toBeDefined();
      expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
      expect(res.headers['x-powered-by']).toBeUndefined();
    });
  });

  describe('CORS', () => {
    it('allows a configured origin', async () => {
      const res = await request(app).get('/health').set('Origin', 'http://localhost:5173');
      expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
      expect(res.headers['access-control-allow-credentials']).toBeUndefined();
    });

    it('does not grant access to an unlisted origin', async () => {
      const res = await request(app).get('/health').set('Origin', 'https://evil.example');
      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });

    it('answers preflight only for allowed origins', async () => {
      const allowed = await request(app)
        .options('/api/v1/tasks')
        .set('Origin', 'http://localhost:5173')
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'authorization,content-type');
      expect(allowed.status).toBe(204);
      expect(allowed.headers['access-control-allow-headers']).toContain('Authorization');

      const denied = await request(app)
        .options('/api/v1/tasks')
        .set('Origin', 'https://evil.example')
        .set('Access-Control-Request-Method', 'POST');
      expect(denied.headers['access-control-allow-origin']).toBeUndefined();
    });
  });

  describe('payload limits', () => {
    it('rejects bodies larger than the configured limit with 413', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'a@example.com', password: 'x'.repeat(200 * 1024) });
      expect(res.status).toBe(413);
      expect(res.body.error.code).toBe('PAYLOAD_TOO_LARGE');
    });
  });

  describe('unexpected errors', () => {
    let user: LoggedInUser;

    beforeEach(async () => {
      user = await createLoggedInUser(app);
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('returns a generic 500 without stack traces or internal details', async () => {
      vi.spyOn(taskService, 'list').mockRejectedValue(
        new Error('connection failed: mongodb://admin:s3cr3t@db:27017'),
      );
      const res = await request(app)
        .get('/api/v1/tasks')
        .set('Authorization', `Bearer ${user.accessToken}`);

      expect(res.status).toBe(500);
      expect(res.body).toEqual({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Erro interno inesperado.',
          requestId: res.headers['x-request-id'],
        },
      });
      expect(res.text).not.toContain('s3cr3t');
      expect(res.text).not.toContain('stack');
      expect(res.text).not.toContain('at ');
    });
  });
});
