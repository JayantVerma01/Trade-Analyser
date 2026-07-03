// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'USER' | 'ADMIN';
  isActive: boolean;
  createdAt: string;
  settings?: UserSettings;
}

export interface UserSettings {
  capital: number;
  riskPerTradePct: number;
  maxDailyLossPct: number;
  maxTradesPerDay: number;
  defaultTimeframe: string;
  preferredMarketType: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

// ─── Documents ────────────────────────────────────────────────────────────────

export type DocumentStatus = 'PENDING' | 'PROCESSING' | 'READY' | 'FAILED';

export interface TheoryDocument {
  id: string;
  originalName: string;
  fileSize: number;
  mimeType: string;
  status: DocumentStatus;
  chunkCount: number;
  textChunkCount?: number;
  imageChunkCount?: number;
  errorMessage?: string;
  createdAt: string;
}

// ─── Chat ─────────────────────────────────────────────────────────────────────

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface SourceChunk {
  document_id: string;
  chunk_index: number;
  content: string;
  score: number;
  is_builtin?: boolean;
  source_type?: 'text' | 'image';
  page?: number | null;
}

export interface TheoryChatResponse {
  answer: string;
  sources: SourceChunk[];
  found_in_theory: boolean;
  session_id: string;
}

// ─── API ──────────────────────────────────────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export interface ApiError {
  success: false;
  message: string;
  errors?: Record<string, string[]>;
}

// ─── Paper Trades ─────────────────────────────────────────────────────────────

export type PaperTradeStatus =
  | 'PENDING'
  | 'ACTIVE'
  | 'TARGET_HIT'
  | 'STOP_LOSS_HIT'
  | 'MANUALLY_CLOSED'
  | 'CANCELLED';

export interface PaperTrade {
  id: string;
  symbol: string;
  timeframe: string;
  entryPrice: number;
  stopLoss: number;
  target1: number;
  target2: number;
  quantity: number;
  capitalUsed: number;
  status: PaperTradeStatus;
  exitPrice?: number;
  pnl?: number;
  notes?: string;
  createdAt: string;
}

// ─── Trade Setup ──────────────────────────────────────────────────────────────

export interface TradeSetup {
  symbol: string;
  timeframe: string;
  marketBias: 'Bullish' | 'Bearish' | 'Sideways';
  setupType: string;
  entryCondition: string;
  entryZone: { from: number; to: number };
  stopLoss: number;
  target1: number;
  target2: number;
  riskReward: string;
  positionSize: number;
  confidenceScore: number;
  rulesPassed: string[];
  rulesFailed: string[];
  theoryReferences: Array<{ source: string; excerpt: string }>;
  reasoning: string;
  invalidationCondition: string;
  riskWarning: string;
}
