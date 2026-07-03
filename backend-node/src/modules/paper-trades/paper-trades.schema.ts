import { z } from 'zod';

export const openPaperTradeSchema = z.object({
  symbol:      z.string().min(1).max(20).transform(s => s.toUpperCase()),
  timeframe:   z.string().min(1),
  direction:   z.enum(['LONG', 'SHORT']),
  entryPrice:  z.number().positive(),
  stopLoss:    z.number().positive(),
  target1:     z.number().positive(),
  target2:     z.number().positive(),
  quantity:    z.number().int().positive(),
  capitalUsed: z.number().positive(),
  strategyId:  z.string().cuid().optional(),
  setupId:     z.string().cuid().optional(),
  notes:       z.string().max(2000).optional(),
});

export const closePaperTradeSchema = z.object({
  exitPrice: z.number().positive(),
  status:    z.enum(['TARGET_HIT', 'STOP_LOSS_HIT', 'MANUALLY_CLOSED']),
  notes:     z.string().max(2000).optional(),
});

export const listPaperTradesSchema = z.object({
  status: z.enum(['PENDING', 'ACTIVE', 'TARGET_HIT', 'STOP_LOSS_HIT', 'MANUALLY_CLOSED', 'CANCELLED', 'open', 'closed']).optional(),
});

export type OpenPaperTradeInput  = z.infer<typeof openPaperTradeSchema>;
export type ClosePaperTradeInput = z.infer<typeof closePaperTradeSchema>;
export type ListPaperTradesInput = z.infer<typeof listPaperTradesSchema>;
