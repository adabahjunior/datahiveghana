import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/PageHeader";
import { formatGHS, formatDateTime, networkLabel, formatVolume } from "@/lib/format";
import { Badge } from "@/components/ui/badge";

export default function MyStoreOrders() {
  const { profile } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;
    (async () => {
      const { data: store } = await supabase.from("agent_stores").select("id").eq("agent_id", profile.user_id).maybeSingle();
      if (!store) { setLoading(false); return; }
      const { data } = await supabase.from("orders").select("*").eq("store_id", store.id)
        .order("created_at", { ascending: false }).limit(200);
      setOrders(data || []);
      setLoading(false);
    })();
  }, [profile]);

  const totalRevenue = orders.reduce((s, o) => s + Number(o.amount_paid), 0);
  const totalProfit = orders.reduce((s, o) => s + Number(o.agent_profit), 0);

  return (
    <div className="animate-fade-in">
      <PageHeader title="Store Orders" description="Every order placed on your mini-website." />

      <div className="grid sm:grid-cols-3 gap-5 mb-8">
        <Card className="p-5"><p className="text-xs text-muted-foreground uppercase">Total Orders</p><p className="text-2xl font-bold mt-1">{orders.length}</p></Card>
        <Card className="p-5"><p className="text-xs text-muted-foreground uppercase">Revenue</p><p className="text-2xl font-bold mt-1">{formatGHS(totalRevenue)}</p></Card>
        <Card className="p-5"><p className="text-xs text-muted-foreground uppercase">Profit</p><p className="text-2xl font-bold mt-1 text-success">{formatGHS(totalProfit)}</p></Card>
      </div>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-sm text-muted-foreground">Loading...</div>
        ) : orders.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">No store orders yet.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Network</TableHead>
                <TableHead>Bundle</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Profit</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="text-sm">{formatDateTime(o.created_at)}</TableCell>
                  <TableCell className="text-sm font-medium">{o.recipient_phone}</TableCell>
                  <TableCell className="text-sm">{networkLabel[o.network]}</TableCell>
                  <TableCell className="text-sm">{formatVolume(o.volume_mb)}</TableCell>
                  <TableCell className="text-right font-bold">{formatGHS(o.amount_paid)}</TableCell>
                  <TableCell className="text-right text-success font-medium">{formatGHS(o.agent_profit)}</TableCell>
                  <TableCell>
                    <Badge variant={o.status === "delivered" ? "default" : o.status === "pending" ? "secondary" : "destructive"}
                      className={o.status === "delivered" ? "bg-success text-success-foreground hover:bg-success" : ""}>
                      {o.status}
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
