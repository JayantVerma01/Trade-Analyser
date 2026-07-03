import { z } from 'zod';

export const createJournalSchema = z.object({
  paperTradeId:   z.string().cuid().optional(),
  symbol:         z.string().min(1).max(20).transform(s => s.toUpperCase()),
  setupType:      z.string().min(1).max(100),
  result:         z.enum(['WIN', 'LOSS', 'BREAKEVEN']),
  pnl:            z.number().optional(),
  notes:          z.string().max(5000).optional(),
  mistakes:       z.array(z.string()).optional(),
  emotionTags:    z.array(z.string()).optional(),
  lessonsLearned: z.string().max(2000).optional(),
});

export const updateJournalSchema = createJournalSchema
  .omit({ paperTradeId: true })
  .partial();

export const listJournalSchema = z.object({
  symbol:     z.string().optional(),
  result:     z.enum(['WIN', 'LOSS', 'BREAKEVEN']).optional(),
  dateFrom:   z.string().datetime().optional(),
  dateTo:     z.string().datetime().optional(),
  take:       z.coerce.number().int().min(1).max(100).default(50),
  skip:       z.coerce.number().int().min(0).default(0),
});

export type CreateJournalInput = z.infer<typeof createJournalSchema>;
export type UpdateJournalInput = z.infer<typeof updateJournalSchema>;
export type ListJournalInput   = z.infer<typeof listJournalSchema>;
