import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/PageHeader";
import { formatGHS, formatDateTime } from "@/lib/format";
import { Badge } from "@/components/ui/badge";

const typeLabel: Record<string, string> = {
  wallet_topup: "Wallet Top-up",
  data_purchase: "Data Purchase",
  agent_activation: "Agent Activation",
  withdrawal: "Withdrawal",
  store_sale: "Store Sale",
};

export default function Transactions() {
  const { profile } = useAuth();
  const [txns, setTxns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;
    (async () => {
      const { data } = await supabase.from("transactions").select("*")
        .eq("user_id", profile.user_id).order("created_at", { ascending: false }).limit(100);
      setTxns(data || []);
      setLoading(false);
    })();
  }, [profile]);

  return (
    <div className="animate-fade-in">
      <PageHeader title="Transactions" description="A complete history of your wallet and purchases." />
      <Card className="overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-sm text-muted-foreground">Loading...</div>
        ) : txns.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">No transactions yet.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {txns.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="text-sm">{formatDateTime(t.created_at)}</TableCell>
                  <TableCell className="text-sm font-medium">{typeLabel[t.type] || t.type}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{t.description || "—"}</TableCell>
                  <TableCell className="text-right font-bold">
                    <span className={t.type === "wallet_topup" || t.type === "store_sale" ? "text-success" : ""}>
                      {t.type === "wallet_topup" || t.type === "store_sale" ? "+" : "−"}{formatGHS(Math.abs(Number(t.amount)))}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge variant={t.status === "success" ? "default" : t.status === "pending" ? "secondary" : "destructive"}
                      className={t.status === "success" ? "bg-success text-success-foreground hover:bg-success" : ""}>
                      {t.status}
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
