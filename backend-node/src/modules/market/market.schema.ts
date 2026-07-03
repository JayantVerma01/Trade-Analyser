import { z } from 'zod';

const VALID_TIMEFRAMES = ['1m', '3m', '5m', '15m', '30m', '1h', '4h', '1d'] as const;

export const candlesQuerySchema = z.object({
  symbol:    z.string().min(1).max(20).transform((s) => s.toUpperCase()),
  timeframe: z.enum(VALID_TIMEFRAMES).default('15m'),
  limit:     z.coerce.number().int().min(10).max(500).default(200),
});

export const quoteQuerySchema = z.object({
  symbol: z.string().min(1).max(20).transform((s) => s.toUpperCase()),
});

export const symbolSearchSchema = z.object({
  q: z.string().default(''),
});
