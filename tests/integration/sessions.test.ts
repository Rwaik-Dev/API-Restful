import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { SessionModel } from '../../src/modules/sessions/session.model.js';
import { useTestDatabase } from '../helpers/database.js';
import { createLoggedInUser, login, type LoggedInUser } from '../helpers/auth.js';

useTestDatabase();
const app = createApp();

const authed = (method: 'get' | 'post' | 'delete', url: string, token: string) =>
  request(app)[method](url).set('Authorization', `Bearer ${token}`);

describe('logout and session management', () => {
  let user: LoggedInUser;

  beforeEach(async () => {
    user = await createLoggedInUser(app);
  });

  describe('POST /auth/logout', () => {
    it('revokes the current session so the token stops working', async () => {
      const res = await authed('post', '/api/v1/auth/logout', user.accessToken);
      expect(res.status).toBe(204);
      expect(res.text).toBe('');

      expect((await authed('get', '/api/v1/auth/me', user.accessToken)).status).toBe(401);
      const refresh = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: user.refreshToken });
      expect(refresh.status).toBe(401);
    });

    it('is idempotent', async () => {
      await authed('post', '/api/v1/auth/logout', user.accessToken);
      expect((await authed('post', '/api/v1/auth/logout', user.accessToken)).status).toBe(204);
    });

    it('does not affect other sessions of the same user', async () => {
      const second = await login(app, user.email, user.password);
      await authed('post', '/api/v1/auth/logout', user.accessToken);
      expect((await authed('get', '/api/v1/auth/me', second.body.data.accessToken)).status).toBe(
        200,
      );
    });

    it('requires a valid token', async () => {
      expect((await request(app).post('/api/v1/auth/logout')).status).toBe(401);
    });
  });

  describe('POST /auth/logout-all', () => {
    it('revokes every session of the user', async () => {
      const second = await login(app, user.email, user.password);
      const res = await authed('post', '/api/v1/auth/logout-all', user.accessToken);
      expect(res.status).toBe(204);

      expect((await authed('get', '/api/v1/auth/me', user.accessToken)).status).toBe(401);
      expect((await authed('get', '/api/v1/auth/me', second.body.data.accessToken)).status).toBe(
        401,
      );
    });

    it("does not touch other users' sessions", async () => {
      const other = await createLoggedInUser(app);
      await authed('post', '/api/v1/auth/logout-all', user.accessToken);
      expect((await authed('get', '/api/v1/auth/me', other.accessToken)).status).toBe(200);
    });
  });

  describe('GET /sessions', () => {
    it('lists active sessions without secrets and flags the current one', async () => {
      await login(app, user.email, user.password);
      const res = await authed('get', '/api/v1/sessions', user.accessToken);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      const current = res.body.data.filter((s: { current: boolean }) => s.current);
      expect(current).toHaveLength(1);
      expect(current[0].id).toBe(user.sessionId);
      for (const session of res.body.data) {
        expect(session).not.toHaveProperty('refreshTokenHash');
        expect(session).not.toHaveProperty('tokenFamilyId');
        expect(session).not.toHaveProperty('userId');
      }
    });

    it('omits revoked sessions', async () => {
      const second = await login(app, user.email, user.password);
      await authed('post', '/api/v1/auth/logout', second.body.data.accessToken);
      const res = await authed('get', '/api/v1/sessions', user.accessToken);
      expect(res.body.data).toHaveLength(1);
    });

    it('requires authentication', async () => {
      expect((await request(app).get('/api/v1/sessions')).status).toBe(401);
    });
  });

  describe('DELETE /sessions/:sessionId', () => {
    it('revokes one of the user sessions', async () => {
      const second = await login(app, user.email, user.password);
      const secondSessionId = second.body.data.refreshToken.split('.')[0];

      const res = await authed('delete', `/api/v1/sessions/${secondSessionId}`, user.accessToken);
      expect(res.status).toBe(204);
      expect((await authed('get', '/api/v1/auth/me', second.body.data.accessToken)).status).toBe(
        401,
      );
      expect((await authed('get', '/api/v1/auth/me', user.accessToken)).status).toBe(200);
    });

    it("returns 404 for another user's session and leaves it intact", async () => {
      const other = await createLoggedInUser(app);
      const res = await authed('delete', `/api/v1/sessions/${other.sessionId}`, user.accessToken);
      expect(res.status).toBe(404);
      const session = await SessionModel.findById(other.sessionId).lean();
      expect(session?.revokedAt).toBeNull();
    });

    it('returns 400 for an invalid id', async () => {
      const res = await authed('delete', '/api/v1/sessions/not-an-id', user.accessToken);
      expect(res.status).toBe(400);
    });
  });
});
