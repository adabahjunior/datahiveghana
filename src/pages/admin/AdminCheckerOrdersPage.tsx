import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { formatDateTime, formatGHS } from "@/lib/format";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const sourceLabel = (row: any) => (row.store_id ? "Mini Store" : "Dashboard");

export default function AdminCheckerOrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [syncing, setSyncing] = useState<string | null>(null);

  const sync = async (id: string) => {
    setSyncing(id);
    const { data, error } = await supabase.functions.invoke("sync-checker-order", { body: { action: "sync_order", order_id: id } });
    setSyncing(null);
    if (error || !data?.ok) return toast.error(data?.error || error?.message || "Sync failed");
    toast.success(`Status: ${data.status}`);
    load();
  };

  const markSent = async (id: string) => {
    const { error } = await (supabase as any).from("checker_orders").update({ status: "delivered", provider_status: "sent" }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Marked as sent");
    load();
  };

  const load = async () => {
    const { data, error } = await (supabase as any)
      .from("checker_orders")
      .select("*, checker:checker_products(name,exam_type), store:agent_stores(store_name)")
      .order("created_at", { ascending: false })
      .limit(500);

    if (error) {
      toast.error(error.message || "Could not load checker orders");
      return;
    }

    setOrders(data || []);
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return orders;

    return orders.filter((o) => [
      o.recipient_phone,
      o.checker?.name,
      o.checker?.exam_type,
      o.store?.store_name,
      sourceLabel(o),
      o.paystack_reference,
    ].some((value) => String(value || "").toLowerCase().includes(term)));
  }, [orders, search]);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-3xl font-bold">Checker Orders</h2>
        <p className="text-muted-foreground mt-1">All checker sales across dashboard and mini-store channels.</p>
      </div>

      <Card className="p-4">
        <Input
          placeholder="Search by phone, checker type, store, source, or reference"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </Card>

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Checker</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Qty</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Store</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>ByteBoss</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} className="text-center text-sm text-muted-foreground py-10">No checker orders found.</TableCell>
              </TableRow>
            ) : filtered.map((o) => (
              <TableRow key={o.id}>
                <TableCell className="text-sm">{formatDateTime(o.created_at)}</TableCell>
                <TableCell>{o.checker?.name || "Checker"}</TableCell>
                <TableCell><Badge variant="outline">{String(o.checker?.exam_type || o.exam_type || "").toUpperCase()}</Badge></TableCell>
                <TableCell>{o.quantity || 1}</TableCell>
                <TableCell>{o.recipient_phone}</TableCell>
                <TableCell><Badge variant="secondary">{sourceLabel(o)}</Badge></TableCell>
                <TableCell>{o.store?.store_name || "-"}</TableCell>
                <TableCell>{formatGHS(Number(o.amount_paid || 0))}</TableCell>
                <TableCell><Badge variant={o.status === "failed" ? "destructive" : o.status === "delivered" ? "default" : "secondary"}>{o.status}</Badge></TableCell>
                <TableCell className="text-xs">
                  <div>{o.provider_status || "-"}</div>
                  {o.provider_order_id && <div className="text-muted-foreground">#{o.provider_order_id}</div>}
                </TableCell>
                <TableCell className="space-x-2 whitespace-nowrap">
                  {o.provider_order_id && (
                    <Button size="sm" variant="outline" disabled={syncing === o.id} onClick={() => sync(o.id)}>
                      {syncing === o.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Sync"}
                    </Button>
                  )}
                  {o.status !== "delivered" && (
                    <Button size="sm" variant="secondary" onClick={() => markSent(o.id)}>Mark Sent</Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
