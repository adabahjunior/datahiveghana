import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { formatDateTime, formatVolume, networkLabel } from "@/lib/format";
import { toast } from "sonner";

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [phoneSearch, setPhoneSearch] = useState("");

  const load = async () => {
    const { data } = await supabase.from("orders").select("*").order("created_at", { ascending: false }).limit(500);
    setOrders(data || []);
  };

  useEffect(() => {
    load();
  }, []);

  const retryOrder = async (order: any) => {
    const { error } = await supabase
      .from("orders")
      .update({ status: "processing", notes: `Retry queued by admin at ${new Date().toISOString()}` })
      .eq("id", order.id);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Retry queued. Order set to processing pending API integration.");
    load();
  };

  const filtered = useMemo(() => {
    if (!phoneSearch.trim()) return orders;
    return orders.filter((o) => (o.recipient_phone || "").toLowerCase().includes(phoneSearch.toLowerCase()));
  }, [orders, phoneSearch]);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-3xl font-bold">Orders</h2>
        <p className="text-muted-foreground mt-1">All orders across DataHive Ghana and agent stores.</p>
      </div>

      <Card className="p-4">
        <Input
          placeholder="Search by phone number"
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
              <TableHead>Data Volume</TableHead>
              <TableHead>Network</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((o) => (
              <TableRow key={o.id}>
                <TableCell className="text-sm">{formatDateTime(o.created_at)}</TableCell>
                <TableCell>{o.recipient_phone}</TableCell>
                <TableCell>{formatVolume(o.volume_mb)}</TableCell>
                <TableCell>{networkLabel[o.network]}</TableCell>
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
