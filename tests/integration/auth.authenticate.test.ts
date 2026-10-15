import { SignJWT } from 'jose';
import { Types } from 'mongoose';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { SessionModel } from '../../src/modules/sessions/session.model.js';
import { UserModel } from '../../src/modules/users/user.model.js';
import { useTestDatabase } from '../helpers/database.js';
import { createLoggedInUser, type LoggedInUser } from '../helpers/auth.js';

useTestDatabase();
const app = createApp();
const secret = new TextEncoder().encode(process.env.JWT_ACCESS_SECRET);

interface ForgeOptions {
  sub: string;
  sid: string;
  issuer?: string;
  audience?: string;
  expiresAt?: number;
  key?: Uint8Array;
}

function forgeToken({
  sub,
  sid,
  issuer = 'task-management-api',
  audience = 'task-management-clients',
  expiresAt = Math.floor(Date.now() / 1000) + 600,
  key = secret,
}: ForgeOptions): Promise<string> {
  return new SignJWT({ sid })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(sub)
    .setIssuer(issuer)
    .setAudience(audience)
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .sign(key);
}

const me = (token?: string) => {
  const req = request(app).get('/api/v1/auth/me');
  return token ? req.set('Authorization', `Bearer ${token}`) : req;
};

describe('authenticate middleware + GET /auth/me', () => {
  let alice: LoggedInUser;

  beforeEach(async () => {
    alice = await createLoggedInUser(app);
  });

  it('returns the current user with a valid token', async () => {
    const res = await me(alice.accessToken);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ id: alice.userId, email: alice.email });
    expect(res.body.data).not.toHaveProperty('passwordHash');
  });

  it('rejects a missing Authorization header', async () => {
    expect((await me()).status).toBe(401);
  });

  it('rejects a non-Bearer scheme', async () => {
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Basic ${alice.accessToken}`);
    expect(res.status).toBe(401);
  });

  it('rejects a tampered signature', async () => {
    const [header, payload, signature] = alice.accessToken.split('.');
    const flipped = signature!.startsWith('A')
      ? `B${signature!.slice(1)}`
      : `A${signature!.slice(1)}`;
    expect((await me(`${header}.${payload}.${flipped}`)).status).toBe(401);
  });

  it('rejects a tampered payload', async () => {
    const [header, , signature] = alice.accessToken.split('.');
    const payload = Buffer.from(
      JSON.stringify({ sub: alice.userId, sid: alice.sessionId }),
    ).toString('base64url');
    expect((await me(`${header}.${payload}.${signature}`)).status).toBe(401);
  });

  it('rejects an unsigned token (alg none)', async () => {
    const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(
      JSON.stringify({
        sub: alice.userId,
        sid: alice.sessionId,
        iss: 'task-management-api',
        aud: 'task-management-clients',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 600,
      }),
    ).toString('base64url');
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${header}.${payload}.`);
    expect(res.status).toBe(401);
  });

  it('rejects an expired token', async () => {
    const token = await forgeToken({
      sub: alice.userId,
      sid: alice.sessionId,
      expiresAt: Math.floor(Date.now() / 1000) - 60,
    });
    expect((await me(token)).status).toBe(401);
  });

  it('rejects a wrong issuer', async () => {
    const token = await forgeToken({ sub: alice.userId, sid: alice.sessionId, issuer: 'evil' });
    expect((await me(token)).status).toBe(401);
  });

  it('rejects a wrong audience', async () => {
    const token = await forgeToken({ sub: alice.userId, sid: alice.sessionId, audience: 'evil' });
    expect((await me(token)).status).toBe(401);
  });

  it('rejects a token signed with another key', async () => {
    const token = await forgeToken({
      sub: alice.userId,
      sid: alice.sessionId,
      key: new TextEncoder().encode('another-secret-another-secret-another!!'),
    });
    expect((await me(token)).status).toBe(401);
  });

  it('rejects a revoked session', async () => {
    await SessionModel.updateOne({ _id: alice.sessionId }, { revokedAt: new Date() });
    expect((await me(alice.accessToken)).status).toBe(401);
  });

  it('rejects an expired session even before the TTL cleanup runs', async () => {
    await SessionModel.collection.updateOne(
      { _id: new Types.ObjectId(alice.sessionId) },
      { $set: { expiresAt: new Date(Date.now() - 1000) } },
    );
    expect((await me(alice.accessToken)).status).toBe(401);
  });

  it('rejects a deactivated user with a live session', async () => {
    await UserModel.updateOne({ _id: alice.userId }, { isActive: false });
    expect((await me(alice.accessToken)).status).toBe(401);
  });

  it("rejects a token pairing one user with another user's session", async () => {
    const bob = await createLoggedInUser(app);
    const token = await forgeToken({ sub: alice.userId, sid: bob.sessionId });
    expect((await me(token)).status).toBe(401);
  });
});
