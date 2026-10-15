import { Types } from 'mongoose';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { createUser } from '../factories/user.factory.js';
import { createTask } from '../factories/task.factory.js';
import { useTestDatabase } from '../helpers/database.js';
import { createLoggedInUser, login, type LoggedInUser } from '../helpers/auth.js';
import {
  expectToMatchContract,
  listDocumentedOperations,
  openApiDocument,
} from '../helpers/openapi.js';

useTestDatabase();
const app = createApp();
const api = '/api/v1';
const randomId = () => new Types.ObjectId().toString();

describe('OpenAPI contract', () => {
  let user: LoggedInUser;
  const bearer = () => ({ Authorization: `Bearer ${user.accessToken}` });

  beforeEach(async () => {
    user = await createLoggedInUser(app);
  });

  describe('auth', () => {
    it('register: 201, 400, 409', async () => {
      const body = { name: 'Contract', email: 'contract@example.com', password: 'long-password' };
      expectToMatchContract(
        await request(app).post(`${api}/auth/register`).send(body),
        'post',
        '/auth/register',
        201,
      );
      expectToMatchContract(
        await request(app).post(`${api}/auth/register`).send(body),
        'post',
        '/auth/register',
        409,
      );
      expectToMatchContract(
        await request(app).post(`${api}/auth/register`).send({}),
        'post',
        '/auth/register',
        400,
      );
    });

    it('login: 200, 401, 403', async () => {
      expectToMatchContract(
        await login(app, user.email, user.password),
        'post',
        '/auth/login',
        200,
      );
      expectToMatchContract(await login(app, user.email, 'wrong'), 'post', '/auth/login', 401);
      const inactive = await createUser({ isActive: false });
      expectToMatchContract(
        await login(app, inactive.user.email, inactive.password),
        'post',
        '/auth/login',
        403,
      );
    });

    it('refresh: 200, 401, 400', async () => {
      const ok = await request(app)
        .post(`${api}/auth/refresh`)
        .send({ refreshToken: user.refreshToken });
      expectToMatchContract(ok, 'post', '/auth/refresh', 200);
      const reused = await request(app)
        .post(`${api}/auth/refresh`)
        .send({ refreshToken: user.refreshToken });
      expectToMatchContract(reused, 'post', '/auth/refresh', 401);
      expectToMatchContract(
        await request(app).post(`${api}/auth/refresh`).send({}),
        'post',
        '/auth/refresh',
        400,
      );
    });

    it('me: 200, 401', async () => {
      expectToMatchContract(
        await request(app).get(`${api}/auth/me`).set(bearer()),
        'get',
        '/auth/me',
        200,
      );
      expectToMatchContract(await request(app).get(`${api}/auth/me`), 'get', '/auth/me', 401);
    });

    it('logout-all and logout: 204', async () => {
      const second = await createLoggedInUser(app);
      expectToMatchContract(
        await request(app)
          .post(`${api}/auth/logout`)
          .set('Authorization', `Bearer ${second.accessToken}`),
        'post',
        '/auth/logout',
        204,
      );
      expectToMatchContract(
        await request(app).post(`${api}/auth/logout-all`).set(bearer()),
        'post',
        '/auth/logout-all',
        204,
      );
    });
  });

  describe('sessions', () => {
    it('list: 200; revoke: 204, 404, 400', async () => {
      expectToMatchContract(
        await request(app).get(`${api}/sessions`).set(bearer()),
        'get',
        '/sessions',
        200,
      );

      const other = await login(app, user.email, user.password);
      const otherId: string = other.body.data.refreshToken.split('.')[0];
      const path = '/sessions/{sessionId}';
      expectToMatchContract(
        await request(app).delete(`${api}/sessions/${otherId}`).set(bearer()),
        'delete',
        path,
        204,
      );
      expectToMatchContract(
        await request(app).delete(`${api}/sessions/${randomId()}`).set(bearer()),
        'delete',
        path,
        404,
      );
      expectToMatchContract(
        await request(app).delete(`${api}/sessions/bad`).set(bearer()),
        'delete',
        path,
        400,
      );
    });
  });

  describe('tasks', () => {
    it('create: 201, 400', async () => {
      const created = await request(app)
        .post(`${api}/tasks`)
        .set(bearer())
        .send({ title: 'Contract', dueDate: '2026-10-25T18:00:00.000Z', tags: ['a'] });
      expectToMatchContract(created, 'post', '/tasks', 201);
      expectToMatchContract(
        await request(app).post(`${api}/tasks`).set(bearer()).send({}),
        'post',
        '/tasks',
        400,
      );
    });

    it('list: 200, 400', async () => {
      await createTask(user.userId, { status: 'completed', dueDate: new Date(), description: 'd' });
      await createTask(user.userId);
      expectToMatchContract(
        await request(app).get(`${api}/tasks?limit=1`).set(bearer()),
        'get',
        '/tasks',
        200,
      );
      expectToMatchContract(
        await request(app).get(`${api}/tasks?limit=500`).set(bearer()),
        'get',
        '/tasks',
        400,
      );
    });

    it('get, patch, delete: success and errors', async () => {
      const task = await createTask(user.userId);
      const path = '/tasks/{taskId}';
      const url = `${api}/tasks/${task.id}`;

      expectToMatchContract(await request(app).get(url).set(bearer()), 'get', path, 200);
      expectToMatchContract(
        await request(app).get(`${api}/tasks/${randomId()}`).set(bearer()),
        'get',
        path,
        404,
      );
      expectToMatchContract(
        await request(app).get(`${api}/tasks/bad`).set(bearer()),
        'get',
        path,
        400,
      );
      expectToMatchContract(
        await request(app).patch(url).set(bearer()).send({ status: 'completed' }),
        'patch',
        path,
        200,
      );
      expectToMatchContract(
        await request(app).patch(url).set(bearer()).send({}),
        'patch',
        path,
        400,
      );
      expectToMatchContract(await request(app).delete(url).set(bearer()), 'delete', path, 204);
      expectToMatchContract(await request(app).delete(url).set(bearer()), 'delete', path, 404);
    });
  });

  describe('infrastructure and limits', () => {
    it('health and ready: 200', async () => {
      expectToMatchContract(await request(app).get('/health'), 'get', '/health', 200);
      expectToMatchContract(await request(app).get('/ready'), 'get', '/ready', 200);
    });

    it('rate limited responses follow the Error schema', async () => {
      const limited = createApp({ rateLimit: { authMax: 1 } });
      await request(limited).post(`${api}/auth/login`).send({});
      expectToMatchContract(
        await request(limited).post(`${api}/auth/login`).send({}),
        'post',
        '/auth/login',
        429,
      );
    });

    it('serves the OpenAPI document and Swagger UI', async () => {
      const json = await request(app).get('/api/docs.json');
      expect(json.status).toBe(200);
      expect(json.body).toEqual(openApiDocument);

      const ui = await request(app).get('/api/docs/');
      expect(ui.status).toBe(200);
      expect(ui.text).toContain('swagger-ui');
    });
  });

  describe('validator sanity', () => {
    it('fails when a response leaks an undocumented field', async () => {
      const res = await request(app).get(`${api}/auth/me`).set(bearer());
      res.body.data.passwordHash = 'leaked';
      expect(() => {
        expectToMatchContract(res, 'get', '/auth/me', 200);
      }).toThrow(/diverge do contrato/);
    });

    it('fails for an undocumented status code', async () => {
      const res = await request(app).get(`${api}/auth/me`).set(bearer());
      res.status = 418;
      expect(() => {
        expectToMatchContract(res, 'get', '/auth/me');
      }).toThrow(/não documentado/);
    });
  });

  describe('security requirements', () => {
    const operations = listDocumentedOperations();
    const toUrl = (serverUrl: string, path: string) =>
      `${serverUrl.replace(/\/$/, '')}${path.replace(/\{[^}]+\}/g, randomId())}`;

    it.each(
      operations
        .filter((op) => op.requiresAuth)
        .map((op) => [op.method.toUpperCase(), op.path, op]),
    )('%s %s requires a bearer token', async (_method, _path, op) => {
      const res = await request(app)[op.method](toUrl(op.serverUrl, op.path)).send({});
      expectToMatchContract(res, op.method, op.path, 401);
    });

    it.each(
      operations
        .filter((op) => !op.requiresAuth)
        .map((op) => [op.method.toUpperCase(), op.path, op]),
    )('%s %s is public', async (_method, _path, op) => {
      const res = await request(app)[op.method](toUrl(op.serverUrl, op.path)).send({});
      expect(res.status).not.toBe(401);
      expect(res.status).not.toBe(404);
      expectToMatchContract(res, op.method, op.path);
    });
  });
});
