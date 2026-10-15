import mongoose from 'mongoose';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { useTestDatabase } from '../helpers/database.js';

useTestDatabase();

describe('test database', () => {
  it('connects to an isolated database', () => {
    expect(mongoose.connection.readyState).toBe(mongoose.ConnectionStates.connected);
    expect(mongoose.connection.name).toMatch(/^test_/);
  });

  it('GET /ready returns 200 when the database is connected', async () => {
    const res = await request(createApp()).get('/ready');
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('ready');
  });

  it('starts every test with empty collections', async () => {
    const probe = mongoose.connection.collection('probe');
    await probe.insertOne({ value: 1 });
    expect(await probe.countDocuments()).toBe(1);
  });

  it('cleared data from the previous test', async () => {
    expect(await mongoose.connection.collection('probe').countDocuments()).toBe(0);
  });
});
