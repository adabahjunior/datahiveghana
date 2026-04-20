import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatGHS, formatVolume, networkLabel, calcPaystackCharge } from "@/lib/format";
import { startPaystackCheckout } from "@/lib/paystack";
import { toast } from "sonner";
import { Loader2, MessageCircle, Phone, ArrowLeft } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { Sun, Moon } from "lucide-react";
import "@/styles/store-experience.css";

const dotClass: Record<string, string> = {
  mtn: "bg-mtn",
  telecel: "bg-telecel",
  airteltigo_ishare: "bg-airteltigo",
  airteltigo_bigtime: "bg-airteltigo",
};

export default function PublicStore() {
  const { slug } = useParams<{ slug: string }>();
  const { theme, toggleTheme } = useTheme();
  const [store, setStore] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any>(null);
  const [phone, setPhone] = useState("");
  const [paying, setPaying] = useState(false);
  const [filter, setFilter] = useState<string>("all");
  const paystackPublicKey = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY;
  const subAgentBaseFee = 30;

  useEffect(() => {
    if (!slug) return;
    (async () => {
      const { data: s } = await supabase.from("agent_stores").select("*").eq("slug", slug).maybeSingle();
      setStore(s);
      if (s) {
        const { data } = await supabase.from("store_package_prices")
          .select("selling_price, is_listed, package:data_packages(*)")
          .eq("store_id", s.id).eq("is_listed", true);
        setItems((data || []).filter((i: any) => i.package?.is_active));
      }
      setLoading(false);
    })();
  }, [slug]);

  const filtered = filter === "all" ? items : items.filter((i) => i.package.network === filter);

  const handleBuy = async () => {
    if (!selected || !phone || phone.length < 10) { toast.error("Enter a valid phone number"); return; }
    if (!paystackPublicKey) { toast.error("Paystack is not configured"); return; }

    setPaying(true);
    try {
      const sellingPrice = Number(selected.selling_price);
      const total = sellingPrice + calcPaystackCharge(sellingPrice);
      const buyerEmail = `${phone.replace(/\D/g, "") || "guest"}@guest.datahiveghana.com`;

      const reference = await startPaystackCheckout({
        publicKey: paystackPublicKey,
        email: buyerEmail,
        amountInGhs: total,
        metadata: {
          purpose: "guest_store_purchase",
          store_id: store.id,
          package_id: selected.package.id,
          recipient_phone: phone,
        },
      });

      const { data, error } = await supabase.functions.invoke("guest-purchase", {
        body: {
          store_id: store.id,
          package_id: selected.package.id,
          recipient_phone: phone,
          reference,
        },
      });

      if (error || !data?.success) {
        toast.error(data?.error || error?.message || "Order failed");
        return;
      }

      toast.success("Purchase successful. Your data is on its way.");
      setSelected(null);
      setPhone("");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Payment failed";
      if (message !== "Payment cancelled") toast.error(message);
    } finally {
      setPaying(false);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (!store) return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      <p className="text-2xl font-bold">Store not found</p>
      <Button variant="outline" asChild className="mt-4"><Link to="/">Back home</Link></Button>
    </div>
  );

  const networks = Array.from(new Set(items.map((i) => i.package.network)));

  return (
    <div className="store-canvas store-public min-h-screen">
      <header className="border-b border-border/60 backdrop-blur-sm bg-background/70">
        <div className="max-w-5xl mx-auto px-6 lg:px-10 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-primary/90 flex items-center justify-center shadow-lg">
              <span className="text-primary-foreground font-bold">{store.store_name[0]?.toUpperCase()}</span>
            </div>
            <div>
              <h1 className="font-bold leading-tight">{store.store_name}</h1>
              <p className="text-[11px] text-muted-foreground leading-tight uppercase tracking-wider">Independent Agent Storefront</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={toggleTheme} className="rounded-xl border border-border/70 bg-card/70">
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
        </div>
      </header>

      <section className="max-w-5xl mx-auto px-6 lg:px-10 py-12">
        <div className="space-y-3 mb-10 store-reveal">
          <p className="inline-flex rounded-full px-3 py-1 text-xs tracking-wider uppercase store-chip">Fast Fulfillment Network</p>
          <h2 className="text-3xl lg:text-4xl font-bold">Buy data instantly</h2>
          <p className="text-muted-foreground">Choose a bundle below. Delivery is automatic.</p>
        </div>

        <Card className="p-5 mb-8 store-panel store-panel-strong store-reveal store-delay-1">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Subagent Program</p>
              <h3 className="font-bold text-lg mt-1">Become a Subagent under {store.store_name}</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Final signup fee: <span className="font-semibold text-foreground">{formatGHS(subAgentBaseFee + Number(store.subagent_fee_addon || 0))}</span>
              </p>
            </div>
            <Button asChild className="store-pulse">
              <Link to={`/store/${store.slug}/subagent-program`}>View Subagent Program</Link>
            </Button>
          </div>
        </Card>

        <div className="flex flex-wrap gap-2 mb-8 store-reveal store-delay-2">
          <Button className="rounded-full" variant={filter === "all" ? "default" : "outline"} size="sm" onClick={() => setFilter("all")}>All</Button>
          {networks.map((n) => (
            <Button className="rounded-full" key={n} variant={filter === n ? "default" : "outline"} size="sm" onClick={() => setFilter(n)}>{networkLabel[n]}</Button>
          ))}
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((i) => (
            <Card key={i.package.id} className="p-6 store-panel hover:border-primary/50 transition-colors store-reveal store-delay-3">
              <div className="flex items-center gap-2 mb-3">
                <span className={`h-2 w-2 rounded-full ${dotClass[i.package.network]}`} />
                <span className="text-xs uppercase tracking-wider text-muted-foreground">{networkLabel[i.package.network]}</span>
              </div>
              <p className="text-3xl font-bold">{formatVolume(i.package.volume_mb)}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {i.package.validity_days ? `Valid ${i.package.validity_days} days` : "Non-Expiry"}
              </p>
              <p className="text-2xl font-bold mt-5 mb-4 pt-5 border-t border-border">{formatGHS(i.selling_price)}</p>
              <Button className="w-full" onClick={() => setSelected(i)}>Buy Now</Button>
            </Card>
          ))}
        </div>

        {filtered.length === 0 && (
          <p className="py-16 text-center text-sm text-muted-foreground">No bundles listed yet.</p>
        )}
      </section>

      <footer className="border-t border-border">
        <div className="max-w-5xl mx-auto px-6 lg:px-10 py-8 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <span className="flex items-center gap-2 text-muted-foreground"><Phone className="h-4 w-4" /> {store.support_phone}</span>
            {store.whatsapp_link && (
              <a href={store.whatsapp_link} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-primary hover:underline">
                <MessageCircle className="h-4 w-4" /> WhatsApp Group
              </a>
            )}
          </div>
          <Link to="/" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"><ArrowLeft className="h-3 w-3" /> DataHive Ghana</Link>
        </div>
      </footer>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Purchase</DialogTitle>
            <DialogDescription>Enter the recipient's phone number. You will checkout directly with Paystack.</DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="rounded-lg bg-muted p-4 space-y-1.5 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Network</span><span className="font-medium">{networkLabel[selected.package.network]}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Bundle</span><span className="font-medium">{formatVolume(selected.package.volume_mb)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Price</span><span>{formatGHS(selected.selling_price)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Paystack charge</span><span>{formatGHS(calcPaystackCharge(Number(selected.selling_price)))}</span></div>
                <div className="flex justify-between font-bold pt-2 border-t border-border"><span>Total</span><span>{formatGHS(Number(selected.selling_price) + calcPaystackCharge(Number(selected.selling_price)))}</span></div>
              </div>
              <div className="space-y-2">
                <Label>Phone Number</Label>
                <Input placeholder="0244000000" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelected(null)}>Cancel</Button>
            <Button onClick={handleBuy} disabled={paying}>
              {paying && <Loader2 className="h-4 w-4 animate-spin" />} Pay with Paystack
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
