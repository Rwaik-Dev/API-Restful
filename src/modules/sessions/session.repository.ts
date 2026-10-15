import type { Types } from 'mongoose';
import { SessionModel, type SessionDocument } from './session.model.js';

export interface CreateSessionData {
  _id: Types.ObjectId;
  userId: string;
  refreshTokenHash: string;
  expiresAt: Date;
  deviceName?: string | undefined;
  userAgent?: string | undefined;
}

export const sessionRepository = {
  create(data: CreateSessionData): Promise<SessionDocument> {
    const now = new Date();
    return SessionModel.create({
      ...data,
      tokenFamilyId: data._id.toString(),
      lastUsedAt: now,
      revokedAt: null,
    });
  },

  findById(id: string): Promise<SessionDocument | null> {
    return SessionModel.findById(id).exec();
  },

  /**
   * Troca o hash do refresh token somente se o hash atual ainda for o esperado
   * e a sessão estiver ativa. A condição no filtro torna a rotação atômica.
   */
  rotateRefreshToken(
    id: string,
    currentHash: string,
    nextHash: string,
    now: Date,
  ): Promise<SessionDocument | null> {
    return SessionModel.findOneAndUpdate(
      { _id: id, refreshTokenHash: currentHash, revokedAt: null, expiresAt: { $gt: now } },
      { $set: { refreshTokenHash: nextHash, lastUsedAt: now } },
      { returnDocument: 'after' },
    ).exec();
  },

  async revoke(id: string, userId: string): Promise<boolean> {
    const result = await SessionModel.updateOne(
      { _id: id, userId, revokedAt: null },
      { $set: { revokedAt: new Date() } },
    ).exec();
    return result.modifiedCount > 0;
  },

  async revokeById(id: string): Promise<void> {
    await SessionModel.updateOne(
      { _id: id, revokedAt: null },
      { $set: { revokedAt: new Date() } },
    ).exec();
  },

  async revokeAllForUser(userId: string): Promise<number> {
    const result = await SessionModel.updateMany(
      { userId, revokedAt: null },
      { $set: { revokedAt: new Date() } },
    ).exec();
    return result.modifiedCount;
  },

  listActiveForUser(userId: string, now = new Date()): Promise<SessionDocument[]> {
    return SessionModel.find({ userId, revokedAt: null, expiresAt: { $gt: now } })
      .sort({ lastUsedAt: -1, _id: -1 })
      .exec();
  },

  existsForUser(id: string, userId: string): Promise<boolean> {
    return SessionModel.exists({ _id: id, userId })
      .exec()
      .then((result) => result !== null);
  },
};
