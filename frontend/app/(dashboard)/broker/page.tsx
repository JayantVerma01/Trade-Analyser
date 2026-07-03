'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Plug, CheckCircle2, XCircle, RefreshCw, Unplug,
  TrendingUp, TrendingDown, ShieldAlert, Wallet, BarChart2, BookOpen
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  brokerApi,
  type BrokerName, type BrokerConnection, type BrokerAccount,
  type BrokerPosition, type BrokerOrder, type BrokerHolding,
} from '@/lib/api/broker.api';

// ─── Broker catalogue ──────────────────────────────────────────────────────

interface BrokerMeta {
  name:     BrokerName;
  label:    string;
  live:     boolean;
  needsKey: boolean;
  tagline:  string;
}

const BROKERS: BrokerMeta[] = [
  { name: 'MOCK',     label: 'MockBroker (Demo)',  live: true,  needsKey: false, tagline: 'Paper trading — no real money' },
  { name: 'ZERODHA',  label: 'Zerodha Kite',       live: false, needsKey: true,  tagline: 'Kite Connect API v3' },
  { name: 'UPSTOX',   label: 'Upstox',             live: false, needsKey: true,  tagline: 'Upstox API v2' },
  { name: 'DHAN',     label: 'Dhan',               live: false, needsKey: true,  tagline: 'DhanHQ Trading API' },
  { name: 'ANGEL',    label: 'Angel One SmartAPI', live: false, needsKey: true,  tagline: 'SmartConnect API' },
  { name: 'FYERS',    label: 'Fyers',              live: false, needsKey: true,  tagline: 'Fyers API v3' },
];

// ─── Sub-components ────────────────────────────────────────────────────────

type DashTab = 'account' | 'positions' | 'orders' | 'holdings';

function PnlCell({ val }: { val: number }) {
  return (
    <span className={`font-mono font-medium ${val >= 0 ? 'bull-text' : 'bear-text'}`}>
      {val >= 0 ? '+' : ''}₹{Math.abs(val).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
    </span>
  );
}

function statusBadge(s: string) {
  if (s === 'COMPLETE') return <Badge className="text-[10px] bull-badge border">COMPLETE</Badge>;
  if (s === 'REJECTED') return <Badge className="text-[10px] bear-badge border">REJECTED</Badge>;
  if (s === 'OPEN')     return <Badge className="text-[10px] bg-blue-500/15 text-blue-400 border border-blue-500/30">OPEN</Badge>;
  return <Badge variant="secondary" className="text-[10px]">{s}</Badge>;
}

// ─── Main page ─────────────────────────────────────────────────────────────

export default function BrokerPage() {
  const [connections, setConnections] = useState<BrokerConnection[]>([]);
  const [account,     setAccount]     = useState<BrokerAccount | null>(null);
  const [positions,   setPositions]   = useState<BrokerPosition[]>([]);
  const [orders,      setOrders]      = useState<BrokerOrder[]>([]);
  const [holdings,    setHoldings]    = useState<BrokerHolding[]>([]);

  const [tab,         setTab]         = useState<DashTab>('account');
  const [loading,     setLoading]     = useState(false);
  const [connecting,  setConnecting]  = useState<BrokerName | null>(null);
  const [error,       setError]       = useState('');

  const [apiKey,      setApiKey]      = useState('');
  const [apiSecret,   setApiSecret]   = useState('');
  const [showKeyForm, setShowKeyForm] = useState<BrokerName | null>(null);

  const hasActive = connections.some(c => c.isActive);
  const activeConn = connections.find(c => c.isActive);

  const loadConnections = useCallback(async () => {
    try { setConnections(await brokerApi.listConnections()); } catch {}
  }, []);

  const loadDashboard = useCallback(async () => {
    if (!hasActive) return;
    setLoading(true);
    try {
      const [acc, pos, ord, hold] = await Promise.all([
        brokerApi.getAccount(),
        brokerApi.getPositions(),
        brokerApi.getOrders(),
        brokerApi.getHoldings(),
      ]);
      setAccount(acc);
      setPositions(pos.positions);
      setOrders(ord.orders);
      setHoldings(hold.holdings);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Failed to load broker data');
    } finally {
      setLoading(false);
    }
  }, [hasActive]);

  useEffect(() => { loadConnections(); }, [loadConnections]);
  useEffect(() => { if (hasActive) loadDashboard(); }, [hasActive, loadDashboard]);

  const handleConnect = async (b: BrokerMeta) => {
    setError('');
    setConnecting(b.name);
    try {
      await brokerApi.connect({ brokerName: b.name, apiKey: apiKey || undefined, apiSecret: apiSecret || undefined });
      setShowKeyForm(null);
      setApiKey(''); setApiSecret('');
      await loadConnections();
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Connection failed');
    } finally {
      setConnecting(null);
    }
  };

  const handleDisconnect = async (id: string) => {
    if (!confirm('Disconnect this broker?')) return;
    try {
      await brokerApi.disconnect(id);
      setConnections(prev => prev.filter(c => c.id !== id));
      setAccount(null); setPositions([]); setOrders([]); setHoldings([]);
    } catch { setError('Failed to disconnect'); }
  };

  const openPositionPnl = positions.reduce((a, p) => a + p.pnl, 0);

  return (
    <div className="p-6 space-y-6 animate-fade-in max-w-5xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
          <Plug className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold leading-none">Broker Integration</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Connect a broker for live account data</p>
        </div>
      </div>

      {/* Safety disclaimer */}
      <div className="flex items-start gap-3 p-4 rounded-xl border border-amber-500/30 bg-amber-500/5">
        <ShieldAlert className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-semibold text-amber-300">No auto-trading — ever</p>
          <p className="text-muted-foreground text-xs mt-0.5">
            This platform only reads account data and displays analysis. Order placement always requires explicit manual
            confirmation from you. Automatic order execution is not implemented and will never be added to this system.
          </p>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {/* ── Broker cards ─────────────────────────────────────────────────── */}
      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Supported Brokers</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {BROKERS.map(b => {
            const conn = connections.find(c => c.brokerName === b.name);
            const isConnected = !!conn;
            return (
              <Card key={b.name} className={`${isConnected ? 'border-primary/40 bg-primary/5' : ''}`}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold">{b.label}</p>
                      <p className="text-[11px] text-muted-foreground">{b.tagline}</p>
                    </div>
                    {isConnected
                      ? <CheckCircle2 className="h-4 w-4 bull-text shrink-0 mt-0.5" />
                      : <Plug className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5 opacity-40" />}
                  </div>

                  {isConnected ? (
                    <div className="flex items-center gap-2">
                      <Badge className={`text-[10px] ${conn.isActive ? 'bull-badge border' : 'bg-secondary text-muted-foreground border'}`}>
                        {conn.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                      <button
                        onClick={() => handleDisconnect(conn.id)}
                        className="ml-auto text-xs text-muted-foreground hover:text-destructive flex items-center gap-1 transition-colors"
                      >
                        <Unplug className="h-3 w-3" /> Disconnect
                      </button>
                    </div>
                  ) : b.live ? (
                    <Button size="sm" className="w-full h-7 text-xs" onClick={() => handleConnect(b)} disabled={connecting === b.name}>
                      {connecting === b.name ? <><RefreshCw className="h-3 w-3 animate-spin mr-1" />Connecting…</> : 'Connect Demo'}
                    </Button>
                  ) : showKeyForm === b.name ? (
                    <div className="space-y-2">
                      <input placeholder="API Key" value={apiKey} onChange={e => setApiKey(e.target.value)}
                        className="w-full bg-secondary/50 border border-border rounded px-2 py-1 text-xs focus:outline-none focus:border-primary" />
                      <input placeholder="API Secret" type="password" value={apiSecret} onChange={e => setApiSecret(e.target.value)}
                        className="w-full bg-secondary/50 border border-border rounded px-2 py-1 text-xs focus:outline-none focus:border-primary" />
                      <div className="flex gap-2">
                        <Button size="sm" className="flex-1 h-7 text-xs" onClick={() => handleConnect(b)} disabled={!apiKey || connecting === b.name}>
                          Save
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setShowKeyForm(null)}>Cancel</Button>
                      </div>
                      <p className="text-[10px] text-muted-foreground">Keys are base64-encoded at rest. Use a dedicated read-only API key.</p>
                    </div>
                  ) : (
                    <Button size="sm" variant="outline" className="w-full h-7 text-xs" onClick={() => setShowKeyForm(b.name)}>
                      Connect
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* ── Dashboard (when connected) ───────────────────────────────────── */}
      {hasActive && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              {activeConn?.brokerName === 'MOCK' ? 'Mock Account Dashboard' : 'Live Account Dashboard'}
            </h2>
            <button onClick={loadDashboard} className="text-muted-foreground hover:text-foreground transition-colors">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Margin summary */}
          {account && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Card><CardContent className="pt-3 pb-3">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1"><Wallet className="h-3 w-3" />Total</p>
                <p className="text-lg font-bold font-mono mt-0.5">₹{account.margins.equity.total.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
              </CardContent></Card>
              <Card><CardContent className="pt-3 pb-3">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Available</p>
                <p className="text-lg font-bold font-mono mt-0.5 bull-text">₹{account.margins.equity.available.cash.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
              </CardContent></Card>
              <Card><CardContent className="pt-3 pb-3">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Used</p>
                <p className="text-lg font-bold font-mono mt-0.5">₹{account.margins.equity.used.debits.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
              </CardContent></Card>
              <Card><CardContent className="pt-3 pb-3">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Open P&L</p>
                <p className={`text-lg font-bold font-mono mt-0.5 ${openPositionPnl >= 0 ? 'bull-text' : 'bear-text'}`}>
                  {openPositionPnl >= 0 ? '+' : ''}₹{Math.abs(openPositionPnl).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                </p>
              </CardContent></Card>
            </div>
          )}

          {/* Tab bar */}
          <div className="flex gap-1 p-1 bg-secondary/50 rounded-lg w-fit">
            {([
              { key: 'account',   label: 'Profile',   icon: Wallet },
              { key: 'positions', label: `Positions (${positions.length})`, icon: BarChart2 },
              { key: 'orders',    label: `Orders (${orders.length})`,    icon: TrendingUp },
              { key: 'holdings',  label: `Holdings (${holdings.length})`, icon: BookOpen },
            ] as { key: DashTab; label: string; icon: any }[]).map(({ key, label, icon: Icon }) => (
              <button key={key} onClick={() => setTab(key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${tab === key ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                <Icon className="h-3 w-3" />{label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          {tab === 'account' && account && (
            <Card>
              <CardContent className="pt-4 space-y-2 text-sm">
                <div className="grid grid-cols-2 gap-y-2 gap-x-8">
                  <div><span className="text-muted-foreground text-xs">Client ID</span><p className="font-mono">{account.profile.client_id}</p></div>
                  <div><span className="text-muted-foreground text-xs">Broker</span><p>{account.profile.broker}</p></div>
                  <div><span className="text-muted-foreground text-xs">Exchanges</span><p>{account.profile.exchange.join(', ')}</p></div>
                  <div><span className="text-muted-foreground text-xs">Products</span><p>{account.profile.products.join(', ')}</p></div>
                  <div><span className="text-muted-foreground text-xs">M2M</span>
                    <p className={account.margins.equity.used.m2m >= 0 ? 'bull-text' : 'bear-text'}>
                      {account.margins.equity.used.m2m >= 0 ? '+' : ''}₹{Math.abs(account.margins.equity.used.m2m).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                    </p>
                  </div>
                </div>
                {account.profile.is_mock && (
                  <p className="text-[11px] text-amber-400/80 border-t border-border pt-2 mt-2">{account.profile.disclaimer}</p>
                )}
              </CardContent>
            </Card>
          )}

          {tab === 'positions' && (
            positions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No open positions</p>
            ) : (
              <Card><CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead><tr className="border-b border-border bg-secondary/40">
                      {['Symbol', 'Product', 'Qty', 'Avg', 'LTP', 'P&L', 'Day %'].map(h => (
                        <th key={h} className="px-3 py-2 text-left font-medium text-muted-foreground whitespace-nowrap">{h}</th>
                      ))}
                    </tr></thead>
                    <tbody>
                      {positions.map((p, i) => (
                        <tr key={i} className="border-b border-border last:border-0 hover:bg-secondary/20">
                          <td className="px-3 py-2 font-semibold">{p.tradingsymbol}</td>
                          <td className="px-3 py-2 text-muted-foreground">{p.product}</td>
                          <td className="px-3 py-2 font-mono">{p.quantity}</td>
                          <td className="px-3 py-2 font-mono">₹{p.average_price}</td>
                          <td className="px-3 py-2 font-mono">₹{p.last_price}</td>
                          <td className="px-3 py-2"><PnlCell val={p.pnl} /></td>
                          <td className={`px-3 py-2 font-mono ${p.day_change_pct >= 0 ? 'bull-text' : 'bear-text'}`}>
                            {p.day_change_pct >= 0 ? '+' : ''}{p.day_change_pct.toFixed(2)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent></Card>
            )
          )}

          {tab === 'orders' && (
            orders.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No orders today</p>
            ) : (
              <Card><CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead><tr className="border-b border-border bg-secondary/40">
                      {['Symbol', 'Type', 'B/S', 'Qty', 'Price', 'Status', 'Time'].map(h => (
                        <th key={h} className="px-3 py-2 text-left font-medium text-muted-foreground whitespace-nowrap">{h}</th>
                      ))}
                    </tr></thead>
                    <tbody>
                      {orders.map((o, i) => (
                        <tr key={i} className="border-b border-border last:border-0 hover:bg-secondary/20">
                          <td className="px-3 py-2 font-semibold">{o.tradingsymbol}</td>
                          <td className="px-3 py-2 text-muted-foreground">{o.order_type}</td>
                          <td className={`px-3 py-2 font-medium ${o.transaction_type === 'BUY' ? 'bull-text' : 'bear-text'}`}>{o.transaction_type}</td>
                          <td className="px-3 py-2 font-mono">{o.quantity}</td>
                          <td className="px-3 py-2 font-mono">₹{o.price}</td>
                          <td className="px-3 py-2">{statusBadge(o.status)}</td>
                          <td className="px-3 py-2 text-muted-foreground">{new Date(o.placed_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent></Card>
            )
          )}

          {tab === 'holdings' && (
            holdings.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No holdings</p>
            ) : (
              <Card><CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead><tr className="border-b border-border bg-secondary/40">
                      {['Symbol', 'Qty', 'Avg Cost', 'LTP', 'P&L', 'P&L %'].map(h => (
                        <th key={h} className="px-3 py-2 text-left font-medium text-muted-foreground whitespace-nowrap">{h}</th>
                      ))}
                    </tr></thead>
                    <tbody>
                      {holdings.map((h, i) => (
                        <tr key={i} className="border-b border-border last:border-0 hover:bg-secondary/20">
                          <td className="px-3 py-2 font-semibold">{h.tradingsymbol}</td>
                          <td className="px-3 py-2 font-mono">{h.quantity}</td>
                          <td className="px-3 py-2 font-mono">₹{h.average_price}</td>
                          <td className="px-3 py-2 font-mono">₹{h.last_price}</td>
                          <td className="px-3 py-2"><PnlCell val={h.pnl} /></td>
                          <td className={`px-3 py-2 font-mono ${h.pnl_pct >= 0 ? 'bull-text' : 'bear-text'}`}>
                            {h.pnl_pct >= 0 ? '+' : ''}{h.pnl_pct.toFixed(2)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent></Card>
            )
          )}
        </div>
      )}
    </div>
  );
}
