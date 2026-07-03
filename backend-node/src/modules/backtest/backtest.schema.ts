import { z } from 'zod';

const ruleSchema = z.object({
  id:         z.string().min(1),
  label:      z.string().min(1),
  indicator:  z.string().min(1),
  operator:   z.enum(['above', 'below', 'between', 'crossover', 'equal']),
  value:      z.number().optional(),
  compare_to: z.string().optional(),
  value_min:  z.number().optional(),
  value_max:  z.number().optional(),
});

const conditionsSchema = z.object({
  rules:  z.array(ruleSchema).min(1),
  logic:  z.enum(['AND', 'OR']).default('AND'),
  min_rr: z.number().positive().optional(),
});

export const runBacktestSchema = z.object({
  strategyId: z.string().cuid(),
  symbol:     z.string().min(1).max(20).transform((s) => s.toUpperCase()),
  timeframe:  z.enum(['1m', '3m', '5m', '15m', '30m', '1h', '4h', '1d']).default('15m'),
  capital:    z.number().positive().default(100_000),
  riskPct:    z.number().positive().max(10).default(1),
  nCandles:   z.number().int().min(100).max(1000).default(500),
});

export type RunBacktestInput = z.infer<typeof runBacktestSchema>;
