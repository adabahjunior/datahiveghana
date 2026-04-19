import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/PageHeader";
import { formatGHS, formatDateTime, networkLabel, formatVolume } from "@/lib/format";
import { Wallet, TrendingUp, ShoppingBag, Store, ArrowUpRight } from "lucide-react";

export default function Dashboard() {
  const { profile, isSeller } = useAuth();
  const [stats, setStats] = useState({ totalSpent: 0, totalOrders: 0, storeRevenue: 0, storeOrders: 0 });
  const [recent, setRecent] = useState<any[]>([]);

  useEffect(() => {
    if (!profile) return;
    (async () => {
      const { data: orders } = await supabase
        .from("orders")
        .select("*")
        .eq("buyer_user_id", profile.user_id)
        .order("created_at", { ascending: false })
        .limit(5);
      setRecent(orders || []);

      const { data: allOrders } = await supabase
        .from("orders").select("amount_paid").eq("buyer_user_id", profile.user_id);
      const totalSpent = (allOrders || []).reduce((s, o) => s + Number(o.amount_paid), 0);
      const totalOrders = allOrders?.length || 0;

      let storeRevenue = 0, storeOrders = 0;
      if (isSeller) {
        const { data: store } = await supabase
          .from("agent_stores").select("id").eq("agent_id", profile.user_id).maybeSingle();
        if (store) {
          const { data: so } = await supabase.from("orders").select("amount_paid").eq("store_id", store.id);
          storeRevenue = (so || []).reduce((s, o) => s + Number(o.amount_paid), 0);
          storeOrders = so?.length || 0;
        }
      }
      setStats({ totalSpent, totalOrders, storeRevenue, storeOrders });
    })();
  }, [profile, isSeller]);

  if (!profile) return null;

  return (
    <div className="animate-fade-in">
      <PageHeader
        title={`Welcome, ${profile.full_name || "there"}`}
        description="Here's a quick look at your account today."
      />

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-10">
        <StatCard icon={Wallet} label="Wallet Balance" value={formatGHS(profile.wallet_balance)} accent />
        <StatCard icon={ShoppingBag} label="Total Orders" value={stats.totalOrders.toString()} />
        <StatCard icon={TrendingUp} label="Total Spent" value={formatGHS(stats.totalSpent)} />
        {isSeller ? (
          <StatCard icon={Store} label="Store Revenue" value={formatGHS(stats.storeRevenue)} sub={`${stats.storeOrders} orders`} />
        ) : (
          <StatCard icon={Store} label="Become an Agent" value="Unlock" sub="Run your own store" link="/my-store" />
        )}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-bold text-lg">Recent Orders</h3>
            <Button variant="ghost" size="sm" asChild><Link to="/transactions">View all <ArrowUpRight className="h-3 w-3 ml-1" /></Link></Button>
          </div>
          {recent.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              No orders yet. <Link to="/buy/mtn" className="text-primary font-medium hover:underline">Buy your first bundle</Link>
            </div>
          ) : (
            <div className="space-y-3">
              {recent.map((o) => (
                <div key={o.id} className="flex items-center justify-between py-3 border-b border-border last:border-0">
                  <div>
                    <p className="font-medium text-sm">{networkLabel[o.network]} • {formatVolume(o.volume_mb)}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{o.recipient_phone} • {formatDateTime(o.created_at)}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">{formatGHS(o.amount_paid)}</p>
                    <p className="text-xs text-muted-foreground capitalize">{o.status}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-6">
          <h3 className="font-bold text-lg mb-5">Quick Actions</h3>
          <div className="space-y-2">
            <Button variant="outline" className="w-full justify-start" asChild><Link to="/wallet">Top Up Wallet</Link></Button>
            <Button variant="outline" className="w-full justify-start" asChild><Link to="/buy/mtn">Buy MTN Data</Link></Button>
            <Button variant="outline" className="w-full justify-start" asChild><Link to="/buy/telecel">Buy Telecel</Link></Button>
            {isSeller && <Button variant="outline" className="w-full justify-start" asChild><Link to="/my-store">Manage Store</Link></Button>}
          </div>
        </Card>
      </div>
    </div>
  );
}

const StatCard = ({ icon: Icon, label, value, sub, link, accent }: any) => {
  const content = (
    <Card className={`p-6 transition-colors ${link ? "hover:border-primary cursor-pointer" : ""} ${accent ? "border-primary/30" : ""}`}>
      <div className={`h-9 w-9 rounded-lg ${accent ? "bg-primary text-primary-foreground" : "bg-muted"} flex items-center justify-center mb-4`}>
        <Icon className="h-4 w-4" />
      </div>
      <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </Card>
  );
  return link ? <Link to={link}>{content}</Link> : content;
};
