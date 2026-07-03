import { ChevronDown, ChevronUp, BookOpen, Image as ImageIcon, FileText } from 'lucide-react';
import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { cn } from '@/lib/utils';
import type { SourceChunk } from '@/types';

interface Props {
  role: 'user' | 'assistant';
  content: string;
  sources?: SourceChunk[];
  found_in_theory?: boolean;
}

export default function MessageBubble({ role, content, sources, found_in_theory }: Props) {
  const [showSources, setShowSources] = useState(false);
  const isUser = role === 'user';
  const hasSources = sources && sources.length > 0 && found_in_theory;

  return (
    <div className={cn('flex gap-3 animate-fade-in', isUser ? 'flex-row-reverse' : 'flex-row')}>
      {/* Avatar */}
      <div className={cn(
        'w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-xs font-bold',
        isUser ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'
      )}>
        {isUser ? 'U' : 'AI'}
      </div>

      {/* Bubble */}
      <div className={cn('max-w-[80%] space-y-2', isUser ? 'items-end' : 'items-start')}>
        <div className={cn(
          'rounded-2xl px-4 py-3 text-sm leading-relaxed',
          isUser
            ? 'bg-primary text-primary-foreground rounded-tr-sm'
            : 'bg-secondary text-foreground rounded-tl-sm'
        )}>
          {isUser ? (
            <p>{content}</p>
          ) : (
            <ReactMarkdown
              components={{
                p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>,
                ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>,
                strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                code: ({ children }) => (
                  <code className="bg-background/50 rounded px-1 py-0.5 text-xs font-mono">{children}</code>
                ),
              }}
            >
              {content}
            </ReactMarkdown>
          )}
        </div>

        {/* Source toggle — only for AI messages with theory sources */}
        {hasSources && (
          <div>
            <button
              onClick={() => setShowSources((v) => !v)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <BookOpen className="h-3 w-3" />
              {sources!.length} source{sources!.length > 1 ? 's' : ''} found
              {showSources ? (
                <ChevronUp className="h-3 w-3" />
              ) : (
                <ChevronDown className="h-3 w-3" />
              )}
            </button>

            {showSources && (
              <div className="mt-2 space-y-2">
                {sources!.map((s, i) => {
                  const isVisual = s.source_type === 'image';
                  return (
                    <div
                      key={i}
                      className={cn(
                        'rounded-lg border p-3 text-xs space-y-1',
                        isVisual
                          ? 'border-violet-500/30 bg-violet-500/5'
                          : 'border-border bg-card'
                      )}
                    >
                      <div className="flex items-center gap-2 text-muted-foreground flex-wrap">
                        <span className={cn(
                          'font-mono px-1.5 py-0.5 rounded flex items-center gap-1',
                          isVisual ? 'bg-violet-500/15 text-violet-300' : 'bg-secondary'
                        )}>
                          {isVisual ? <ImageIcon className="h-3 w-3" /> : <FileText className="h-3 w-3" />}
                          {isVisual
                            ? `Visual${s.page ? ` · Page ${s.page}` : ''}`
                            : `Chunk ${s.chunk_index + 1}`}
                        </span>
                        {s.is_builtin && (
                          <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                            Built-in
                          </span>
                        )}
                        <span>Score: {(s.score * 100).toFixed(0)}%</span>
                      </div>
                      <p className="text-muted-foreground leading-relaxed">{s.content}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
