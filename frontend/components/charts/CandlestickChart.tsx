'use client';

import { useEffect, useRef } from 'react';
import {
  createChart,
  ColorType,
  CrosshairMode,
  type IChartApi,
  type ISeriesApi,
} from 'lightweight-charts';

export interface ChartCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface Indicators {
  ema9?: number;
  ema21?: number;
  ema50?: number;
  vwap?: number;
}

interface Levels {
  entryFrom?: number;
  entryTo?: number;
  stopLoss?: number;
  target1?: number;
  target2?: number;
}

interface Props {
  candles: ChartCandle[];
  indicators?: Indicators;
  levels?: Levels;
  symbol?: string;
  timeframe?: string;
}

export default function CandlestickChart({ candles, indicators, levels, symbol, timeframe }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef     = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!containerRef.current || candles.length === 0) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#9ca3af',
      },
      grid: {
        vertLines: { color: '#1f2937' },
        horzLines: { color: '#1f2937' },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: '#374151' },
      timeScale: { borderColor: '#374151', timeVisible: true, secondsVisible: false },
      width:  containerRef.current.clientWidth,
      height: 360,
    });

    chartRef.current = chart;

    // ── Candlestick series ──────────────────────────────────────────────────
    const candleSeries = chart.addCandlestickSeries({
      upColor:        '#22c55e',
      downColor:      '#ef4444',
      borderUpColor:  '#22c55e',
      borderDownColor:'#ef4444',
      wickUpColor:    '#22c55e',
      wickDownColor:  '#ef4444',
    });

    const sorted = [...candles].sort((a, b) => a.time - b.time);
    candleSeries.setData(sorted.map((c) => ({ time: c.time as any, open: c.open, high: c.high, low: c.low, close: c.close })));

    // ── Volume histogram ────────────────────────────────────────────────────
    const volSeries = chart.addHistogramSeries({
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
      color: '#3b82f620',
    });
    chart.priceScale('volume').applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });
    volSeries.setData(sorted.map((c) => ({
      time: c.time as any,
      value: c.volume,
      color: c.close >= c.open ? '#22c55e30' : '#ef444430',
    })));

    // ── EMA lines ───────────────────────────────────────────────────────────
    const addEmaLine = (value: number | undefined, color: string, title: string) => {
      if (!value || value === 0) return;
      const series = chart.addLineSeries({ color, lineWidth: 1, title, priceLineVisible: false });
      series.setData(sorted.map((c) => ({ time: c.time as any, value })));
    };

    addEmaLine(indicators?.ema9,  '#facc15', 'EMA9');
    addEmaLine(indicators?.ema21, '#60a5fa', 'EMA21');
    addEmaLine(indicators?.ema50, '#f97316', 'EMA50');
    addEmaLine(indicators?.vwap, '#a78bfa', 'VWAP');

    // ── Price levels (horizontal lines) ─────────────────────────────────────
    if (levels?.stopLoss) {
      candleSeries.createPriceLine({ price: levels.stopLoss, color: '#ef4444', lineWidth: 1, lineStyle: 2, title: 'SL' });
    }
    if (levels?.target1) {
      candleSeries.createPriceLine({ price: levels.target1, color: '#22c55e', lineWidth: 1, lineStyle: 2, title: 'T1' });
    }
    if (levels?.target2) {
      candleSeries.createPriceLine({ price: levels.target2, color: '#16a34a', lineWidth: 1, lineStyle: 2, title: 'T2' });
    }
    if (levels?.entryFrom) {
      candleSeries.createPriceLine({ price: levels.entryFrom, color: '#3b82f6', lineWidth: 1, lineStyle: 1, title: 'Entry' });
    }

    chart.timeScale().fitContent();

    // ── Resize observer ─────────────────────────────────────────────────────
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        chart.applyOptions({ width: entry.contentRect.width });
      }
    });
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      chart.remove();
    };
  }, [candles, indicators, levels]);

  return (
    <div className="relative">
      {symbol && (
        <div className="absolute top-2 left-3 z-10 flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <span className="text-foreground font-semibold">{symbol}</span>
          <span>{timeframe}</span>
        </div>
      )}
      <div ref={containerRef} className="w-full rounded-lg overflow-hidden" />
      {/* Legend */}
      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground px-1">
        <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-yellow-400 inline-block" />EMA9</span>
        <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-blue-400 inline-block" />EMA21</span>
        <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-orange-400 inline-block" />EMA50</span>
        <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-violet-400 inline-block" />VWAP</span>
        <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-red-400 inline-block border-dashed" />SL</span>
        <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-green-400 inline-block border-dashed" />T1/T2</span>
      </div>
    </div>
  );
}
