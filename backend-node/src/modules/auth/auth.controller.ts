import { Request, Response } from 'express';
import { registerUser, loginUser, getMe } from './auth.service';
import { sendSuccess } from '../../utils/response';
import { prisma } from '../../config/database';

export const register = async (req: Request, res: Response): Promise<void> => {
  const result = await registerUser(req.body);
  sendSuccess(res, result, 'Account created successfully', 201);

  // Fire-and-forget audit log
  prisma.auditLog.create({
    data: {
      userId: result.user.id,
      action: 'USER_REGISTER',
      resourceType: 'user',
      resourceId: result.user.id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    },
  }).catch(() => {});
};

export const login = async (req: Request, res: Response): Promise<void> => {
  const result = await loginUser(req.body);
  sendSuccess(res, result, 'Login successful');

  prisma.auditLog.create({
    data: {
      userId: result.user.id,
      action: 'USER_LOGIN',
      resourceType: 'user',
      resourceId: result.user.id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    },
  }).catch(() => {});
};

export const me = async (req: Request, res: Response): Promise<void> => {
  const user = await getMe(req.user!.id);
  sendSuccess(res, user);
};
