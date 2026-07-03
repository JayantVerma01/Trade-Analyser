'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  FlaskConical, Play, Trash2, ChevronRight, Clock, BarChart2,
  TrendingUp, TrendingDown, Minus, RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import BacktestResults from '@/components/backtest/BacktestResults';
import { backtestApi, type BacktestResult, type BacktestListItem } from '@/lib/api/backtest.api';
import { strategyApi, type Strategy } from '@/lib/api/strategy.api';

const SYMBOLS  = ['NIFTY', 'BANKNIFTY', 'RELIANCE', 'TCS', 'INFY', 'HDFCBANK', 'TATAMOTORS'];
const TFS      = ['1m', '3m', '5m', '15m', '30m', '1h', '4h', '1d'];

function historyBadge(item: BacktestListItem) {
  if (item.status === 'RUNNING') return <Badge variant="secondary" className="text-[10px]">Running</Badge>;
  if (item.status === 'FAILED')  return <Badge variant="destructive" className="text-[10px]">Failed</Badge>;
  if (item.winRate == null)      return <Badge variant="secondary" className="text-[10px]">No data</Badge>;
  return item.winRate >= 50
    ? <Badge className="text-[10px] bull-badge border">{item.winRate}% WR</Badge>
    : <Badge className="text-[10px] bear-badge border">{item.winRate}% WR</Badge>;
}

export default function BacktestPage() {
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [strategyId, setStrategyId] = useState('');
  const [symbol,     setSymbol]     = useState('NIFTY');
  const [timeframe,  setTimeframe]  = useState('5m');
  const [capital,    setCapital]    = useState(100000);
  const [riskPct,    setRiskPct]    = useState(1);
  const [nCandles,   setNCandles]   = useState(500);

  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState('');
  const [result,     setResult]     = useState<BacktestResult | null>(null);

  const [history,    setHistory]    = useState<BacktestListItem[]>([]);
  const [histLoading, setHistLoading] = useState(false);
  const [loadingId,  setLoadingId]  = useState('');

  const fetchHistory = useCallback(async () => {
    setHistLoading(true);
    try { setHistory(await backtestApi.list()); } catch { /* ignore */ }
    finally { setHistLoading(false); }
  }, []);

  useEffect(() => {
    strategyApi.list().then(s => { setStrategies(s); if (s.length) setStrategyId(s[0].id); }).catch(() => {});
    fetchHistory();
  }, [fetchHistory]);

  const run = async () => {
    if (!strategyId) { setError('Please select a strategy.'); return; }
    setError('');
    setLoading(true);
    setResult(null);
    try {
      const res = await backtestApi.run({ strategyId, symbol, timeframe, capital, riskPct, nCandles });
      setResult(res);
      fetchHistory();
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Backtest failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const loadHistoryItem = async (id: string) => {
    setLoadingId(id);
    setError('');
    try {
      const res = await backtestApi.getOne(id);
      setResult(res);
    } catch {
      setError('Failed to load backtest result.');
    } finally {
      setLoadingId('');
    }
  };

  const deleteHistoryItem = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await backtestApi.delete(id);
      setHistory(prev => prev.filter(h => h.id !== id));
      if (result && (result as any).backtestId === id) setResult(null);
    } catch {
      setError('Failed to delete backtest.');
    }
  };

  return (
    <div className="p-6 space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
          <FlaskConical className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold leading-none">Backtesting</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Walk-forward simulation on historical candles</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-6 items-start">
        {/* ── Left: form ─────────────────────────────────────────────────── */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Strategy */}
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground font-medium">Strategy</label>
                {strategies.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2">No strategies found. Create one first.</p>
                ) : (
                  <div className="space-y-1">
                    {strategies.map(s => (
                      <button
                        key={s.id}
                        onClick={() => setStrategyId(s.id)}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border text-sm transition-colors ${
                          strategyId === s.id
                            ? 'border-primary bg-primary/5 text-primary'
                            : 'border-border hover:bg-secondary/50'
                        }`}
                      >
                        <span className="font-medium truncate">{s.name}</span>
                        <span className="text-xs text-muted-foreground ml-2 shrink-0">{s.marketType}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Symbol */}
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground font-medium">Symbol</label>
                <div className="flex flex-wrap gap-1.5">
                  {SYMBOLS.map(s => (
                    <button
                      key={s}
                      onClick={() => setSymbol(s)}
                      className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                        symbol === s ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-secondary/50'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
                <input
                  className="w-full mt-1 bg-secondary/50 border border-border rounded-md px-3 py-1.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                  placeholder="Or type symbol…"
                  value={SYMBOLS.includes(symbol) ? '' : symbol}
                  onChange={e => setSymbol(e.target.value.toUpperCase())}
                />
              </div>

              {/* Timeframe */}
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground font-medium">Timeframe</label>
                <div className="flex flex-wrap gap-1.5">
                  {TFS.map(t => (
                    <button
                      key={t}
                      onClick={() => setTimeframe(t)}
                      className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                        timeframe === t ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-secondary/50'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Capital & Risk */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground font-medium">Capital (₹)</label>
                  <input
                    type="number"
                    className="w-full bg-secondary/50 border border-border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:border-primary"
                    value={capital}
                    onChange={e => setCapital(Number(e.target.value))}
                    min={10000}
                    step={10000}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground font-medium">Risk %</label>
                  <input
                    type="number"
                    className="w-full bg-secondary/50 border border-border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:border-primary"
                    value={riskPct}
                    onChange={e => setRiskPct(Number(e.target.value))}
                    min={0.5}
                    max={5}
                    step={0.5}
                  />
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground -mt-3">
                Risk per trade: ₹{((capital * riskPct) / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </p>

              {/* N Candles */}
              <div className="space-y-2">
                <div className="flex justify-between">
                  <label className="text-xs text-muted-foreground font-medium">Candles</label>
                  <span className="text-xs font-mono text-foreground">{nCandles}</span>
                </div>
                <input
                  type="range"
                  min={100}
                  max={1000}
                  step={50}
                  value={nCandles}
                  onChange={e => setNCandles(Number(e.target.value))}
                  className="w-full accent-primary"
                />
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>100</span>
                  <span>1,000</span>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30">
                  <p className="text-xs text-destructive">{error}</p>
                </div>
              )}

              <Button onClick={run} disabled={loading || !strategyId} className="w-full gap-2">
                {loading ? (
                  <><RefreshCw className="h-4 w-4 animate-spin" /> Running…</>
                ) : (
                  <><Play className="h-4 w-4" /> Run Backtest</>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Disclaimer */}
          <p className="text-[10px] text-muted-foreground leading-relaxed px-1">
            Simulations use synthetic GBM candles seeded from symbol+timeframe. Past performance does not guarantee
            future results. This tool is for strategy evaluation only — not financial advice.
          </p>
        </div>

        {/* ── Right: results ─────────────────────────────────────────────── */}
        <div>
          {loading && (
            <div className="flex flex-col items-center justify-center py-24 text-center text-muted-foreground space-y-3">
              <RefreshCw className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm">Simulating {nCandles} candles on {symbol}…</p>
              <p className="text-xs">Building indicator matrix and walking forward</p>
            </div>
          )}

          {!loading && result && (
            <BacktestResults result={result} />
          )}

          {!loading && !result && (
            <div className="flex flex-col items-center justify-center py-24 text-center text-muted-foreground space-y-3">
              <BarChart2 className="h-12 w-12 opacity-20" />
              <p className="text-sm font-medium">No results yet</p>
              <p className="text-xs">Configure your strategy and click Run Backtest</p>
            </div>
          )}
        </div>
      </div>

      {/* ── History ──────────────────────────────────────────────────────── */}
      {history.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">History ({history.length})</h2>
            <button
              onClick={fetchHistory}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
            >
              <RefreshCw className={`h-3 w-3 ${histLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {history.map(item => (
              <button
                key={item.id}
                onClick={() => loadHistoryItem(item.id)}
                disabled={loadingId === item.id}
                className="group relative text-left p-4 rounded-xl border border-border hover:border-primary/50 bg-card hover:bg-secondary/30 transition-all"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-sm font-semibold">{item.symbol}</span>
                      <span className="text-xs text-muted-foreground">{item.timeframe}</span>
                      {historyBadge(item)}
                    </div>
                    {item.strategy && (
                      <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{item.strategy.name}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={(e) => deleteHistoryItem(item.id, e)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                    {loadingId === item.id
                      ? <RefreshCw className="h-3.5 w-3.5 animate-spin text-primary" />
                      : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                    }
                  </div>
                </div>

                {item.status === 'COMPLETED' && item.totalTrades != null && (
                  <div className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
                    <div>
                      <span className="text-muted-foreground block">Trades</span>
                      <span className="font-mono font-medium">{item.totalTrades}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">Avg R:R</span>
                      <span className="font-mono font-medium">1:{item.avgRR ?? '-'}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">Net P&L</span>
                      <span className={`font-mono font-medium ${(item.netPnl ?? 0) >= 0 ? 'bull-text' : 'bear-text'}`}>
                        {(item.netPnl ?? 0) >= 0 ? '+' : ''}₹{Math.abs(item.netPnl ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                      </span>
                    </div>
                  </div>
                )}

                <div className="mt-2 flex items-center gap-1 text-[10px] text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {new Date(item.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
