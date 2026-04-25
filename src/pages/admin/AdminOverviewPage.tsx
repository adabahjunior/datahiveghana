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
  storeOrders: number;
  subagentStoreOrders: number;
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
    storeOrders: 0,
    subagentStoreOrders: 0,
  });

  useEffect(() => {
    const load = async () => {
      const [{ count: users }, { count: agents }, { data: orderPayload }] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("profiles").select("id", { count: "exact", head: true }).eq("is_agent", true),
        supabase.functions.invoke("admin-orders"),
      ]);

      const adminStats = orderPayload?.success ? orderPayload.stats : null;

      setStats({
        users: users || 0,
        agents: agents || 0,
        orders: adminStats?.orders || 0,
        successfulOrders: adminStats?.successfulOrders || 0,
        pendingOrders: adminStats?.pendingOrders || 0,
        failedOrders: adminStats?.failedOrders || 0,
        revenue: adminStats?.revenue || 0,
        totalWithdrawals: adminStats?.totalWithdrawals || 0,
        storeOrders: adminStats?.storeOrders || 0,
        subagentStoreOrders: adminStats?.subagentStoreOrders || 0,
      });
    };

    load();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold">Overview</h2>
        <p className="text-muted-foreground mt-1">Complete control center summary for BenzosData Ghana.</p>
      </div>

      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <Stat title="Total Users" value={stats.users.toString()} />
        <Stat title="Total Agents" value={stats.agents.toString()} />
        <Stat title="All Orders" value={stats.orders.toString()} />
        <Stat title="Revenue" value={formatGHS(stats.revenue)} />
        <Stat title="Agent Store Orders" value={stats.storeOrders.toString()} />
        <Stat title="Subagent Store Orders" value={stats.subagentStoreOrders.toString()} />
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

