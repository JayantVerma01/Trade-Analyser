import axios from 'axios';

const api = axios.create({ baseURL: '/api', withCredentials: true });

api.interceptors.request.use((cfg) => {
  const token = document.cookie.match(/trade_token=([^;]+)/)?.[1];
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

export interface MTFBias {
  bias: string;
  bull_pct: number;
  label: string;
  is_primary: boolean;
}

export interface MTFConfluence {
  primary_tf: string;
  higher_tfs: string[];
  timeframe_bias: Record<string, MTFBias>;
  confluence_score: number;
  confluence_label: string;
  primary_bias: string;
  confidence_adjustment: number;
  total_tfs_analysed: number;
}

export interface Validation {
  occurrences: number;
  decided: number;
  wins: number;
  losses: number;
  hit_rate: number;
  is_validated: boolean;
  confidence_label: string;
}

export interface StockRecommendation {
  rank: number;
  symbol: string;
  recommendation_score: number;
  bias: 'Bullish' | 'Bearish';
  setup_type: string;
  confidence_score: number;
  entry_zone: { from: number; to: number };
  stop_loss: number;
  target1: number;
  target2: number;
  risk_reward: number;
  position_size: number;
  analysis_timeframe: string;
  trading_style: string;
  mtf_confluence: MTFConfluence | null;
  validation: Validation | null;
  indicators: Record<string, number>;
  entry_condition: string;
  invalidation_condition: string;
  rules_passed: string[];
  key_reasons: string[];
}

export interface RecommendationResult {
  scope: 'custom' | 'sector' | 'market';
  sector: string | null;
  trading_style: string;
  analysis_timeframe: string;
  top_n_requested: number;
  total_scanned: number;
  total_qualified: number;
  recommendations: StockRecommendation[];
  elapsed_seconds: number;
  generated_at: string;
}

export interface SectorMeta {
  sectors: string[];
  sector_stocks: Record<string, number>;
  trading_styles: string[];
  style_timeframes: Record<string, string>;
  total_universe: number;
}

export interface SymbolSearchResult {
  query: string;
  matches: string[];
  count: number;
}

export const recommendationsApi = {
  getSectors: async (): Promise<SectorMeta> => {
    const { data } = await api.get('/recommendations/sectors');
    return data.data;
  },

  searchSymbols: async (q: string, limit = 20): Promise<SymbolSearchResult> => {
    const { data } = await api.get('/recommendations/search', { params: { q, limit } });
    return data.data;
  },

  scan: async (params: {
    trading_style: string;
    sector?:  string | null;
    symbols?: string[] | null;
    capital:  number;
    risk_pct: number;
    top_n:    number;
  }): Promise<RecommendationResult> => {
    const { data } = await api.post('/recommendations/scan', params);
    return data.data;
  },
};
