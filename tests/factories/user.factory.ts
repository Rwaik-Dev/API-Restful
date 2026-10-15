import { randomUUID } from 'node:crypto';
import { UserModel, type UserDocument } from '../../src/modules/users/user.model.js';
import { hashPassword } from '../../src/shared/utils/password.js';

export const DEFAULT_PASSWORD = 'Sup3r-Secret-Pass';

export function buildUserInput(
  overrides: Partial<{ name: string; email: string; password: string }> = {},
) {
  return {
    name: 'Test User',
    email: `user-${randomUUID()}@example.com`,
    password: DEFAULT_PASSWORD,
    ...overrides,
  };
}

export async function createUser(
  overrides: Partial<{ name: string; email: string; password: string; isActive: boolean }> = {},
): Promise<{ user: UserDocument; password: string }> {
  const input = buildUserInput(overrides);
  const user = await UserModel.create({
    name: input.name,
    email: input.email,
    passwordHash: await hashPassword(input.password),
    isActive: overrides.isActive ?? true,
  });
  return { user, password: input.password };
}
