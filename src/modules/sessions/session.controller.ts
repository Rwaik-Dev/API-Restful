import type { RequestHandler } from 'express';
import { getAuth } from '../../shared/middlewares/authenticate.js';
import { sessionService } from './session.service.js';

const list: RequestHandler = async (req, res) => {
  const { userId, sessionId } = getAuth(req);
  const sessions = await sessionService.list(userId, sessionId);
  res.status(200).json({ success: true, data: sessions });
};

const revoke: RequestHandler<{ sessionId: string }> = async (req, res) => {
  await sessionService.revokeOwned(getAuth(req).userId, req.params.sessionId);
  res.status(204).end();
};

export const sessionController = { list, revoke };
