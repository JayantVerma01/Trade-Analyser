'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  TrendingUp, TrendingDown, Search, Clock, RefreshCw,
  Sparkles, AlertTriangle, Globe, X, Plus,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAuthStore } from '@/lib/store/auth.store';
import {
  recommendationsApi,
  RecommendationResult,
  SectorMeta,
} from '@/lib/api/recommendations.api';
import StockRecommendationCard from '@/components/recommendations/StockRecommendationCard';

const TRADING_STYLES = [
  { id: 'intraday',   label: 'Intraday',   tf: '15m', desc: 'Same-day trades' },
  { id: 'swing',      label: 'Swing',      tf: '1h',  desc: '2–10 day holds' },
  { id: 'positional', label: 'Positional', tf: '1d',  desc: 'Weeks to months' },
];

const TOP_N_OPTIONS = [5, 8, 10, 15];

type SearchMode = 'market' | 'sector' | 'symbols';

export default function RecommendationsPage() {
  const { user } = useAuthStore();
  const { toast } = useToast();

  const [meta, setMeta]               = useState<SectorMeta | null>(null);
  const [selectedStyle, setStyle]     = useState('swing');
  const [searchMode, setSearchMode]   = useState<SearchMode>('market');
  const [selectedSector, setSector]   = useState<string | null>(null);
  const [customSymbols, setSymbols]   = useState<string[]>([]);
  const [symbolQuery, setSymbolQuery] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [topN, setTopN]               = useState(8);
  const [capital, setCapital]         = useState(user?.settings?.capital ?? 100_000);
  const [riskPct, setRiskPct]         = useState(1.0);
  const [loading, setLoading]         = useState(false);
  const [result, setResult]           = useState<RecommendationResult | null>(null);

  // Initial sector list
  useEffect(() => {
    recommendationsApi.getSectors()
      .then(setMeta)
      .catch(() => toast({ variant: 'destructive', title: 'Failed to load sector list' }));
  }, []);

  // Symbol search (debounced)
  useEffect(() => {
    if (searchMode !== 'symbols' || symbolQuery.trim().length < 1) {
      setSuggestions([]);
      return;
    }
    const handle = setTimeout(() => {
      recommendationsApi.searchSymbols(symbolQuery, 12)
        .then((res) => setSuggestions(res.matches))
        .catch(() => setSuggestions([]));
    }, 200);
    return () => clearTimeout(handle);
  }, [symbolQuery, searchMode]);

  const scanScopeLabel = useMemo(() => {
    if (searchMode === 'symbols' && customSymbols.length) return `${customSymbols.length} selected stocks`;
    if (searchMode === 'sector'  && selectedSector)        return `${selectedSector} sector (${meta?.sector_stocks[selectedSector] ?? '...'} stocks)`;
    if (searchMode === 'market')                            return `entire NSE+BSE liquid universe (~${meta?.total_universe ?? '...'} stocks)`;
    return 'select scope';
  }, [searchMode, selectedSector, customSymbols, meta]);

  const canScan = useMemo(() => {
    if (searchMode === 'sector')  return !!selectedSector;
    if (searchMode === 'symbols') return customSymbols.length > 0;
    return true;
  }, [searchMode, selectedSector, customSymbols]);

  const addSymbol = (sym: string) => {
    const up = sym.toUpperCase().trim();
    if (!up || customSymbols.includes(up)) return;
    setSymbols([...customSymbols, up]);
    setSymbolQuery('');
    setSuggestions([]);
  };

  const removeSymbol = (sym: string) => {
    setSymbols(customSymbols.filter((s) => s !== sym));
  };

  const handleScan = async () => {
    if (!canScan) {
      toast({ variant: 'destructive', title: 'Pick a scope first' });
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const res = await recommendationsApi.scan({
        trading_style: selectedStyle,
        sector:        searchMode === 'sector'  ? selectedSector : null,
        symbols:       searchMode === 'symbols' ? customSymbols  : null,
        capital,
        risk_pct: riskPct,
        top_n:    topN,
      });
      setResult(res);
      if (res.recommendations.length === 0) {
        toast({
          title:       'No strong setups found',
          description: `${res.total_scanned} stocks scanned, none passed the quality filter.`,
        });
      } else {
        toast({
          title:       `Found ${res.recommendations.length} recommendations`,
          description: `${res.total_qualified}/${res.total_scanned} qualified · scan time ${res.elapsed_seconds}s`,
        });
      }
    } catch (err: any) {
      toast({
        variant:     'destructive',
        title:       'Scan failed',
        description: err?.response?.data?.message || 'Please try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-primary" />
          Stock Recommendations
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Deep AI analysis across NSE+BSE — surfaces the best setups for your trading style
        </p>
      </div>

      {/* Disclaimer */}
      <div className="flex items-start gap-3 p-3 rounded-lg bg-yellow-500/5 border border-yellow-500/20">
        <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5 shrink-0" />
        <p className="text-xs text-muted-foreground">
          <span className="text-yellow-500 font-medium">Analysis only — </span>
          Recommendations come from technical indicators + multi-timeframe confluence + historical
          setup validation. Not financial advice. Always apply your own judgement.
        </p>
      </div>

      {/* Config card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Scan Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">

          {/* Trading style */}
          <div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-2">
              Trading Style
            </p>
            <div className="flex gap-2 flex-wrap">
              {TRADING_STYLES.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setStyle(s.id)}
                  className={`flex flex-col px-4 py-2.5 rounded-lg border text-sm font-medium transition-all ${
                    selectedStyle === s.id
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground'
                  }`}
                >
                  <span>{s.label}</span>
                  <span className="text-[10px] font-normal opacity-70">{s.desc} · {s.tf}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Search mode tabs */}
          <div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-2">
              Search Scope <span className="normal-case font-normal opacity-70">(optional — pick what to scan)</span>
            </p>
            <div className="flex gap-2 border-b border-border">
              {[
                { id: 'market'  as const, label: 'Whole Market', icon: Globe,  desc: 'Scan all liquid NSE+BSE stocks' },
                { id: 'sector'  as const, label: 'By Sector',    icon: Sparkles, desc: 'Pick one industry to focus on' },
                { id: 'symbols' as const, label: 'Specific Stocks', icon: Search,  desc: 'Search and shortlist symbols' },
              ].map(({ id, label, icon: Icon, desc }) => (
                <button
                  key={id}
                  onClick={() => setSearchMode(id)}
                  title={desc}
                  className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                    searchMode === id
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </button>
              ))}
            </div>

            {/* Whole Market */}
            {searchMode === 'market' && (
              <div className="mt-4 flex items-center gap-3 p-4 rounded-lg bg-secondary/40 border border-border">
                <Globe className="h-6 w-6 text-primary shrink-0" />
                <div className="text-sm">
                  <p className="font-medium">Scanning entire liquid NSE+BSE universe</p>
                  <p className="text-xs text-muted-foreground">
                    {meta ? `${meta.total_universe} stocks across ${meta.sectors.length} sectors` : 'Loading...'}
                    {' · '}may take 15–30 seconds
                  </p>
                </div>
              </div>
            )}

            {/* Sector grid */}
            {searchMode === 'sector' && (
              <div className="mt-4">
                {meta ? (
                  <div className="flex flex-wrap gap-2">
                    {meta.sectors.map((sec) => (
                      <button
                        key={sec}
                        onClick={() => setSector(sec)}
                        className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                          selectedSector === sec
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground'
                        }`}
                      >
                        {sec}
                        <span className="ml-1 opacity-50">({meta.sector_stocks[sec]})</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="h-10 bg-secondary/40 rounded animate-pulse" />
                )}
              </div>
            )}

            {/* Symbol search */}
            {searchMode === 'symbols' && (
              <div className="mt-4 space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    value={symbolQuery}
                    onChange={(e) => setSymbolQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && suggestions[0]) addSymbol(suggestions[0]);
                    }}
                    placeholder="Search NSE/BSE — type RELIANCE, TCS, BANK..."
                    className="w-full h-10 pl-9 pr-3 rounded-md border border-input bg-background text-sm uppercase"
                    autoComplete="off"
                  />
                  {suggestions.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 max-h-56 overflow-y-auto bg-card border border-border rounded-md shadow-lg z-10">
                      {suggestions.map((sym) => (
                        <button
                          key={sym}
                          onClick={() => addSymbol(sym)}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-secondary flex items-center justify-between"
                        >
                          <span className="font-medium">{sym}</span>
                          <Plus className="h-3 w-3 text-muted-foreground" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {customSymbols.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {customSymbols.map((sym) => (
                      <Badge key={sym} variant="secondary" className="gap-1 pr-1">
                        {sym}
                        <button onClick={() => removeSymbol(sym)} className="hover:text-red-400">
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                    <button
                      onClick={() => setSymbols([])}
                      className="text-xs text-muted-foreground hover:text-red-400 ml-2"
                    >
                      Clear all
                    </button>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    No symbols selected yet — search above and click to add.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Capital / Risk / Top-N row */}
          <div className="flex flex-wrap items-end gap-4 pt-2 border-t border-border">
            <div>
              <label className="text-xs text-muted-foreground font-medium uppercase tracking-wide block mb-1">
                Capital (₹)
              </label>
              <input
                type="number"
                value={capital}
                onChange={(e) => setCapital(Number(e.target.value))}
                className="h-9 w-36 rounded-md border border-input bg-background px-3 text-sm"
                step={10000}
                min={10000}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground font-medium uppercase tracking-wide block mb-1">
                Risk per Trade (%)
              </label>
              <input
                type="number"
                value={riskPct}
                onChange={(e) => setRiskPct(Number(e.target.value))}
                className="h-9 w-24 rounded-md border border-input bg-background px-3 text-sm"
                step={0.5}
                min={0.1}
                max={5}
              />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">
                Top Results
              </p>
              <div className="flex gap-1">
                {TOP_N_OPTIONS.map((n) => (
                  <button
                    key={n}
                    onClick={() => setTopN(n)}
                    className={`w-10 h-9 rounded-md border text-sm font-medium transition-all ${
                      topN === n
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border text-muted-foreground hover:border-primary/40'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            <Button
              onClick={handleScan}
              disabled={loading || !canScan}
              className="ml-auto gap-2 h-9"
            >
              {loading ? (
                <><RefreshCw className="h-4 w-4 animate-spin" /> Scanning...</>
              ) : (
                <><Search className="h-4 w-4" /> Find Best Stocks</>
              )}
            </Button>
          </div>

          {/* Scope label */}
          <p className="text-xs text-muted-foreground">
            Will scan <strong className="text-foreground">{scanScopeLabel}</strong>
            {' '}for <strong className="text-foreground">{selectedStyle}</strong> setups,
            return top <strong className="text-foreground">{topN}</strong>.
          </p>
        </CardContent>
      </Card>

      {/* Loading skeleton */}
      {loading && (
        <div>
          <p className="text-xs text-muted-foreground mb-3 animate-pulse">
            Analysing {scanScopeLabel}... running indicators, MTF confluence, and signal validation in parallel.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {Array.from({ length: topN }).map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-5 space-y-3">
                  <div className="h-5 bg-secondary rounded w-1/3" />
                  <div className="h-3 bg-secondary rounded w-2/3" />
                  <div className="h-2 bg-secondary rounded w-full" />
                  <div className="h-16 bg-secondary rounded" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Results */}
      {!loading && result && (
        <div className="space-y-4">
          {/* Summary bar */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="secondary" className="gap-1">
                <Search className="h-3 w-3" />
                {result.total_scanned} scanned
              </Badge>
              <Badge variant="secondary" className="gap-1 border-primary/30 text-primary">
                {result.total_qualified} qualified
              </Badge>
              <Badge variant="outline" className="gap-1">
                <TrendingUp className="h-3 w-3 text-green-400" />
                {result.recommendations.filter(r => r.bias === 'Bullish').length} Bullish
              </Badge>
              <Badge variant="outline" className="gap-1">
                <TrendingDown className="h-3 w-3 text-red-400" />
                {result.recommendations.filter(r => r.bias === 'Bearish').length} Bearish
              </Badge>
              <Badge variant="outline" className="text-[10px]">
                {result.elapsed_seconds}s scan
              </Badge>
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              {new Date(result.generated_at).toLocaleTimeString()}
            </div>
          </div>

          {result.recommendations.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center">
                <TrendingUp className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-40" />
                <p className="text-muted-foreground text-sm">
                  No stocks in this scan passed the quality filter for{' '}
                  <strong>{result.trading_style}</strong> right now.
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Try a different scope or trading style.
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Top {result.recommendations.length} setups
                {result.scope === 'sector' && result.sector && <> in <strong className="text-foreground">{result.sector}</strong></>}
                {result.scope === 'market' && <> across the <strong className="text-foreground">whole market</strong></>}
                {result.scope === 'custom' && <> from your <strong className="text-foreground">selected stocks</strong></>}
                {' '}for <strong className="text-foreground">{result.trading_style}</strong> trading
                on <strong className="text-foreground">{result.analysis_timeframe}</strong> chart
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {result.recommendations.map((rec) => (
                  <StockRecommendationCard key={rec.symbol} rec={rec} />
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
