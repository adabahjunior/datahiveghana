import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { formatDateTime, formatGHS, formatVolume, networkLabel } from "@/lib/format";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download } from "lucide-react";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";

const sourceLabel: Record<string, string> = {
  direct: "Direct",
  agent_store: "Agent Store",
  subagent_store: "Subagent Store",
};

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [phoneSearch, setPhoneSearch] = useState("");
  const [exportStatus, setExportStatus] = useState("all");

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

  const exportRows = () => {
    const rows = orders.filter((o) => {
      if (exportStatus === "all") return true;
      if (exportStatus === "successful") return o.status === "delivered";
      return o.status === exportStatus;
    });
    if (rows.length === 0) {
      toast.error("No orders match that status");
      return null;
    }
    return rows.map((o) => ({
      Date: formatDateTime(o.created_at),
      Phone: o.recipient_phone,
      Source: sourceLabel[o.source] || "Direct",
      Store: o.store_name || "-",
      Volume: formatVolume(o.volume_mb),
      Network: networkLabel[o.network],
      Amount: Number(o.amount_paid).toFixed(2),
      Status: o.status,
    }));
  };

  const exportExcel = () => {
    const rows = exportRows();
    if (!rows) return;
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = Object.keys(rows[0]).map((k) => ({ wch: Math.max(k.length + 2, 16) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Orders");
    XLSX.writeFile(wb, `orders-${exportStatus}-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const exportPdf = () => {
    const rows = exportRows();
    if (!rows) return;
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(14);
    doc.text(`Orders (${exportStatus === "all" ? "All" : exportStatus})`, 14, 14);
    doc.setFontSize(8);
    const headers = Object.keys(rows[0]);
    const colX = [14, 48, 78, 108, 148, 178, 208, 238];
    let y = 24;
    doc.setFont("helvetica", "bold");
    headers.forEach((h, i) => doc.text(h, colX[i], y));
    doc.setFont("helvetica", "normal");
    y += 6;
    rows.forEach((r) => {
      if (y > 195) { doc.addPage(); y = 14; }
      headers.forEach((h, i) => doc.text(String((r as any)[h]).slice(0, 24), colX[i], y));
      y += 5;
    });
    doc.save(`orders-${exportStatus}-${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-3xl font-bold">Orders</h2>
        <p className="text-muted-foreground mt-1">All orders across BenzosData Ghana and agent stores.</p>
      </div>

      <Card className="p-4 space-y-3">
        <Input
          placeholder="Search by phone number, store name, or source"
          value={phoneSearch}
          onChange={(e) => setPhoneSearch(e.target.value)}
        />
        <div className="flex flex-wrap items-center gap-2">
          <Select value={exportStatus} onValueChange={setExportStatus}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Order status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All orders</SelectItem>
              <SelectItem value="successful">Successful</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="processing">Processing</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" onClick={exportPdf}>
            <Download className="h-4 w-4 mr-1" /> PDF
          </Button>
          <Button size="sm" variant="outline" onClick={exportExcel}>
            <Download className="h-4 w-4 mr-1" /> Excel
          </Button>
        </div>
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

