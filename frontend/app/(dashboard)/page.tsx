'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  FileText, MessageSquare, TrendingUp, LineChart,
  BookOpen, FlaskConical, ArrowRight, AlertTriangle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuthStore } from '@/lib/store/auth.store';
import { documentsApi } from '@/lib/api/documents.api';
import { formatCurrency } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  trend?: 'up' | 'down' | 'neutral';
}

function StatCard({ title, value, subtitle, icon: Icon, trend }: StatCardProps) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{title}</p>
            <p className={`text-2xl font-bold mt-1 ${
              trend === 'up' ? 'bull-text' : trend === 'down' ? 'bear-text' : 'text-foreground'
            }`}>{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
          </div>
          <div className="p-2 rounded-lg bg-primary/10">
            <Icon className="h-5 w-5 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

const QUICK_ACTIONS = [
  { href: '/documents', label: 'Upload Theory Doc', icon: FileText, desc: 'Add your trading PDF' },
  { href: '/chat', label: 'Ask Theory Bot', icon: MessageSquare, desc: 'RAG-powered Q&A' },
  { href: '/analysis', label: 'Analyse a Stock', icon: TrendingUp, desc: 'AI trade setup' },
  { href: '/paper-trades', label: 'Paper Trade', icon: LineChart, desc: 'Virtual trading' },
];

export default function DashboardPage() {
  const { user } = useAuthStore();
  const [docCount, setDocCount] = useState(0);

  useEffect(() => {
    documentsApi.list().then((docs) => setDocCount(docs.filter((d) => d.status === 'READY').length)).catch(() => {});
  }, []);

  const capital = user?.settings?.capital ?? 100000;

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">
          Good morning, {user?.name?.split(' ')[0]} 👋
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Your AI trade analysis assistant is ready.
        </p>
      </div>

      {/* Risk disclaimer */}
      <div className="flex items-start gap-3 p-4 rounded-lg bg-yellow-500/5 border border-yellow-500/20">
        <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5 shrink-0" />
        <p className="text-xs text-muted-foreground">
          <span className="text-yellow-500 font-medium">Risk reminder: </span>
          This platform provides analysis and decision support only. All outputs are for educational purposes.
          Never trade based solely on AI suggestions. Always apply your own judgement.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Capital"
          value={formatCurrency(capital)}
          subtitle="Available capital"
          icon={TrendingUp}
        />
        <StatCard
          title="Theory Docs"
          value={docCount}
          subtitle="Ready for RAG"
          icon={FileText}
        />
        <StatCard
          title="Paper Trades"
          value="0"
          subtitle="This month"
          icon={LineChart}
        />
        <StatCard
          title="Win Rate"
          value="—"
          subtitle="Not enough data"
          icon={FlaskConical}
        />
      </div>

      {/* Quick actions */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Quick Actions
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {QUICK_ACTIONS.map(({ href, label, icon: Icon, desc }) => (
            <Link key={href} href={href}>
              <Card className="hover:border-primary/40 hover:bg-card/80 transition-all cursor-pointer group">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{label}</p>
                    <p className="text-xs text-muted-foreground">{desc}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {/* Phase roadmap cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Recent Documents</CardTitle>
              <Link href="/documents">
                <Button variant="ghost" size="sm" className="text-xs h-7">
                  View all <ArrowRight className="h-3 w-3 ml-1" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {docCount === 0 ? (
              <div className="text-center py-6">
                <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No documents uploaded yet.</p>
                <Link href="/documents">
                  <Button variant="outline" size="sm" className="mt-3 text-xs">
                    Upload your first theory doc
                  </Button>
                </Link>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{docCount} document(s) ready for RAG queries.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Coming in Next Phases</CardTitle>
              <Badge variant="secondary" className="text-xs">Roadmap</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {[
                { label: 'Stock Analysis (AI)', phase: 'Phase 2' },
                { label: 'Strategy Rule Engine', phase: 'Phase 3' },
                { label: 'LangGraph Agents', phase: 'Phase 4' },
                { label: 'Backtesting Engine', phase: 'Phase 5' },
                { label: 'Paper Trading', phase: 'Phase 6' },
              ].map(({ label, phase }) => (
                <li key={label} className="flex items-center justify-between">
                  <span className="text-muted-foreground">{label}</span>
                  <Badge variant="outline" className="text-[10px]">{phase}</Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
