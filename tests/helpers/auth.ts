import type { Express } from 'express';
import request from 'supertest';
import { createUser } from '../factories/user.factory.js';

export interface LoggedInUser {
  userId: string;
  email: string;
  password: string;
  accessToken: string;
  refreshToken: string;
  sessionId: string;
}

export async function login(app: Express, email: string, password: string) {
  return request(app).post('/api/v1/auth/login').send({ email, password });
}

export async function createLoggedInUser(app: Express): Promise<LoggedInUser> {
  const { user, password } = await createUser();
  const res = await login(app, user.email, password);
  if (res.status !== 200) throw new Error(`Login falhou no helper: ${res.status}`);
  const refreshToken: string = res.body.data.refreshToken;
  return {
    userId: user.id,
    email: user.email,
    password,
    accessToken: res.body.data.accessToken,
    refreshToken,
    sessionId: refreshToken.split('.')[0]!,
  };
}
