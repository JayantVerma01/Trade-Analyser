import { z } from 'zod';

const VALID_TIMEFRAMES = ['1m', '3m', '5m', '15m', '30m', '1h', '4h', '1d'] as const;

export const stockAnalysisSchema = z.object({
  symbol:      z.string().min(1).max(20).transform((s) => s.toUpperCase()),
  timeframe:   z.enum(VALID_TIMEFRAMES).default('15m'),
  capital:     z.number().positive().default(100000),
  riskPct:     z.number().positive().max(10).default(1),
  marketType:  z.enum(['intraday', 'swing', 'positional']).default('intraday'),
  strategyId:  z.string().cuid().optional(),
  notes:       z.string().max(500).optional().default(''),
});

export type StockAnalysisInput = z.infer<typeof stockAnalysisSchema>;
