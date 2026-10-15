import { logger } from '../../config/logger.js';
import { AppError } from '../../shared/errors/AppError.js';
import { hashPassword, verifyAgainstDummy, verifyPassword } from '../../shared/utils/password.js';
import { sessionService, type SessionMetadata } from '../sessions/session.service.js';
import { toPublicUser, type PublicUser } from '../users/user.model.js';
import { userRepository } from '../users/user.repository.js';
import { accessTokenTtlSeconds, signAccessToken } from './token.service.js';
import type { LoginInput, RegisterInput } from './auth.validation.js';

export interface AuthTokens {
  tokenType: 'Bearer';
  accessToken: string;
  expiresIn: number;
  refreshToken: string;
}

const invalidCredentials = (): AppError => AppError.unauthorized('E-mail ou senha inválidos.');

export const authService = {
  async register(input: RegisterInput): Promise<PublicUser> {
    if (await userRepository.existsByEmail(input.email)) {
      throw AppError.conflict('E-mail já cadastrado.');
    }
    const user = await userRepository.create({
      name: input.name,
      email: input.email,
      passwordHash: await hashPassword(input.password),
    });
    return toPublicUser(user);
  },

  async me(userId: string): Promise<PublicUser> {
    const user = await userRepository.findById(userId);
    if (!user) throw AppError.unauthorized();
    return toPublicUser(user);
  },

  async login(
    input: LoginInput,
    metadata: SessionMetadata,
  ): Promise<AuthTokens & { user: PublicUser }> {
    const user = await userRepository.findByEmailWithPassword(input.email);

    if (!user) {
      await verifyAgainstDummy(input.password);
      logger.warn({ event: 'auth.login_failed', reason: 'unknown_user' }, 'Login failed');
      throw invalidCredentials();
    }

    if (!(await verifyPassword(user.passwordHash, input.password))) {
      logger.warn({ event: 'auth.login_failed', userId: user.id }, 'Login failed');
      throw invalidCredentials();
    }

    if (!user.isActive) {
      logger.warn({ event: 'auth.login_blocked', userId: user.id }, 'Inactive account login');
      throw AppError.forbidden('Conta desativada.');
    }

    const { session, refreshToken } = await sessionService.create(user.id, {
      deviceName: input.deviceName ?? metadata.deviceName,
      userAgent: metadata.userAgent,
    });
    const accessToken = await signAccessToken({ userId: user.id, sessionId: session.id });

    return {
      tokenType: 'Bearer',
      accessToken,
      expiresIn: accessTokenTtlSeconds,
      refreshToken,
      user: toPublicUser(user),
    };
  },

  async refresh(refreshToken: string): Promise<AuthTokens> {
    const rotated = await sessionService.rotate(refreshToken);
    const accessToken = await signAccessToken({
      userId: rotated.userId,
      sessionId: rotated.sessionId,
    });
    return {
      tokenType: 'Bearer',
      accessToken,
      expiresIn: accessTokenTtlSeconds,
      refreshToken: rotated.refreshToken,
    };
  },
};
