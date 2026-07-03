import { z } from 'zod';

export const theoryChatSchema = z.object({
  message: z.string().min(1, 'Message is required').max(2000),
  sessionId: z.string().optional().default('default'),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string(),
      })
    )
    .optional()
    .default([]),
});

export type TheoryChatInput = z.infer<typeof theoryChatSchema>;
