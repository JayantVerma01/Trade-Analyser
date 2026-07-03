import { apiClient } from './client';
import type { ApiResponse } from '@/types';

export type BrokerName = 'MOCK' | 'ZERODHA' | 'UPSTOX' | 'DHAN' | 'ANGEL' | 'FYERS';

export interface BrokerConnection {
  id:             string;
  brokerName:     BrokerName;
  isActive:       boolean;
  createdAt:      string;
  tokenExpiresAt: string | null;
}

export interface BrokerProfile {
  client_id:  string;
  full_name:  string;
  broker:     string;
  exchange:   string[];
  products:   string[];
  is_mock:    boolean;
  disclaimer: string;
}

export interface BrokerMargins {
  equity: {
    available: { cash: number; collateral: number; intraday_payin: number };
    used:      { debits: number; m2m: number };
    net:       number;
    total:     number;
  };
  currency: string;
}

export interface BrokerAccount {
  profile: BrokerProfile;
  margins: BrokerMargins;
}

export interface BrokerPosition {
  tradingsymbol:   string;
  exchange:        string;
  product:         string;
  quantity:        number;
  average_price:   number;
  last_price:      number;
  pnl:             number;
  value:           number;
  day_change_pct:  number;
}

export interface BrokerOrder {
  order_id:          string;
  tradingsymbol:     string;
  exchange:          string;
  transaction_type:  string;
  order_type:        string;
  product:           string;
  quantity:          number;
  price:             number;
  trigger_price:     number;
  status:            string;
  filled_quantity:   number;
  placed_at:         string;
  tag:               string;
}

export interface BrokerHolding {
  tradingsymbol: string;
  exchange:      string;
  isin:          string;
  quantity:      number;
  average_price: number;
  last_price:    number;
  pnl:           number;
  pnl_pct:       number;
  day_change:    number;
}

export interface ConnectBrokerPayload {
  brokerName: BrokerName;
  apiKey?:    string;
  apiSecret?: string;
}

export const brokerApi = {
  listConnections: async (): Promise<BrokerConnection[]> => {
    const { data } = await apiClient.get<ApiResponse<BrokerConnection[]>>('/broker/connections');
    return data.data;
  },

  connect: async (payload: ConnectBrokerPayload): Promise<BrokerConnection> => {
    const { data } = await apiClient.post<ApiResponse<BrokerConnection>>('/broker/connections', payload);
    return data.data;
  },

  disconnect: async (id: string): Promise<void> => {
    await apiClient.delete(`/broker/connections/${id}`);
  },

  getAccount: async (): Promise<BrokerAccount> => {
    const { data } = await apiClient.get<ApiResponse<BrokerAccount>>('/broker/account');
    return data.data;
  },

  getPositions: async (): Promise<{ positions: BrokerPosition[] }> => {
    const { data } = await apiClient.get<ApiResponse<{ positions: BrokerPosition[] }>>('/broker/positions');
    return data.data;
  },

  getOrders: async (): Promise<{ orders: BrokerOrder[] }> => {
    const { data } = await apiClient.get<ApiResponse<{ orders: BrokerOrder[] }>>('/broker/orders');
    return data.data;
  },

  getHoldings: async (): Promise<{ holdings: BrokerHolding[] }> => {
    const { data } = await apiClient.get<ApiResponse<{ holdings: BrokerHolding[] }>>('/broker/holdings');
    return data.data;
  },
};
