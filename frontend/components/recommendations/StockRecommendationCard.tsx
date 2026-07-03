'use client';

import { StockRecommendation } from '@/lib/api/recommendations.api';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/utils';
import {
  TrendingUp, TrendingDown, Target, ShieldAlert,
  CheckCircle2, BarChart2, Layers, Zap,
} from 'lucide-react';

interface Props {
  rec: StockRecommendation;
}

function ScoreBar({ score }: { score: number }) {
  const color =
    score >= 75 ? 'bg-green-500' :
    score >= 55 ? 'bg-yellow-400' :
    'bg-orange-400';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 rounded-full bg-secondary overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-xs font-bold tabular-nums w-9 text-right">{score.toFixed(0)}</span>
    </div>
  );
}

function LevelRow({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-semibold tabular-nums ${color}`}>{formatCurrency(value)}</span>
    </div>
  );
}

export default function StockRecommendationCard({ rec }: Props) {
  const isBull = rec.bias === 'Bullish';
  const biasColor = isBull ? 'text-green-400' : 'text-red-400';
  const BullBear = isBull ? TrendingUp : TrendingDown;

  const mtf    = rec.mtf_confluence;
  const valid  = rec.validation;

  const scoreColor =
    rec.recommendation_score >= 75 ? 'text-green-400' :
    rec.recommendation_score >= 55 ? 'text-yellow-400' :
    'text-orange-400';

  return (
    <Card className="relative overflow-hidden border-border/60 hover:border-primary/40 transition-colors">
      {/* Rank badge */}
      <div className={`absolute top-0 left-0 w-8 h-8 flex items-center justify-center text-xs font-bold text-primary-foreground rounded-br-lg ${
        rec.rank === 1 ? 'bg-yellow-500' :
        rec.rank === 2 ? 'bg-slate-400' :
        rec.rank === 3 ? 'bg-amber-600' : 'bg-primary/70'
      }`}>
        #{rec.rank}
      </div>

      <CardHeader className="pt-4 pl-10 pb-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold tracking-tight">{rec.symbol}</h3>
              <Badge variant="outline" className="text-[10px] font-medium">
                {rec.analysis_timeframe}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{rec.setup_type}</p>
          </div>

          <div className="flex flex-col items-end gap-1">
            <div className={`flex items-center gap-1 text-sm font-bold ${biasColor}`}>
              <BullBear className="h-4 w-4" />
              {rec.bias}
            </div>
            <Badge variant="outline" className={`text-[10px] ${
              rec.risk_reward >= 2.5 ? 'border-green-500/40 text-green-400' :
              rec.risk_reward >= 2.0 ? 'border-yellow-500/40 text-yellow-400' :
              'border-muted-foreground/30'
            }`}>
              R:R {rec.risk_reward?.toFixed(1)}:1
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 pt-0">
        {/* Score bar */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium">
              Rec. Score
            </span>
            <span className={`text-xs font-bold ${scoreColor}`}>
              {rec.recommendation_score >= 75 ? 'Strong' :
               rec.recommendation_score >= 55 ? 'Moderate' : 'Weak'}
            </span>
          </div>
          <ScoreBar score={rec.recommendation_score} />
        </div>

        {/* Confidence + signals row */}
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="secondary" className="text-[10px] gap-1">
            <Zap className="h-3 w-3" />
            Confidence {rec.confidence_score}%
          </Badge>

          {mtf && (
            <Badge variant="secondary" className={`text-[10px] gap-1 ${
              mtf.confluence_label === 'Strong'   ? 'border-green-500/30 text-green-400' :
              mtf.confluence_label === 'Moderate' ? 'border-yellow-500/30 text-yellow-400' :
              ''
            }`}>
              <Layers className="h-3 w-3" />
              MTF: {mtf.confluence_label}
            </Badge>
          )}

          {valid?.is_validated && (
            <Badge variant="secondary" className={`text-[10px] gap-1 ${
              valid.hit_rate >= 60 ? 'border-green-500/30 text-green-400' :
              valid.hit_rate >= 50 ? 'border-yellow-500/30 text-yellow-400' :
              'border-red-500/30 text-red-400'
            }`}>
              <BarChart2 className="h-3 w-3" />
              {valid.hit_rate}% hit rate ({valid.decided} trades)
            </Badge>
          )}
        </div>

        {/* Price levels */}
        <div className="rounded-lg bg-secondary/40 p-3 space-y-1.5">
          <LevelRow label="Entry Zone"
            value={(rec.entry_zone.from + rec.entry_zone.to) / 2}
            color="text-blue-400" />
          <LevelRow label="Stop Loss"   value={rec.stop_loss} color="text-red-400" />
          <LevelRow label="Target 1"    value={rec.target1}   color="text-green-400" />
          <LevelRow label="Target 2"    value={rec.target2}   color="text-emerald-400" />
          <div className="border-t border-border/40 mt-1.5 pt-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Position Size</span>
              <span className="font-semibold">{rec.position_size} shares</span>
            </div>
          </div>
        </div>

        {/* MTF timeframe breakdown */}
        {mtf && Object.keys(mtf.timeframe_bias).length > 0 && (
          <div className="space-y-1">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">
              Timeframe Bias
            </p>
            <div className="flex gap-2 flex-wrap">
              {Object.entries(mtf.timeframe_bias).map(([tf, b]) => (
                <div key={tf} className="flex items-center gap-1 text-[10px] bg-secondary/50 px-2 py-1 rounded">
                  <span className="text-muted-foreground font-medium">{tf}</span>
                  <span className={
                    b.bias === 'Bullish' ? 'text-green-400 font-semibold' :
                    b.bias === 'Bearish' ? 'text-red-400 font-semibold' :
                    'text-muted-foreground'
                  }>{b.bias}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Key reasons */}
        {rec.key_reasons.length > 0 && (
          <div className="space-y-1">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" />
              Why This Stock
            </p>
            <ul className="space-y-0.5">
              {rec.key_reasons.map((reason, i) => (
                <li key={i} className="text-[11px] text-muted-foreground flex gap-1.5">
                  <span className="text-primary mt-0.5 shrink-0">·</span>
                  {reason}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Entry + Invalidation */}
        {rec.entry_condition && (
          <div className="text-[11px] text-muted-foreground border-t border-border/40 pt-2 space-y-1">
            <p className="flex gap-1"><Target className="h-3 w-3 text-blue-400 mt-0.5 shrink-0" />{rec.entry_condition}</p>
            {rec.invalidation_condition && (
              <p className="flex gap-1"><ShieldAlert className="h-3 w-3 text-red-400 mt-0.5 shrink-0" />{rec.invalidation_condition}</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
