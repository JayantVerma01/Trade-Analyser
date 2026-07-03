import { z } from 'zod';

export const strategyRuleSchema = z.object({
  id:         z.string().min(1),
  label:      z.string().min(1),
  indicator:  z.string().min(1),
  operator:   z.enum(['above', 'below', 'between', 'crossover', 'equal']),
  value:      z.number().optional(),
  compare_to: z.string().optional(),
  value_min:  z.number().optional(),
  value_max:  z.number().optional(),
});

export const strategyConditionsSchema = z.object({
  rules:   z.array(strategyRuleSchema).min(1),
  logic:   z.enum(['AND', 'OR']).default('AND'),
  min_rr:  z.number().positive().optional(),
});

export const createStrategySchema = z.object({
  name:        z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  marketType:  z.enum(['intraday', 'swing', 'positional']),
  conditions:  strategyConditionsSchema,
});

export const updateStrategySchema = createStrategySchema.partial().extend({
  isActive: z.boolean().optional(),
});

export const evaluateStrategySchema = z.object({
  symbol:    z.string().min(1),
  timeframe: z.enum(['1m', '3m', '5m', '15m', '30m', '1h', '4h', '1d']).default('15m'),
});

export const scanStrategySchema = z.object({
  symbols:   z.array(z.string().min(1)).min(1).max(20),
  timeframe: z.enum(['1m', '3m', '5m', '15m', '30m', '1h', '4h', '1d']).default('15m'),
});

export type CreateStrategyInput  = z.infer<typeof createStrategySchema>;
export type UpdateStrategyInput  = z.infer<typeof updateStrategySchema>;
export type EvaluateStrategyInput = z.infer<typeof evaluateStrategySchema>;
export type ScanStrategyInput     = z.infer<typeof scanStrategySchema>;
