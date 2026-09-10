import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatGHS, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

type Entry = {
  id: string;
  created_at: string;
  category: string;
  kind: string;
  description: string | null;
  amount: number;
  direction: "in" | "out";
  status: string;
  method: string | null;
  reference: string | null;
  customer: string | null;
  customer_email: string | null;
  store_name: string | null;
};

const categories = [
  { value: "all", label: "All" },
  { value: "wallet", label: "Wallet & Payouts" },
  { value: "data_order", label: "Data Orders" },
  { value: "checker_order", label: "Result Checkers" },
  { value: "university_form", label: "University Forms" },
];

const kindLabel: Record<string, string> = {
  wallet_topup: "Wallet Top-up",
  data_purchase: "Data Purchase",
  agent_activation: "Agent Activation",
  withdrawal: "Withdrawal",
  store_sale: "Store Sale",
};

export default function AdminTransactionsPage() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("admin-transactions");
    setLoading(false);
    if (error || !data?.success) {
      toast.error(data?.error || error?.message || "Could not load transactions");
      return;
    }
    setEntries(data.entries || []);
    setStats(data.stats || null);
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return entries.filter((e) => {
      if (category !== "all" && e.category !== category) return false;
      if (!q) return true;
      return [e.kind, e.description, e.customer, e.customer_email, e.reference, e.store_name, e.method, e.status]
        .some((v) => String(v || "").toLowerCase().includes(q));
    });
  }, [entries, search, category]);

  const exportCsv = () => {
    if (filtered.length === 0) {
      toast.error("Nothing to export");
      return;
    }
    const header = ["Date", "Category", "Item", "Details", "Customer", "Store", "Method", "Reference", "Status", "Amount"];
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = [header.join(",")];
    filtered.forEach((e) => {
      lines.push([
        formatDateTime(e.created_at),
        e.category,
        kindLabel[e.kind] || e.kind,
        e.description || "",
        e.customer || "",
        e.store_name || "",
        e.method || "",
        e.reference || "",
        e.status,
        e.amount.toFixed(2),
      ].map(esc).join(","));
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transactions-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const statCards = [
    { label: "Wallet Top-ups", value: stats?.walletTopups },
    { label: "Paystack Top-ups", value: stats?.paystackTopups },
    { label: "Manual Top-ups", value: stats?.manualTopups },
    { label: "Data Revenue", value: stats?.dataRevenue },
    { label: "Checker Revenue", value: stats?.checkerRevenue },
    { label: "Form Revenue", value: stats?.formRevenue },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-3xl font-bold">Transactions</h2>
          <p className="text-muted-foreground mt-1">
            Every payment across the platform — wallet top-ups (Paystack & manual), data, checkers and forms.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            {loading ? "Loading..." : "Refresh"}
          </Button>
          <Button size="sm" onClick={exportCsv}>Export CSV</Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {statCards.map((s) => (
          <Card key={s.label} className="p-4">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{s.label}</p>
            <p className="text-xl font-bold mt-1">{formatGHS(Number(s.value || 0))}</p>
          </Card>
        ))}
      </div>

      <Card className="p-4 space-y-3">
        <Input
          placeholder="Search by customer, phone, reference, store, status..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          {categories.map((c) => (
            <Button
              key={c.value}
              size="sm"
              variant={category === c.value ? "default" : "outline"}
              onClick={() => setCategory(c.value)}
            >
              {c.label}
            </Button>
          ))}
        </div>
      </Card>

      <Card className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Details</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Store</TableHead>
              <TableHead>Method</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.slice(0, 500).map((e) => (
              <TableRow key={e.id}>
                <TableCell className="whitespace-nowrap text-sm">{formatDateTime(e.created_at)}</TableCell>
                <TableCell className="text-sm font-medium">{kindLabel[e.kind] || e.kind}</TableCell>
                <TableCell className="text-sm text-muted-foreground max-w-[240px] truncate">{e.description || "—"}</TableCell>
                <TableCell className="text-sm">{e.customer || "Guest"}</TableCell>
                <TableCell className="text-sm">{e.store_name || "Main site"}</TableCell>
                <TableCell className="text-sm capitalize">{e.method || "—"}</TableCell>
                <TableCell>
                  <Badge variant={["success", "delivered"].includes(e.status) ? "default" : e.status === "failed" ? "destructive" : "secondary"}>
                    {e.status}
                  </Badge>
                </TableCell>
                <TableCell className={cn("text-right font-bold whitespace-nowrap", e.direction === "out" && "text-muted-foreground")}>
                  {e.direction === "out" ? "−" : "+"}{formatGHS(Math.abs(e.amount))}
                </TableCell>
              </TableRow>
            ))}
            {!loading && filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-8">
                  No transactions found.
                </TableCell>
              </TableRow>
            )}
            {loading && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-8">
                  Loading transactions...
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        {filtered.length > 500 && (
          <p className="p-3 text-xs text-muted-foreground text-center">
            Showing the latest 500 of {filtered.length}. Export CSV for the full list.
          </p>
        )}
      </Card>
    </div>
  );
}
