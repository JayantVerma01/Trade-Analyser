'use client';

import { useState } from 'react';
import {
  TrendingUp, TrendingDown, CheckCircle2, XCircle, Minus,
  Target, X, Play, ChevronDown, ChevronUp, Trash2
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { paperTradeApi, type PaperTrade, type ClosePaperTradePayload } from '@/lib/api/paper-trade.api';

const STATUS_LABELS: Record<string, string> = {
  PENDING:       'Pending',
  ACTIVE:        'Active',
  TARGET_HIT:    'Target Hit',
  STOP_LOSS_HIT: 'SL Hit',
  MANUALLY_CLOSED: 'Closed',
  CANCELLED:     'Cancelled',
};

function statusBadge(s: string, pnl: number | null) {
  if (s === 'ACTIVE')        return <Badge className="text-[10px] bg-blue-500/15 text-blue-400 border border-blue-500/30">Active</Badge>;
  if (s === 'PENDING')       return <Badge variant="secondary" className="text-[10px]">Pending</Badge>;
  if (s === 'TARGET_HIT')    return <Badge className="text-[10px] bull-badge border">Target Hit</Badge>;
  if (s === 'STOP_LOSS_HIT') return <Badge className="text-[10px] bear-badge border">SL Hit</Badge>;
  if (s === 'CANCELLED')     return <Badge variant="secondary" className="text-[10px]">Cancelled</Badge>;
  return pnl != null && pnl >= 0
    ? <Badge className="text-[10px] bull-badge border">Closed +</Badge>
    : <Badge className="text-[10px] bear-badge border">Closed −</Badge>;
}

interface Props {
  trade:     PaperTrade;
  onRefresh: () => void;
}

export default function PaperTradeCard({ trade: t, onRefresh }: Props) {
  const [expanded,  setExpanded]  = useState(false);
  const [closing,   setClosing]   = useState(false);
  const [exitPrice, setExitPrice] = useState('');
  const [closeType, setCloseType] = useState<ClosePaperTradePayload['status']>('MANUALLY_CLOSED');
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState('');

  const isOpen   = t.status === 'PENDING' || t.status === 'ACTIVE';
  const isLong   = t.direction === 'LONG';
  const riskAmt  = Math.abs(Number(t.entryPrice) - Number(t.stopLoss)) * t.quantity;
  const rr1      = Math.abs(Number(t.target1) - Number(t.entryPrice)) / Math.abs(Number(t.entryPrice) - Number(t.stopLoss));

  const handleActivate = async () => {
    setLoading(true);
    try { await paperTradeApi.activate(t.id); onRefresh(); }
    catch (e: any) { setError(e?.response?.data?.message ?? 'Failed'); }
    finally { setLoading(false); }
  };

  const handleClose = async () => {
    const ep = Number(exitPrice);
    if (!ep || ep <= 0) { setError('Enter a valid exit price'); return; }
    setLoading(true);
    setError('');
    try {
      await paperTradeApi.close(t.id, { exitPrice: ep, status: closeType });
      setClosing(false);
      onRefresh();
    } catch (e: any) { setError(e?.response?.data?.message ?? 'Failed'); }
    finally { setLoading(false); }
  };

  const handleCancel = async () => {
    if (!confirm('Cancel this trade?')) return;
    setLoading(true);
    try { await paperTradeApi.cancel(t.id); onRefresh(); }
    catch (e: any) { setError(e?.response?.data?.message ?? 'Failed'); }
    finally { setLoading(false); }
  };

  const handleDelete = async () => {
    if (!confirm('Delete this trade permanently?')) return;
    setLoading(true);
    try { await paperTradeApi.delete(t.id); onRefresh(); }
    catch (e: any) { setError(e?.response?.data?.message ?? 'Failed'); }
    finally { setLoading(false); }
  };

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4 space-y-3">
        {/* Header row */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {isLong
              ? <TrendingUp  className="h-4 w-4 bull-text shrink-0" />
              : <TrendingDown className="h-4 w-4 bear-text shrink-0" />}
            <span className="font-bold text-sm">{t.symbol}</span>
            <span className="text-xs text-muted-foreground">{t.timeframe}</span>
            {statusBadge(t.status, t.pnl)}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setExpanded(e => !e)}
              className="text-muted-foreground hover:text-foreground p-1 transition-colors"
            >
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            {!isOpen && (
              <button
                onClick={handleDelete}
                className="text-muted-foreground hover:text-destructive p-1 transition-colors"
                disabled={loading}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Price grid */}
        <div className="grid grid-cols-4 gap-2 text-xs">
          <div>
            <span className="text-muted-foreground block">Entry</span>
            <span className="font-mono font-medium">₹{Number(t.entryPrice)}</span>
          </div>
          <div>
            <span className="text-muted-foreground block">SL</span>
            <span className="font-mono bear-text">₹{Number(t.stopLoss)}</span>
          </div>
          <div>
            <span className="text-muted-foreground block">T1</span>
            <span className="font-mono bull-text">₹{Number(t.target1)}</span>
          </div>
          <div>
            <span className="text-muted-foreground block">Qty</span>
            <span className="font-mono font-medium">{t.quantity}</span>
          </div>
        </div>

        {/* P&L (when closed) */}
        {t.pnl != null && (
          <div className="flex items-center justify-between pt-1 border-t border-border">
            <span className="text-xs text-muted-foreground">P&L</span>
            <span className={`text-sm font-bold font-mono ${t.pnl >= 0 ? 'bull-text' : 'bear-text'}`}>
              {t.pnl >= 0 ? '+' : ''}₹{Math.abs(t.pnl).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              <span className="text-[10px] font-normal text-muted-foreground ml-1">at ₹{Number(t.exitPrice)}</span>
            </span>
          </div>
        )}

        {/* Expanded details */}
        {expanded && (
          <div className="pt-2 border-t border-border space-y-2 text-xs">
            <div className="grid grid-cols-3 gap-2">
              <div>
                <span className="text-muted-foreground block">T2</span>
                <span className="font-mono bull-text">₹{Number(t.target2)}</span>
              </div>
              <div>
                <span className="text-muted-foreground block">Risk ₹</span>
                <span className="font-mono">₹{riskAmt.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
              </div>
              <div>
                <span className="text-muted-foreground block">R:R (T1)</span>
                <span className="font-mono">1:{rr1.toFixed(1)}</span>
              </div>
            </div>
            {t.strategy && (
              <p className="text-muted-foreground">Strategy: <span className="text-foreground">{t.strategy.name}</span></p>
            )}
            {t.notes && <p className="text-muted-foreground italic">"{t.notes}"</p>}
            {t.entryAt && <p className="text-muted-foreground">Entered: {new Date(t.entryAt).toLocaleString('en-IN')}</p>}
            {t.exitAt  && <p className="text-muted-foreground">Exited:  {new Date(t.exitAt).toLocaleString('en-IN')}</p>}
          </div>
        )}

        {/* Error */}
        {error && <p className="text-[11px] bear-text">{error}</p>}

        {/* Actions for open trades */}
        {isOpen && !closing && (
          <div className="flex gap-2 pt-1">
            {t.status === 'PENDING' && (
              <Button size="sm" variant="outline" className="flex-1 h-7 text-xs gap-1" onClick={handleActivate} disabled={loading}>
                <Play className="h-3 w-3" /> Activate
              </Button>
            )}
            <Button size="sm" className="flex-1 h-7 text-xs gap-1 bull-badge border-0 text-white" onClick={() => setClosing(true)}>
              <Target className="h-3 w-3" /> Close Trade
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs px-2" onClick={handleCancel} disabled={loading}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}

        {/* Close form */}
        {closing && (
          <div className="space-y-2 pt-1 border-t border-border">
            <div className="flex gap-2">
              <input
                type="number"
                placeholder="Exit price"
                value={exitPrice}
                onChange={e => setExitPrice(e.target.value)}
                className="flex-1 bg-secondary/50 border border-border rounded px-2 py-1 text-xs focus:outline-none focus:border-primary"
              />
              <select
                value={closeType}
                onChange={e => setCloseType(e.target.value as any)}
                className="bg-secondary/50 border border-border rounded px-2 py-1 text-xs focus:outline-none"
              >
                <option value="TARGET_HIT">Target Hit</option>
                <option value="STOP_LOSS_HIT">SL Hit</option>
                <option value="MANUALLY_CLOSED">Manual</option>
              </select>
            </div>
            <div className="flex gap-2">
              <Button size="sm" className="flex-1 h-7 text-xs" onClick={handleClose} disabled={loading}>
                {loading ? 'Closing…' : 'Confirm Close'}
              </Button>
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setClosing(false); setError(''); }}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
