'use client';

import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { StrategyRule } from '@/lib/api/strategy.api';

const INDICATORS = [
  { value: 'price',        label: 'Price (LTP)' },
  { value: 'ema9',         label: 'EMA 9' },
  { value: 'ema21',        label: 'EMA 21' },
  { value: 'ema50',        label: 'EMA 50' },
  { value: 'ema200',       label: 'EMA 200' },
  { value: 'sma20',        label: 'SMA 20' },
  { value: 'sma50',        label: 'SMA 50' },
  { value: 'rsi',          label: 'RSI (14)' },
  { value: 'macd',         label: 'MACD Line' },
  { value: 'macd_signal',  label: 'MACD Signal' },
  { value: 'macd_hist',    label: 'MACD Histogram' },
  { value: 'atr',          label: 'ATR (14)' },
  { value: 'bb_upper',     label: 'BB Upper' },
  { value: 'bb_mid',       label: 'BB Mid' },
  { value: 'bb_lower',     label: 'BB Lower' },
  { value: 'volume_ratio', label: 'Volume Ratio' },
  { value: 'vwap',         label: 'VWAP' },
  { value: 'pdh',          label: 'Prev Day High' },
  { value: 'pdl',          label: 'Prev Day Low' },
];

const OPERATORS = [
  { value: 'above',     label: '> above' },
  { value: 'below',     label: '< below' },
  { value: 'between',   label: 'between' },
  { value: 'crossover', label: 'crossover >' },
  { value: 'equal',     label: '= equal' },
];

type CompareMode = 'value' | 'indicator';

interface RuleRow extends StrategyRule {
  compareMode: CompareMode;
}

interface Props {
  rules:     StrategyRule[];
  onChange:  (rules: StrategyRule[]) => void;
}

function newRule(): RuleRow {
  return {
    id:          `r_${Date.now()}`,
    label:       '',
    indicator:   'price',
    operator:    'above',
    compareMode: 'indicator',
    compare_to:  'ema21',
  };
}

function toStrategyRule(r: RuleRow): StrategyRule {
  const { compareMode, ...rest } = r;
  if (compareMode === 'value') {
    return { ...rest, compare_to: undefined };
  }
  return { ...rest, value: undefined, value_min: undefined, value_max: undefined };
}

function makeLabel(r: RuleRow): string {
  const ind  = INDICATORS.find((i) => i.value === r.indicator)?.label ?? r.indicator;
  const op   = OPERATORS.find((o) => o.value === r.operator)?.label ?? r.operator;
  if (r.operator === 'between') return `${ind} between ${r.value_min ?? '?'} – ${r.value_max ?? '?'}`;
  if (r.compareMode === 'indicator') {
    const rhs = INDICATORS.find((i) => i.value === r.compare_to)?.label ?? r.compare_to;
    return `${ind} ${op} ${rhs}`;
  }
  return `${ind} ${op} ${r.value ?? '?'}`;
}

export default function RuleBuilder({ rules, onChange }: Props) {
  const [rows, setRows] = useState<RuleRow[]>(() =>
    rules.length
      ? rules.map((r) => ({
          ...r,
          compareMode: (r.compare_to ? 'indicator' : 'value') as CompareMode,
        }))
      : [newRule()]
  );

  const update = (updated: RuleRow[]) => {
    setRows(updated);
    onChange(updated.map(toStrategyRule));
  };

  const addRow = () => update([...rows, newRule()]);

  const removeRow = (id: string) => update(rows.filter((r) => r.id !== id));

  const setField = (id: string, field: keyof RuleRow, val: any) => {
    update(rows.map((r) => {
      if (r.id !== id) return r;
      const updated = { ...r, [field]: val };
      // Auto-set label if not manually edited
      updated.label = updated.label || makeLabel(updated);
      return updated;
    }));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">Rules</Label>
        <Button type="button" variant="outline" size="sm" onClick={addRow} className="h-7 text-xs gap-1">
          <Plus className="h-3 w-3" />Add Rule
        </Button>
      </div>

      {rows.map((row, idx) => (
        <div key={row.id} className="border border-border rounded-lg p-3 space-y-2 bg-secondary/30">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase">Rule {idx + 1}</span>
            <button
              type="button"
              onClick={() => removeRow(row.id)}
              className="text-muted-foreground hover:text-bear transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Indicator + Operator row */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-[10px]">Indicator</Label>
              <select
                value={row.indicator}
                onChange={(e) => setField(row.id, 'indicator', e.target.value)}
                className="w-full h-8 text-xs rounded-md border border-border bg-background px-2"
              >
                {INDICATORS.map((i) => (
                  <option key={i.value} value={i.value}>{i.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px]">Operator</Label>
              <select
                value={row.operator}
                onChange={(e) => setField(row.id, 'operator', e.target.value as StrategyRule['operator'])}
                className="w-full h-8 text-xs rounded-md border border-border bg-background px-2"
              >
                {OPERATORS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Compare mode + value */}
          {row.operator === 'between' ? (
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-[10px]">Min value</Label>
                <Input
                  type="number"
                  value={row.value_min ?? ''}
                  onChange={(e) => setField(row.id, 'value_min', parseFloat(e.target.value))}
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px]">Max value</Label>
                <Input
                  type="number"
                  value={row.value_max ?? ''}
                  onChange={(e) => setField(row.id, 'value_max', parseFloat(e.target.value))}
                  className="h-8 text-xs"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {/* Compare mode toggle */}
              <div className="flex gap-2">
                {(['indicator', 'value'] as CompareMode[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setField(row.id, 'compareMode', m)}
                    className={`text-[10px] px-2 py-0.5 rounded border transition-colors capitalize ${
                      row.compareMode === m
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border text-muted-foreground'
                    }`}
                  >
                    {m === 'indicator' ? 'vs indicator' : 'vs fixed value'}
                  </button>
                ))}
              </div>

              {row.compareMode === 'indicator' ? (
                <div className="space-y-1">
                  <Label className="text-[10px]">Compare to</Label>
                  <select
                    value={row.compare_to ?? 'ema21'}
                    onChange={(e) => setField(row.id, 'compare_to', e.target.value)}
                    className="w-full h-8 text-xs rounded-md border border-border bg-background px-2"
                  >
                    {INDICATORS.map((i) => (
                      <option key={i.value} value={i.value}>{i.label}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="space-y-1">
                  <Label className="text-[10px]">Value</Label>
                  <Input
                    type="number"
                    value={row.value ?? ''}
                    onChange={(e) => setField(row.id, 'value', parseFloat(e.target.value))}
                    className="h-8 text-xs"
                    placeholder="e.g. 50 for RSI, 1.2 for volume ratio"
                  />
                </div>
              )}
            </div>
          )}

          {/* Label (auto-generated, user can override) */}
          <div className="space-y-1">
            <Label className="text-[10px]">Rule label</Label>
            <Input
              value={row.label}
              onChange={(e) => setField(row.id, 'label', e.target.value)}
              placeholder={makeLabel(row)}
              className="h-7 text-xs"
            />
          </div>
        </div>
      ))}

      {rows.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-4">
          No rules yet. Click "Add Rule" to define entry conditions.
        </p>
      )}
    </div>
  );
}
