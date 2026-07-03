import { cn } from '@/lib/utils';

interface Props {
  indicators: Record<string, any>;
}

interface IndicatorRowProps {
  label: string;
  value: string | number;
  color?: 'bull' | 'bear' | 'neutral' | 'default';
}

function Row({ label, value, color = 'default' }: IndicatorRowProps) {
  const colorClass = {
    bull:    'bull-text',
    bear:    'bear-text',
    neutral: 'neutral-text',
    default: 'text-foreground',
  }[color];
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={cn('text-xs font-mono font-medium', colorClass)}>{value}</span>
    </div>
  );
}

function rsiColor(rsi: number): 'bull' | 'bear' | 'neutral' {
  if (rsi >= 60) return 'bull';
  if (rsi <= 40) return 'bear';
  return 'neutral';
}

function macdColor(hist: number): 'bull' | 'bear' {
  return hist >= 0 ? 'bull' : 'bear';
}

function volColor(ratio: number): 'bull' | 'bear' | 'neutral' {
  if (ratio >= 1.3) return 'bull';
  if (ratio < 0.8) return 'bear';
  return 'neutral';
}

function priceVsLevel(price: number, level: number): 'bull' | 'bear' {
  return price >= level ? 'bull' : 'bear';
}

export default function IndicatorPanel({ indicators: ind }: Props) {
  if (!ind || !ind.price) return null;

  return (
    <div className="space-y-4">
      {/* Price & EMAs */}
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
          Price & Moving Averages
        </p>
        <Row label="LTP" value={`₹${ind.price?.toFixed(2)}`} />
        {ind.ema9  > 0 && <Row label="EMA 9"   value={`₹${ind.ema9?.toFixed(2)}`}  color={priceVsLevel(ind.price, ind.ema9)} />}
        {ind.ema21 > 0 && <Row label="EMA 21"  value={`₹${ind.ema21?.toFixed(2)}`} color={priceVsLevel(ind.price, ind.ema21)} />}
        {ind.ema50 > 0 && <Row label="EMA 50"  value={`₹${ind.ema50?.toFixed(2)}`} color={priceVsLevel(ind.price, ind.ema50)} />}
        {ind.ema200 > 0 && <Row label="EMA 200" value={`₹${ind.ema200?.toFixed(2)}`} color={priceVsLevel(ind.price, ind.ema200)} />}
        {ind.vwap  > 0 && <Row label="VWAP"    value={`₹${ind.vwap?.toFixed(2)}`}  color={priceVsLevel(ind.price, ind.vwap)} />}
      </div>

      {/* Momentum */}
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
          Momentum
        </p>
        {ind.rsi > 0 && (
          <Row label="RSI (14)" value={ind.rsi?.toFixed(1)} color={rsiColor(ind.rsi)} />
        )}
        {ind.macd !== 0 && (
          <>
            <Row label="MACD"          value={ind.macd?.toFixed(2)}       color={macdColor(ind.macd_hist)} />
            <Row label="MACD Signal"   value={ind.macd_signal?.toFixed(2)} color={macdColor(ind.macd_hist)} />
            <Row label="MACD Hist"     value={ind.macd_hist?.toFixed(2)}  color={macdColor(ind.macd_hist)} />
          </>
        )}
      </div>

      {/* Volatility */}
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
          Volatility
        </p>
        {ind.atr > 0 && <Row label="ATR (14)" value={`₹${ind.atr?.toFixed(2)}`} />}
        {ind.bb_upper > 0 && (
          <>
            <Row label="BB Upper" value={`₹${ind.bb_upper?.toFixed(2)}`} />
            <Row label="BB Mid"   value={`₹${ind.bb_mid?.toFixed(2)}`} />
            <Row label="BB Lower" value={`₹${ind.bb_lower?.toFixed(2)}`} />
          </>
        )}
      </div>

      {/* Volume */}
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
          Volume
        </p>
        {ind.volume_ratio > 0 && (
          <Row
            label="Volume Ratio"
            value={`${ind.volume_ratio?.toFixed(2)}x avg`}
            color={volColor(ind.volume_ratio)}
          />
        )}
      </div>

      {/* Key levels */}
      {(ind.pdh > 0 || ind.pdl > 0) && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
            Key Levels
          </p>
          {ind.pdh > 0 && <Row label="Prev Day High" value={`₹${ind.pdh?.toFixed(2)}`} />}
          {ind.pdl > 0 && <Row label="Prev Day Low"  value={`₹${ind.pdl?.toFixed(2)}`} />}
          {ind.support_levels?.length > 0 && (
            <Row label="Support"    value={ind.support_levels.map((s: number) => `₹${s}`).join(' · ')} color="bull" />
          )}
          {ind.resistance_levels?.length > 0 && (
            <Row label="Resistance" value={ind.resistance_levels.map((r: number) => `₹${r}`).join(' · ')} color="bear" />
          )}
        </div>
      )}
    </div>
  );
}
