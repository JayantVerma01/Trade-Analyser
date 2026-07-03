import { apiClient } from './client';
import type { ApiResponse } from '@/types';

export type JournalResult = 'WIN' | 'LOSS' | 'BREAKEVEN';

export interface JournalEntry {
  id:             string;
  symbol:         string;
  setupType:      string;
  result:         JournalResult;
  pnl:            number | null;
  notes:          string | null;
  mistakes:       string[];
  emotionTags:    string[];
  lessonsLearned: string | null;
  createdAt:      string;
  updatedAt:      string;
  paperTrade:     { id: string; symbol: string; direction: string; entryPrice: number } | null;
}

export interface JournalStats {
  total:       number;
  wins:        number;
  losses:      number;
  breakevens:  number;
  winRate:     number;
  totalPnl:    number;
  avgPnl:      number;
  topMistakes: Array<{ tag: string; count: number }>;
  topEmotions: Array<{ tag: string; count: number }>;
}

export interface CreateJournalPayload {
  paperTradeId?:  string;
  symbol:         string;
  setupType:      string;
  result:         JournalResult;
  pnl?:           number;
  notes?:         string;
  mistakes?:      string[];
  emotionTags?:   string[];
  lessonsLearned?: string;
}

export interface UpdateJournalPayload extends Partial<Omit<CreateJournalPayload, 'paperTradeId'>> {}

export interface JournalListResponse {
  entries: JournalEntry[];
  total:   number;
  take:    number;
  skip:    number;
}

export const journalApi = {
  list: async (params?: { symbol?: string; result?: JournalResult; dateFrom?: string; dateTo?: string; take?: number; skip?: number }): Promise<JournalListResponse> => {
    const { data } = await apiClient.get<ApiResponse<JournalListResponse>>('/journal', { params });
    return data.data;
  },

  stats: async (): Promise<JournalStats> => {
    const { data } = await apiClient.get<ApiResponse<JournalStats>>('/journal/stats');
    return data.data;
  },

  create: async (payload: CreateJournalPayload): Promise<JournalEntry> => {
    const { data } = await apiClient.post<ApiResponse<JournalEntry>>('/journal', payload);
    return data.data;
  },

  update: async (id: string, payload: UpdateJournalPayload): Promise<JournalEntry> => {
    const { data } = await apiClient.put<ApiResponse<JournalEntry>>(`/journal/${id}`, payload);
    return data.data;
  },

  getOne: async (id: string): Promise<JournalEntry> => {
    const { data } = await apiClient.get<ApiResponse<JournalEntry>>(`/journal/${id}`);
    return data.data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/journal/${id}`);
  },
};
