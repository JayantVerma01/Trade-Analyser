'use client';

import { useState } from 'react';
import { CheckCircle2, XCircle, FlaskConical, Trash2, Power, ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { Strategy, EvaluateResult } from '@/lib/api/strategy.api';
import { strategyApi } from '@/lib/api/strategy.api';

const QUICK_SYMBOLS = ['RELIANCE', 'TCS', 'INFY', 'HDFCBANK', 'NIFTY50', 'BANKNIFTY'];

interface Props {
  strategy:  Strategy;
  onDeleted: (id: string) => void;
  onToggled: (updated: Strategy) => void;
}

export default function StrategyCard({ strategy, onDeleted, onToggled }: Props) {
  const [expanded,       setExpanded]       = useState(false);
  const [evaluating,     setEvaluating]     = useState(false);
  const [evalResult,     setEvalResult]     = useState<EvaluateResult | null>(null);
  const [evalSymbol,     setEvalSymbol]     = useState('RELIANCE');
  const [evalTimeframe,  setEvalTimeframe]  = useState('15m');
  const [deleting,       setDeleting]       = useState(false);
  const [toggling,       setToggling]       = useState(false);

  const ruleCount = strategy.conditions?.rules?.length ?? 0;
  const setupCount = strategy._count?.tradeSetups ?? 0;

  const handleEvaluate = async () => {
    setEvaluating(true);
    setEvalResult(null);
    try {
      const res = await strategyApi.evaluate(strategy.id, evalSymbol, evalTimeframe);
      setEvalResult(res);
    } catch {
      /* ignore — user sees no result */
    } finally {
      setEvaluating(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Delete strategy "${strategy.name}"? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await strategyApi.delete(strategy.id);
      onDeleted(strategy.id);
    } finally {
      setDeleting(false);
    }
  };

  const handleToggle = async () => {
    setToggling(true);
    try {
      const updated = await strategyApi.update(strategy.id, { isActive: !strategy.isActive });
      onToggled(updated);
    } finally {
      setToggling(false);
    }
  };

  return (
    <Card className={strategy.isActive ? '' : 'opacity-60'}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm truncate">{strategy.name}</span>
              <Badge variant="outline" className="text-[10px]">{strategy.marketType}</Badge>
              {strategy.isActive
                ? <Badge className="text-[10px] bull-badge border">Active</Badge>
                : <Badge variant="secondary" className="text-[10px]">Inactive</Badge>}
            </div>
            {strategy.description && (
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{strategy.description}</p>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={handleToggle}
              disabled={toggling}
              title={strategy.isActive ? 'Deactivate' : 'Activate'}
              className={`p-1.5 rounded hover:bg-secondary transition-colors ${strategy.isActive ? 'neutral-text' : 'text-muted-foreground'}`}
            >
              <Power className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:bear-text transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground mt-1">
          <span>{ruleCount} rule{ruleCount !== 1 ? 's' : ''}</span>
          <span>·</span>
          <span>{strategy.conditions?.logic ?? 'AND'} logic</span>
          <span>·</span>
          <span>{setupCount} setups generated</span>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Rule preview */}
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          {expanded ? 'Hide rules' : 'Show rules'}
        </button>

        {expanded && (
          <div className="space-y-1">
            {strategy.conditions?.rules?.map((rule, i) => (
              <div key={rule.id ?? i} className="flex items-start gap-1.5 text-xs">
                <span className="text-muted-foreground mt-px">{i + 1}.</span>
                <span>{rule.label}</span>
              </div>
            ))}
          </div>
        )}

        {/* Quick evaluate */}
        <div className="border-t border-border pt-3 space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
            <FlaskConical className="h-3 w-3" />Quick Evaluate
          </p>
          <div className="flex gap-2">
            <select
              value={evalSymbol}
              onChange={(e) => setEvalSymbol(e.target.value)}
              className="flex-1 h-7 text-xs rounded-md border border-border bg-background px-2"
            >
              {QUICK_SYMBOLS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <select
              value={evalTimeframe}
              onChange={(e) => setEvalTimeframe(e.target.value)}
              className="w-20 h-7 text-xs rounded-md border border-border bg-background px-2"
            >
              {['1m','5m','15m','30m','1h','4h','1d'].map((tf) => (
                <option key={tf} value={tf}>{tf}</option>
              ))}
            </select>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleEvaluate}
              disabled={evaluating}
              className="h-7 text-xs px-3"
            >
              {evaluating ? 'Checking...' : 'Check'}
            </Button>
          </div>

          {/* Eval result */}
          {evalResult && (
            <div className={`rounded-md px-3 py-2 text-xs space-y-1 ${
              evalResult.matches ? 'bg-bull/10 border border-bull/20' : 'bg-secondary border border-border'
            }`}>
              <div className="flex items-center gap-1.5 font-medium">
                {evalResult.matches
                  ? <><CheckCircle2 className="h-3.5 w-3.5 bull-text" /><span className="bull-text">Strategy MATCHES {evalResult.symbol}</span></>
                  : <><XCircle className="h-3.5 w-3.5 bear-text" /><span className="bear-text">Strategy NOT matched on {evalResult.symbol}</span></>
                }
                <span className="ml-auto text-muted-foreground">{(evalResult.score * 100).toFixed(0)}%</span>
              </div>
              {evalResult.rules_matched.slice(0, 3).map((r, i) => (
                <div key={i} className="flex items-start gap-1 text-muted-foreground">
                  <CheckCircle2 className="h-3 w-3 bull-text mt-px shrink-0" />{r}
                </div>
              ))}
              {evalResult.rules_failed.slice(0, 3).map((r, i) => (
                <div key={i} className="flex items-start gap-1 text-muted-foreground">
                  <XCircle className="h-3 w-3 bear-text mt-px shrink-0" />{r}
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
