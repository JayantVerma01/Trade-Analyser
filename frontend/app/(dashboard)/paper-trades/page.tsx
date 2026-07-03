'use client';

import { useState, useEffect, useCallback } from 'react';
import { LineChart, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import PaperTradeCard from '@/components/paper-trades/PaperTradeCard';
import OpenTradeForm  from '@/components/paper-trades/OpenTradeForm';
import { paperTradeApi, type PaperTrade } from '@/lib/api/paper-trade.api';
import { strategyApi,   type Strategy }   from '@/lib/api/strategy.api';

type Tab = 'open' | 'closed';

export default function PaperTradesPage() {
  const [trades,     setTrades]     = useState<PaperTrade[]>([]);
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [tab,        setTab]        = useState<Tab>('open');
  const [showForm,   setShowForm]   = useState(false);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [t, s] = await Promise.all([
        paperTradeApi.list(),
        strategyApi.list(),
      ]);
      setTrades(t);
      setStrategies(s);
    } catch {
      setError('Failed to load trades');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const open   = trades.filter(t => t.status === 'PENDING' || t.status === 'ACTIVE');
  const closed = trades.filter(t => !['PENDING', 'ACTIVE'].includes(t.status));

  const displayed = tab === 'open' ? open : closed;

  // Quick P&L summary for closed
  const closedPnl = closed.reduce((acc, t) => acc + Number(t.pnl ?? 0), 0);
  const wins      = closed.filter(t => (t.pnl ?? 0) > 0).length;

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
            <LineChart className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold leading-none">Paper Trading</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Virtual trades with full lifecycle tracking</p>
          </div>
        </div>
        <Button size="sm" className="gap-1.5" onClick={() => setShowForm(f => !f)}>
          {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showForm ? 'Cancel' : 'New Trade'}
        </Button>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-6 items-start">
        {/* Left: form (when open) */}
        {showForm && (
          <OpenTradeForm
            strategies={strategies}
            onCreated={() => { setShowForm(false); load(); }}
          />
        )}

        {/* Right: trade list */}
        <div className={showForm ? '' : 'lg:col-span-2'}>
          {/* Stats bar for closed tab */}
          {tab === 'closed' && closed.length > 0 && (
            <div className="flex items-center gap-6 mb-4 p-3 rounded-xl bg-secondary/30 border border-border text-sm">
              <div>
                <span className="text-muted-foreground text-xs">Closed Trades</span>
                <p className="font-bold">{closed.length}</p>
              </div>
              <div>
                <span className="text-muted-foreground text-xs">Win Rate</span>
                <p className={`font-bold ${wins / closed.length >= 0.5 ? 'bull-text' : 'bear-text'}`}>
                  {Math.round((wins / closed.length) * 100)}%
                </p>
              </div>
              <div>
                <span className="text-muted-foreground text-xs">Net P&L</span>
                <p className={`font-bold font-mono ${closedPnl >= 0 ? 'bull-text' : 'bear-text'}`}>
                  {closedPnl >= 0 ? '+' : ''}₹{Math.abs(closedPnl).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                </p>
              </div>
            </div>
          )}

          {/* Tab bar */}
          <div className="flex gap-1 p-1 bg-secondary/50 rounded-lg w-fit mb-4">
            {(['open', 'closed'] as Tab[]).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === t ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                {t === 'open' ? `Open (${open.length})` : `Closed (${closed.length})`}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {[1,2,3].map(i => (
                <div key={i} className="h-40 rounded-xl bg-secondary/40 animate-pulse" />
              ))}
            </div>
          ) : displayed.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground">
              <LineChart className="h-10 w-10 opacity-20 mb-3" />
              <p className="text-sm font-medium">No {tab} trades</p>
              {tab === 'open' && (
                <p className="text-xs mt-1">Click "New Trade" to open your first paper trade</p>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {displayed.map(trade => (
                <PaperTradeCard key={trade.id} trade={trade} onRefresh={load} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
