import bcrypt from 'bcryptjs';
import { prisma } from '../../config/database';
import { generateToken } from '../../utils/jwt';
import { AppError } from '../../utils/errors';
import { RegisterInput, LoginInput } from './auth.schema';

const SALT_ROUNDS = 12;

const safeUser = {
  id: true,
  email: true,
  name: true,
  role: true,
  isActive: true,
  createdAt: true,
};

export const registerUser = async (input: RegisterInput) => {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw new AppError('An account with this email already exists', 409);
  }

  const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);

  const user = await prisma.user.create({
    data: {
      email: input.email,
      name: input.name,
      passwordHash,
      settings: {
        create: {}, // Default settings
      },
    },
    select: safeUser,
  });

  const token = generateToken({ userId: user.id, role: user.role });
  return { user, token };
};

export const loginUser = async (input: LoginInput) => {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
    select: { ...safeUser, passwordHash: true },
  });

  if (!user || !user.isActive) {
    throw new AppError('Invalid email or password', 401);
  }

  const isPasswordValid = await bcrypt.compare(input.password, user.passwordHash);
  if (!isPasswordValid) {
    throw new AppError('Invalid email or password', 401);
  }

  const { passwordHash: _, ...safeUserData } = user;
  const token = generateToken({ userId: user.id, role: user.role });
  return { user: safeUserData, token };
};

export const getMe = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      ...safeUser,
      settings: true,
    },
  });

  if (!user) throw new AppError('User not found', 404);
  return user;
};
