import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { SessionModel } from '../../src/modules/sessions/session.model.js';
import { UserModel } from '../../src/modules/users/user.model.js';
import { useTestDatabase } from '../helpers/database.js';
import { createLoggedInUser, type LoggedInUser } from '../helpers/auth.js';

useTestDatabase();
const app = createApp();

const refresh = (refreshToken: string) =>
  request(app).post('/api/v1/auth/refresh').send({ refreshToken });

describe('POST /auth/refresh', () => {
  let user: LoggedInUser;

  beforeEach(async () => {
    user = await createLoggedInUser(app);
  });

  it('rotates the refresh token and issues a working access token', async () => {
    const res = await refresh(user.refreshToken);

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ tokenType: 'Bearer', expiresIn: 900 });
    expect(res.body.data.refreshToken).not.toBe(user.refreshToken);
    expect(res.body.data.refreshToken.split('.')[0]).toBe(user.sessionId);

    const me = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${res.body.data.accessToken}`);
    expect(me.status).toBe(200);
  });

  it('allows chaining rotations with the latest token', async () => {
    const first = await refresh(user.refreshToken);
    const second = await refresh(first.body.data.refreshToken);
    expect(second.status).toBe(200);
  });

  it('detects reuse of a rotated token and revokes the whole session', async () => {
    const rotated = await refresh(user.refreshToken);
    expect(rotated.status).toBe(200);

    const reuse = await refresh(user.refreshToken);
    expect(reuse.status).toBe(401);

    const session = await SessionModel.findById(user.sessionId).lean();
    expect(session?.revokedAt).toBeInstanceOf(Date);

    expect((await refresh(rotated.body.data.refreshToken)).status).toBe(401);
    const me = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${rotated.body.data.accessToken}`);
    expect(me.status).toBe(401);
  });

  it('lets only one of two concurrent refreshes with the same token win', async () => {
    const results = await Promise.all([refresh(user.refreshToken), refresh(user.refreshToken)]);
    const statuses = results.map((res) => res.status).sort();
    expect(statuses).toEqual([200, 401]);
  });

  it.each([
    ['garbage', 'not-a-token'],
    ['unknown session', `${'a'.repeat(24)}.${'b'.repeat(43)}`],
    ['extra segments', 'a.b.c'],
  ])('rejects a %s token with 401', async (_label, token) => {
    expect((await refresh(token)).status).toBe(401);
  });

  it('rejects a token for a revoked session', async () => {
    await SessionModel.updateOne({ _id: user.sessionId }, { revokedAt: new Date() });
    expect((await refresh(user.refreshToken)).status).toBe(401);
  });

  it('rejects a token for an expired session', async () => {
    await SessionModel.updateOne(
      { _id: user.sessionId },
      { expiresAt: new Date(Date.now() - 1000) },
    );
    expect((await refresh(user.refreshToken)).status).toBe(401);
  });

  it('rejects refresh for a deactivated user', async () => {
    await UserModel.updateOne({ _id: user.userId }, { isActive: false });
    expect((await refresh(user.refreshToken)).status).toBe(401);
  });

  it('returns 400 when refreshToken is missing', async () => {
    const res = await request(app).post('/api/v1/auth/refresh').send({});
    expect(res.status).toBe(400);
  });
});
