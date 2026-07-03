'use client';

import { useEffect, useRef, useState } from 'react';
import { Send, Loader2, RotateCcw, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import MessageBubble from './MessageBubble';
import { chatApi } from '@/lib/api/chat.api';
import type { ChatMessage, SourceChunk } from '@/types';

interface DisplayMessage extends ChatMessage {
  sources?: SourceChunk[];
  found_in_theory?: boolean;
}

const STARTER_QUESTIONS = [
  'When should I take entry according to my breakout theory?',
  'What does my theory say about stop loss placement?',
  'How do I identify a valid support zone?',
  'When should I avoid trading sideways markets?',
];

export default function ChatInterface() {
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId] = useState(() => `session-${Date.now()}`);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMsg: DisplayMessage = { role: 'user', content: text.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const history: ChatMessage[] = messages
        .slice(-10)
        .map(({ role, content }) => ({ role, content }));

      const response = await chatApi.theoryChat(userMsg.content, sessionId, history);

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: response.answer,
          sources: response.sources,
          found_in_theory: response.found_in_theory,
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Sorry, something went wrong. Please check your connection and try again.',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const clearChat = () => setMessages([]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
        <div>
          <h1 className="text-lg font-semibold">Theory Chat</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Ask questions based on your uploaded trading theory documents
          </p>
        </div>
        {messages.length > 0 && (
          <Button variant="ghost" size="sm" onClick={clearChat} className="text-xs">
            <RotateCcw className="h-3 w-3 mr-1.5" />
            Clear chat
          </Button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-6 py-12">
            {/* Intro */}
            <div className="text-center max-w-md">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Info className="h-6 w-6 text-primary" />
              </div>
              <h2 className="text-base font-semibold mb-1">Theory-Grounded Q&A</h2>
              <p className="text-sm text-muted-foreground">
                I answer <strong>only</strong> from your uploaded trading documents.
                I will never hallucinate or give generic advice — if it&apos;s not in your docs, I&apos;ll say so.
              </p>
            </div>

            {/* Starter questions */}
            <div className="w-full max-w-lg space-y-2">
              <p className="text-xs text-muted-foreground text-center mb-3 uppercase tracking-wide font-medium">
                Try asking
              </p>
              {STARTER_QUESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => sendMessage(q)}
                  className="w-full text-left text-sm px-4 py-3 rounded-lg border border-border bg-card hover:bg-secondary hover:border-primary/30 transition-all"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg, i) => (
            <MessageBubble
              key={i}
              role={msg.role}
              content={msg.content}
              sources={msg.sources}
              found_in_theory={msg.found_in_theory}
            />
          ))
        )}

        {isLoading && (
          <div className="flex gap-3">
            <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center text-xs font-bold shrink-0">
              AI
            </div>
            <div className="bg-secondary rounded-2xl rounded-tl-sm px-4 py-3">
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" />
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:0.15s]" />
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:0.3s]" />
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-6 py-4 border-t border-border shrink-0">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask something from your trading theory..."
            disabled={isLoading}
            className="flex-1"
          />
          <Button type="submit" disabled={isLoading || !input.trim()} size="icon">
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </form>
        <p className="text-xs text-muted-foreground mt-2 text-center">
          Answers are grounded in your uploaded documents only · Never financial advice
        </p>
      </div>
    </div>
  );
}
