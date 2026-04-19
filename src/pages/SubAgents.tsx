import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { networkLabel, formatGHS, formatVolume } from "@/lib/format";
import { Loader2, Users } from "lucide-react";
import { toast } from "sonner";

const SUBAGENT_BASE_FEE = 30;

export default function SubAgents() {
  const { profile, isAgent, isSubAgent } = useAuth();
  const [loading, setLoading] = useState(true);
  const [store, setStore] = useState<any>(null);
  const [addon, setAddon] = useState("0");
  const [savingAddon, setSavingAddon] = useState(false);
  const [packages, setPackages] = useState<any[]>([]);
  const [basePrices, setBasePrices] = useState<Record<string, number>>({});
  const [savingPrice, setSavingPrice] = useState<Record<string, boolean>>({});
  const [subagents, setSubagents] = useState<any[]>([]);

  const totalSignupFee = SUBAGENT_BASE_FEE + (Number(addon) || 0);

  const groupedPackages = useMemo(() => {
    const groups: Record<string, any[]> = {};
    packages.forEach((pkg) => {
      if (!groups[pkg.network]) groups[pkg.network] = [];
      groups[pkg.network].push(pkg);
    });
    return groups;
  }, [packages]);

  const load = async () => {
    if (!profile) return;
    setLoading(true);

    const { data: myStore } = await supabase
      .from("agent_stores")
      .select("id,slug,store_name,subagent_fee_addon")
      .eq("agent_id", profile.user_id)
      .maybeSingle();

    setStore(myStore);
    setAddon(String(Number(myStore?.subagent_fee_addon || 0)));

    if (myStore) {
      const [{ data: catalog }, { data: existingBase }, { data: assigned }] = await Promise.all([
        supabase.from("data_packages").select("*").eq("is_active", true).order("network").order("display_order"),
        supabase.from("subagent_package_prices").select("*").eq("parent_agent_id", profile.user_id),
        supabase
          .from("subagent_assignments")
          .select("id,subagent_user_id,status,paid_amount,created_at")
          .eq("parent_agent_id", profile.user_id)
          .order("created_at", { ascending: false }),
      ]);

      const map: Record<string, number> = {};
      (catalog || []).forEach((pkg: any) => {
        const existing = (existingBase || []).find((x: any) => x.package_id === pkg.id);
        map[pkg.id] = existing ? Number(existing.base_price) : Number(pkg.agent_price);
      });

      let usersMap: Record<string, any> = {};
      if ((assigned || []).length > 0) {
        const userIds = (assigned || []).map((a: any) => a.subagent_user_id);
        const { data: subProfiles } = await supabase
          .from("profiles")
          .select("user_id,full_name,email,phone")
          .in("user_id", userIds);

        usersMap = (subProfiles || []).reduce((acc: Record<string, any>, p: any) => {
          acc[p.user_id] = p;
          return acc;
        }, {});
      }

      const joined = (assigned || []).map((a: any) => ({ ...a, profile: usersMap[a.subagent_user_id] || null }));

      setPackages(catalog || []);
      setBasePrices(map);
      setSubagents(joined);
    }

    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [profile?.user_id]);

  const saveAddon = async () => {
    if (!store || !profile) return;
    const parsed = Number(addon);
    if (!Number.isFinite(parsed) || parsed < 0) {
      toast.error("Addon must be 0 or more");
      return;
    }

    setSavingAddon(true);
    const { error } = await supabase
      .from("agent_stores")
      .update({ subagent_fee_addon: parsed })
      .eq("id", store.id)
      .eq("agent_id", profile.user_id);
    setSavingAddon(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Subagent signup addon saved");
    await load();
  };

  const saveBasePrice = async (pkg: any) => {
    if (!profile) return;
    const price = Number(basePrices[pkg.id]);
    if (!Number.isFinite(price) || price <= 0) {
      toast.error("Invalid base price");
      return;
    }

    setSavingPrice((prev) => ({ ...prev, [pkg.id]: true }));
    const { error } = await supabase.from("subagent_package_prices").upsert(
      {
        parent_agent_id: profile.user_id,
        package_id: pkg.id,
        base_price: price,
        is_active: true,
      },
      { onConflict: "parent_agent_id,package_id" },
    );
    setSavingPrice((prev) => ({ ...prev, [pkg.id]: false }));

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Subagent base price saved");
  };

  if (!isAgent || isSubAgent) {
    return (
      <div className="animate-fade-in">
        <PageHeader title="Sub Agents" description="Only primary agents can manage subagents." />
        <Card className="p-8">
          <p className="text-sm text-muted-foreground">Subagent recruitment and base price controls are available to primary agent accounts only.</p>
        </Card>
      </div>
    );
  }

  if (loading) {
    return <div className="py-16 text-center text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin inline mr-2" />Loading subagent controls...</div>;
  }

  if (!store) {
    return (
      <div className="animate-fade-in">
        <PageHeader title="Sub Agents" description="Create your store first to recruit subagents." />
        <Card className="p-8">
          <Button asChild><Link to="/my-store">Create My Store</Link></Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Sub Agents"
        description="Set signup pricing and package base prices for your assigned subagent network."
      />

      <div className="grid lg:grid-cols-3 gap-5 mb-8">
        <Card className="p-5">
          <p className="text-xs uppercase text-muted-foreground">Platform Base Fee</p>
          <p className="text-2xl font-bold mt-1">{formatGHS(SUBAGENT_BASE_FEE)}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs uppercase text-muted-foreground">Your Addon</p>
          <p className="text-2xl font-bold mt-1">{formatGHS(Number(addon) || 0)}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs uppercase text-muted-foreground">Subagent Signup Price</p>
          <p className="text-2xl font-bold mt-1">{formatGHS(totalSignupFee)}</p>
        </Card>
      </div>

      <Card className="p-6 mb-8">
        <h3 className="font-semibold mb-1">Subagent Signup Settings</h3>
        <p className="text-sm text-muted-foreground mb-4">Subagents joining through your store pay base 30 GHS plus your addon.</p>
        <div className="grid md:grid-cols-[220px_180px] gap-3 items-end">
          <div className="space-y-2">
            <Label>Addon Amount (GHS)</Label>
            <Input type="number" min="0" step="0.01" value={addon} onChange={(e) => setAddon(e.target.value)} />
          </div>
          <Button onClick={saveAddon} disabled={savingAddon}>
            {savingAddon && <Loader2 className="h-4 w-4 animate-spin" />} Save Addon
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-3">Public signup URL: {window.location.origin}/store/{store.slug}/subagent</p>
      </Card>

      <Card className="overflow-hidden mb-8">
        <div className="p-6 border-b border-border">
          <h3 className="font-bold">Subagent Base Package Prices</h3>
          <p className="text-sm text-muted-foreground mt-1">These are the base prices your subagents buy at from wallet purchases.</p>
        </div>

        <div className="p-4 md:p-6 space-y-6">
          {Object.keys(groupedPackages).map((network) => (
            <div key={network} className="border border-border rounded-xl overflow-hidden">
              <div className="px-4 py-3 bg-muted/40 border-b border-border">
                <h4 className="font-semibold text-sm">{networkLabel[network]}</h4>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Bundle</TableHead>
                    <TableHead>Agent Base</TableHead>
                    <TableHead>Subagent Base</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groupedPackages[network].map((pkg) => (
                    <TableRow key={pkg.id}>
                      <TableCell className="text-sm font-medium">{formatVolume(pkg.volume_mb)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatGHS(pkg.agent_price)}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          className="w-28 h-9"
                          value={basePrices[pkg.id] ?? Number(pkg.agent_price)}
                          onChange={(e) => setBasePrices((prev) => ({ ...prev, [pkg.id]: Number(e.target.value) || 0 }))}
                        />
                      </TableCell>
                      <TableCell>
                        <Button size="sm" variant="outline" onClick={() => saveBasePrice(pkg)} disabled={!!savingPrice[pkg.id]}>
                          {savingPrice[pkg.id] && <Loader2 className="h-4 w-4 animate-spin" />} Save
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ))}
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="p-6 border-b border-border flex items-center gap-2">
          <Users className="h-4 w-4" />
          <h3 className="font-bold">Assigned Subagents</h3>
        </div>
        {subagents.length === 0 ? (
          <div className="p-10 text-sm text-muted-foreground text-center">No subagents assigned yet.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Paid</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {subagents.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{row.profile?.full_name || "—"}</TableCell>
                  <TableCell>{row.profile?.email || "—"}</TableCell>
                  <TableCell>{row.profile?.phone || "—"}</TableCell>
                  <TableCell>{formatGHS(Number(row.paid_amount || 0))}</TableCell>
                  <TableCell className="capitalize">{row.status}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
