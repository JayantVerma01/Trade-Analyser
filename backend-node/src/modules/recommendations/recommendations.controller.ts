import { Request, Response } from 'express';
import { aiService } from '../../services/ai.service';
import { sendSuccess } from '../../utils/response';

export const getSectors = async (_req: Request, res: Response): Promise<void> => {
  const data = await aiService.getRecommendationSectors();
  sendSuccess(res, data);
};

export const searchSymbols = async (req: Request, res: Response): Promise<void> => {
  const q     = String(req.query.q ?? '').trim();
  const limit = Number(req.query.limit ?? 20);
  if (!q) {
    sendSuccess(res, { query: '', matches: [], count: 0 });
    return;
  }
  const data = await aiService.searchSymbolsForRecommendations(q, limit);
  sendSuccess(res, data);
};

export const scanRecommendations = async (req: Request, res: Response): Promise<void> => {
  const { sector, symbols, trading_style, capital, risk_pct, top_n } = req.body;
  const result = await aiService.scanRecommendations({
    trading_style,
    sector:   sector  ?? null,
    symbols:  Array.isArray(symbols) && symbols.length ? symbols : null,
    capital:  capital  ?? 100_000,
    risk_pct: risk_pct ?? 1.0,
    top_n:    top_n    ?? 5,
  });
  sendSuccess(res, result);
};
