'use client';

import { useState, useEffect, useCallback } from 'react';
import { BookOpen, Plus, X, TrendingUp, TrendingDown, Minus, RefreshCw, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import JournalEntryCard from '@/components/journal/JournalEntry';
import { journalApi, type JournalEntry, type JournalStats, type CreateJournalPayload, type JournalResult } from '@/lib/api/journal.api';

const MISTAKE_OPTIONS = [
  'FOMO entry', 'Early exit', 'Ignored SL', 'Overtraded',
  'No setup', 'Chased price', 'Wrong timeframe', 'Poor R:R',
];
const EMOTION_OPTIONS = [
  'Confident', 'Anxious', 'Greedy', 'Fearful',
  'Disciplined', 'Impatient', 'Calm', 'Frustrated',
];

function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <Card><CardContent className="pt-4 pb-3">
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className={`text-xl font-bold font-mono mt-0.5 ${color ?? ''}`}>{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
    </CardContent></Card>
  );
}

export default function JournalPage() {
  const [entries,    setEntries]    = useState<JournalEntry[]>([]);
  const [stats,      setStats]      = useState<JournalStats | null>(null);
  const [total,      setTotal]      = useState(0);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState('');

  // Filters
  const [fSymbol,    setFSymbol]    = useState('');
  const [fResult,    setFResult]    = useState<JournalResult | ''>('');

  // New entry form
  const [showForm,   setShowForm]   = useState(false);
  const [fSymbolNew, setFSymbolNew] = useState('');
  const [fSetup,     setFSetup]     = useState('');
  const [fRes,       setFRes]       = useState<JournalResult>('WIN');
  const [fPnl,       setFPnl]       = useState('');
  const [fNotes,     setFNotes]     = useState('');
  const [fMistakes,  setFMistakes]  = useState<string[]>([]);
  const [fEmotions,  setFEmotions]  = useState<string[]>([]);
  const [fLessons,   setFLessons]   = useState('');
  const [formErr,    setFormErr]    = useState('');
  const [formLoading, setFormLoading] = useState(false);

  const loadStats   = useCallback(async () => {
    try { setStats(await journalApi.stats()); } catch {}
  }, []);

  const loadEntries = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await journalApi.list({
        symbol: fSymbol || undefined,
        result: (fResult || undefined) as JournalResult | undefined,
        take: 50,
      });
      setEntries(res.entries);
      setTotal(res.total);
    } catch { setError('Failed to load journal'); }
    finally { setLoading(false); }
  }, [fSymbol, fResult]);

  useEffect(() => { loadStats(); }, [loadStats]);
  useEffect(() => { loadEntries(); }, [loadEntries]);

  const toggle = (arr: string[], val: string, set: (a: string[]) => void) =>
    arr.includes(val) ? set(arr.filter(x => x !== val)) : set([...arr, val]);

  const handleCreate = async () => {
    if (!fSymbolNew || !fSetup) { setFormErr('Symbol and setup type are required'); return; }
    setFormErr(''); setFormLoading(true);
    try {
      const payload: CreateJournalPayload = {
        symbol: fSymbolNew.toUpperCase(), setupType: fSetup,
        result: fRes, pnl: fPnl ? Number(fPnl) : undefined,
        notes: fNotes || undefined, mistakes: fMistakes, emotionTags: fEmotions,
        lessonsLearned: fLessons || undefined,
      };
      const entry = await journalApi.create(payload);
      setEntries(prev => [entry, ...prev]);
      setTotal(t => t + 1);
      setShowForm(false);
      setFSymbolNew(''); setFSetup(''); setFPnl(''); setFNotes(''); setFLessons('');
      setFMistakes([]); setFEmotions([]);
      loadStats();
    } catch (e: any) { setFormErr(e?.response?.data?.message ?? 'Failed to create entry'); }
    finally { setFormLoading(false); }
  };

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
            <BookOpen className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold leading-none">Trade Journal</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Annotate trades with emotion tags and lessons</p>
          </div>
        </div>
        <Button size="sm" className="gap-1.5" onClick={() => setShowForm(f => !f)}>
          {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showForm ? 'Cancel' : 'Add Entry'}
        </Button>
      </div>

      {/* Stats row */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Total Entries" value={`${stats.total}`} />
          <StatCard label="Win Rate"  value={`${stats.winRate}%`}
            sub={`${stats.wins}W · ${stats.losses}L · ${stats.breakevens}B/E`}
            color={stats.winRate >= 50 ? 'bull-text' : 'bear-text'} />
          <StatCard label="Net P&L"   value={`${stats.totalPnl >= 0 ? '+' : ''}₹${Math.abs(stats.totalPnl).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
            color={stats.totalPnl >= 0 ? 'bull-text' : 'bear-text'} />
          <StatCard label="Avg P&L"   value={`${stats.avgPnl >= 0 ? '+' : ''}₹${Math.abs(stats.avgPnl).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
            color={stats.avgPnl >= 0 ? 'bull-text' : 'bear-text'} />
        </div>
      )}

      {/* Top mistakes + emotions */}
      {stats && (stats.topMistakes.length > 0 || stats.topEmotions.length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {stats.topMistakes.length > 0 && (
            <Card><CardContent className="pt-3 pb-3">
              <p className="text-[11px] text-muted-foreground mb-2 font-medium uppercase tracking-wide flex items-center gap-1">
                <AlertCircle className="h-3 w-3" /> Top Mistakes
              </p>
              <div className="flex flex-wrap gap-1.5">
                {stats.topMistakes.map(m => (
                  <span key={m.tag} className="text-[11px] px-2 py-0.5 rounded-full bg-destructive/10 text-destructive border border-destructive/20">
                    {m.tag} ×{m.count}
                  </span>
                ))}
              </div>
            </CardContent></Card>
          )}
          {stats.topEmotions.length > 0 && (
            <Card><CardContent className="pt-3 pb-3">
              <p className="text-[11px] text-muted-foreground mb-2 font-medium uppercase tracking-wide">Emotions</p>
              <div className="flex flex-wrap gap-1.5">
                {stats.topEmotions.map(t => (
                  <span key={t.tag} className="text-[11px] px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                    {t.tag} ×{t.count}
                  </span>
                ))}
              </div>
            </CardContent></Card>
          )}
        </div>
      )}

      {/* Add entry form */}
      {showForm && (
        <Card>
          <CardContent className="pt-4 space-y-4">
            <p className="text-sm font-semibold">New Journal Entry</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] text-muted-foreground">Symbol</label>
                <input value={fSymbolNew} onChange={e => setFSymbolNew(e.target.value.toUpperCase())}
                  placeholder="NIFTY" className="w-full bg-secondary/50 border border-border rounded px-2.5 py-1.5 text-sm focus:outline-none focus:border-primary" />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] text-muted-foreground">Setup Type</label>
                <input value={fSetup} onChange={e => setFSetup(e.target.value)}
                  placeholder="EMA Crossover" className="w-full bg-secondary/50 border border-border rounded px-2.5 py-1.5 text-sm focus:outline-none focus:border-primary" />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] text-muted-foreground">P&L (₹)</label>
                <input type="number" value={fPnl} onChange={e => setFPnl(e.target.value)}
                  placeholder="0" className="w-full bg-secondary/50 border border-border rounded px-2.5 py-1.5 text-sm focus:outline-none focus:border-primary" />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] text-muted-foreground">Result</label>
              <div className="flex gap-2">
                {(['WIN', 'LOSS', 'BREAKEVEN'] as JournalResult[]).map(r => (
                  <button key={r} onClick={() => setFRes(r)}
                    className={`flex-1 py-1.5 rounded text-xs font-medium border transition-colors ${
                      fRes === r
                        ? r === 'WIN' ? 'bull-badge border-green-500/50' : r === 'LOSS' ? 'bear-badge border-red-500/50' : 'bg-secondary text-foreground border-border'
                        : 'border-border text-muted-foreground hover:bg-secondary/50'
                    }`}>
                    {r}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] text-muted-foreground">Mistakes</label>
              <div className="flex flex-wrap gap-1">
                {MISTAKE_OPTIONS.map(m => (
                  <button key={m} onClick={() => toggle(fMistakes, m, setFMistakes)}
                    className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${fMistakes.includes(m) ? 'bg-destructive/15 text-destructive border-destructive/30' : 'border-border text-muted-foreground hover:bg-secondary/50'}`}>
                    {m}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] text-muted-foreground">Emotions</label>
              <div className="flex flex-wrap gap-1">
                {EMOTION_OPTIONS.map(t => (
                  <button key={t} onClick={() => toggle(fEmotions, t, setFEmotions)}
                    className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${fEmotions.includes(t) ? 'bg-primary/15 text-primary border-primary/30' : 'border-border text-muted-foreground hover:bg-secondary/50'}`}>
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] text-muted-foreground">Notes</label>
                <textarea rows={2} value={fNotes} onChange={e => setFNotes(e.target.value)}
                  className="w-full bg-secondary/50 border border-border rounded px-2.5 py-1.5 text-sm resize-none focus:outline-none focus:border-primary" />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] text-muted-foreground">Lessons Learned</label>
                <textarea rows={2} value={fLessons} onChange={e => setFLessons(e.target.value)}
                  className="w-full bg-secondary/50 border border-border rounded px-2.5 py-1.5 text-sm resize-none focus:outline-none focus:border-primary" />
              </div>
            </div>

            {formErr && <p className="text-xs bear-text">{formErr}</p>}
            <Button onClick={handleCreate} disabled={formLoading} className="w-full sm:w-auto">
              {formLoading ? 'Saving…' : 'Save Entry'}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3">
        <input value={fSymbol} onChange={e => setFSymbol(e.target.value.toUpperCase())}
          placeholder="Filter by symbol"
          className="bg-secondary/50 border border-border rounded px-2.5 py-1.5 text-sm focus:outline-none focus:border-primary w-36" />
        <div className="flex gap-1">
          {(['', 'WIN', 'LOSS', 'BREAKEVEN'] as const).map(r => (
            <button key={r} onClick={() => setFResult(r)}
              className={`px-2.5 py-1 rounded text-xs font-medium border transition-colors ${fResult === r ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-secondary/50'}`}>
              {r || 'All'}
            </button>
          ))}
        </div>
        <button onClick={loadEntries} className="text-muted-foreground hover:text-foreground ml-auto transition-colors">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {error && <p className="text-sm bear-text">{error}</p>}

      {/* Entry list */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1,2,3].map(i => <div key={i} className="h-28 rounded-xl bg-secondary/40 animate-pulse" />)}
        </div>
      ) : entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground">
          <BookOpen className="h-10 w-10 opacity-20 mb-3" />
          <p className="text-sm font-medium">No journal entries yet</p>
          <p className="text-xs mt-1">Close a paper trade or add an entry manually</p>
        </div>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">{total} entries</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {entries.map(entry => (
              <JournalEntryCard
                key={entry.id}
                entry={entry}
                onDelete={id => { setEntries(prev => prev.filter(e => e.id !== id)); setTotal(t => t - 1); loadStats(); }}
                onUpdated={upd => setEntries(prev => prev.map(e => e.id === upd.id ? upd : e))}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
