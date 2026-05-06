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
import { Loader2, MessageCircle, Phone } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { Sun, Moon } from "lucide-react";
import "@/styles/store-experience.css";

const dotClass: Record<string, string> = {
  mtn: "bg-mtn",
  telecel: "bg-telecel",
  airteltigo_ishare: "bg-airteltigo",
  airteltigo_bigtime: "bg-airteltigo",
};

const sortByNetworkAsc = (a: any, b: any) => {
  const networkA = String(a?.package?.network || "");
  const networkB = String(b?.package?.network || "");
  const byNetwork = networkA.localeCompare(networkB);
  if (byNetwork !== 0) return byNetwork;

  const orderA = Number(a?.package?.display_order ?? 0);
  const orderB = Number(b?.package?.display_order ?? 0);
  if (orderA !== orderB) return orderA - orderB;

  return String(a?.package?.name || "").localeCompare(String(b?.package?.name || ""));
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export default function PublicStore() {
  const { slug } = useParams<{ slug: string }>();
  const { theme, toggleTheme } = useTheme();
  const [store, setStore] = useState<any>(null);
  const [storeError, setStoreError] = useState("");
  const [storeMissing, setStoreMissing] = useState(false);
  const [items, setItems] = useState<any[]>([]);
  const [checkerItems, setCheckerItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any>(null);
  const [selectedChecker, setSelectedChecker] = useState<any>(null);
  const [phone, setPhone] = useState("");
  const [checkerPhone, setCheckerPhone] = useState("");
  const [checkerQty, setCheckerQty] = useState("1");
  const [checkerSuccess, setCheckerSuccess] = useState<any>(null);
  const [universityItems, setUniversityItems] = useState<any[]>([]);
  const [selectedUniversity, setSelectedUniversity] = useState<any>(null);
  const [uniFullName, setUniFullName] = useState("");
  const [uniPhone, setUniPhone] = useState("");
  const [uniEmail, setUniEmail] = useState("");
  const [universitySuccess, setUniversitySuccess] = useState<any>(null);
  const [universityWhatsapp, setUniversityWhatsapp] = useState("");
  const [paying, setPaying] = useState(false);
  const [filter, setFilter] = useState<string>("all");
  const paystackPublicKey = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY;
  const subAgentBaseFee = 30;

  useEffect(() => {
    if (!slug) return;
    (async () => {
      setLoading(true);
      setStoreError("");
      setStoreMissing(false);

      let s: any = null;
      let lastError = "";

      for (let attempt = 1; attempt <= 3; attempt++) {
        const { data, error } = await supabase
          .from("agent_stores")
          .select("*")
          .eq("slug", slug)
          .maybeSingle();

        if (!error) {
          s = data;
          break;
        }

        lastError = error.message;
        if (attempt < 3) await sleep(500 * attempt);
      }

      setStore(s);
      if (!s && lastError) {
        setStoreError("We couldn't load this store right now. Please try again.");
        setLoading(false);
        return;
      }

      if (!s) {
        setStoreMissing(true);
        setLoading(false);
        return;
      }

      if (s) {
        const [{ data }, { data: checkerData }, { data: uniData }, { data: uniSetting }] = await Promise.all([
          supabase.from("store_package_prices")
            .select("selling_price, is_listed, package:data_packages(*)")
            .eq("store_id", s.id).eq("is_listed", true),
          (supabase as any)
            .from("store_checker_prices")
            .select("selling_price, is_listed, checker:checker_products(*)")
            .eq("store_id", s.id).eq("is_listed", true),
          (supabase as any)
            .from("store_university_form_prices")
            .select("selling_price, is_listed, form_type:university_form_types(id,name,price,is_active,school:university_schools(id,name,is_published))")
            .eq("store_id", s.id)
            .eq("is_listed", true),
          supabase.from("app_settings").select("value").eq("key", "university_forms_whatsapp").maybeSingle(),
        ]);
        const activePackages = (data || [])
          .filter((i: any) => i.package?.is_active)
          .sort(sortByNetworkAsc);

        setItems(activePackages);
        setCheckerItems((checkerData || []).filter((i: any) => i.checker?.is_active));
        setUniversityItems((uniData || []).filter((i: any) => i.form_type?.is_active && i.form_type?.school?.is_published));
        setUniversityWhatsapp(typeof uniSetting?.value === "string" ? uniSetting.value : "");
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

  const handleBuyChecker = async () => {
    const qty = Number(checkerQty);
    if (!selectedChecker || !checkerPhone || checkerPhone.length < 10) { toast.error("Enter a valid phone number"); return; }
    if (!Number.isInteger(qty) || qty <= 0 || qty > 50) { toast.error("Quantity must be between 1 and 50"); return; }
    if (!paystackPublicKey) { toast.error("Paystack is not configured"); return; }

    setPaying(true);
    try {
      const sellingPrice = Number(selectedChecker.selling_price) * qty;
      const total = sellingPrice + calcPaystackCharge(sellingPrice);
      const buyerEmail = `${checkerPhone.replace(/\D/g, "") || "guest"}@guest.datahiveghana.com`;

      const reference = await startPaystackCheckout({
        publicKey: paystackPublicKey,
        email: buyerEmail,
        amountInGhs: total,
        metadata: {
          purpose: "guest_checker_purchase",
          store_id: store.id,
          checker_id: selectedChecker.checker.id,
          recipient_phone: checkerPhone,
        },
      });

      const { data, error } = await supabase.functions.invoke("guest-checker-purchase", {
        body: {
          store_id: store.id,
          checker_id: selectedChecker.checker.id,
          recipient_phone: checkerPhone,
          reference,
          quantity: qty,
        },
      });

      if (error || !data?.success) {
        toast.error(data?.error || error?.message || "Checker purchase failed");
        return;
      }

      toast.success("Checker purchase successful");
      setCheckerSuccess(data.checker || null);
      setSelectedChecker(null);
      setCheckerPhone("");
      setCheckerQty("1");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Payment failed";
      if (message !== "Payment cancelled") toast.error(message);
    } finally {
      setPaying(false);
    }
  };

  const handleBuyUniversityForm = async () => {
    if (!selectedUniversity) return;
    if (!uniFullName.trim()) { toast.error("Enter your full name"); return; }
    if (!uniPhone.trim() || uniPhone.trim().length < 10) { toast.error("Enter a valid phone number"); return; }
    if (!uniEmail.trim() || !uniEmail.includes("@")) { toast.error("Enter a valid email"); return; }
    if (!paystackPublicKey) { toast.error("Paystack is not configured"); return; }

    setPaying(true);
    try {
      const sellingPrice = Number(selectedUniversity.selling_price);
      const total = sellingPrice + calcPaystackCharge(sellingPrice);

      const reference = await startPaystackCheckout({
        publicKey: paystackPublicKey,
        email: uniEmail.trim(),
        amountInGhs: total,
        metadata: {
          purpose: "guest_university_form_purchase",
          store_id: store.id,
          form_type_id: selectedUniversity.form_type.id,
          phone: uniPhone.trim(),
        },
      });

      const { data, error } = await supabase.functions.invoke("guest-university-form-purchase", {
        body: {
          store_id: store.id,
          form_type_id: selectedUniversity.form_type.id,
          full_name: uniFullName.trim(),
          phone: uniPhone.trim(),
          email: uniEmail.trim(),
          reference,
        },
      });

      if (error || !data?.success) {
        toast.error(data?.error || error?.message || "University form purchase failed");
        return;
      }

      toast.success("University form purchase successful");
      setUniversitySuccess(data.order || null);
      setSelectedUniversity(null);
      setUniFullName("");
      setUniPhone("");
      setUniEmail("");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Payment failed";
      if (message !== "Payment cancelled") toast.error(message);
    } finally {
      setPaying(false);
    }
  };

  const handleUniversityWhatsApp = () => {
    if (!universitySuccess || !universityWhatsapp) return;
    const num = universityWhatsapp.replace(/\D/g, "");
    const message = encodeURIComponent(
      `Hello, I purchased a university admission form.\n\n` +
      `🏫 School: ${universitySuccess.school_name}\n` +
      `📋 Form Type: ${universitySuccess.form_type_name}\n` +
      `💰 Amount Paid: ${formatGHS(universitySuccess.amount_paid)}\n` +
      `👤 Name: ${universitySuccess.full_name}\n` +
      `📞 Phone: ${universitySuccess.phone}\n` +
      `📧 Email: ${universitySuccess.email}\n` +
      `🔖 Reference: ${universitySuccess.reference}`
    );
    window.open(`https://wa.me/${num}?text=${message}`, "_blank");
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (storeError) return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center">
      <p className="text-2xl font-bold">Store temporarily unavailable</p>
      <p className="text-muted-foreground mt-2 max-w-md">{storeError}</p>
      <Button variant="outline" className="mt-4" onClick={() => window.location.reload()}>Retry</Button>
    </div>
  );
  if (storeMissing || !store) return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      <p className="text-2xl font-bold">Store not found</p>
      <p className="text-muted-foreground mt-2 text-center max-w-md">This store link is unavailable right now.</p>
    </div>
  );

  const networks = Array.from(new Set(items.map((i) => i.package.network))).sort((a, b) => String(a).localeCompare(String(b)));

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
        {checkerSuccess && (
          <Card className="p-6 mb-8 border-success/40 bg-success/5">
            <h3 className="text-xl font-bold">Purchase Successful</h3>
            <p className="text-sm text-muted-foreground mt-1">Your checker purchase is complete.</p>
            <div className="mt-4 space-y-2 text-sm">
              <p><span className="text-muted-foreground">Checker:</span> {checkerSuccess.name} ({String(checkerSuccess.exam_type || "").toUpperCase()})</p>
              <p><span className="text-muted-foreground">Quantity:</span> {checkerSuccess.quantity}</p>
            </div>
            <div className="mt-4 max-h-52 overflow-auto rounded-lg border border-border bg-card p-3 space-y-2 text-sm">
              {(checkerSuccess.codes || []).map((code: any, i: number) => (
                <p key={`${code.serial}-${i}`}>#{i + 1} Serial: <span className="font-semibold">{code.serial}</span> | PIN: <span className="font-semibold">{code.pin}</span></p>
              ))}
            </div>
            <Button className="mt-4" variant="outline" onClick={() => setCheckerSuccess(null)}>Close Success Page</Button>
          </Card>
        )}

        {universitySuccess && (
          <Card className="p-6 mb-8 border-green-500/40 bg-green-500/5">
            <h3 className="text-xl font-bold">University Form Purchase Successful</h3>
            <p className="text-sm text-muted-foreground mt-1">Your order has been recorded successfully.</p>
            <div className="mt-4 space-y-2 text-sm">
              <p><span className="text-muted-foreground">School:</span> {universitySuccess.school_name}</p>
              <p><span className="text-muted-foreground">Form Type:</span> {universitySuccess.form_type_name}</p>
              <p><span className="text-muted-foreground">Amount:</span> {formatGHS(universitySuccess.amount_paid)}</p>
              <p><span className="text-muted-foreground">Phone:</span> {universitySuccess.phone}</p>
              <p><span className="text-muted-foreground">Reference:</span> {universitySuccess.reference}</p>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {universityWhatsapp && (
                <Button className="bg-green-600 hover:bg-green-700 text-white" onClick={handleUniversityWhatsApp}>
                  Contact Admin via WhatsApp
                </Button>
              )}
              <Button variant="outline" onClick={() => setUniversitySuccess(null)}>Close</Button>
            </div>
          </Card>
        )}

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

        <div className="mt-14 mb-6 store-reveal">
          <p className="inline-flex rounded-full px-3 py-1 text-xs tracking-wider uppercase store-chip">Checker Products</p>
          <h3 className="text-2xl font-bold mt-3">WASSCE and BECE Checkers</h3>
          <p className="text-muted-foreground mt-1">Buy official result checker vouchers instantly.</p>
        </div>

        {checkerItems.length === 0 ? (
          <p className="py-8 text-sm text-muted-foreground">No checker products listed yet.</p>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {checkerItems.map((item) => (
              <Card key={item.checker.id} className="p-6 store-panel hover:border-primary/50 transition-colors store-reveal store-delay-3">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs uppercase tracking-wider text-muted-foreground">{String(item.checker.exam_type).toUpperCase()}</span>
                  <span className="text-xs text-muted-foreground">Checker</span>
                </div>
                <p className="text-xl font-bold">{item.checker.name}</p>
                <p className="text-2xl font-bold mt-5 mb-4 pt-5 border-t border-border">{formatGHS(item.selling_price)}</p>
                <Button className="w-full" onClick={() => setSelectedChecker(item)}>Buy Checker</Button>
              </Card>
            ))}
          </div>
        )}

        <div className="mt-14 mb-6 store-reveal">
          <p className="inline-flex rounded-full px-3 py-1 text-xs tracking-wider uppercase store-chip">University Forms</p>
          <h3 className="text-2xl font-bold mt-3">Admission Forms</h3>
          <p className="text-muted-foreground mt-1">Buy university admission forms listed by this store.</p>
        </div>

        {universityItems.length === 0 ? (
          <p className="py-8 text-sm text-muted-foreground">No university forms listed yet.</p>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {universityItems.map((item) => (
              <Card key={item.form_type.id} className="p-6 store-panel hover:border-primary/50 transition-colors store-reveal store-delay-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs uppercase tracking-wider text-muted-foreground">University Form</span>
                  <span className="text-xs text-muted-foreground">{item.form_type.school?.name || "School"}</span>
                </div>
                <p className="text-xl font-bold">{item.form_type.name}</p>
                <p className="text-2xl font-bold mt-5 mb-4 pt-5 border-t border-border">{formatGHS(item.selling_price)}</p>
                <Button className="w-full" onClick={() => setSelectedUniversity(item)}>Buy University Form</Button>
              </Card>
            ))}
          </div>
        )}
      </section>

      <footer className="border-t border-border">
        <div className="max-w-5xl mx-auto px-6 lg:px-10 py-8 flex flex-col sm:flex-row gap-4 justify-start items-start sm:items-center">
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <span className="flex items-center gap-2 text-muted-foreground"><Phone className="h-4 w-4" /> {store.support_phone}</span>
            {store.whatsapp_link && (
              <a href={store.whatsapp_link} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-primary hover:underline">
                <MessageCircle className="h-4 w-4" /> WhatsApp Group
              </a>
            )}
          </div>
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

      <Dialog open={!!selectedChecker} onOpenChange={(o) => !o && setSelectedChecker(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Checker Purchase</DialogTitle>
            <DialogDescription>Enter the recipient's phone number. You will checkout directly with Paystack.</DialogDescription>
          </DialogHeader>
          {selectedChecker && (
            <div className="space-y-4">
              <div className="rounded-lg bg-muted p-4 space-y-1.5 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Product</span><span className="font-medium">{selectedChecker.checker.name}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Exam</span><span className="font-medium uppercase">{selectedChecker.checker.exam_type}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Unit Price</span><span>{formatGHS(selectedChecker.selling_price)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Quantity</span><span>{checkerQty}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Paystack charge</span><span>{formatGHS(calcPaystackCharge(Number(selectedChecker.selling_price) * (Number(checkerQty) || 1)))}</span></div>
                <div className="flex justify-between font-bold pt-2 border-t border-border"><span>Total</span><span>{formatGHS((Number(selectedChecker.selling_price) * (Number(checkerQty) || 1)) + calcPaystackCharge(Number(selectedChecker.selling_price) * (Number(checkerQty) || 1)))}</span></div>
              </div>
              <div className="space-y-2">
                <Label>Quantity</Label>
                <Input type="number" min="1" max="50" value={checkerQty} onChange={(e) => setCheckerQty(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Phone Number</Label>
                <Input placeholder="0244000000" value={checkerPhone} onChange={(e) => setCheckerPhone(e.target.value)} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedChecker(null)}>Cancel</Button>
            <Button onClick={handleBuyChecker} disabled={paying}>
              {paying && <Loader2 className="h-4 w-4 animate-spin" />} Pay with Paystack
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedUniversity} onOpenChange={(o) => !o && setSelectedUniversity(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm University Form Purchase</DialogTitle>
            <DialogDescription>Enter your details to continue to Paystack checkout.</DialogDescription>
          </DialogHeader>
          {selectedUniversity && (
            <div className="space-y-4">
              <div className="rounded-lg bg-muted p-4 space-y-1.5 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">School</span><span className="font-medium">{selectedUniversity.form_type.school?.name || "School"}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Form Type</span><span className="font-medium">{selectedUniversity.form_type.name}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Price</span><span>{formatGHS(selectedUniversity.selling_price)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Paystack charge</span><span>{formatGHS(calcPaystackCharge(Number(selectedUniversity.selling_price)))}</span></div>
                <div className="flex justify-between font-bold pt-2 border-t border-border"><span>Total</span><span>{formatGHS(Number(selectedUniversity.selling_price) + calcPaystackCharge(Number(selectedUniversity.selling_price)))}</span></div>
              </div>

              <div className="space-y-2">
                <Label>Full Name</Label>
                <Input placeholder="Your full name" value={uniFullName} onChange={(e) => setUniFullName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Phone Number (WhatsApp preferred)</Label>
                <Input placeholder="0244000000" value={uniPhone} onChange={(e) => setUniPhone(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Email Address</Label>
                <Input type="email" placeholder="name@email.com" value={uniEmail} onChange={(e) => setUniEmail(e.target.value)} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedUniversity(null)}>Cancel</Button>
            <Button onClick={handleBuyUniversityForm} disabled={paying}>
              {paying && <Loader2 className="h-4 w-4 animate-spin" />} Pay with Paystack
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
