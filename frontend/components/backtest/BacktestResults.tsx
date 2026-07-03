import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import EquityCurve from './EquityCurve';
import type { BacktestResult, BacktestTrade } from '@/lib/api/backtest.api';

interface MetricProps {
  label: string;
  value: string;
  sub?:  string;
  color?: 'bull' | 'bear' | 'neutral' | 'default';
}

function Metric({ label, value, sub, color = 'default' }: MetricProps) {
  const cls = color === 'bull' ? 'bull-text' : color === 'bear' ? 'bear-text' : color === 'neutral' ? 'neutral-text' : 'text-foreground';
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</span>
      <span className={`text-lg font-bold font-mono ${cls}`}>{value}</span>
      {sub && <span className="text-[10px] text-muted-foreground">{sub}</span>}
    </div>
  );
}

function resultBadge(r: BacktestTrade['result']) {
  if (r === 'win')     return <Badge className="text-[10px] bull-badge border">WIN</Badge>;
  if (r === 'loss')    return <Badge className="text-[10px] bear-badge border">LOSS</Badge>;
  return <Badge variant="secondary" className="text-[10px]">TIMEOUT</Badge>;
}

function fmt(n: number) { return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}` }

interface Props { result: BacktestResult }

export default function BacktestResults({ result: r }: Props) {
  const profitable = r.net_pnl >= 0;

  return (
    <div className="space-y-6">
      {/* Headline metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card><CardContent className="pt-4">
          <Metric label="Net P&L" value={fmt(r.net_pnl)} sub={`${r.net_pnl >= 0 ? '+' : ''}${((r.net_pnl / r.initial_capital) * 100).toFixed(1)}%`} color={profitable ? 'bull' : 'bear'} />
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <Metric label="Win Rate" value={`${r.win_rate}%`} sub={`${r.winning_trades}W / ${r.losing_trades}L / ${r.timeout_trades}T`} color={r.win_rate >= 50 ? 'bull' : 'bear'} />
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <Metric label="Profit Factor" value={r.profit_factor >= 999 ? '∞' : r.profit_factor.toFixed(2)} sub={`${fmt(r.gross_profit)} / ${fmt(r.gross_loss)}`} color={r.profit_factor >= 1.5 ? 'bull' : r.profit_factor >= 1 ? 'neutral' : 'bear'} />
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <Metric label="Max Drawdown" value={`${r.max_drawdown_pct.toFixed(1)}%`} sub={`Avg R:R 1:${r.avg_rr}`} color={r.max_drawdown_pct <= 10 ? 'bull' : r.max_drawdown_pct <= 20 ? 'neutral' : 'bear'} />
        </CardContent></Card>
      </div>

      {/* Secondary metrics */}
      <Card>
        <CardContent className="pt-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Metric label="Total Trades"    value={`${r.total_trades}`} sub={`on ${r.n_candles} candles`} />
            <Metric label="Best Trade"      value={fmt(r.best_trade)}  color="bull" />
            <Metric label="Worst Trade"     value={fmt(r.worst_trade)} color="bear" />
            <Metric label="Initial Capital" value={fmt(r.initial_capital)} />
          </div>
        </CardContent>
      </Card>

      {/* Equity curve */}
      {r.equity_curve.length > 2 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              {profitable
                ? <TrendingUp className="h-4 w-4 bull-text" />
                : <TrendingDown className="h-4 w-4 bear-text" />}
              Equity Curve
              <span className="ml-auto text-xs font-normal text-muted-foreground">
                {r.symbol} · {r.timeframe} · {r.total_trades} trades
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <EquityCurve equity={r.equity_curve} initialCapital={r.initial_capital} height={200} />
          </CardContent>
        </Card>
      )}

      {/* Trade log */}
      {r.trades.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Trade Log ({r.trades.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-secondary/40">
                    {['#', 'Dir', 'Entry', 'Exit', 'SL', 'T1', 'Qty', 'P&L', 'Cumul.', 'Result'].map((h) => (
                      <th key={h} className="px-3 py-2 text-left font-medium text-muted-foreground whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {r.trades.map((t) => (
                    <tr key={t.trade_num} className="border-b border-border last:border-0 hover:bg-secondary/20 transition-colors">
                      <td className="px-3 py-2 text-muted-foreground">{t.trade_num}</td>
                      <td className="px-3 py-2">
                        <span className={`font-medium ${t.direction === 'LONG' ? 'bull-text' : 'bear-text'}`}>{t.direction}</span>
                      </td>
                      <td className="px-3 py-2 font-mono">₹{t.entry_price}</td>
                      <td className="px-3 py-2 font-mono">₹{t.exit_price}</td>
                      <td className="px-3 py-2 font-mono bear-text">₹{t.sl}</td>
                      <td className="px-3 py-2 font-mono bull-text">₹{t.target1}</td>
                      <td className="px-3 py-2 font-mono">{t.qty}</td>
                      <td className={`px-3 py-2 font-mono font-medium ${t.pnl >= 0 ? 'bull-text' : 'bear-text'}`}>
                        {t.pnl >= 0 ? '+' : ''}{fmt(t.pnl)}
                      </td>
                      <td className={`px-3 py-2 font-mono ${t.cumulative_pnl >= 0 ? 'bull-text' : 'bear-text'}`}>
                        {t.cumulative_pnl >= 0 ? '+' : ''}{fmt(t.cumulative_pnl)}
                      </td>
                      <td className="px-3 py-2">{resultBadge(t.result)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
