export type UserRole = 'user' | 'admin';

export interface AuthContext {
  userId: string;
  sessionId: string;
  role: UserRole;
}
