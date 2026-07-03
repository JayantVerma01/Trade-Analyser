'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  MessageSquare,
  FileText,
  TrendingUp,
  Settings2,
  FlaskConical,
  BookOpen,
  LineChart,
  Plug,
  LogOut,
  ChevronRight,
  Bot,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/lib/store/auth.store';
import { Separator } from '@/components/ui/separator';

const NAV_ITEMS = [
  { href: '/',                label: 'Dashboard',         icon: LayoutDashboard },
  { href: '/chat',            label: 'Theory Chat',       icon: MessageSquare },
  { href: '/documents',       label: 'Documents',         icon: FileText },
  { href: '/analysis',        label: 'Stock Analysis',    icon: TrendingUp },
  { href: '/recommendations', label: 'Recommendations',   icon: Sparkles },
  { href: '/agent',           label: 'AI Agent',          icon: Bot },
  { href: '/strategies',      label: 'Strategies',        icon: Settings2 },
  { href: '/backtest',        label: 'Backtesting',       icon: FlaskConical },
  { href: '/paper-trades',    label: 'Paper Trading',     icon: LineChart },
  { href: '/journal',         label: 'Trade Journal',     icon: BookOpen },
];

const BOTTOM_ITEMS = [
  { href: '/settings', label: 'Settings', icon: Settings2 },
  { href: '/broker', label: 'Broker', icon: Plug },
];

interface NavItemProps {
  href: string;
  label: string;
  icon: React.ElementType;
  active: boolean;
  comingSoon?: boolean;
}

function NavItem({ href, label, icon: Icon, active, comingSoon }: NavItemProps) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex shrink-0 items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors group',
        active
          ? 'bg-primary/10 text-primary'
          : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="flex-1">{label}</span>
      {comingSoon && (
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">
          Soon
        </span>
      )}
      {active && <ChevronRight className="h-3 w-3 opacity-50" />}
    </Link>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuthStore();

  const handleLogout = () => {
    logout();
    document.cookie = 'trade_token=; path=/; max-age=0';
    router.push('/login');
  };

  return (
    <aside className="sticky top-0 flex h-dvh w-60 shrink-0 flex-col border-r border-border bg-card">
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-4 h-16 border-b border-border">
        <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold text-xs">
          TA
        </div>
        <div>
          <p className="text-sm font-semibold leading-none">Trade Analyser</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">AI · Indian Markets</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex min-h-0 flex-1 flex-col overflow-y-auto px-3 py-4 space-y-0.5">
        {NAV_ITEMS.map((item) => (
          <NavItem
            key={item.href}
            {...item}
            active={
              item.href === '/'
                ? pathname === '/'
                : pathname === item.href || pathname.startsWith(`${item.href}/`)
            }
          />
        ))}

        <Separator className="my-3" />

        {BOTTOM_ITEMS.map((item) => (
          <NavItem
            key={item.href}
            {...item}
            active={pathname.startsWith(item.href)}
          />
        ))}
      </nav>

      {/* User footer */}
      <div className="p-3 border-t border-border">
        <div className="flex items-center gap-2.5 px-2 py-2 rounded-md">
          <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs font-bold">
            {user?.name?.[0]?.toUpperCase() ?? 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium truncate">{user?.name ?? 'User'}</p>
            <p className="text-[10px] text-muted-foreground truncate">{user?.email ?? ''}</p>
          </div>
          <button
            onClick={handleLogout}
            className="text-muted-foreground hover:text-foreground transition-colors"
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
