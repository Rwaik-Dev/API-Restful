import { Types } from 'mongoose';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { TaskModel } from '../../src/modules/tasks/task.model.js';
import { createTask } from '../factories/task.factory.js';
import { useTestDatabase } from '../helpers/database.js';
import { createLoggedInUser, type LoggedInUser } from '../helpers/auth.js';

useTestDatabase();
const app = createApp();

const api = (token: string) => ({
  post: (url: string, body: object) =>
    request(app).post(url).set('Authorization', `Bearer ${token}`).send(body),
  get: (url: string) => request(app).get(url).set('Authorization', `Bearer ${token}`),
  patch: (url: string, body: object) =>
    request(app).patch(url).set('Authorization', `Bearer ${token}`).send(body),
  delete: (url: string) => request(app).delete(url).set('Authorization', `Bearer ${token}`),
});

describe('tasks CRUD', () => {
  let alice: LoggedInUser;
  let bob: LoggedInUser;

  beforeEach(async () => {
    [alice, bob] = await Promise.all([createLoggedInUser(app), createLoggedInUser(app)]);
  });

  describe('POST /tasks', () => {
    it('creates a task owned by the authenticated user', async () => {
      const body = {
        title: '  Documentar a API  ',
        description: 'Finalizar os contratos OpenAPI',
        priority: 'high',
        dueDate: '2026-10-25T18:00:00.000Z',
        tags: ['Backend', 'documentacao', 'backend'],
      };
      const res = await api(alice.accessToken).post('/api/v1/tasks', body);

      expect(res.status).toBe(201);
      expect(res.body.data).toMatchObject({
        title: 'Documentar a API',
        description: 'Finalizar os contratos OpenAPI',
        status: 'pending',
        priority: 'high',
        dueDate: '2026-10-25T18:00:00.000Z',
        tags: ['backend', 'documentacao'],
        completedAt: null,
      });
      expect(res.body.data).not.toHaveProperty('userId');
      expect(res.body.data).not.toHaveProperty('priorityRank');

      const stored = await TaskModel.findById(res.body.data.id).lean();
      expect(stored?.userId.toString()).toBe(alice.userId);
    });

    it('applies defaults', async () => {
      const res = await api(alice.accessToken).post('/api/v1/tasks', { title: 'Only title' });
      expect(res.body.data).toMatchObject({
        status: 'pending',
        priority: 'medium',
        description: null,
        dueDate: null,
        tags: [],
      });
    });

    it('fills completedAt when created as completed', async () => {
      const res = await api(alice.accessToken).post('/api/v1/tasks', {
        title: 'Done',
        status: 'completed',
      });
      expect(res.body.data.completedAt).not.toBeNull();
    });

    it.each(['userId', 'completedAt', 'createdAt', 'updatedAt', 'id', '_id'])(
      'rejects the protected field %s',
      async (field) => {
        const res = await api(alice.accessToken).post('/api/v1/tasks', {
          title: 'Mass assignment',
          [field]: bob.userId,
        });
        expect(res.status).toBe(400);
        expect(res.body.error.details).toContainEqual({ field, message: 'Campo não permitido.' });
      },
    );

    it.each([
      ['empty title', { title: '   ' }],
      ['title too long', { title: 'x'.repeat(201) }],
      ['invalid status', { title: 'ok', status: 'done' }],
      ['invalid date', { title: 'ok', dueDate: '25/10/2026' }],
      ['too many tags', { title: 'ok', tags: Array.from({ length: 21 }, (_, i) => `t${i}`) }],
      ['tag too long', { title: 'ok', tags: ['x'.repeat(31)] }],
    ])('returns 400 for %s', async (_label, body) => {
      const res = await api(alice.accessToken).post('/api/v1/tasks', body);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('requires authentication', async () => {
      expect((await request(app).post('/api/v1/tasks').send({ title: 'x' })).status).toBe(401);
    });
  });

  describe('GET /tasks/:taskId', () => {
    it('returns an own task', async () => {
      const task = await createTask(alice.userId, { title: 'Mine' });
      const res = await api(alice.accessToken).get(`/api/v1/tasks/${task.id}`);
      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({ id: task.id, title: 'Mine' });
    });

    it('returns 404 for a non-existent task', async () => {
      const res = await api(alice.accessToken).get(
        `/api/v1/tasks/${new Types.ObjectId().toString()}`,
      );
      expect(res.status).toBe(404);
    });

    it('returns 400 for an invalid id', async () => {
      expect((await api(alice.accessToken).get('/api/v1/tasks/123')).status).toBe(400);
    });
  });

  describe('PATCH /tasks/:taskId', () => {
    it('updates allowed fields', async () => {
      const task = await createTask(alice.userId, { title: 'Old', description: 'desc' });
      const res = await api(alice.accessToken).patch(`/api/v1/tasks/${task.id}`, {
        title: 'New',
        priority: 'low',
        description: null,
        tags: ['A'],
      });
      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({
        title: 'New',
        priority: 'low',
        description: null,
        tags: ['a'],
      });
    });

    it('fills completedAt on completion and clears it on reopen', async () => {
      const task = await createTask(alice.userId);
      const done = await api(alice.accessToken).patch(`/api/v1/tasks/${task.id}`, {
        status: 'completed',
      });
      expect(done.body.data.completedAt).not.toBeNull();

      const reopened = await api(alice.accessToken).patch(`/api/v1/tasks/${task.id}`, {
        status: 'in_progress',
      });
      expect(reopened.body.data).toMatchObject({ status: 'in_progress', completedAt: null });
    });

    it('rejects an empty body', async () => {
      const task = await createTask(alice.userId);
      const res = await api(alice.accessToken).patch(`/api/v1/tasks/${task.id}`, {});
      expect(res.status).toBe(400);
    });

    it.each(['userId', 'completedAt', 'createdAt'])('rejects changing %s', async (field) => {
      const task = await createTask(alice.userId);
      const res = await api(alice.accessToken).patch(`/api/v1/tasks/${task.id}`, {
        [field]: bob.userId,
      });
      expect(res.status).toBe(400);
      const stored = await TaskModel.findById(task.id).lean();
      expect(stored?.userId.toString()).toBe(alice.userId);
    });
  });

  describe('DELETE /tasks/:taskId', () => {
    it('deletes an own task', async () => {
      const task = await createTask(alice.userId);
      const res = await api(alice.accessToken).delete(`/api/v1/tasks/${task.id}`);
      expect(res.status).toBe(204);
      expect(await TaskModel.exists({ _id: task.id })).toBeNull();
    });

    it('returns 404 when deleting twice', async () => {
      const task = await createTask(alice.userId);
      await api(alice.accessToken).delete(`/api/v1/tasks/${task.id}`);
      expect((await api(alice.accessToken).delete(`/api/v1/tasks/${task.id}`)).status).toBe(404);
    });
  });

  describe('object level authorization (BOLA)', () => {
    it("cannot read another user's task", async () => {
      const task = await createTask(bob.userId);
      expect((await api(alice.accessToken).get(`/api/v1/tasks/${task.id}`)).status).toBe(404);
    });

    it("cannot update another user's task", async () => {
      const task = await createTask(bob.userId, { title: 'Bob task' });
      const res = await api(alice.accessToken).patch(`/api/v1/tasks/${task.id}`, {
        title: 'Hacked',
      });
      expect(res.status).toBe(404);
      expect((await TaskModel.findById(task.id).lean())?.title).toBe('Bob task');
    });

    it("cannot delete another user's task", async () => {
      const task = await createTask(bob.userId);
      expect((await api(alice.accessToken).delete(`/api/v1/tasks/${task.id}`)).status).toBe(404);
      expect(await TaskModel.exists({ _id: task.id })).not.toBeNull();
    });

    it("never lists another user's tasks", async () => {
      await createTask(bob.userId);
      await createTask(alice.userId);
      const res = await api(alice.accessToken).get('/api/v1/tasks');
      expect(res.body.data).toHaveLength(1);
      expect(res.body.meta.totalItems).toBe(1);
    });
  });
});
