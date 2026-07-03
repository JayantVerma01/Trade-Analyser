import { apiClient } from './client';
import type { ApiResponse } from '@/types';

export interface BacktestTrade {
  trade_num:      number;
  direction:      'LONG' | 'SHORT';
  entry_time:     number;
  exit_time:      number;
  entry_price:    number;
  exit_price:     number;
  sl:             number;
  target1:        number;
  target2:        number;
  qty:            number;
  result:         'win' | 'loss' | 'timeout';
  pnl:            number;
  risk_amount:    number;
  cumulative_pnl: number;
}

export interface BacktestResult {
  backtestId?:      string;
  symbol:           string;
  timeframe:        string;
  n_candles:        number;
  initial_capital:  number;
  total_trades:     number;
  winning_trades:   number;
  losing_trades:    number;
  timeout_trades:   number;
  win_rate:         number;
  net_pnl:          number;
  gross_profit:     number;
  gross_loss:       number;
  profit_factor:    number;
  avg_rr:           number;
  max_drawdown_pct: number;
  best_trade:       number;
  worst_trade:      number;
  equity_curve:     number[];
  trades:           BacktestTrade[];
}

export interface BacktestListItem {
  id:          string;
  symbol:      string;
  timeframe:   string;
  status:      string;
  totalTrades: number | null;
  winRate:     number | null;
  netPnl:      number | null;
  maxDrawdown: number | null;
  avgRR:       number | null;
  createdAt:   string;
  strategy:    { id: string; name: string } | null;
}

export interface RunBacktestPayload {
  strategyId: string;
  symbol:     string;
  timeframe:  string;
  capital:    number;
  riskPct:    number;
  nCandles:   number;
}

export const backtestApi = {
  run: async (payload: RunBacktestPayload): Promise<BacktestResult> => {
    const { data } = await apiClient.post<ApiResponse<BacktestResult>>('/backtest/run', payload);
    return data.data;
  },

  list: async (): Promise<BacktestListItem[]> => {
    const { data } = await apiClient.get<ApiResponse<BacktestListItem[]>>('/backtest');
    return data.data;
  },

  getOne: async (id: string): Promise<BacktestResult> => {
    const { data } = await apiClient.get<ApiResponse<BacktestResult>>(`/backtest/${id}`);
    return data.data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/backtest/${id}`);
  },
};
