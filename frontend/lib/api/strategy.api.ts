import { apiClient } from './client';
import type { ApiResponse } from '@/types';

export interface StrategyRule {
  id:         string;
  label:      string;
  indicator:  string;
  operator:   'above' | 'below' | 'between' | 'crossover' | 'equal';
  value?:     number;
  compare_to?: string;
  value_min?: number;
  value_max?: number;
}

export interface StrategyConditions {
  rules:   StrategyRule[];
  logic:   'AND' | 'OR';
  min_rr?: number;
}

export interface Strategy {
  id:          string;
  name:        string;
  description?: string;
  marketType:  string;
  conditions:  StrategyConditions;
  isActive:    boolean;
  createdAt:   string;
  updatedAt:   string;
  _count?:     { tradeSetups: number };
}

export interface CreateStrategyPayload {
  name:        string;
  description?: string;
  marketType:  'intraday' | 'swing' | 'positional';
  conditions:  StrategyConditions;
}

export interface EvaluateResult {
  strategy:      { id: string; name: string };
  symbol:        string;
  timeframe:     string;
  matches:       boolean;
  rules_matched: string[];
  rules_failed:  string[];
  score:         number;
  confidence_bonus: number;
  logic:         string;
  indicators?:   Record<string, any>;
}

export interface ScanResult {
  strategy: { id: string; name: string };
  timeframe: string;
  total:    number;
  matched:  number;
  results:  Array<{
    symbol:        string;
    price:         number;
    matches:       boolean;
    score:         number;
    rules_matched: string[];
    rules_failed:  string[];
    confidence_bonus: number;
    logic:         string;
  }>;
}

export const strategyApi = {
  list: async (): Promise<Strategy[]> => {
    const { data } = await apiClient.get<ApiResponse<Strategy[]>>('/strategies');
    return data.data;
  },

  getOne: async (id: string): Promise<Strategy> => {
    const { data } = await apiClient.get<ApiResponse<Strategy>>(`/strategies/${id}`);
    return data.data;
  },

  create: async (payload: CreateStrategyPayload): Promise<Strategy> => {
    const { data } = await apiClient.post<ApiResponse<Strategy>>('/strategies', payload);
    return data.data;
  },

  update: async (id: string, payload: Partial<CreateStrategyPayload> & { isActive?: boolean }): Promise<Strategy> => {
    const { data } = await apiClient.put<ApiResponse<Strategy>>(`/strategies/${id}`, payload);
    return data.data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/strategies/${id}`);
  },

  evaluate: async (id: string, symbol: string, timeframe: string): Promise<EvaluateResult> => {
    const { data } = await apiClient.post<ApiResponse<EvaluateResult>>(
      `/strategies/${id}/evaluate`,
      { symbol, timeframe },
    );
    return data.data;
  },

  scan: async (id: string, symbols: string[], timeframe: string): Promise<ScanResult> => {
    const { data } = await apiClient.post<ApiResponse<ScanResult>>(
      `/strategies/${id}/scan`,
      { symbols, timeframe },
    );
    return data.data;
  },

  getMeta: async (): Promise<{ indicators: string[]; operators: string[] }> => {
    const { data } = await apiClient.get<ApiResponse<{ indicators: string[]; operators: string[] }>>('/strategies/meta');
    return data.data;
  },
};
