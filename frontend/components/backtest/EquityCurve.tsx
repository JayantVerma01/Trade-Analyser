'use client';

import { useMemo } from 'react';

interface Props {
  equity:         number[];
  initialCapital: number;
  height?:        number;
}

export default function EquityCurve({ equity, initialCapital, height = 200 }: Props) {
  const { path, areaPath, minY, maxY, isProfit } = useMemo(() => {
    if (!equity || equity.length < 2) return { path: '', areaPath: '', minY: 0, maxY: 0, isProfit: true };

    const W = 100; // viewBox width (percentage-based)
    const H = height;
    const pad = 4;

    const minVal = Math.min(...equity);
    const maxVal = Math.max(...equity);
    const range  = maxVal - minVal || 1;

    const toX = (i: number) => pad + (i / (equity.length - 1)) * (W - pad * 2);
    const toY = (v: number) => H - pad - ((v - minVal) / range) * (H - pad * 2);

    const pts = equity.map((v, i) => `${toX(i)},${toY(v)}`);
    const linePath = `M ${pts[0]} L ${pts.slice(1).join(' L ')}`;

    const baselineY = toY(initialCapital);
    const areaPath = `${linePath} L ${toX(equity.length - 1)},${baselineY} L ${toX(0)},${baselineY} Z`;

    const finalValue = equity[equity.length - 1];
    return { path: linePath, areaPath, minY: minVal, maxY: maxVal, isProfit: finalValue >= initialCapital };
  }, [equity, initialCapital, height]);

  if (!equity || equity.length < 2) return null;

  const strokeColor  = isProfit ? '#22c55e' : '#ef4444';
  const fillColor    = isProfit ? '#22c55e18' : '#ef444418';
  const baselineY    = height - 4 - ((initialCapital - Math.min(...equity)) / (Math.max(...equity) - Math.min(...equity) || 1)) * (height - 8);

  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 100 ${height}`}
        preserveAspectRatio="none"
        className="w-full"
        style={{ height }}
      >
        {/* Zero / baseline */}
        <line
          x1="4" y1={baselineY} x2="96" y2={baselineY}
          stroke="#374151" strokeWidth="0.4" strokeDasharray="2,2"
        />

        {/* Area fill */}
        <path d={areaPath} fill={fillColor} />

        {/* Line */}
        <path
          d={path}
          fill="none"
          stroke={strokeColor}
          strokeWidth="0.8"
          vectorEffect="non-scaling-stroke"
        />

        {/* Start / end dots */}
        {equity.length > 1 && (
          <>
            <circle cx="4" cy={height - 4 - ((equity[0] - Math.min(...equity)) / (Math.max(...equity) - Math.min(...equity) || 1)) * (height - 8)}
              r="1" fill="#9ca3af" />
            <circle
              cx="96"
              cy={height - 4 - ((equity[equity.length - 1] - Math.min(...equity)) / (Math.max(...equity) - Math.min(...equity) || 1)) * (height - 8)}
              r="1.2"
              fill={strokeColor}
            />
          </>
        )}
      </svg>

      {/* Y-axis labels */}
      <div className="flex justify-between text-[10px] text-muted-foreground mt-1 font-mono">
        <span>₹{minY.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
        <span className={equity[equity.length - 1] >= initialCapital ? 'bull-text' : 'bear-text'}>
          ₹{(equity[equity.length - 1] ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
        </span>
        <span>₹{maxY.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
      </div>
    </div>
  );
}
