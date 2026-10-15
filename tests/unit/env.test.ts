import { describe, expect, it } from 'vitest';
import { parseEnv } from '../../src/config/env.js';

const validEnv = {
  MONGODB_URI: 'mongodb://localhost:27017/app',
  JWT_ACCESS_SECRET: 'a'.repeat(32),
  REFRESH_TOKEN_SECRET: 'b'.repeat(32),
  JWT_ISSUER: 'issuer',
  JWT_AUDIENCE: 'audience',
};

describe('parseEnv', () => {
  it('applies defaults to a minimal valid environment', () => {
    const env = parseEnv(validEnv);
    expect(env.PORT).toBe(3000);
    expect(env.API_PREFIX).toBe('/api/v1');
    expect(env.ACCESS_TOKEN_TTL).toBe('15m');
    expect(env.CORS_ORIGINS).toEqual([]);
    expect(env.TRUST_PROXY).toBe(false);
  });

  it('splits CORS_ORIGINS into a list of URLs', () => {
    const env = parseEnv({ ...validEnv, CORS_ORIGINS: 'http://a.test, https://b.test' });
    expect(env.CORS_ORIGINS).toEqual(['http://a.test', 'https://b.test']);
  });

  it('fails with a clear message when a required variable is missing', () => {
    const { MONGODB_URI: _omitted, ...withoutUri } = validEnv;
    expect(() => parseEnv(withoutUri)).toThrow(/MONGODB_URI/);
  });

  it('rejects short secrets', () => {
    expect(() => parseEnv({ ...validEnv, JWT_ACCESS_SECRET: 'short' })).toThrow(
      /JWT_ACCESS_SECRET/,
    );
  });

  it('rejects reusing the JWT secret as the refresh secret', () => {
    expect(() =>
      parseEnv({ ...validEnv, REFRESH_TOKEN_SECRET: validEnv.JWT_ACCESS_SECRET }),
    ).toThrow(/devem ser diferentes/);
  });

  it('rejects an invalid TTL format', () => {
    expect(() => parseEnv({ ...validEnv, ACCESS_TOKEN_TTL: '15 minutes' })).toThrow(
      /ACCESS_TOKEN_TTL/,
    );
  });
});
