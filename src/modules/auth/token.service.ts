import { createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';
import { z } from 'zod';
import { env } from '../../config/env.js';
import { AppError } from '../../shared/errors/AppError.js';

const ALGORITHM = 'HS256';
const accessKey = new TextEncoder().encode(env.JWT_ACCESS_SECRET);
const objectIdPattern = /^[a-f\d]{24}$/i;

const accessClaimsSchema = z.object({
  sub: z.string().regex(objectIdPattern),
  sid: z.string().regex(objectIdPattern),
});

export interface AccessTokenClaims {
  userId: string;
  sessionId: string;
}

const durationUnits: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };

export function durationToSeconds(duration: string): number {
  const match = /^(\d+)([smhd])$/.exec(duration);
  if (!match?.[1] || !match[2]) throw new Error(`Duração inválida: ${duration}`);
  return Number(match[1]) * (durationUnits[match[2]] ?? 0);
}

export const accessTokenTtlSeconds = durationToSeconds(env.ACCESS_TOKEN_TTL);

export function signAccessToken({ userId, sessionId }: AccessTokenClaims): Promise<string> {
  return new SignJWT({ sid: sessionId })
    .setProtectedHeader({ alg: ALGORITHM, typ: 'JWT' })
    .setSubject(userId)
    .setIssuer(env.JWT_ISSUER)
    .setAudience(env.JWT_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(env.ACCESS_TOKEN_TTL)
    .setJti(randomUUID())
    .sign(accessKey);
}

export async function verifyAccessToken(token: string): Promise<AccessTokenClaims> {
  try {
    const { payload } = await jwtVerify(token, accessKey, {
      algorithms: [ALGORITHM],
      issuer: env.JWT_ISSUER,
      audience: env.JWT_AUDIENCE,
      requiredClaims: ['sub', 'sid', 'iat', 'exp'],
    });
    const claims = accessClaimsSchema.parse(payload);
    return { userId: claims.sub, sessionId: claims.sid };
  } catch {
    throw AppError.unauthorized('Token de acesso inválido ou expirado.');
  }
}

export function generateRefreshToken(sessionId: string): string {
  return `${sessionId}.${randomBytes(32).toString('base64url')}`;
}

export function hashRefreshToken(token: string): string {
  return createHmac('sha256', env.REFRESH_TOKEN_SECRET).update(token).digest('hex');
}

export function refreshTokenMatches(token: string, storedHash: string): boolean {
  const computed = Buffer.from(hashRefreshToken(token), 'hex');
  const stored = Buffer.from(storedHash, 'hex');
  return computed.length === stored.length && timingSafeEqual(computed, stored);
}

/** Extrai o ID da sessão de um refresh token sem confiar nele para autenticação. */
export function parseRefreshToken(token: string): { sessionId: string } | null {
  const [sessionId, secret, ...rest] = token.split('.');
  if (rest.length > 0 || !sessionId || !secret || !objectIdPattern.test(sessionId)) return null;
  if (!/^[\w-]{43}$/.test(secret)) return null;
  return { sessionId };
}
