import { apiClient } from './client';
import type { ApiResponse } from '@/types';

export type TradeDirection  = 'LONG' | 'SHORT';
export type PaperTradeStatus =
  | 'PENDING' | 'ACTIVE'
  | 'TARGET_HIT' | 'STOP_LOSS_HIT' | 'MANUALLY_CLOSED' | 'CANCELLED';

export interface PaperTrade {
  id:          string;
  symbol:      string;
  timeframe:   string;
  direction:   TradeDirection;
  entryPrice:  number;
  stopLoss:    number;
  target1:     number;
  target2:     number;
  quantity:    number;
  capitalUsed: number;
  status:      PaperTradeStatus;
  exitPrice:   number | null;
  pnl:         number | null;
  notes:       string | null;
  entryAt:     string | null;
  exitAt:      string | null;
  createdAt:   string;
  updatedAt:   string;
  strategy:    { id: string; name: string } | null;
}

export interface OpenPaperTradePayload {
  symbol:      string;
  timeframe:   string;
  direction:   TradeDirection;
  entryPrice:  number;
  stopLoss:    number;
  target1:     number;
  target2:     number;
  quantity:    number;
  capitalUsed: number;
  strategyId?: string;
  setupId?:    string;
  notes?:      string;
}

export interface ClosePaperTradePayload {
  exitPrice: number;
  status:    'TARGET_HIT' | 'STOP_LOSS_HIT' | 'MANUALLY_CLOSED';
  notes?:    string;
}

export const paperTradeApi = {
  list: async (status?: string): Promise<PaperTrade[]> => {
    const { data } = await apiClient.get<ApiResponse<PaperTrade[]>>('/paper-trades', { params: status ? { status } : {} });
    return data.data;
  },

  open: async (payload: OpenPaperTradePayload): Promise<PaperTrade> => {
    const { data } = await apiClient.post<ApiResponse<PaperTrade>>('/paper-trades', payload);
    return data.data;
  },

  getOne: async (id: string): Promise<PaperTrade> => {
    const { data } = await apiClient.get<ApiResponse<PaperTrade>>(`/paper-trades/${id}`);
    return data.data;
  },

  activate: async (id: string): Promise<PaperTrade> => {
    const { data } = await apiClient.patch<ApiResponse<PaperTrade>>(`/paper-trades/${id}/activate`);
    return data.data;
  },

  close: async (id: string, payload: ClosePaperTradePayload): Promise<PaperTrade> => {
    const { data } = await apiClient.patch<ApiResponse<PaperTrade>>(`/paper-trades/${id}/close`, payload);
    return data.data;
  },

  cancel: async (id: string): Promise<PaperTrade> => {
    const { data } = await apiClient.patch<ApiResponse<PaperTrade>>(`/paper-trades/${id}/cancel`);
    return data.data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/paper-trades/${id}`);
  },
};
