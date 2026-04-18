import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { formatGHS } from "@/lib/format";

type Stats = {
  users: number;
  agents: number;
  orders: number;
  successfulOrders: number;
  pendingOrders: number;
  failedOrders: number;
  revenue: number;
  totalWithdrawals: number;
};

export default function AdminOverviewPage() {
  const [stats, setStats] = useState<Stats>({
    users: 0,
    agents: 0,
    orders: 0,
    successfulOrders: 0,
    pendingOrders: 0,
    failedOrders: 0,
    revenue: 0,
    totalWithdrawals: 0,
  });

  useEffect(() => {
    const load = async () => {
      const [{ count: users }, { count: agents }, { data: orders }, { data: withdrawals }] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("profiles").select("id", { count: "exact", head: true }).eq("is_agent", true),
        supabase.from("orders").select("status,amount_paid"),
        supabase.from("withdrawals").select("amount,status"),
      ]);

      const allOrders = orders || [];
      const successfulOrders = allOrders.filter((o) => o.status === "delivered").length;
      const pendingOrders = allOrders.filter((o) => o.status === "pending" || o.status === "processing").length;
      const failedOrders = allOrders.filter((o) => o.status === "failed").length;
      const revenue = allOrders.filter((o) => o.status !== "failed").reduce((sum, order) => sum + Number(order.amount_paid || 0), 0);
      const totalWithdrawals = (withdrawals || []).filter((w) => w.status === "paid").reduce((sum, w) => sum + Number(w.amount || 0), 0);

      setStats({
        users: users || 0,
        agents: agents || 0,
        orders: allOrders.length,
        successfulOrders,
        pendingOrders,
        failedOrders,
        revenue,
        totalWithdrawals,
      });
    };

    load();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold">Overview</h2>
        <p className="text-muted-foreground mt-1">Complete control center summary for DataHive Ghana.</p>
      </div>

      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <Stat title="Total Users" value={stats.users.toString()} />
        <Stat title="Total Agents" value={stats.agents.toString()} />
        <Stat title="All Orders" value={stats.orders.toString()} />
        <Stat title="Revenue" value={formatGHS(stats.revenue)} />
        <Stat title="Delivered Orders" value={stats.successfulOrders.toString()} />
        <Stat title="Pending Orders" value={stats.pendingOrders.toString()} />
        <Stat title="Failed Orders" value={stats.failedOrders.toString()} />
        <Stat title="Paid Withdrawals" value={formatGHS(stats.totalWithdrawals)} />
      </div>
    </div>
  );
}

const Stat = ({ title, value }: { title: string; value: string }) => (
  <Card className="p-5">
    <p className="text-xs uppercase tracking-wider text-muted-foreground">{title}</p>
    <p className="text-2xl font-bold mt-1">{value}</p>
  </Card>
);
