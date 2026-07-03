'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, Pencil, Trash2, Save, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { journalApi, type JournalEntry as JEntry, type UpdateJournalPayload } from '@/lib/api/journal.api';

const MISTAKE_OPTIONS = [
  'FOMO entry', 'Early exit', 'Ignored SL', 'Overtraded',
  'No setup', 'Chased price', 'Wrong timeframe', 'Poor R:R',
];

const EMOTION_OPTIONS = [
  'Confident', 'Anxious', 'Greedy', 'Fearful',
  'Disciplined', 'Impatient', 'Calm', 'Frustrated',
];

function resultBadge(r: string) {
  if (r === 'WIN')      return <Badge className="text-[10px] bull-badge border">WIN</Badge>;
  if (r === 'LOSS')     return <Badge className="text-[10px] bear-badge border">LOSS</Badge>;
  return <Badge variant="secondary" className="text-[10px]">B/E</Badge>;
}

interface Props {
  entry:     JEntry;
  onDelete:  (id: string) => void;
  onUpdated: (updated: JEntry) => void;
}

export default function JournalEntry({ entry: e, onDelete, onUpdated }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [editing,  setEditing]  = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  const [notes,       setNotes]       = useState(e.notes ?? '');
  const [lessons,     setLessons]     = useState(e.lessonsLearned ?? '');
  const [mistakes,    setMistakes]    = useState<string[]>(e.mistakes ?? []);
  const [emotions,    setEmotions]    = useState<string[]>(e.emotionTags ?? []);

  const toggle = (arr: string[], val: string, set: (a: string[]) => void) =>
    arr.includes(val) ? set(arr.filter(x => x !== val)) : set([...arr, val]);

  const handleSave = async () => {
    setLoading(true); setError('');
    try {
      const updated = await journalApi.update(e.id, { notes, lessonsLearned: lessons, mistakes, emotionTags: emotions } as UpdateJournalPayload);
      setEditing(false);
      onUpdated(updated);
    } catch { setError('Failed to save'); }
    finally { setLoading(false); }
  };

  const handleDelete = async () => {
    if (!confirm('Delete this journal entry?')) return;
    setLoading(true);
    try { await journalApi.delete(e.id); onDelete(e.id); }
    catch { setError('Failed to delete'); setLoading(false); }
  };

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {resultBadge(e.result)}
            <span className="font-bold text-sm">{e.symbol}</span>
            <span className="text-xs text-muted-foreground truncate">{e.setupType}</span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {e.pnl != null && (
              <span className={`text-sm font-bold font-mono mr-2 ${e.pnl >= 0 ? 'bull-text' : 'bear-text'}`}>
                {e.pnl >= 0 ? '+' : ''}₹{Math.abs(e.pnl).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </span>
            )}
            <button onClick={() => setEditing(ed => !ed)} className="text-muted-foreground hover:text-foreground p-1 transition-colors">
              {editing ? <X className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
            </button>
            <button onClick={() => setExpanded(ex => !ex)} className="text-muted-foreground hover:text-foreground p-1 transition-colors">
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            <button onClick={handleDelete} disabled={loading} className="text-muted-foreground hover:text-destructive p-1 transition-colors">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Tags (read mode) */}
        {!editing && (e.mistakes.length > 0 || e.emotionTags.length > 0) && (
          <div className="flex flex-wrap gap-1">
            {e.mistakes.map(m => (
              <span key={m} className="text-[10px] px-1.5 py-0.5 rounded bg-destructive/10 text-destructive border border-destructive/20">{m}</span>
            ))}
            {e.emotionTags.map(t => (
              <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">{t}</span>
            ))}
          </div>
        )}

        {/* Expanded read view */}
        {expanded && !editing && (
          <div className="space-y-2 pt-2 border-t border-border text-xs text-muted-foreground">
            {e.paperTrade && (
              <p>Linked trade: <span className="text-foreground">{e.paperTrade.symbol} · {e.paperTrade.direction} @ ₹{Number(e.paperTrade.entryPrice)}</span></p>
            )}
            {e.notes && <p>Notes: <span className="text-foreground italic">{e.notes}</span></p>}
            {e.lessonsLearned && <p>Lessons: <span className="text-foreground">{e.lessonsLearned}</span></p>}
            <p>{new Date(e.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</p>
          </div>
        )}

        {/* Edit form */}
        {editing && (
          <div className="space-y-3 pt-2 border-t border-border">
            <div className="space-y-1">
              <label className="text-[11px] text-muted-foreground">Notes</label>
              <textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)}
                className="w-full bg-secondary/50 border border-border rounded px-2.5 py-1.5 text-xs resize-none focus:outline-none focus:border-primary" />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] text-muted-foreground">Lessons Learned</label>
              <textarea rows={2} value={lessons} onChange={e => setLessons(e.target.value)}
                className="w-full bg-secondary/50 border border-border rounded px-2.5 py-1.5 text-xs resize-none focus:outline-none focus:border-primary" />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] text-muted-foreground">Mistakes</label>
              <div className="flex flex-wrap gap-1">
                {MISTAKE_OPTIONS.map(m => (
                  <button key={m} onClick={() => toggle(mistakes, m, setMistakes)}
                    className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${mistakes.includes(m) ? 'bg-destructive/15 text-destructive border-destructive/30' : 'border-border text-muted-foreground hover:bg-secondary/50'}`}>
                    {m}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] text-muted-foreground">Emotions</label>
              <div className="flex flex-wrap gap-1">
                {EMOTION_OPTIONS.map(t => (
                  <button key={t} onClick={() => toggle(emotions, t, setEmotions)}
                    className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${emotions.includes(t) ? 'bg-primary/15 text-primary border-primary/30' : 'border-border text-muted-foreground hover:bg-secondary/50'}`}>
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {error && <p className="text-xs bear-text">{error}</p>}

            <div className="flex gap-2">
              <Button size="sm" className="flex-1 h-7 text-xs gap-1" onClick={handleSave} disabled={loading}>
                <Save className="h-3 w-3" /> {loading ? 'Saving…' : 'Save'}
              </Button>
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditing(false)}>Cancel</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
