'use client';

import { useState, useEffect } from 'react';
import { Bot, Loader2, AlertCircle, Sparkles, Search } from 'lucide-react';
import { Button }       from '@/components/ui/button';
import { Input }        from '@/components/ui/input';
import { Label }        from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import ReactMarkdown    from 'react-markdown';
import StepBadge        from '@/components/agent/StepBadge';
import TradeSetupCard   from '@/components/analysis/TradeSetupCard';
import CandlestickChart from '@/components/charts/CandlestickChart';
import { agentApi, type AgentResult, type AgentRequest } from '@/lib/api/agent.api';
import { strategyApi, type Strategy } from '@/lib/api/strategy.api';

const TIMEFRAMES  = ['5m', '15m', '30m', '1h', '4h', '1d'] as const;
const SYMBOLS     = ['RELIANCE', 'TCS', 'INFY', 'HDFCBANK', 'ICICIBANK', 'SBIN', 'NIFTY50', 'BANKNIFTY'];
const MARKET_TYPES = ['intraday', 'swing', 'positional'] as const;

const QUICK_QUERIES = [
  'Is this a good entry point right now?',
  'What is the highest-probability setup I can take today?',
  'What does my theory say about this chart pattern?',
  'Give me a full risk-managed trade plan.',
];

export default function AgentPage() {
  const [query,       setQuery]       = useState(QUICK_QUERIES[0]);
  const [symbol,      setSymbol]      = useState('RELIANCE');
  const [timeframe,   setTimeframe]   = useState<typeof TIMEFRAMES[number]>('15m');
  const [capital,     setCapital]     = useState('100000');
  const [riskPct,     setRiskPct]     = useState('1');
  const [marketType,  setMarketType]  = useState<typeof MARKET_TYPES[number]>('intraday');
  const [strategyId,  setStrategyId]  = useState('');
  const [strategies,  setStrategies]  = useState<Strategy[]>([]);
  const [isLoading,   setIsLoading]   = useState(false);
  const [result,      setResult]      = useState<AgentResult | null>(null);
  const [error,       setError]       = useState<string | null>(null);

  useEffect(() => {
    strategyApi.list()
      .then((list) => setStrategies(list.filter((s) => s.isActive)))
      .catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || !symbol.trim()) return;

    setIsLoading(true);
    setError(null);
    setResult(null);

    const req: AgentRequest = {
      query:      query.trim(),
      symbol:     symbol.toUpperCase().trim(),
      timeframe,
      capital:    parseFloat(capital),
      riskPct:    parseFloat(riskPct),
      marketType,
      strategyId: strategyId || undefined,
    };

    try {
      const data = await agentApi.tradeQuery(req);
      setResult(data);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? err?.message ?? 'Agent query failed.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Bot className="h-6 w-6 text-primary" />
          AI Trade Agent
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          LangGraph-powered ReAct agent — analyses market data, searches your theory docs, and delivers a structured trade plan
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[360px_1fr] gap-6 items-start">
        {/* Left — query form */}
        <div className="xl:sticky xl:top-6 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                Agent Query
              </CardTitle>
            </CardHeader>
            <form onSubmit={handleSubmit}>
              <CardContent className="space-y-4">

                {/* Query */}
                <div className="space-y-1.5">
                  <Label>Your Question</Label>
                  <textarea
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    rows={3}
                    placeholder="Ask anything about the stock..."
                    className="w-full text-sm rounded-md border border-border bg-background px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <div className="flex flex-wrap gap-1.5">
                    {QUICK_QUERIES.map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => setQuery(q)}
                        className={`text-[10px] px-2 py-0.5 rounded border transition-colors text-left ${
                          query === q
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border text-muted-foreground hover:border-primary/40'
                        }`}
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Symbol */}
                <div className="space-y-1.5">
                  <Label>Symbol</Label>
                  <Input
                    value={symbol}
                    onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                    placeholder="RELIANCE"
                    className="font-mono"
                    required
                  />
                  <div className="flex flex-wrap gap-1">
                    {SYMBOLS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setSymbol(s)}
                        className={`text-[10px] px-2 py-0.5 rounded border font-mono transition-colors ${
                          symbol === s
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border text-muted-foreground hover:border-primary/40'
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Timeframe + Market type */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Timeframe</Label>
                    <div className="flex flex-wrap gap-1">
                      {TIMEFRAMES.map((tf) => (
                        <button
                          key={tf}
                          type="button"
                          onClick={() => setTimeframe(tf)}
                          className={`text-xs px-2 py-1 rounded border transition-colors ${
                            timeframe === tf
                              ? 'border-primary bg-primary/10 text-primary'
                              : 'border-border text-muted-foreground hover:border-primary/40'
                          }`}
                        >
                          {tf}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Market Type</Label>
                    <div className="flex flex-col gap-1">
                      {MARKET_TYPES.map((mt) => (
                        <button
                          key={mt}
                          type="button"
                          onClick={() => setMarketType(mt)}
                          className={`text-xs px-2 py-1.5 rounded border text-left capitalize transition-colors ${
                            marketType === mt
                              ? 'border-primary bg-primary/10 text-primary'
                              : 'border-border text-muted-foreground hover:border-primary/40'
                          }`}
                        >
                          {mt}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Capital + Risk */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="ag-cap">Capital (₹)</Label>
                    <Input id="ag-cap" type="number" value={capital} onChange={(e) => setCapital(e.target.value)} min="1000" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="ag-risk">Risk (%)</Label>
                    <Input id="ag-risk" type="number" value={riskPct} onChange={(e) => setRiskPct(e.target.value)} min="0.1" max="10" step="0.1" />
                  </div>
                </div>

                {/* Strategy (optional) */}
                {strategies.length > 0 && (
                  <div className="space-y-1.5">
                    <Label>Apply Strategy</Label>
                    <select
                      value={strategyId}
                      onChange={(e) => setStrategyId(e.target.value)}
                      className="w-full h-9 text-sm rounded-md border border-border bg-background px-3"
                    >
                      <option value="">— None —</option>
                      {strategies.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                <Button type="submit" className="w-full gap-2" disabled={isLoading || !symbol.trim() || !query.trim()}>
                  {isLoading
                    ? <><Loader2 className="h-4 w-4 animate-spin" />Agent thinking...</>
                    : <><Search className="h-4 w-4" />Ask the Agent</>}
                </Button>
              </CardContent>
            </form>
          </Card>

          {/* Info card */}
          <Card className="border-dashed">
            <CardContent className="pt-4 text-xs text-muted-foreground space-y-1.5 leading-relaxed">
              <p className="font-medium text-foreground">How the agent works</p>
              <p>1. Fetches live candles and runs the indicator engine</p>
              <p>2. Detects market bias and trade setup</p>
              <p>3. Searches your uploaded theory documents</p>
              <p>4. Synthesises a comprehensive trade plan</p>
            </CardContent>
          </Card>
        </div>

        {/* Right — results */}
        <div className="space-y-6">
          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 text-sm bear-text bg-bear/10 border border-bear/20 rounded-lg px-4 py-3">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />{error}
            </div>
          )}

          {/* Loading state */}
          {isLoading && (
            <Card>
              <CardContent className="py-12 flex flex-col items-center gap-4 text-center">
                <div className="relative">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <Bot className="h-6 w-6 text-primary" />
                  </div>
                  <div className="absolute inset-0 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
                </div>
                <div>
                  <p className="font-medium">Agent is working...</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Fetching market data → Running analysis → Searching theory docs → Synthesising...
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Results */}
          {result && !isLoading && (
            <>
              {/* Agent steps */}
              {result.steps.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Bot className="h-4 w-4 text-primary" />
                      Agent Reasoning Chain
                      <span className="ml-auto text-xs font-normal text-muted-foreground">
                        {result.steps.length} step{result.steps.length !== 1 ? 's' : ''}
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-2">
                    {result.steps.map((step, i) => (
                      <StepBadge key={i} step={step} index={i} />
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* AI Recommendation */}
              <Card className="border-primary/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    AI Recommendation
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="prose prose-invert prose-sm max-w-none text-sm leading-relaxed">
                    <ReactMarkdown>{result.recommendation}</ReactMarkdown>
                  </div>
                </CardContent>
              </Card>

              {/* Chart */}
              {result.analysis?.candles && result.analysis.candles.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Price Chart</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <CandlestickChart
                      candles={result.analysis.candles}
                      symbol={result.analysis.symbol}
                      timeframe={result.analysis.timeframe}
                      indicators={{
                        ema9:  result.analysis.indicators?.ema9,
                        ema21: result.analysis.indicators?.ema21,
                        ema50: result.analysis.indicators?.ema50,
                        vwap:  result.analysis.indicators?.vwap,
                      }}
                      levels={{
                        entryFrom: result.analysis.entry_zone?.from,
                        entryTo:   result.analysis.entry_zone?.to,
                        stopLoss:  result.analysis.stop_loss,
                        target1:   result.analysis.target1,
                        target2:   result.analysis.target2,
                      }}
                    />
                  </CardContent>
                </Card>
              )}

              {/* Trade setup detail */}
              {result.analysis && (
                <TradeSetupCard result={result.analysis} />
              )}
            </>
          )}

          {/* Empty state */}
          {!result && !isLoading && !error && (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-20 text-center gap-4">
                <div className="p-5 rounded-full bg-secondary">
                  <Bot className="h-10 w-10 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-medium text-lg">Ask your AI Trade Agent</p>
                  <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
                    The agent uses LangGraph to chain tool calls — market data, technical analysis,
                    and your theory documents — then synthesises a structured trade recommendation.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
