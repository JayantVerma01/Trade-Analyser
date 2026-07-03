import { apiClient } from './client';
import type { ApiResponse } from '@/types';

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Quote {
  symbol: string;
  ltp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  change: number;
  change_pct: number;
}

export interface SymbolResult {
  symbol: string;
  name: string;
  exchange: string;
  segment: string;
  lot_size: number;
}

export const marketApi = {
  getCandles: async (
    symbol: string,
    timeframe = '15m',
    limit = 200
  ): Promise<{ symbol: string; timeframe: string; count: number; candles: Candle[] }> => {
    const { data } = await apiClient.get<ApiResponse<any>>('/market/candles', {
      params: { symbol, timeframe, limit },
    });
    return data.data;
  },

  getQuote: async (symbol: string): Promise<Quote> => {
    const { data } = await apiClient.get<ApiResponse<Quote>>('/market/quote', {
      params: { symbol },
    });
    return data.data;
  },

  searchSymbols: async (q: string): Promise<SymbolResult[]> => {
    const { data } = await apiClient.get<ApiResponse<{ results: SymbolResult[] }>>('/market/symbols', {
      params: { q },
    });
    return data.data.results;
  },
};
