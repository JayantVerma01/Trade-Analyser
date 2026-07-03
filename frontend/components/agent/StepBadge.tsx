import { TrendingUp, BookOpen, DollarSign, CheckCircle2 } from 'lucide-react';
import type { AgentStep } from '@/lib/api/agent.api';

const TOOL_META: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  analyse_stock:          { label: 'Technical Analysis',   icon: TrendingUp,   color: 'text-primary' },
  search_theory_documents:{ label: 'Theory Search',        icon: BookOpen,     color: 'neutral-text' },
  get_price_quote:        { label: 'Price Quote',          icon: DollarSign,   color: 'bull-text'    },
};

const DEFAULT_META = { label: 'Tool Call', icon: CheckCircle2, color: 'text-muted-foreground' };

interface Props {
  step:  AgentStep;
  index: number;
}

export default function StepBadge({ step, index }: Props) {
  const meta   = TOOL_META[step.tool] ?? DEFAULT_META;
  const Icon   = meta.icon;

  return (
    <div className="flex items-start gap-3">
      {/* Line + number */}
      <div className="flex flex-col items-center shrink-0">
        <div className={`w-6 h-6 rounded-full bg-secondary flex items-center justify-center text-[10px] font-bold ${meta.color}`}>
          {index + 1}
        </div>
        <div className="w-px flex-1 bg-border mt-1 min-h-[1rem]" />
      </div>

      <div className="pb-4 flex-1 min-w-0">
        <div className={`flex items-center gap-1.5 text-xs font-medium ${meta.color}`}>
          <Icon className="h-3.5 w-3.5 shrink-0" />
          {meta.label}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{step.summary}</p>
      </div>
    </div>
  );
}
