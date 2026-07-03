import { apiClient } from './client';
import type { ApiResponse } from '@/types';
import type { AnalysisResult } from './analysis.api';

export interface AgentRequest {
  query:       string;
  symbol:      string;
  timeframe:   string;
  capital:     number;
  riskPct:     number;
  marketType:  'intraday' | 'swing' | 'positional';
  strategyId?: string;
}

export interface AgentStep {
  tool:    string;
  input:   Record<string, any>;
  summary: string;
}

export interface AgentResult {
  query:             string;
  symbol:            string;
  timeframe:         string;
  steps:             AgentStep[];
  analysis:          AnalysisResult | null;
  theory_references: Array<{ source: string; excerpt: string; score: number }>;
  recommendation:    string;
}

export const agentApi = {
  tradeQuery: async (req: AgentRequest): Promise<AgentResult> => {
    const { data } = await apiClient.post<ApiResponse<AgentResult>>('/agent/trade-query', {
      query:      req.query,
      symbol:     req.symbol,
      timeframe:  req.timeframe,
      capital:    req.capital,
      riskPct:    req.riskPct,
      marketType: req.marketType,
      strategyId: req.strategyId,
    });
    return data.data;
  },
};
