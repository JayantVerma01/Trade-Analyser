import { apiClient } from './client';
import type { ApiResponse } from '@/types';

export interface AnalysisRequest {
  symbol: string;
  timeframe: string;
  capital: number;
  riskPct: number;
  marketType: 'intraday' | 'swing' | 'positional';
  notes?: string;
  strategyId?: string;
}

export interface AnalysisResult {
  symbol: string;
  timeframe: string;
  market_bias: 'Bullish' | 'Bearish' | 'Sideways';
  setup_type: string;
  entry_condition: string;
  entry_zone: { from: number; to: number };
  stop_loss: number;
  target1: number;
  target2: number;
  risk_reward: string;
  position_size: number;
  confidence_score: number;
  rules_passed: string[];
  rules_failed: string[];
  theory_references: Array<{ source: string; excerpt: string }>;
  reasoning: string;
  invalidation_condition: string;
  risk_warning: string;
  indicators: Record<string, any>;
  candles: Array<{ time: number; open: number; high: number; low: number; close: number; volume: number }>;
  strategy_result?: {
    matches:          boolean;
    rules_matched:    string[];
    rules_failed:     string[];
    score:            number;
    confidence_bonus: number;
    logic:            string;
  } | null;
  validation?: {
    occurrences:      number;
    decided:          number;
    wins:             number;
    losses:           number;
    timeouts:         number;
    hit_rate:         number;
    is_validated:     boolean;
    confidence_label: string;
    n_candles_scanned: number;
  } | null;
  mtf_confluence?: {
    primary_tf:           string;
    higher_tfs:           string[];
    timeframe_bias:       Record<string, {
      bias:           string;
      bull_pct:       number;
      label:          string;
      is_primary:     boolean;
      key_indicators: Record<string, number>;
    }>;
    confluence_score:      number;
    confluence_label:      string;
    primary_bias:          string;
    all_bullish:           boolean;
    all_bearish:           boolean;
    confidence_adjustment: number;
    total_tfs_analysed:    number;
  } | null;
}

export const analysisApi = {
  analyseStock: async (req: AnalysisRequest): Promise<AnalysisResult> => {
    const { data } = await apiClient.post<ApiResponse<AnalysisResult>>('/analysis/stock', req);
    return data.data;
  },

  getRecentSetups: async (): Promise<any[]> => {
    const { data } = await apiClient.get<ApiResponse<any[]>>('/analysis/recent');
    return data.data;
  },
};
