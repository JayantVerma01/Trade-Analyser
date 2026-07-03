import { AlertTriangle, CheckCircle2, XCircle, TrendingUp, TrendingDown, Minus, BarChart2, Layers } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import ReactMarkdown from 'react-markdown';
import type { AnalysisResult } from '@/lib/api/analysis.api';

interface Props {
  result: AnalysisResult;
}

function BiasIcon({ bias }: { bias: string }) {
  if (bias === 'Bullish') return <TrendingUp className="h-4 w-4 bull-text" />;
  if (bias === 'Bearish') return <TrendingDown className="h-4 w-4 bear-text" />;
  return <Minus className="h-4 w-4 neutral-text" />;
}

function biasBadgeClass(bias: string) {
  if (bias === 'Bullish') return 'bull-badge';
  if (bias === 'Bearish') return 'bear-badge';
  return 'neutral-badge';
}

function confidenceColor(score: number) {
  if (score >= 70) return 'bull-text';
  if (score >= 50) return 'neutral-text';
  return 'bear-text';
}

export default function TradeSetupCard({ result }: Props) {
  const r = result;
  const hasSetup = r.setup_type && r.setup_type !== 'No Setup';

  return (
    <div className="space-y-4">
      {/* Header summary */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-base font-semibold font-mono">
              {r.symbol} · {r.timeframe}
            </CardTitle>
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${biasBadgeClass(r.market_bias)}`}>
                <BiasIcon bias={r.market_bias} />
                {r.market_bias}
              </span>
              {hasSetup && (
                <Badge variant="outline" className="text-xs">{r.setup_type}</Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Confidence bar */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">Confidence</span>
              <span className={`text-sm font-bold font-mono ${confidenceColor(r.confidence_score)}`}>
                {r.confidence_score}%
              </span>
            </div>
            <div className="w-full bg-secondary rounded-full h-1.5">
              <div
                className={`h-1.5 rounded-full transition-all ${
                  r.confidence_score >= 70 ? 'bg-bull' : r.confidence_score >= 50 ? 'bg-neutral' : 'bg-bear'
                }`}
                style={{ width: `${r.confidence_score}%` }}
              />
            </div>
          </div>

          {hasSetup ? (
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Entry Zone</p>
                <p className="font-mono font-medium">
                  ₹{r.entry_zone.from.toFixed(2)}
                  {r.entry_zone.to !== r.entry_zone.from && ` – ₹${r.entry_zone.to.toFixed(2)}`}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Stop Loss</p>
                <p className="font-mono font-medium bear-text">₹{r.stop_loss.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Target 1</p>
                <p className="font-mono font-medium bull-text">₹{r.target1.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Target 2</p>
                <p className="font-mono font-medium bull-text">₹{r.target2.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Risk / Reward</p>
                <p className="font-mono font-medium">{r.risk_reward}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Position Size</p>
                <p className="font-mono font-medium">{r.position_size} qty</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm neutral-text bg-secondary rounded-md px-3 py-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              No high-probability setup detected. Market conditions not favourable for a trade right now.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Entry condition & invalidation */}
      {hasSetup && (
        <Card>
          <CardContent className="pt-4 space-y-3">
            {r.entry_condition && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Entry Condition</p>
                <p className="text-sm">{r.entry_condition}</p>
              </div>
            )}
            {r.invalidation_condition && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Invalidation</p>
                <p className="text-sm bear-text">{r.invalidation_condition}</p>
              </div>
            )}
            {r.risk_warning && (
              <div className="flex items-start gap-2 bg-bear/10 border border-bear/20 rounded-md px-3 py-2 text-xs bear-text">
                <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                {r.risk_warning}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Rules passed / failed */}
      {(r.rules_passed?.length > 0 || r.rules_failed?.length > 0) && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Rule Checklist</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {r.rules_passed?.map((rule) => (
              <div key={rule} className="flex items-center gap-2 text-xs">
                <CheckCircle2 className="h-3.5 w-3.5 bull-text shrink-0" />
                <span>{rule}</span>
              </div>
            ))}
            {r.rules_failed?.map((rule) => (
              <div key={rule} className="flex items-center gap-2 text-xs text-muted-foreground">
                <XCircle className="h-3.5 w-3.5 bear-text shrink-0" />
                <span>{rule}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Reasoning */}
      {r.reasoning && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">AI Reasoning</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose prose-invert prose-sm max-w-none text-sm leading-relaxed">
              <ReactMarkdown>{r.reasoning}</ReactMarkdown>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Theory references */}
      {r.theory_references?.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Theory References</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {r.theory_references.map((ref, i) => (
              <div key={i} className="text-xs border border-border rounded-md p-2 space-y-1">
                <p className="font-medium text-primary">{ref.source}</p>
                <p className="text-muted-foreground line-clamp-3">{ref.excerpt}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Strategy match result */}
      {r.strategy_result && (
        <Card className={r.strategy_result.matches ? 'border-bull/30' : 'border-border'}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              {r.strategy_result.matches
                ? <CheckCircle2 className="h-4 w-4 bull-text" />
                : <XCircle className="h-4 w-4 bear-text" />}
              Strategy Filter
              <span className="ml-auto font-normal text-xs text-muted-foreground">
                {(r.strategy_result.score * 100).toFixed(0)}% rules passed · {r.strategy_result.logic}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {r.strategy_result.rules_matched.slice(0, 5).map((rule, i) => (
              <div key={i} className="flex items-start gap-1.5 text-xs">
                <CheckCircle2 className="h-3.5 w-3.5 bull-text shrink-0 mt-px" />
                <span className="text-muted-foreground">{rule.replace('[Strategy] ', '')}</span>
              </div>
            ))}
            {r.strategy_result.rules_failed.slice(0, 5).map((rule, i) => (
              <div key={i} className="flex items-start gap-1.5 text-xs">
                <XCircle className="h-3.5 w-3.5 bear-text shrink-0 mt-px" />
                <span className="text-muted-foreground">{rule.replace('[Strategy] ', '')}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Approach 1: Signal Validation */}
      {r.validation && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <BarChart2 className="h-4 w-4 text-primary" />
              Signal Validation
              <span className="ml-auto text-xs font-normal text-muted-foreground">
                {r.validation.n_candles_scanned} candles scanned
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {r.validation.is_validated ? (
              <div className="space-y-3">
                <div className="grid grid-cols-4 gap-2 text-center">
                  <div className="bg-secondary rounded-md px-2 py-2">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Occurrences</p>
                    <p className="text-base font-bold font-mono">{r.validation.occurrences}</p>
                  </div>
                  <div className="bg-secondary rounded-md px-2 py-2">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Wins</p>
                    <p className="text-base font-bold font-mono bull-text">{r.validation.wins}</p>
                  </div>
                  <div className="bg-secondary rounded-md px-2 py-2">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Losses</p>
                    <p className="text-base font-bold font-mono bear-text">{r.validation.losses}</p>
                  </div>
                  <div className="bg-secondary rounded-md px-2 py-2">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Hit Rate</p>
                    <p className={`text-base font-bold font-mono ${r.validation.hit_rate >= 60 ? 'bull-text' : r.validation.hit_rate >= 50 ? 'neutral-text' : 'bear-text'}`}>
                      {r.validation.hit_rate}%
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Historical accuracy of this setup pattern</span>
                  <span className={`font-semibold px-2 py-0.5 rounded-full text-[10px] border ${
                    r.validation.confidence_label === 'Strong'   ? 'bull-badge' :
                    r.validation.confidence_label === 'Moderate' ? 'neutral-badge' : 'bear-badge'
                  }`}>
                    {r.validation.confidence_label}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Insufficient historical occurrences ({r.validation.occurrences}) to validate this setup pattern. Need at least 5 decided outcomes.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Approach 2: MTF Confluence */}
      {r.mtf_confluence && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Layers className="h-4 w-4 text-primary" />
              Multi-Timeframe Confluence
              <span className={`ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                r.mtf_confluence.confluence_label === 'Strong'   ? 'bull-badge' :
                r.mtf_confluence.confluence_label === 'Moderate' ? 'neutral-badge' :
                r.mtf_confluence.confluence_label === 'Conflicting' ? 'bear-badge' : 'secondary'
              }`}>
                {r.mtf_confluence.confluence_label} ({r.mtf_confluence.confluence_score}/{r.mtf_confluence.total_tfs_analysed})
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Object.entries(r.mtf_confluence.timeframe_bias).map(([tf, info]) => (
                <div key={tf} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded ${info.is_primary ? 'bg-primary/20 text-primary' : 'bg-secondary text-muted-foreground'}`}>
                      {info.label}
                      {info.is_primary && ' (Primary)'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-20 bg-secondary rounded-full h-1.5">
                      <div
                        className={`h-1.5 rounded-full ${info.bias === 'Bullish' ? 'bg-bull' : info.bias === 'Bearish' ? 'bg-bear' : 'bg-neutral'}`}
                        style={{ width: `${Math.round(info.bull_pct * 100)}%` }}
                      />
                    </div>
                    <span className={`text-xs font-medium w-14 text-right ${
                      info.bias === 'Bullish' ? 'bull-text' :
                      info.bias === 'Bearish' ? 'bear-text' : 'neutral-text'
                    }`}>
                      {info.bias}
                    </span>
                  </div>
                </div>
              ))}
              <p className="text-[10px] text-muted-foreground pt-1">
                {r.mtf_confluence.confidence_adjustment >= 0
                  ? `+${r.mtf_confluence.confidence_adjustment} confidence boost from ${r.mtf_confluence.confluence_label.toLowerCase()} alignment`
                  : `${r.mtf_confluence.confidence_adjustment} confidence penalty from ${r.mtf_confluence.confluence_label.toLowerCase()} signals`}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Disclaimer */}
      <div className="text-[10px] text-muted-foreground bg-secondary rounded-md px-3 py-2 leading-relaxed">
        <strong>Disclaimer:</strong> This analysis is for educational and decision-support purposes only. It does not constitute financial advice. All trades carry risk — always do your own due diligence before entering any position.
      </div>
    </div>
  );
}
