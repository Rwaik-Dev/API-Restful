import { UserModel, type UserDocument } from './user.model.js';

export interface CreateUserData {
  name: string;
  email: string;
  passwordHash: string;
}

export const userRepository = {
  findByEmailWithPassword(email: string): Promise<UserDocument | null> {
    return UserModel.findOne({ email }).select('+passwordHash').exec();
  },

  existsByEmail(email: string): Promise<boolean> {
    return UserModel.exists({ email })
      .exec()
      .then((result) => result !== null);
  },

  findById(id: string): Promise<UserDocument | null> {
    return UserModel.findById(id).exec();
  },

  create(data: CreateUserData): Promise<UserDocument> {
    return UserModel.create({ ...data, role: 'user', isActive: true });
  },
};
