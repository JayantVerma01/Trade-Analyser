import axios, { AxiosInstance } from 'axios';
import { config } from '../config';
import { logger } from '../utils/logger';

class AIService {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: config.PYTHON_SERVICE_URL,
      timeout: 300_000, // 5 min — recommendation scans + agent trade-queries can legitimately run this long
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Secret': config.JWT_SECRET, // guards Python service from direct external access
      },
    });

    this.client.interceptors.response.use(
      (res) => res,
      (err) => {
        logger.error('Python AI service error:', {
          url: err.config?.url,
          status: err.response?.status,
          message: err.response?.data?.detail ?? err.message,
        });
        throw err;
      }
    );
  }

  async processDocument(
    docId: string,
    userId: string,
    filePath: string
  ): Promise<{
    chunkCount: number;
    textChunkCount: number;
    imageChunkCount: number;
  }> {
    const response = await this.client.post('/ai/documents/process', {
      document_id: docId,
      user_id: userId,
      file_path: filePath,
    });
    return {
      chunkCount:      response.data.chunk_count       ?? 0,
      textChunkCount:  response.data.text_chunk_count  ?? 0,
      imageChunkCount: response.data.image_chunk_count ?? 0,
    };
  }

  async deleteDocumentChunks(docId: string): Promise<void> {
    await this.client.delete(`/ai/documents/${docId}/chunks`);
  }

  async getCandles(symbol: string, timeframe: string, limit: number) {
    const response = await this.client.get('/ai/market/candles', {
      params: { symbol, timeframe, limit },
    });
    return response.data;
  }

  async getQuote(symbol: string) {
    const response = await this.client.get('/ai/market/quote', {
      params: { symbol },
    });
    return response.data;
  }

  async searchSymbols(q: string) {
    const response = await this.client.get('/ai/market/symbols', {
      params: { q },
    });
    return response.data;
  }

  async analyseStock(
    symbol: string,
    timeframe: string,
    capital: number,
    riskPct: number,
    marketType: string,
    notes: string,
    strategyConditions?: Record<string, any>,
    strategyName?: string,
  ) {
    const response = await this.client.post('/ai/analysis/stock', {
      symbol,
      timeframe,
      capital,
      risk_pct:             riskPct,
      market_type:          marketType,
      notes,
      strategy_conditions:  strategyConditions,
      strategy_name:        strategyName ?? '',
    });
    return response.data;
  }

  async evaluateStrategy(
    symbol: string,
    timeframe: string,
    conditions: Record<string, any>,
  ) {
    const response = await this.client.post('/ai/strategy/evaluate', {
      symbol,
      timeframe,
      conditions,
    });
    return response.data;
  }

  async scanStrategy(
    symbols: string[],
    timeframe: string,
    conditions: Record<string, any>,
  ) {
    const response = await this.client.post('/ai/strategy/scan', {
      symbols,
      timeframe,
      conditions,
    });
    return response.data;
  }

  async getStrategyMeta() {
    const response = await this.client.get('/ai/strategy/meta');
    return response.data;
  }

  async runBacktest(
    symbol:     string,
    timeframe:  string,
    conditions: Record<string, any>,
    capital:    number,
    riskPct:    number,
    nCandles:   number,
  ) {
    const response = await this.client.post('/ai/backtest/run', {
      symbol,
      timeframe,
      conditions,
      capital,
      risk_pct:  riskPct,
      n_candles: nCandles,
    });
    return response.data;
  }

  async agentTradeQuery(
    userId: string,
    query: string,
    symbol: string,
    timeframe: string,
    capital: number,
    riskPct: number,
    marketType: string,
    strategyName?: string,
  ) {
    const response = await this.client.post('/ai/agent/trade-query', {
      user_id:       userId,
      query,
      symbol,
      timeframe,
      capital,
      risk_pct:      riskPct,
      market_type:   marketType,
      strategy_name: strategyName,
    });
    return response.data;
  }

  async getBrokerAccount(userId: string) {
    const response = await this.client.get('/ai/broker/account', { params: { user_id: userId } });
    return response.data;
  }

  async getBrokerPositions(userId: string) {
    const response = await this.client.get('/ai/broker/positions', { params: { user_id: userId } });
    return response.data;
  }

  async getBrokerOrders(userId: string) {
    const response = await this.client.get('/ai/broker/orders', { params: { user_id: userId } });
    return response.data;
  }

  async getBrokerHoldings(userId: string) {
    const response = await this.client.get('/ai/broker/holdings', { params: { user_id: userId } });
    return response.data;
  }

  async getRecommendationSectors() {
    const response = await this.client.get('/ai/recommendations/sectors');
    return response.data;
  }

  async scanRecommendations(payload: {
    trading_style: string;
    sector?:  string | null;
    symbols?: string[] | null;
    capital:  number;
    risk_pct: number;
    top_n:    number;
  }) {
    const response = await this.client.post('/ai/recommendations/scan', payload);
    return response.data;
  }

  async searchSymbolsForRecommendations(q: string, limit = 20) {
    const response = await this.client.get('/ai/recommendations/search', {
      params: { q, limit },
    });
    return response.data;
  }

  async seedBuiltinTheories() {
    const response = await this.client.post('/ai/documents/seed-builtin');
    return response.data;
  }

  async getBuiltinSeedStatus() {
    const response = await this.client.get('/ai/documents/seed-builtin/status');
    return response.data;
  }

  async theoryChatQuery(
    userId: string,
    message: string,
    sessionId: string,
    history: Array<{ role: string; content: string }>
  ) {
    const response = await this.client.post('/ai/chat/theory', {
      user_id: userId,
      message,
      session_id: sessionId,
      history,
    });
    return response.data;
  }
}

export const aiService = new AIService();
