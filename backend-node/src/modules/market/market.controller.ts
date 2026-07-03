import { Request, Response } from 'express';
import { sendSuccess } from '../../utils/response';
import { aiService } from '../../services/ai.service';
import { candlesQuerySchema, quoteQuerySchema, symbolSearchSchema } from './market.schema';

export const getCandles = async (req: Request, res: Response): Promise<void> => {
  const query = candlesQuerySchema.parse(req.query);
  const data = await aiService.getCandles(query.symbol, query.timeframe, query.limit);
  sendSuccess(res, data);
};

export const getQuote = async (req: Request, res: Response): Promise<void> => {
  const { symbol } = quoteQuerySchema.parse(req.query);
  const data = await aiService.getQuote(symbol);
  sendSuccess(res, data);
};

export const searchSymbols = async (req: Request, res: Response): Promise<void> => {
  const { q } = symbolSearchSchema.parse(req.query);
  const data = await aiService.searchSymbols(q);
  sendSuccess(res, data);
};
