'use client';

import { useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import AnalysisForm from '@/components/analysis/AnalysisForm';
import TradeSetupCard from '@/components/analysis/TradeSetupCard';
import IndicatorPanel from '@/components/analysis/IndicatorPanel';
import CandlestickChart from '@/components/charts/CandlestickChart';
import { analysisApi, type AnalysisRequest, type AnalysisResult } from '@/lib/api/analysis.api';

export default function AnalysisPage() {
  const [result,    setResult]    = useState<AnalysisResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  const handleAnalyse = async (req: AnalysisRequest) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await analysisApi.analyseStock(req);
      setResult(data);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? err?.message ?? 'Analysis failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Stock Analysis</h1>
        <p className="text-sm text-muted-foreground mt-1">
          AI-powered technical analysis, trade setups, and risk management for Indian markets
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[320px_1fr] gap-6 items-start">
        {/* Left sidebar — form */}
        <div className="xl:sticky xl:top-6">
          <AnalysisForm onSubmit={handleAnalyse} isLoading={isLoading} />
        </div>

        {/* Right panel — results */}
        <div className="space-y-6">
          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 text-sm bear-text bg-bear/10 border border-bear/20 rounded-lg px-4 py-3">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              {error}
            </div>
          )}

          {/* Loading skeleton */}
          {isLoading && (
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-3 animate-pulse">
                  <div className="h-4 bg-secondary rounded w-1/3" />
                  <div className="h-64 bg-secondary rounded" />
                  <div className="h-4 bg-secondary rounded w-1/2" />
                  <div className="h-4 bg-secondary rounded w-2/3" />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Results */}
          {result && !isLoading && (
            <>
              {/* Chart */}
              {result.candles?.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Price Chart</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <CandlestickChart
                      candles={result.candles}
                      symbol={result.symbol}
                      timeframe={result.timeframe}
                      indicators={{
                        ema9:  result.indicators?.ema9,
                        ema21: result.indicators?.ema21,
                        ema50: result.indicators?.ema50,
                        vwap:  result.indicators?.vwap,
                      }}
                      levels={{
                        entryFrom: result.entry_zone?.from,
                        entryTo:   result.entry_zone?.to,
                        stopLoss:  result.stop_loss,
                        target1:   result.target1,
                        target2:   result.target2,
                      }}
                    />
                  </CardContent>
                </Card>
              )}

              {/* Setup + Indicators side by side on large screens */}
              <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-6 items-start">
                <TradeSetupCard result={result} />

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Indicators</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <IndicatorPanel indicators={result.indicators} />
                  </CardContent>
                </Card>
              </div>
            </>
          )}

          {/* Empty state */}
          {!result && !isLoading && !error && (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center gap-3">
                <div className="p-4 rounded-full bg-secondary">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted-foreground">
                    <path d="M3 3v18h18" /><path d="m19 9-5 5-4-4-3 3" />
                  </svg>
                </div>
                <div>
                  <p className="font-medium">No analysis yet</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Select a symbol and configure your parameters, then click "Run Analysis"
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
