import { Request, Response } from 'express';
import { sendSuccess } from '../../utils/response';
import { aiService } from '../../services/ai.service';

export const theoryChat = async (req: Request, res: Response): Promise<void> => {
  const { message, sessionId, history } = req.body;
  const result = await aiService.theoryChatQuery(
    req.user!.id,
    message,
    sessionId,
    history
  );
  sendSuccess(res, result);
};
