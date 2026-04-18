import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { formatDateTime, formatGHS, networkLabel } from "@/lib/format";
import { toast } from "sonner";

export default function AdminWithdrawalsPage() {
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);

  const load = async () => {
    const [{ data: w }, { data: p }] = await Promise.all([
      supabase.from("withdrawals").select("*").order("created_at", { ascending: false }).limit(500),
      supabase.from("profiles").select("user_id,full_name,profit_balance"),
    ]);

    setWithdrawals(w || []);
    setProfiles(p || []);
  };

  useEffect(() => {
    load();
  }, []);

  const profileMap = useMemo(() => {
    const map = new Map<string, any>();
    profiles.forEach((p) => map.set(p.user_id, p));
    return map;
  }, [profiles]);

  const confirmSent = async (withdrawal: any) => {
    const profile = profileMap.get(withdrawal.agent_id);
    if (!profile) {
      toast.error("Agent profile not found");
      return;
    }

    const nextProfit = Math.max(0, Number(profile.profit_balance) - Number(withdrawal.amount));

    const { error: withdrawalError } = await supabase
      .from("withdrawals")
      .update({ status: "paid", processed_at: new Date().toISOString() })
      .eq("id", withdrawal.id);

    if (withdrawalError) {
      toast.error(withdrawalError.message);
      return;
    }

    const { error: profileError } = await supabase
      .from("profiles")
      .update({ profit_balance: nextProfit })
      .eq("user_id", withdrawal.agent_id);

    if (profileError) {
      toast.error(profileError.message);
      return;
    }

    toast.success("Withdrawal marked as sent and profit updated.");
    load();
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-3xl font-bold">Withdrawals</h2>
        <p className="text-muted-foreground mt-1">Review and settle agent withdrawal requests.</p>
      </div>

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Agent</TableHead>
              <TableHead>Current Profit</TableHead>
              <TableHead>Requested Amount</TableHead>
              <TableHead>MoMo Details</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {withdrawals.map((w) => {
              const profile = profileMap.get(w.agent_id);
              return (
                <TableRow key={w.id}>
                  <TableCell>{formatDateTime(w.created_at)}</TableCell>
                  <TableCell>{profile?.full_name || "Unknown Agent"}</TableCell>
                  <TableCell>{formatGHS(profile?.profit_balance || 0)}</TableCell>
                  <TableCell>{formatGHS(w.amount)}</TableCell>
                  <TableCell>{w.momo_number} ({w.momo_name}) - {networkLabel[w.network]}</TableCell>
                  <TableCell>
                    <Badge variant={w.status === "paid" ? "default" : w.status === "rejected" ? "destructive" : "secondary"}>
                      {w.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {w.status === "pending" ? (
                      <Button size="sm" onClick={() => confirmSent(w)}>Sent</Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
