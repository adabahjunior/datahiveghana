import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { formatDateTime, formatGHS, formatVolume, networkLabel } from "@/lib/format";
import { toast } from "sonner";

const sourceLabel: Record<string, string> = {
  direct: "Direct",
  agent_store: "Agent Store",
  subagent_store: "Subagent Store",
};

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [phoneSearch, setPhoneSearch] = useState("");

  const load = async () => {
    const { data, error } = await supabase.functions.invoke("admin-orders");
    if (error || !data?.success) {
      toast.error(data?.error || error?.message || "Could not load orders");
      return;
    }
    setOrders(data.orders || []);
  };

  useEffect(() => {
    load();
  }, []);

  const retryOrder = async (order: any) => {
    const { data, error } = await supabase.functions.invoke("retry-order", {
      body: { order_id: order.id },
    });

    if (error || !data?.success) {
      toast.error(data?.error || error?.message || "Retry failed");
      return;
    }

    toast.success("Retry processed successfully.");
    load();
  };

  const filtered = useMemo(() => {
    const term = phoneSearch.trim().toLowerCase();
    if (!term) return orders;
    return orders.filter((o) => [o.recipient_phone, o.store_name, sourceLabel[o.source]]
      .some((value) => String(value || "").toLowerCase().includes(term)));
  }, [orders, phoneSearch]);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-3xl font-bold">Orders</h2>
        <p className="text-muted-foreground mt-1">All orders across BenzosData Ghana and agent stores.</p>
      </div>

      <Card className="p-4">
        <Input
          placeholder="Search by phone number, store name, or source"
          value={phoneSearch}
          onChange={(e) => setPhoneSearch(e.target.value)}
        />
      </Card>

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Phone Number</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Store</TableHead>
              <TableHead>Data Volume</TableHead>
              <TableHead>Network</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((o) => (
              <TableRow key={o.id}>
                <TableCell className="text-sm">{formatDateTime(o.created_at)}</TableCell>
                <TableCell>{o.recipient_phone}</TableCell>
                <TableCell><Badge variant="outline">{sourceLabel[o.source] || "Direct"}</Badge></TableCell>
                <TableCell className="text-sm">{o.store_name || "-"}</TableCell>
                <TableCell>{formatVolume(o.volume_mb)}</TableCell>
                <TableCell>{networkLabel[o.network]}</TableCell>
                <TableCell>{formatGHS(o.amount_paid)}</TableCell>
                <TableCell>
                  <Badge variant={o.status === "failed" ? "destructive" : "secondary"}>{o.status}</Badge>
                </TableCell>
                <TableCell>
                  {o.status === "failed" ? (
                    <Button size="sm" onClick={() => retryOrder(o)}>Retry</Button>
                  ) : (
                    <span className="text-xs text-muted-foreground">-</span>
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

