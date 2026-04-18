import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/PageHeader";
import { formatGHS, formatDateTime, networkLabel, formatVolume } from "@/lib/format";
import { toast } from "sonner";
import { Users, Package, ShoppingBag, Banknote, MessageSquareWarning } from "lucide-react";

export default function Admin() {
  const [stats, setStats] = useState({ users: 0, agents: 0, orders: 0, revenue: 0 });
  const [orders, setOrders] = useState<any[]>([]);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [packages, setPackages] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);

  const load = async () => {
    const [{ count: uc }, { count: ac }, { data: ords }, { data: wd }, { data: us }, { data: pk }, { data: rp }] = await Promise.all([
      supabase.from("profiles").select("*", { count: "exact", head: true }),
      supabase.from("profiles").select("*", { count: "exact", head: true }).eq("is_agent", true),
      supabase.from("orders").select("*").order("created_at", { ascending: false }).limit(50),
      supabase.from("withdrawals").select("*").order("created_at", { ascending: false }).limit(50),
      supabase.from("profiles").select("*").order("created_at", { ascending: false }).limit(50),
      supabase.from("data_packages").select("*").order("network").order("display_order"),
      supabase.from("issue_reports").select("*").order("created_at", { ascending: false }).limit(50),
    ]);
    const revenue = (ords || []).reduce((s, o) => s + Number(o.amount_paid), 0);
    setStats({ users: uc || 0, agents: ac || 0, orders: ords?.length || 0, revenue });
    setOrders(ords || []);
    setWithdrawals(wd || []);
    setUsers(us || []);
    setPackages(pk || []);
    setReports(rp || []);
  };

  useEffect(() => { load(); }, []);

  const updateOrder = async (id: string, status: string) => {
    const { error } = await supabase.from("orders").update({ status }).eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Updated"); load(); }
  };

  const updateWithdrawal = async (id: string, status: string) => {
    const { error } = await supabase.from("withdrawals")
      .update({ status, processed_at: new Date().toISOString() }).eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Updated"); load(); }
  };

  const togglePackage = async (id: string, is_active: boolean) => {
    const { error } = await supabase.from("data_packages").update({ is_active: !is_active }).eq("id", id);
    if (error) toast.error(error.message); else load();
  };

  return (
    <div className="animate-fade-in">
      <PageHeader title="Admin Dashboard" description="Full control over users, orders, and payouts." />

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        <Stat icon={Users} label="Total Users" value={stats.users.toString()} />
        <Stat icon={Users} label="Agents" value={stats.agents.toString()} />
        <Stat icon={ShoppingBag} label="Recent Orders" value={stats.orders.toString()} />
        <Stat icon={Banknote} label="Recent Revenue" value={formatGHS(stats.revenue)} />
      </div>

      <Tabs defaultValue="orders">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-5 mb-6">
          <TabsTrigger value="orders">Orders</TabsTrigger>
          <TabsTrigger value="withdrawals">Withdrawals</TabsTrigger>
          <TabsTrigger value="packages">Packages</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="orders">
          <Card className="overflow-hidden">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Date</TableHead><TableHead>Phone</TableHead><TableHead>Network</TableHead>
                <TableHead>Bundle</TableHead><TableHead>Amount</TableHead><TableHead>Status</TableHead><TableHead>Action</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {orders.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="text-sm">{formatDateTime(o.created_at)}</TableCell>
                    <TableCell className="text-sm">{o.recipient_phone}</TableCell>
                    <TableCell className="text-sm">{networkLabel[o.network]}</TableCell>
                    <TableCell className="text-sm">{formatVolume(o.volume_mb)}</TableCell>
                    <TableCell className="font-bold">{formatGHS(o.amount_paid)}</TableCell>
                    <TableCell><Badge variant="secondary">{o.status}</Badge></TableCell>
                    <TableCell>
                      {o.status !== "delivered" && (
                        <Button size="sm" variant="outline" onClick={() => updateOrder(o.id, "delivered")}>Mark delivered</Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="withdrawals">
          <Card className="overflow-hidden">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Date</TableHead><TableHead>Amount</TableHead><TableHead>MoMo</TableHead>
                <TableHead>Network</TableHead><TableHead>Status</TableHead><TableHead>Action</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {withdrawals.map((w) => (
                  <TableRow key={w.id}>
                    <TableCell className="text-sm">{formatDateTime(w.created_at)}</TableCell>
                    <TableCell className="font-bold">{formatGHS(w.amount)}</TableCell>
                    <TableCell className="text-sm">{w.momo_number} ({w.momo_name})</TableCell>
                    <TableCell className="text-sm">{networkLabel[w.network]}</TableCell>
                    <TableCell><Badge variant="secondary">{w.status}</Badge></TableCell>
                    <TableCell className="space-x-2">
                      {w.status === "pending" && (
                        <>
                          <Button size="sm" onClick={() => updateWithdrawal(w.id, "paid")}>Mark paid</Button>
                          <Button size="sm" variant="destructive" onClick={() => updateWithdrawal(w.id, "rejected")}>Reject</Button>
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="packages">
          <Card className="overflow-hidden">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Network</TableHead><TableHead>Name</TableHead><TableHead>Volume</TableHead>
                <TableHead>Guest Price</TableHead><TableHead>Agent Price</TableHead><TableHead>Active</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {packages.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="text-sm">{networkLabel[p.network]}</TableCell>
                    <TableCell className="text-sm font-medium">{p.name}</TableCell>
                    <TableCell className="text-sm">{formatVolume(p.volume_mb)}</TableCell>
                    <TableCell>{formatGHS(p.guest_price)}</TableCell>
                    <TableCell>{formatGHS(p.agent_price)}</TableCell>
                    <TableCell>
                      <Button size="sm" variant={p.is_active ? "default" : "outline"} onClick={() => togglePackage(p.id, p.is_active)}>
                        {p.is_active ? "Active" : "Inactive"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="users">
          <Card className="overflow-hidden">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Phone</TableHead>
                <TableHead>Wallet</TableHead><TableHead>Profit</TableHead><TableHead>Agent</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="text-sm font-medium">{u.full_name || "—"}</TableCell>
                    <TableCell className="text-sm">{u.email}</TableCell>
                    <TableCell className="text-sm">{u.phone || "—"}</TableCell>
                    <TableCell>{formatGHS(u.wallet_balance)}</TableCell>
                    <TableCell>{formatGHS(u.profit_balance)}</TableCell>
                    <TableCell>{u.is_agent ? <Badge>Agent</Badge> : "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="reports">
          <Card>
            {reports.length === 0 ? <div className="p-12 text-center text-sm text-muted-foreground">No reports.</div> : (
              <div className="divide-y divide-border">
                {reports.map((r) => (
                  <div key={r.id} className="p-5">
                    <div className="flex justify-between items-start mb-2">
                      <p className="font-bold">{r.subject}</p>
                      <span className="text-xs text-muted-foreground">{formatDateTime(r.created_at)}</span>
                    </div>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{r.message}</p>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

const Stat = ({ icon: Icon, label, value }: any) => (
  <Card className="p-5">
    <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center mb-3"><Icon className="h-4 w-4" /></div>
    <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
    <p className="text-2xl font-bold mt-1">{value}</p>
  </Card>
);
