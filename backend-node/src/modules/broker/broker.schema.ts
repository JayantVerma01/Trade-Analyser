import { z } from 'zod';

export const SUPPORTED_BROKERS = ['MOCK', 'ZERODHA', 'UPSTOX', 'DHAN', 'ANGEL', 'FYERS'] as const;
export type BrokerName = typeof SUPPORTED_BROKERS[number];

export const connectBrokerSchema = z.object({
  brokerName: z.enum(SUPPORTED_BROKERS),
  apiKey:     z.string().min(1).max(200).optional(),
  apiSecret:  z.string().min(1).max(200).optional(),
});

export type ConnectBrokerInput = z.infer<typeof connectBrokerSchema>;
