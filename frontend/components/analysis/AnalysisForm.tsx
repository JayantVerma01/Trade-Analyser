'use client';

import { useState, useEffect } from 'react';
import { Search, Loader2, TrendingUp, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { AnalysisRequest } from '@/lib/api/analysis.api';
import { strategyApi, type Strategy } from '@/lib/api/strategy.api';

const TIMEFRAMES = ['1m', '3m', '5m', '15m', '30m', '1h', '4h', '1d'] as const;
const MARKET_TYPES = [
  { value: 'intraday',   label: 'Intraday' },
  { value: 'swing',      label: 'Swing (2–5 days)' },
  { value: 'positional', label: 'Positional (weeks)' },
] as const;

const POPULAR_SYMBOLS = ['RELIANCE', 'TCS', 'INFY', 'HDFCBANK', 'ICICIBANK', 'SBIN', 'NIFTY50', 'BANKNIFTY'];

interface Props {
  onSubmit:  (req: AnalysisRequest) => void;
  isLoading: boolean;
}

export default function AnalysisForm({ onSubmit, isLoading }: Props) {
  const [symbol,     setSymbol]     = useState('RELIANCE');
  const [timeframe,  setTimeframe]  = useState<'1m'|'3m'|'5m'|'15m'|'30m'|'1h'|'4h'|'1d'>('15m');
  const [capital,    setCapital]    = useState('100000');
  const [riskPct,    setRiskPct]    = useState('1');
  const [marketType, setMarketType] = useState<'intraday'|'swing'|'positional'>('intraday');
  const [notes,      setNotes]      = useState('');
  const [strategyId, setStrategyId] = useState('');
  const [strategies, setStrategies] = useState<Strategy[]>([]);

  useEffect(() => {
    strategyApi.list()
      .then((list) => setStrategies(list.filter((s) => s.isActive)))
      .catch(() => {/* non-critical */});
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      symbol:     symbol.toUpperCase().trim(),
      timeframe,
      capital:    parseFloat(capital),
      riskPct:    parseFloat(riskPct),
      marketType,
      notes,
      strategyId: strategyId || undefined,
    });
  };

  const riskAmount = parseFloat(capital) * parseFloat(riskPct) / 100;
  const selectedStrategy = strategies.find((s) => s.id === strategyId);

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-base flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          Analysis Parameters
        </CardTitle>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">

          {/* Symbol */}
          <div className="space-y-1.5">
            <Label htmlFor="symbol">Symbol</Label>
            <Input
              id="symbol"
              placeholder="RELIANCE, TCS, NIFTY50..."
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              className="font-mono"
              required
            />
            <div className="flex flex-wrap gap-1.5 mt-1">
              {POPULAR_SYMBOLS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSymbol(s)}
                  className={`text-[10px] px-2 py-0.5 rounded border transition-colors font-mono ${
                    symbol === s
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:border-primary/50'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Timeframe */}
          <div className="space-y-1.5">
            <Label>Timeframe</Label>
            <div className="flex flex-wrap gap-1.5">
              {TIMEFRAMES.map((tf) => (
                <button
                  key={tf}
                  type="button"
                  onClick={() => setTimeframe(tf)}
                  className={`text-xs px-3 py-1.5 rounded border font-medium transition-colors ${
                    timeframe === tf
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:border-primary/50'
                  }`}
                >
                  {tf}
                </button>
              ))}
            </div>
          </div>

          {/* Market type */}
          <div className="space-y-1.5">
            <Label>Market Type</Label>
            <div className="flex flex-col gap-1.5">
              {MARKET_TYPES.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setMarketType(value)}
                  className={`text-sm px-3 py-2 rounded border text-left transition-colors ${
                    marketType === value
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:border-primary/50'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Capital + Risk */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="capital">Capital (₹)</Label>
              <Input
                id="capital"
                type="number"
                min="1000"
                value={capital}
                onChange={(e) => setCapital(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="risk">Risk / Trade (%)</Label>
              <Input
                id="risk"
                type="number"
                min="0.1"
                max="10"
                step="0.1"
                value={riskPct}
                onChange={(e) => setRiskPct(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Risk preview */}
          {!isNaN(riskAmount) && riskAmount > 0 && (
            <div className="text-xs text-muted-foreground bg-secondary rounded-md px-3 py-2">
              Max risk per trade:{' '}
              <span className="font-semibold text-foreground">
                ₹{riskAmount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </span>
            </div>
          )}

          {/* Strategy selector */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1">
              <Settings2 className="h-3.5 w-3.5" />
              Strategy (optional)
            </Label>
            <select
              value={strategyId}
              onChange={(e) => setStrategyId(e.target.value)}
              className="w-full h-9 text-sm rounded-md border border-border bg-background px-3"
            >
              <option value="">— No strategy (base analysis only) —</option>
              {strategies.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} · {s.conditions?.rules?.length ?? 0} rules · {s.marketType}
                </option>
              ))}
            </select>
            {selectedStrategy && (
              <p className="text-[10px] text-muted-foreground">
                {selectedStrategy.description || `${selectedStrategy.conditions.rules.length} rules · ${selectedStrategy.conditions.logic} logic`}
              </p>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Input
              id="notes"
              placeholder="Any specific observations..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <Button type="submit" className="w-full" disabled={isLoading || !symbol.trim()}>
            {isLoading ? (
              <><Loader2 className="h-4 w-4 animate-spin" />Analysing...</>
            ) : (
              <><Search className="h-4 w-4" />Run Analysis</>
            )}
          </Button>
        </CardContent>
      </form>
    </Card>
  );
}
