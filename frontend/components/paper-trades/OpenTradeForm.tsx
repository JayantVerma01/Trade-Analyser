'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { paperTradeApi, type OpenPaperTradePayload, type TradeDirection } from '@/lib/api/paper-trade.api';
import type { Strategy } from '@/lib/api/strategy.api';

const SYMBOLS  = ['NIFTY', 'BANKNIFTY', 'RELIANCE', 'TCS', 'INFY', 'HDFCBANK'];
const TFS      = ['1m', '3m', '5m', '15m', '30m', '1h', '1d'];

interface Props {
  strategies: Strategy[];
  onCreated:  () => void;
}

export default function OpenTradeForm({ strategies, onCreated }: Props) {
  const [symbol,      setSymbol]      = useState('NIFTY');
  const [timeframe,   setTimeframe]   = useState('5m');
  const [direction,   setDirection]   = useState<TradeDirection>('LONG');
  const [entryPrice,  setEntryPrice]  = useState('');
  const [stopLoss,    setStopLoss]    = useState('');
  const [target1,     setTarget1]     = useState('');
  const [target2,     setTarget2]     = useState('');
  const [quantity,    setQuantity]    = useState('');
  const [capitalUsed, setCapitalUsed] = useState('');
  const [strategyId,  setStrategyId]  = useState('');
  const [notes,       setNotes]       = useState('');
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState('');

  // Auto-compute capital used when qty + entry change
  const entry = Number(entryPrice);
  const qty   = Number(quantity);
  const autoCapital = entry > 0 && qty > 0 ? (entry * qty).toFixed(0) : '';

  const risk = entry > 0 && Number(stopLoss) > 0
    ? Math.abs(entry - Number(stopLoss)) * qty
    : 0;

  const handleSubmit = async () => {
    setError('');
    const payload: OpenPaperTradePayload = {
      symbol, timeframe, direction,
      entryPrice:  Number(entryPrice),
      stopLoss:    Number(stopLoss),
      target1:     Number(target1),
      target2:     Number(target2),
      quantity:    Number(quantity),
      capitalUsed: Number(capitalUsed || autoCapital),
      strategyId:  strategyId || undefined,
      notes:       notes || undefined,
    };
    const missing = Object.entries(payload).filter(([k, v]) =>
      ['entryPrice','stopLoss','target1','target2','quantity','capitalUsed'].includes(k) && !v
    );
    if (missing.length) { setError('Fill in all price fields'); return; }

    setLoading(true);
    try {
      await paperTradeApi.open(payload);
      // Reset
      setEntryPrice(''); setStopLoss(''); setTarget1(''); setTarget2('');
      setQuantity(''); setCapitalUsed(''); setNotes(''); setStrategyId('');
      onCreated();
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Failed to open trade');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Open Paper Trade</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Symbol */}
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground font-medium">Symbol</label>
          <div className="flex flex-wrap gap-1.5">
            {SYMBOLS.map(s => (
              <button key={s} onClick={() => setSymbol(s)}
                className={`px-2 py-1 rounded text-xs font-medium border transition-colors ${symbol === s ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-secondary/50'}`}>
                {s}
              </button>
            ))}
          </div>
          <input className="w-full mt-1 bg-secondary/50 border border-border rounded px-2.5 py-1.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary"
            placeholder="Or type…"
            value={SYMBOLS.includes(symbol) ? '' : symbol}
            onChange={e => setSymbol(e.target.value.toUpperCase())} />
        </div>

        {/* Timeframe + Direction */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground font-medium">Timeframe</label>
            <div className="flex flex-wrap gap-1">
              {TFS.map(t => (
                <button key={t} onClick={() => setTimeframe(t)}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium border transition-colors ${timeframe === t ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-secondary/50'}`}>
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground font-medium">Direction</label>
            <div className="flex gap-2">
              <button onClick={() => setDirection('LONG')}
                className={`flex-1 py-1.5 rounded text-xs font-bold border transition-colors ${direction === 'LONG' ? 'border-green-500 bg-green-500/10 bull-text' : 'border-border hover:bg-secondary/50'}`}>
                LONG
              </button>
              <button onClick={() => setDirection('SHORT')}
                className={`flex-1 py-1.5 rounded text-xs font-bold border transition-colors ${direction === 'SHORT' ? 'border-red-500 bg-red-500/10 bear-text' : 'border-border hover:bg-secondary/50'}`}>
                SHORT
              </button>
            </div>
          </div>
        </div>

        {/* Prices */}
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: 'Entry Price', value: entryPrice, set: setEntryPrice },
            { label: 'Stop Loss',   value: stopLoss,   set: setStopLoss },
            { label: 'Target 1',    value: target1,    set: setTarget1 },
            { label: 'Target 2',    value: target2,    set: setTarget2 },
          ].map(({ label, value, set }) => (
            <div key={label} className="space-y-1">
              <label className="text-[11px] text-muted-foreground">{label}</label>
              <input type="number" placeholder="₹0" value={value} onChange={e => set(e.target.value)}
                className="w-full bg-secondary/50 border border-border rounded px-2.5 py-1.5 text-sm focus:outline-none focus:border-primary" />
            </div>
          ))}
        </div>

        {/* Qty + Capital */}
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <label className="text-[11px] text-muted-foreground">Quantity</label>
            <input type="number" placeholder="0" value={quantity} onChange={e => setQuantity(e.target.value)}
              className="w-full bg-secondary/50 border border-border rounded px-2.5 py-1.5 text-sm focus:outline-none focus:border-primary" />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] text-muted-foreground">Capital (₹)</label>
            <input type="number" placeholder={autoCapital || '0'} value={capitalUsed}
              onChange={e => setCapitalUsed(e.target.value)}
              className="w-full bg-secondary/50 border border-border rounded px-2.5 py-1.5 text-sm focus:outline-none focus:border-primary" />
          </div>
        </div>

        {risk > 0 && (
          <p className="text-[11px] text-muted-foreground">
            Risk per trade: <span className="bear-text font-mono">₹{risk.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
          </p>
        )}

        {/* Strategy */}
        {strategies.length > 0 && (
          <div className="space-y-1">
            <label className="text-[11px] text-muted-foreground">Strategy (optional)</label>
            <select value={strategyId} onChange={e => setStrategyId(e.target.value)}
              className="w-full bg-secondary/50 border border-border rounded px-2.5 py-1.5 text-sm focus:outline-none focus:border-primary">
              <option value="">— None —</option>
              {strategies.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        )}

        {/* Notes */}
        <div className="space-y-1">
          <label className="text-[11px] text-muted-foreground">Notes (optional)</label>
          <textarea rows={2} placeholder="Reason for trade…" value={notes} onChange={e => setNotes(e.target.value)}
            className="w-full bg-secondary/50 border border-border rounded px-2.5 py-1.5 text-sm resize-none focus:outline-none focus:border-primary" />
        </div>

        {error && <p className="text-xs bear-text">{error}</p>}

        <Button onClick={handleSubmit} disabled={loading} className="w-full">
          {loading ? 'Opening…' : 'Open Trade'}
        </Button>
      </CardContent>
    </Card>
  );
}
