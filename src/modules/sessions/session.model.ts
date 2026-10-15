import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';

const sessionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    refreshTokenHash: { type: String, required: true },
    tokenFamilyId: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    lastUsedAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
    deviceName: { type: String, maxlength: 100 },
    userAgent: { type: String, maxlength: 256 },
  },
  { timestamps: true },
);

sessionSchema.index({ userId: 1, revokedAt: 1, expiresAt: 1 });
// O TTL apenas limpa documentos expirados; a aplicação sempre verifica expiração e revogação.
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type Session = InferSchemaType<typeof sessionSchema>;
export type SessionDocument = HydratedDocument<Session>;

export const SessionModel = model('Session', sessionSchema);

export interface SessionSummary {
  id: string;
  deviceName: string | null;
  userAgent: string | null;
  createdAt: Date;
  lastUsedAt: Date;
  expiresAt: Date;
  current: boolean;
}

export function toSessionSummary(
  session: SessionDocument,
  currentSessionId: string,
): SessionSummary {
  return {
    id: session.id,
    deviceName: session.deviceName ?? null,
    userAgent: session.userAgent ?? null,
    createdAt: session.createdAt,
    lastUsedAt: session.lastUsedAt,
    expiresAt: session.expiresAt,
    current: session.id === currentSessionId,
  };
}

export function isSessionActive(session: Session, now = new Date()): boolean {
  return session.revokedAt === null && session.expiresAt > now;
}
