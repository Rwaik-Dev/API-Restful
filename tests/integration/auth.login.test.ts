import { decodeJwt, decodeProtectedHeader } from 'jose';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { SessionModel } from '../../src/modules/sessions/session.model.js';
import { createUser } from '../factories/user.factory.js';
import { useTestDatabase } from '../helpers/database.js';
import { login } from '../helpers/auth.js';

useTestDatabase();
const app = createApp();

describe('POST /auth/login', () => {
  it('returns tokens and the public user for valid credentials', async () => {
    const { user, password } = await createUser();
    const res = await login(app, user.email, password);

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      tokenType: 'Bearer',
      expiresIn: 900,
      user: { id: user.id, email: user.email },
    });
    expect(res.body.data.user).not.toHaveProperty('passwordHash');
    expect(typeof res.body.data.accessToken).toBe('string');
    expect(res.body.data.refreshToken).toMatch(/^[a-f\d]{24}\.[\w-]{43}$/);
  });

  it('issues an access token with the required claims and a fixed algorithm', async () => {
    const { user, password } = await createUser();
    const res = await login(app, user.email, password);
    const token: string = res.body.data.accessToken;

    expect(decodeProtectedHeader(token).alg).toBe('HS256');
    const claims = decodeJwt(token);
    expect(claims).toMatchObject({
      sub: user.id,
      iss: 'task-management-api',
      aud: 'task-management-clients',
    });
    expect(claims.sid).toMatch(/^[a-f\d]{24}$/);
    expect(claims.exp! - claims.iat!).toBe(900);
    expect(claims.jti).toBeDefined();
  });

  it('persists the session with only a hash of the refresh token', async () => {
    const { user, password } = await createUser();
    const res = await request(app)
      .post('/api/v1/auth/login')
      .set('User-Agent', 'vitest-agent')
      .send({ email: user.email, password, deviceName: 'Laptop' });
    const refreshToken: string = res.body.data.refreshToken;

    const session = await SessionModel.findById(refreshToken.split('.')[0]).lean();
    expect(session).not.toBeNull();
    expect(session!.userId.toString()).toBe(user.id);
    expect(session!.refreshTokenHash).toMatch(/^[a-f\d]{64}$/);
    expect(session!.refreshTokenHash).not.toContain(refreshToken);
    expect(session!.deviceName).toBe('Laptop');
    expect(session!.userAgent).toBe('vitest-agent');
    expect(session!.revokedAt).toBeNull();
  });

  it('returns the same generic 401 for wrong password and unknown e-mail', async () => {
    const { user } = await createUser();
    const wrongPassword = await login(app, user.email, 'wrong-password');
    const unknownEmail = await login(app, 'nobody@example.com', 'wrong-password');

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(wrongPassword.body.error.message).toBe(unknownEmail.body.error.message);
    expect(await SessionModel.countDocuments()).toBe(0);
  });

  it('refuses inactive accounts', async () => {
    const { user, password } = await createUser({ isActive: false });
    const res = await login(app, user.email, password);
    expect(res.status).toBe(403);
    expect(await SessionModel.countDocuments()).toBe(0);
  });

  it('returns 400 for a malformed body', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({ email: 'x' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});
