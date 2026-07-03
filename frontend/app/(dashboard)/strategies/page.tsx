'use client';

import { useState, useEffect } from 'react';
import { Plus, Settings2, Loader2, X, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import StrategyCard from '@/components/strategies/StrategyCard';
import RuleBuilder from '@/components/strategies/RuleBuilder';
import { strategyApi, type Strategy, type StrategyRule } from '@/lib/api/strategy.api';

const TEMPLATES: Array<{ name: string; description: string; marketType: 'intraday'|'swing'|'positional'; rules: StrategyRule[] }> = [
  {
    name:        'EMA Trend Follow',
    description: 'Trend-following strategy using EMA alignment and momentum filters.',
    marketType:  'intraday',
    rules: [
      { id: 'et1', label: 'Price above EMA21',          indicator: 'price',        operator: 'above',   compare_to: 'ema21' },
      { id: 'et2', label: 'Price above EMA50',          indicator: 'price',        operator: 'above',   compare_to: 'ema50' },
      { id: 'et3', label: 'EMA9 above EMA21',           indicator: 'ema9',         operator: 'above',   compare_to: 'ema21' },
      { id: 'et4', label: 'RSI in bullish zone (50-70)',indicator: 'rsi',          operator: 'between', value_min: 50, value_max: 70 },
      { id: 'et5', label: 'MACD histogram positive',    indicator: 'macd_hist',    operator: 'above',   value: 0 },
      { id: 'et6', label: 'Volume above average',       indicator: 'volume_ratio', operator: 'above',   value: 1.0 },
    ],
  },
  {
    name:        'RSI Oversold Bounce',
    description: 'Buy the dip when RSI is oversold and MACD starts recovering.',
    marketType:  'swing',
    rules: [
      { id: 'rb1', label: 'RSI oversold (<35)',          indicator: 'rsi',          operator: 'below',   value: 35 },
      { id: 'rb2', label: 'MACD histogram recovering',  indicator: 'macd_hist',    operator: 'above',   value: -0.5 },
      { id: 'rb3', label: 'Price above long-term EMA50',indicator: 'price',        operator: 'above',   compare_to: 'ema50' },
      { id: 'rb4', label: 'Price near BB Lower',        indicator: 'price',        operator: 'below',   compare_to: 'bb_mid' },
    ],
  },
  {
    name:        'VWAP Power Trend',
    description: 'Intraday power trend — price above VWAP with strong volume and EMA alignment.',
    marketType:  'intraday',
    rules: [
      { id: 'vp1', label: 'Price above VWAP',           indicator: 'price',        operator: 'above',   compare_to: 'vwap' },
      { id: 'vp2', label: 'Strong volume (1.3x avg)',   indicator: 'volume_ratio', operator: 'above',   value: 1.3 },
      { id: 'vp3', label: 'RSI in momentum zone (55-75)',indicator:'rsi',          operator: 'between', value_min: 55, value_max: 75 },
      { id: 'vp4', label: 'EMA9 above EMA21',           indicator: 'ema9',         operator: 'above',   compare_to: 'ema21' },
    ],
  },
];

const MARKET_TYPES = ['intraday', 'swing', 'positional'] as const;

export default function StrategiesPage() {
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [isLoading,  setIsLoading]  = useState(true);
  const [showForm,   setShowForm]   = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [saving,     setSaving]     = useState(false);

  // Form state
  const [name,        setName]        = useState('');
  const [description, setDescription] = useState('');
  const [marketType,  setMarketType]  = useState<'intraday'|'swing'|'positional'>('intraday');
  const [logic,       setLogic]       = useState<'AND'|'OR'>('AND');
  const [rules,       setRules]       = useState<StrategyRule[]>([]);

  useEffect(() => {
    strategyApi.list()
      .then(setStrategies)
      .catch(() => setError('Failed to load strategies'))
      .finally(() => setIsLoading(false));
  }, []);

  const applyTemplate = (t: typeof TEMPLATES[0]) => {
    setName(t.name);
    setDescription(t.description);
    setMarketType(t.marketType);
    setRules(t.rules);
    setShowForm(true);
  };

  const resetForm = () => {
    setName(''); setDescription(''); setMarketType('intraday');
    setLogic('AND'); setRules([]); setShowForm(false); setError(null);
  };

  const handleSave = async () => {
    if (!name.trim() || rules.length === 0) {
      setError('Name and at least one rule are required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const created = await strategyApi.create({
        name: name.trim(),
        description: description.trim() || undefined,
        marketType,
        conditions: { rules, logic },
      });
      setStrategies((prev) => [created, ...prev]);
      resetForm();
    } catch (err: any) {
      setError(err?.response?.data?.error?.message ?? 'Failed to save strategy.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleted = (id: string) => setStrategies((prev) => prev.filter((s) => s.id !== id));
  const handleToggled = (updated: Strategy) =>
    setStrategies((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Strategies</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Define rule-based entry strategies and evaluate them against live market data
          </p>
        </div>
        {!showForm && (
          <Button onClick={() => setShowForm(true)} size="sm" className="gap-1.5">
            <Plus className="h-4 w-4" />New Strategy
          </Button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 text-sm bear-text bg-bear/10 border border-bear/20 rounded-lg px-4 py-3">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      {/* Create form */}
      {showForm && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">New Strategy</CardTitle>
              <button onClick={resetForm} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Quick templates */}
            <div>
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Start from template</Label>
              <div className="flex flex-wrap gap-2 mt-1.5">
                {TEMPLATES.map((t) => (
                  <button
                    key={t.name}
                    type="button"
                    onClick={() => applyTemplate(t)}
                    className="text-xs px-3 py-1.5 rounded-md border border-border hover:border-primary/50 hover:bg-primary/5 transition-colors"
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="h-px bg-border" />

            {/* Name + description */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="sname">Strategy Name *</Label>
                <Input id="sname" value={name} onChange={(e) => setName(e.target.value)} placeholder="My EMA Strategy" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sdesc">Description</Label>
                <Input id="sdesc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional..." />
              </div>
            </div>

            {/* Market type + logic */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Market Type</Label>
                <div className="flex gap-1.5">
                  {MARKET_TYPES.map((mt) => (
                    <button
                      key={mt}
                      type="button"
                      onClick={() => setMarketType(mt)}
                      className={`flex-1 text-xs py-1.5 rounded-md border transition-colors capitalize ${
                        marketType === mt
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border text-muted-foreground hover:border-primary/40'
                      }`}
                    >
                      {mt}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Rule Logic</Label>
                <div className="flex gap-1.5">
                  {(['AND', 'OR'] as const).map((l) => (
                    <button
                      key={l}
                      type="button"
                      onClick={() => setLogic(l)}
                      className={`flex-1 text-xs py-1.5 rounded-md border transition-colors font-mono ${
                        logic === l
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border text-muted-foreground hover:border-primary/40'
                      }`}
                    >
                      {l}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-muted-foreground">
                  {logic === 'AND' ? 'All rules must pass' : 'Any one rule passing is enough'}
                </p>
              </div>
            </div>

            {/* Rule builder */}
            <RuleBuilder rules={rules} onChange={setRules} />

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <Button onClick={handleSave} disabled={saving || !name.trim() || rules.length === 0} className="gap-1.5">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                {saving ? 'Saving...' : 'Save Strategy'}
              </Button>
              <Button variant="ghost" onClick={resetForm}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />Loading strategies...
        </div>
      )}

      {/* Strategy grid */}
      {!isLoading && strategies.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {strategies.map((s) => (
            <StrategyCard
              key={s.id}
              strategy={s}
              onDeleted={handleDeleted}
              onToggled={handleToggled}
            />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && strategies.length === 0 && !showForm && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center gap-4">
            <div className="p-4 rounded-full bg-secondary">
              <Settings2 className="h-8 w-8 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium">No strategies yet</p>
              <p className="text-sm text-muted-foreground mt-1 max-w-xs mx-auto">
                Create a strategy by defining rules like "Price above EMA21" and "RSI between 50–70".
              </p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center">
              {TEMPLATES.map((t) => (
                <button
                  key={t.name}
                  onClick={() => applyTemplate(t)}
                  className="text-xs px-3 py-2 rounded-md border border-border hover:border-primary/50 hover:bg-primary/5 transition-colors"
                >
                  Use "{t.name}"
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
