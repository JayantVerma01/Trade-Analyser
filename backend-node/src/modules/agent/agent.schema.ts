import { z } from 'zod';

export const agentQuerySchema = z.object({
  query:        z.string().min(1).max(1000).default('Provide a comprehensive trade analysis and setup.'),
  symbol:       z.string().min(1).max(20).transform((s) => s.toUpperCase()),
  timeframe:    z.enum(['1m', '3m', '5m', '15m', '30m', '1h', '4h', '1d']).default('15m'),
  capital:      z.number().positive().default(100000),
  riskPct:      z.number().positive().max(10).default(1),
  marketType:   z.enum(['intraday', 'swing', 'positional']).default('intraday'),
  strategyId:   z.string().cuid().optional(),
});

export type AgentQueryInput = z.infer<typeof agentQuerySchema>;
