import { Request, Response } from 'express';
import { sendSuccess } from '../../utils/response';
import { runStockAnalysis, getRecentSetups } from './analysis.service';
import { stockAnalysisSchema } from './analysis.schema';

export const analyseStock = async (req: Request, res: Response): Promise<void> => {
  const input = stockAnalysisSchema.parse(req.body);
  const result = await runStockAnalysis(req.user!.id, input);
  sendSuccess(res, result, 'Analysis complete');
};

export const listRecentSetups = async (req: Request, res: Response): Promise<void> => {
  const setups = await getRecentSetups(req.user!.id);
  sendSuccess(res, setups);
};
