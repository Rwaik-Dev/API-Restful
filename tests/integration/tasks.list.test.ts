import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { createTask } from '../factories/task.factory.js';
import { useTestDatabase } from '../helpers/database.js';
import { createLoggedInUser, type LoggedInUser } from '../helpers/auth.js';

useTestDatabase();
const app = createApp();

describe('GET /tasks', () => {
  let user: LoggedInUser;
  const list = (query = '') =>
    request(app).get(`/api/v1/tasks${query}`).set('Authorization', `Bearer ${user.accessToken}`);
  const titles = (body: { data: { title: string }[] }) => body.data.map((task) => task.title);

  beforeEach(async () => {
    user = await createLoggedInUser(app);
  });

  it('returns an empty page with meta', async () => {
    const res = await list();
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: true,
      data: [],
      meta: { page: 1, limit: 20, totalItems: 0, totalPages: 0 },
    });
  });

  it('paginates with a stable default order (newest first)', async () => {
    for (let i = 1; i <= 5; i++) await createTask(user.userId, { title: `T${i}` });

    const first = await list('?limit=2&page=1');
    const second = await list('?limit=2&page=2');
    const third = await list('?limit=2&page=3');

    expect(first.body.meta).toEqual({ page: 1, limit: 2, totalItems: 5, totalPages: 3 });
    expect(titles(first.body)).toEqual(['T5', 'T4']);
    expect(titles(second.body)).toEqual(['T3', 'T2']);
    expect(titles(third.body)).toEqual(['T1']);
  });

  it('filters by status and priority', async () => {
    await createTask(user.userId, { title: 'A', status: 'pending', priority: 'high' });
    await createTask(user.userId, { title: 'B', status: 'pending', priority: 'low' });
    await createTask(user.userId, { title: 'C', status: 'completed', priority: 'high' });

    expect(titles((await list('?status=pending')).body).sort()).toEqual(['A', 'B']);
    expect(titles((await list('?status=pending&priority=high')).body)).toEqual(['A']);
  });

  it('filters by tags requiring all of them', async () => {
    await createTask(user.userId, { title: 'Both', tags: ['api', 'docs'] });
    await createTask(user.userId, { title: 'Api', tags: ['api'] });

    expect(titles((await list('?tags=api')).body).sort()).toEqual(['Api', 'Both']);
    expect(titles((await list('?tags=API,docs')).body)).toEqual(['Both']);
  });

  it('filters by due date range', async () => {
    await createTask(user.userId, { title: 'Early', dueDate: new Date('2026-10-01T00:00:00Z') });
    await createTask(user.userId, { title: 'Mid', dueDate: new Date('2026-10-15T00:00:00Z') });
    await createTask(user.userId, { title: 'Late', dueDate: new Date('2026-10-30T00:00:00Z') });

    const res = await list('?dueAfter=2026-10-10T00:00:00Z&dueBefore=2026-10-20T00:00:00Z');
    expect(titles(res.body)).toEqual(['Mid']);
  });

  it('searches title and description case-insensitively', async () => {
    await createTask(user.userId, { title: 'Documentar a API' });
    await createTask(user.userId, { title: 'Outra', description: 'precisa DOCUMENTAR' });
    await createTask(user.userId, { title: 'Nada a ver' });

    expect(titles((await list('?search=documentar')).body).sort()).toEqual([
      'Documentar a API',
      'Outra',
    ]);
  });

  it('treats regex characters in search literally', async () => {
    await createTask(user.userId, { title: 'Plain task' });
    await createTask(user.userId, { title: 'Costs (a+b)*' });

    expect(titles((await list('?search=.*')).body)).toEqual([]);
    expect(titles((await list(`?search=${encodeURIComponent('(a+b)*')}`)).body)).toEqual([
      'Costs (a+b)*',
    ]);
  });

  it('sorts by priority semantically', async () => {
    await createTask(user.userId, { title: 'Medium', priority: 'medium' });
    await createTask(user.userId, { title: 'High', priority: 'high' });
    await createTask(user.userId, { title: 'Low', priority: 'low' });

    expect(titles((await list('?sortBy=priority&order=asc')).body)).toEqual([
      'Low',
      'Medium',
      'High',
    ]);
    expect(titles((await list('?sortBy=priority&order=desc')).body)).toEqual([
      'High',
      'Medium',
      'Low',
    ]);
  });

  it('sorts by title ascending', async () => {
    for (const title of ['Charlie', 'Alpha', 'Bravo']) await createTask(user.userId, { title });
    expect(titles((await list('?sortBy=title&order=asc')).body)).toEqual([
      'Alpha',
      'Bravo',
      'Charlie',
    ]);
  });

  it.each([
    ['limit above 100', '?limit=101'],
    ['limit zero', '?limit=0'],
    ['page zero', '?page=0'],
    ['non-numeric page', '?page=abc'],
    ['unknown sort field', '?sortBy=userId'],
    ['invalid order', '?order=up'],
    ['invalid status', '?status=done'],
    ['invalid date', '?dueBefore=yesterday'],
    ['inverted date range', '?dueAfter=2026-10-20T00:00:00Z&dueBefore=2026-10-10T00:00:00Z'],
    ['unknown parameter', '?userId=123'],
    ['repeated parameter', '?status=pending&status=completed'],
    ['operator injection', '?status[$ne]=pending'],
  ])('returns 400 for %s', async (_label, query) => {
    const res = await list(query);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});
