import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';

const app = createApp();

describe('app core', () => {
  it('GET /health returns ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: { status: 'ok' } });
  });

  it('GET /ready returns 503 when the database is not connected', async () => {
    const res = await request(app).get('/ready');
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('SERVICE_UNAVAILABLE');
  });

  it('unknown route returns 404 in the standard error format', async () => {
    const res = await request(app).get('/api/v1/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'Rota não encontrada.',
        requestId: res.headers['x-request-id'],
      },
    });
  });

  it('malformed JSON returns 400 INVALID_JSON', async () => {
    const res = await request(app)
      .post('/api/v1/anything')
      .set('Content-Type', 'application/json')
      .send('{"broken":');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_JSON');
  });

  it('propagates a valid incoming X-Request-Id', async () => {
    const res = await request(app).get('/health').set('X-Request-Id', 'client-abc-123');
    expect(res.headers['x-request-id']).toBe('client-abc-123');
  });

  it('replaces an invalid incoming X-Request-Id', async () => {
    const res = await request(app).get('/health').set('X-Request-Id', 'bad id with spaces');
    expect(res.headers['x-request-id']).toMatch(/^req_/);
  });
});
