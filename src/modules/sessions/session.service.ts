import { Types } from 'mongoose';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { AppError } from '../../shared/errors/AppError.js';
import {
  generateRefreshToken,
  hashRefreshToken,
  parseRefreshToken,
  refreshTokenMatches,
} from '../auth/token.service.js';
import { userRepository } from '../users/user.repository.js';
import {
  isSessionActive,
  toSessionSummary,
  type SessionDocument,
  type SessionSummary,
} from './session.model.js';
import { sessionRepository } from './session.repository.js';

const DAY_MS = 24 * 60 * 60 * 1000;

const invalidRefreshToken = (): AppError =>
  AppError.unauthorized('Refresh token inválido, expirado ou revogado.');

export interface SessionMetadata {
  deviceName?: string | undefined;
  userAgent?: string | undefined;
}

export const sessionService = {
  async create(
    userId: string,
    metadata: SessionMetadata,
  ): Promise<{ session: SessionDocument; refreshToken: string }> {
    const id = new Types.ObjectId();
    const refreshToken = generateRefreshToken(id.toString());
    const session = await sessionRepository.create({
      _id: id,
      userId,
      refreshTokenHash: hashRefreshToken(refreshToken),
      expiresAt: new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * DAY_MS),
      deviceName: metadata.deviceName,
      userAgent: metadata.userAgent?.slice(0, 256),
    });
    return { session, refreshToken };
  },

  /**
   * Rotaciona o refresh token. Um token antigo apresentado para uma sessão ativa
   * indica reutilização: a família (a sessão) é revogada. Em requisições
   * simultâneas com o mesmo token, apenas uma vence a atualização condicional.
   */
  async rotate(
    refreshToken: string,
  ): Promise<{ userId: string; sessionId: string; refreshToken: string }> {
    const parsed = parseRefreshToken(refreshToken);
    if (!parsed) throw invalidRefreshToken();

    const session = await sessionRepository.findById(parsed.sessionId);
    if (!session || !isSessionActive(session)) throw invalidRefreshToken();

    const userId = session.userId.toString();

    if (!refreshTokenMatches(refreshToken, session.refreshTokenHash)) {
      await sessionRepository.revokeById(session.id);
      logger.warn(
        { event: 'auth.refresh_reuse_detected', sessionId: session.id, userId },
        'Refresh token reuse detected, session revoked',
      );
      throw invalidRefreshToken();
    }

    const user = await userRepository.findById(userId);
    if (!user?.isActive) throw invalidRefreshToken();

    const nextToken = generateRefreshToken(session.id);
    const rotated = await sessionRepository.rotateRefreshToken(
      session.id,
      session.refreshTokenHash,
      hashRefreshToken(nextToken),
      new Date(),
    );
    if (!rotated) throw invalidRefreshToken();

    return { userId, sessionId: session.id, refreshToken: nextToken };
  },

  async revokeCurrent(userId: string, sessionId: string): Promise<void> {
    await sessionRepository.revoke(sessionId, userId);
  },

  async revokeAll(userId: string): Promise<void> {
    const count = await sessionRepository.revokeAllForUser(userId);
    logger.info(
      { event: 'auth.logout_all', userId, revokedSessions: count },
      'All sessions revoked',
    );
  },

  async list(userId: string, currentSessionId: string): Promise<SessionSummary[]> {
    const sessions = await sessionRepository.listActiveForUser(userId);
    return sessions.map((session) => toSessionSummary(session, currentSessionId));
  },

  async revokeOwned(userId: string, sessionId: string): Promise<void> {
    if (!(await sessionRepository.existsForUser(sessionId, userId))) {
      throw AppError.notFound('Sessão não encontrada.');
    }
    await sessionRepository.revoke(sessionId, userId);
  },
};
