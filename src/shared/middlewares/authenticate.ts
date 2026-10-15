import type { Request, RequestHandler } from 'express';
import { verifyAccessToken } from '../../modules/auth/token.service.js';
import { isSessionActive } from '../../modules/sessions/session.model.js';
import { sessionRepository } from '../../modules/sessions/session.repository.js';
import { userRepository } from '../../modules/users/user.repository.js';
import { AppError } from '../errors/AppError.js';
import type { AuthContext } from '../types/auth.js';

const bearerPattern = /^Bearer ([\w-]+\.[\w-]+\.[\w-]+)$/;

export function extractBearerToken(req: Request): string {
  const token = bearerPattern.exec(req.get('authorization') ?? '')?.[1];
  if (!token) throw AppError.unauthorized();
  return token;
}

/**
 * Valida o JWT e consulta a sessão a cada requisição para permitir revogação
 * imediata, ao custo de uma leitura extra no banco.
 */
export const authenticate: RequestHandler = async (req, _res, next) => {
  const { userId, sessionId } = await verifyAccessToken(extractBearerToken(req));

  const session = await sessionRepository.findById(sessionId);
  if (!session || session.userId.toString() !== userId || !isSessionActive(session)) {
    throw AppError.unauthorized('Sessão inválida, revogada ou expirada.');
  }

  const user = await userRepository.findById(userId);
  if (!user?.isActive) throw AppError.unauthorized('Sessão inválida, revogada ou expirada.');

  req.auth = { userId, sessionId, role: user.role };
  next();
};

export function getAuth(req: Request): AuthContext {
  if (!req.auth) throw AppError.unauthorized();
  return req.auth;
}
