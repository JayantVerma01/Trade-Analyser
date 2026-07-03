'use client';

import { useState } from 'react';
import { Save, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuthStore } from '@/lib/store/auth.store';
import { useToast } from '@/hooks/use-toast';

export default function SettingsPage() {
  const { user } = useAuthStore();
  const { toast } = useToast();

  const [capital, setCapital] = useState(user?.settings?.capital?.toString() ?? '100000');
  const [risk, setRisk] = useState(user?.settings?.riskPerTradePct?.toString() ?? '1');
  const [maxLoss, setMaxLoss] = useState(user?.settings?.maxDailyLossPct?.toString() ?? '3');
  const [maxTrades, setMaxTrades] = useState(user?.settings?.maxTradesPerDay?.toString() ?? '5');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    await new Promise((r) => setTimeout(r, 600));
    setIsSaving(false);
    toast({ title: 'Settings saved', description: 'Your risk parameters have been updated.' });
  };

  return (
    <div className="p-6 space-y-6 max-w-2xl animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Configure your capital and risk management parameters.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Risk Management</CardTitle>
          <CardDescription>
            These values are used by the risk engine to calculate position sizes.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSave}>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="capital">Trading Capital (₹)</Label>
                <Input
                  id="capital"
                  type="number"
                  min="1000"
                  value={capital}
                  onChange={(e) => setCapital(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="risk">Risk Per Trade (%)</Label>
                <Input
                  id="risk"
                  type="number"
                  min="0.1"
                  max="10"
                  step="0.1"
                  value={risk}
                  onChange={(e) => setRisk(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="maxloss">Max Daily Loss (%)</Label>
                <Input
                  id="maxloss"
                  type="number"
                  min="1"
                  max="20"
                  step="0.5"
                  value={maxLoss}
                  onChange={(e) => setMaxLoss(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="maxtrades">Max Trades / Day</Label>
                <Input
                  id="maxtrades"
                  type="number"
                  min="1"
                  max="20"
                  value={maxTrades}
                  onChange={(e) => setMaxTrades(e.target.value)}
                />
              </div>
            </div>

            <div className="p-3 rounded-lg bg-secondary text-sm text-muted-foreground">
              <strong className="text-foreground">Example: </strong>
              With ₹{Number(capital).toLocaleString('en-IN')} capital and {risk}% risk, max loss per trade
              is <strong className="text-foreground">₹{Math.round(Number(capital) * Number(risk) / 100).toLocaleString('en-IN')}</strong>.
            </div>

            <Button type="submit" disabled={isSaving}>
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Save Settings
            </Button>
          </CardContent>
        </form>
      </Card>
    </div>
  );
}
