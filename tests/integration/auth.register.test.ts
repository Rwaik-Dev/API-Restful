import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { UserModel } from '../../src/modules/users/user.model.js';
import { useTestDatabase } from '../helpers/database.js';
import { buildUserInput } from '../factories/user.factory.js';

useTestDatabase();
const app = createApp();
const url = '/api/v1/auth/register';

describe('POST /auth/register', () => {
  it('creates a user and never returns the password hash', async () => {
    const input = buildUserInput();
    const res = await request(app).post(url).send(input);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({ name: input.name, email: input.email, role: 'user' });
    expect(res.body.data).not.toHaveProperty('passwordHash');
    expect(res.body.data).not.toHaveProperty('password');
  });

  it('stores an Argon2id hash instead of the password', async () => {
    const input = buildUserInput();
    await request(app).post(url).send(input);
    const stored = await UserModel.findOne({ email: input.email }).select('+passwordHash').lean();
    expect(stored?.passwordHash).toMatch(/^\$argon2id\$/);
    expect(stored?.passwordHash).not.toContain(input.password);
  });

  it('normalizes the e-mail', async () => {
    const res = await request(app)
      .post(url)
      .send(buildUserInput({ email: '  Mixed.Case@Example.COM ' }));
    expect(res.status).toBe(201);
    expect(res.body.data.email).toBe('mixed.case@example.com');
  });

  it('returns 409 for a duplicate e-mail regardless of case', async () => {
    await request(app)
      .post(url)
      .send(buildUserInput({ email: 'dup@example.com' }));
    const res = await request(app)
      .post(url)
      .send(buildUserInput({ email: 'DUP@example.com' }));
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('does not allow self-promotion to admin', async () => {
    const input = { ...buildUserInput(), role: 'admin' };
    const res = await request(app).post(url).send(input);
    expect(res.status).toBe(400);
    expect(res.body.error.details).toContainEqual({
      field: 'role',
      message: 'Campo não permitido.',
    });
    expect(await UserModel.countDocuments({ role: 'admin' })).toBe(0);
  });

  it.each([
    ['missing name', { name: undefined }, 'name'],
    ['invalid e-mail', { email: 'not-an-email' }, 'email'],
    ['short password', { password: '123' }, 'password'],
  ])('returns 400 for %s', async (_label, override, field) => {
    const res = await request(app)
      .post(url)
      .send({ ...buildUserInput(), ...override });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.map((d: { field: string }) => d.field)).toContain(field);
  });
});
