import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/PageHeader";
import { formatGHS, formatDateTime, networkLabel } from "@/lib/format";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const MIN = 50;

export default function Withdrawal() {
  const { profile, refreshProfile } = useAuth();
  const [form, setForm] = useState({ amount: "", momo_number: "", momo_name: "", network: "mtn" });
  const [submitting, setSubmitting] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [currentProfit, setCurrentProfit] = useState(0);

  const loadCurrentProfit = async () => {
    if (!profile?.user_id) return;

    const { data } = await supabase
      .from("profiles")
      .select("profit_balance")
      .eq("user_id", profile.user_id)
      .maybeSingle();

    setCurrentProfit(Number(data?.profit_balance || 0));
  };

  const load = async () => {
    if (!profile) return;

    await loadCurrentProfit();

    const { data } = await supabase.from("withdrawals").select("*").eq("agent_id", profile.user_id)
      .order("created_at", { ascending: false }).limit(50);
    setHistory(data || []);
  };

  useEffect(() => { load(); }, [profile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(form.amount);
    if (isNaN(amt) || amt < MIN) { toast.error(`Minimum withdrawal is ${formatGHS(MIN)}`); return; }
    if (amt > currentProfit) { toast.error("Amount exceeds profit balance"); return; }
    setSubmitting(true);
    const { data, error } = await supabase.functions.invoke("request-withdrawal", { body: { ...form, amount: amt } });
    setSubmitting(false);
    if (error || !data?.success) {
      toast.error(data?.error || error?.message || "Failed to submit");
      return;
    }
    toast.success("Your withdrawal request has been received. Funds will be sent within 24–48 hours.");
    setForm({ amount: "", momo_number: "", momo_name: "", network: "mtn" });
    await refreshProfile();
    await load();
  };

  return (
    <div className="animate-fade-in">
      <PageHeader title="Withdrawal" description="Cash out your profit balance to mobile money." />

      <div className="grid lg:grid-cols-3 gap-6 mb-8">
        <Card className="p-6 bg-success text-success-foreground border-0">
          <p className="text-xs uppercase tracking-wider opacity-80">Current Profit</p>
          <p className="text-3xl font-bold mt-2">{formatGHS(currentProfit)}</p>
        </Card>

        <Card className="lg:col-span-2 p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Amount (min {formatGHS(MIN)})</Label>
                <Input type="number" step="0.01" min={MIN} required value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Network</Label>
                <Select value={form.network} onValueChange={(v) => setForm({ ...form, network: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mtn">MTN</SelectItem>
                    <SelectItem value="telecel">Telecel</SelectItem>
                    <SelectItem value="airteltigo_ishare">AirtelTigo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Mobile Money Number</Label>
              <Input required placeholder="0244000000" value={form.momo_number}
                onChange={(e) => setForm({ ...form, momo_number: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Mobile Money Name</Label>
              <Input required value={form.momo_name}
                onChange={(e) => setForm({ ...form, momo_name: e.target.value })} />
            </div>
            <Button type="submit" disabled={submitting} className="w-full">
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />} Request Withdrawal
            </Button>
          </form>
        </Card>
      </div>

      <h3 className="font-bold mb-3">Withdrawal History</h3>
      <Card className="overflow-hidden">
        {history.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">No withdrawals yet.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Network</TableHead>
                <TableHead>MoMo</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.map((w) => (
                <TableRow key={w.id}>
                  <TableCell className="text-sm">{formatDateTime(w.created_at)}</TableCell>
                  <TableCell className="font-bold">{formatGHS(w.amount)}</TableCell>
                  <TableCell className="text-sm">{networkLabel[w.network]}</TableCell>
                  <TableCell className="text-sm">{w.momo_number} ({w.momo_name})</TableCell>
                  <TableCell>
                    <Badge variant={w.status === "paid" ? "default" : w.status === "rejected" ? "destructive" : "secondary"}
                      className={w.status === "paid" ? "bg-success text-success-foreground hover:bg-success" : ""}>
                      {w.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
