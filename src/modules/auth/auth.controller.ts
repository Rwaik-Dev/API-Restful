import type { RequestHandler } from 'express';
import { extractBearerToken, getAuth } from '../../shared/middlewares/authenticate.js';
import { sessionService } from '../sessions/session.service.js';
import { authService } from './auth.service.js';
import { verifyAccessToken } from './token.service.js';
import type { LoginInput, RefreshInput, RegisterInput } from './auth.validation.js';

const register: RequestHandler = async (req, res) => {
  const user = await authService.register(req.body as RegisterInput);
  res.status(201).json({ success: true, data: user });
};

const login: RequestHandler = async (req, res) => {
  const result = await authService.login(req.body as LoginInput, {
    userAgent: req.get('user-agent'),
  });
  res.status(200).json({ success: true, data: result });
};

const refresh: RequestHandler = async (req, res) => {
  const { refreshToken } = req.body as RefreshInput;
  const tokens = await authService.refresh(refreshToken);
  res.status(200).json({ success: true, data: tokens });
};

const me: RequestHandler = async (req, res) => {
  const user = await authService.me(getAuth(req).userId);
  res.status(200).json({ success: true, data: user });
};

/** Exige apenas um JWT válido para que o logout continue idempotente após a revogação. */
const logout: RequestHandler = async (req, res) => {
  const { userId, sessionId } = await verifyAccessToken(extractBearerToken(req));
  await sessionService.revokeCurrent(userId, sessionId);
  res.status(204).end();
};

const logoutAll: RequestHandler = async (req, res) => {
  await sessionService.revokeAll(getAuth(req).userId);
  res.status(204).end();
};

export const authController = { register, login, refresh, me, logout, logoutAll };
