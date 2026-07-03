import { Router } from 'express';
import { theoryChat } from './chat.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import { theoryChatSchema } from './chat.schema';

export const chatRouter = Router();

chatRouter.use(authenticate);
chatRouter.post('/theory', validate(theoryChatSchema), theoryChat);
