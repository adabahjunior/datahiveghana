import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/PageHeader";
import { formatGHS, slugify, networkLabel, formatVolume } from "@/lib/format";
import { Check, Store as StoreIcon, ExternalLink, Loader2, TrendingUp, Users, Tag, Globe } from "lucide-react";
import { toast } from "sonner";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";

const ACTIVATION_FEE = 80;

export default function MyStore() {
  const { profile, isAgent, refreshProfile } = useAuth();
  const [store, setStore] = useState<any>(null);
  const [activating, setActivating] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ store_name: "", support_phone: "", whatsapp_link: "" });
  const [packages, setPackages] = useState<any[]>([]);
  const [storePrices, setStorePrices] = useState<Record<string, { price: number; listed: boolean }>>({});

  useEffect(() => {
    if (!profile) return;
    (async () => {
      const { data: s } = await supabase.from("agent_stores").select("*").eq("agent_id", profile.user_id).maybeSingle();
      setStore(s);
      if (s) await loadCatalog(s.id);
    })();
  }, [profile]);

  const loadCatalog = async (storeId: string) => {
    const [{ data: pkgs }, { data: sp }] = await Promise.all([
      supabase.from("data_packages").select("*").eq("is_active", true).order("network").order("display_order"),
      supabase.from("store_package_prices").select("*").eq("store_id", storeId),
    ]);
    setPackages(pkgs || []);
    const map: Record<string, { price: number; listed: boolean }> = {};
    (pkgs || []).forEach((p: any) => {
      const existing = (sp || []).find((x: any) => x.package_id === p.id);
      map[p.id] = {
        price: existing ? Number(existing.selling_price) : Number(p.guest_price),
        listed: existing ? existing.is_listed : true,
      };
    });
    setStorePrices(map);
  };

  const handleActivate = async () => {
    setActivating(true);
    const { data, error } = await supabase.functions.invoke("activate-agent", {});
    setActivating(false);
    if (error || !data?.success) {
      toast.error(data?.error || error?.message || "Activation failed");
      return;
    }
    toast.success("You're now an agent! Set up your store below.");
    await refreshProfile();
  };

  const handleCreateStore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setCreating(true);
    const slug = slugify(form.store_name);
    if (!slug) { toast.error("Invalid store name"); setCreating(false); return; }

    const { data, error } = await supabase.from("agent_stores").insert({
      agent_id: profile.user_id,
      slug,
      store_name: form.store_name.trim(),
      support_phone: form.support_phone.trim(),
      whatsapp_link: form.whatsapp_link.trim() || null,
    }).select().single();
    setCreating(false);
    if (error) { toast.error(error.message.includes("unique") ? "Store name already taken" : error.message); return; }
    setStore(data);
    await loadCatalog(data.id);
    toast.success("Store created!");
  };

  const savePrice = async (pkg: any) => {
    if (!store) return;
    const sp = storePrices[pkg.id];
    if (sp.price < Number(pkg.agent_price)) {
      toast.error(`Selling price must be at least ${formatGHS(pkg.agent_price)}`);
      return;
    }
    const { error } = await supabase.from("store_package_prices").upsert({
      store_id: store.id, package_id: pkg.id, selling_price: sp.price, is_listed: sp.listed,
    }, { onConflict: "store_id,package_id" });
    if (error) toast.error(error.message);
    else toast.success("Saved");
  };

  if (!profile) return null;

  // Not yet an agent — benefits & activation
  if (!isAgent) {
    return (
      <div className="animate-fade-in">
        <PageHeader title="Become an Agent" description="Unlock wholesale prices and run your own data store." />

        <div className="grid lg:grid-cols-2 gap-8">
          <div className="space-y-5">
            {[
              { icon: Tag, title: "Wholesale prices", desc: "Buy at agent rates and keep the margin you set." },
              { icon: Globe, title: "Personal mini-website", desc: "Your branded store at datahivegh.com/store/your-name" },
              { icon: TrendingUp, title: "Set your own prices", desc: "Full pricing control. Minimum is the agent base price." },
              { icon: Users, title: "Recruit sub-agents", desc: "Build a team and earn from their sales (coming soon)." },
            ].map((b, i) => (
              <div key={i} className="flex gap-4">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <b.icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h4 className="font-bold">{b.title}</h4>
                  <p className="text-sm text-muted-foreground mt-0.5">{b.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <Card className="p-8 border-primary/30">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">One-time fee</p>
            <p className="text-5xl font-bold mt-2">{formatGHS(ACTIVATION_FEE)}</p>
            <p className="text-sm text-muted-foreground mt-2">Pay once. Keep agent benefits forever.</p>

            <ul className="space-y-3 my-8">
              {["Wholesale wholesale data prices", "Your own mini-website", "Custom pricing dashboard", "Order management", "Profit withdrawals"].map((t) => (
                <li key={t} className="flex items-center gap-3 text-sm">
                  <Check className="h-4 w-4 text-primary" /> {t}
                </li>
              ))}
            </ul>

            <Button onClick={handleActivate} disabled={activating} className="w-full" size="lg">
              {activating && <Loader2 className="h-4 w-4 animate-spin" />}
              Pay {formatGHS(ACTIVATION_FEE)} from Wallet
            </Button>
            <p className="text-xs text-muted-foreground mt-3 text-center">
              Wallet: {formatGHS(profile.wallet_balance)}
            </p>
          </Card>
        </div>
      </div>
    );
  }

  // Agent without store — create form
  if (isAgent && !store) {
    return (
      <div className="animate-fade-in">
        <PageHeader title="Create Your Store" description="Set up your branded mini-website. Customers will buy from you here." />
        <Card className="p-8 max-w-xl">
          <form onSubmit={handleCreateStore} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="sn">Store Name</Label>
              <Input id="sn" required placeholder="Quick Data Hub" value={form.store_name}
                onChange={(e) => setForm({ ...form, store_name: e.target.value })} />
              {form.store_name && (
                <p className="text-xs text-muted-foreground">Your URL: <span className="font-mono">/store/{slugify(form.store_name)}</span></p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="sp">Support Contact Number</Label>
              <Input id="sp" required placeholder="0244000000" value={form.support_phone}
                onChange={(e) => setForm({ ...form, support_phone: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="wa">WhatsApp Group Link (optional)</Label>
              <Input id="wa" placeholder="https://chat.whatsapp.com/..." value={form.whatsapp_link}
                onChange={(e) => setForm({ ...form, whatsapp_link: e.target.value })} />
            </div>
            <Button type="submit" disabled={creating} className="w-full">
              {creating && <Loader2 className="h-4 w-4 animate-spin" />} Create Store
            </Button>
          </form>
        </Card>
      </div>
    );
  }

  // Agent with store — dashboard
  const storeUrl = `${window.location.origin}/store/${store.slug}`;

  return (
    <div className="animate-fade-in">
      <PageHeader
        title={store.store_name}
        description="Manage your store catalog and pricing."
        action={
          <Button variant="outline" asChild>
            <a href={storeUrl} target="_blank" rel="noreferrer">View Store <ExternalLink className="h-3 w-3 ml-2" /></a>
          </Button>
        }
      />

      <Card className="p-6 mb-8 bg-primary/5 border-primary/30">
        <div className="flex items-start gap-3">
          <StoreIcon className="h-5 w-5 text-primary mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Your store URL</p>
            <p className="font-mono text-sm font-bold mt-1 break-all">{storeUrl}</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(storeUrl); toast.success("Copied!"); }}>Copy</Button>
        </div>
      </Card>

      <div className="grid sm:grid-cols-3 gap-5 mb-8">
        <Card className="p-5"><p className="text-xs text-muted-foreground uppercase">Profit Balance</p><p className="text-2xl font-bold mt-1">{formatGHS(profile.profit_balance)}</p></Card>
        <Card className="p-5"><p className="text-xs text-muted-foreground uppercase">Listed Packages</p><p className="text-2xl font-bold mt-1">{Object.values(storePrices).filter((s) => s.listed).length}</p></Card>
        <Card className="p-5"><p className="text-xs text-muted-foreground uppercase">Networks</p><p className="text-2xl font-bold mt-1">4</p></Card>
      </div>

      <Card className="overflow-hidden">
        <div className="p-6 border-b border-border">
          <h3 className="font-bold">Catalog & Pricing</h3>
          <p className="text-sm text-muted-foreground mt-1">Set your selling price (must be ≥ agent base price). Toggle to list/unlist.</p>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Network</TableHead>
              <TableHead>Bundle</TableHead>
              <TableHead>Agent Price</TableHead>
              <TableHead>Your Price</TableHead>
              <TableHead>Listed</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {packages.map((p) => {
              const sp = storePrices[p.id] || { price: Number(p.guest_price), listed: true };
              return (
                <TableRow key={p.id}>
                  <TableCell className="text-sm font-medium">{networkLabel[p.network]}</TableCell>
                  <TableCell className="text-sm">{formatVolume(p.volume_mb)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatGHS(p.agent_price)}</TableCell>
                  <TableCell>
                    <Input type="number" step="0.01" min={p.agent_price} value={sp.price}
                      onChange={(e) => setStorePrices({ ...storePrices, [p.id]: { ...sp, price: parseFloat(e.target.value) || 0 } })}
                      className="w-24 h-9" />
                  </TableCell>
                  <TableCell>
                    <Switch checked={sp.listed} onCheckedChange={(v) => setStorePrices({ ...storePrices, [p.id]: { ...sp, listed: v } })} />
                  </TableCell>
                  <TableCell><Button size="sm" variant="outline" onClick={() => savePrice(p)}>Save</Button></TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
