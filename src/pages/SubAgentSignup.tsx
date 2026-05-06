import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ShieldCheck } from "lucide-react";
import { formatGHS, calcPaystackCharge } from "@/lib/format";
import { startPaystackCheckout } from "@/lib/paystack";
import { validateEmailSafety } from "@/lib/emailSafety";
import { toast } from "sonner";
import "@/styles/store-experience.css";

const SUBAGENT_BASE_FEE = 30;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export default function SubAgentSignup() {
  const { slug } = useParams<{ slug: string }>();
  const { user, profile, isSubAgent, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const paystackPublicKey = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY;

  const [loading, setLoading] = useState(true);
  const [processingWallet, setProcessingWallet] = useState(false);
  const [processingPaystack, setProcessingPaystack] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authMode, setAuthMode] = useState<"signup" | "signin">("signup");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [store, setStore] = useState<any>(null);
  const [storeError, setStoreError] = useState("");
  const [storeMissing, setStoreMissing] = useState(false);
  const [subagentFeeEnabled, setSubagentFeeEnabled] = useState(true);
  const [subagentBaseFee, setSubagentBaseFee] = useState(SUBAGENT_BASE_FEE);

  useEffect(() => {
    if (!slug) return;
    (async () => {
      setLoading(true);
      setStoreError("");
      setStoreMissing(false);

      const { data: feeSetting } = await supabase.from("app_settings").select("value").eq("key", "subagent_activation_fee").maybeSingle();

      let data: any = null;
      let lastError = "";

      for (let attempt = 1; attempt <= 3; attempt++) {
        const { data: storeData, error } = await supabase
          .from("agent_stores")
          .select("id,agent_id,store_name,slug,subagent_fee_addon,is_active")
          .eq("slug", slug)
          .maybeSingle();

        if (!error) {
          data = storeData;
          break;
        }

        lastError = error.message;
        if (attempt < 3) await sleep(500 * attempt);
      }

      setStore(data);
      if (!data && lastError) {
        setStoreError("We couldn't load this store right now. Please try again.");
        setLoading(false);
        return;
      }
      if (!data) {
        setStoreMissing(true);
      }

      const feeConfig = feeSetting?.value as { enabled?: boolean; amount?: number } | null;
      if (feeConfig && typeof feeConfig === "object" && "amount" in feeConfig) {
        setSubagentFeeEnabled(feeConfig.enabled !== false);
        setSubagentBaseFee(feeConfig.enabled !== false ? Number(feeConfig.amount) : 0);
      }
      setLoading(false);
    })();
  }, [slug]);

  const addon = Number(store?.subagent_fee_addon || 0);
  const totalFee = subagentBaseFee + addon;
  const paystackTotal = totalFee + calcPaystackCharge(totalFee);

  const blockedReason = useMemo(() => {
    if (!store) return "Store not found";
    if (!store.is_active) return "This store is currently inactive";
    if (!user || !profile) return "Sign in or create an account to continue";
    if (isSubAgent) return "This account is already a subagent";
    if (store.agent_id === user.id) return "Primary agent account cannot self-register as subagent";
    return null;
  }, [user, profile, store, isSubAgent]);

  const canActivate = !blockedReason;

  const handleAuthSubmit = async () => {
    if (!email.trim() || !password) {
      toast.error("Email and password are required");
      return;
    }

    setAuthLoading(true);
    try {
      if (authMode === "signup") {
        if (!fullName.trim()) {
          toast.error("Full name is required");
          return;
        }

        const safeEmail = validateEmailSafety(email);
        if (!safeEmail.ok) {
          toast.error(safeEmail.message);
          return;
        }

        if (password.length < 6) {
          toast.error("Password must be at least 6 characters");
          return;
        }
        if (password !== confirmPassword) {
          toast.error("Passwords do not match");
          return;
        }

        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              full_name: fullName.trim(),
              phone: phone.trim(),
            },
          },
        });

        if (error) {
          toast.error(error.message);
          return;
        }

        if (data.session) {
          await refreshProfile();
          toast.success("Account created. Continue with activation payment below.");
        } else {
          toast.success("Account created. Confirm email if required, then sign in on this page.");
          setAuthMode("signin");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (error) {
          toast.error(error.message);
          return;
        }

        await refreshProfile();
        toast.success("Signed in. Continue with activation payment below.");
      }
    } finally {
      setAuthLoading(false);
    }
  };

  const activateViaWallet = async () => {
    if (!slug) return;
    setProcessingWallet(true);
    const { data, error } = await supabase.functions.invoke("activate-subagent", {
      body: {
        store_slug: slug,
        payment_method: totalFee === 0 ? "free" : "wallet",
      },
    });
    setProcessingWallet(false);

    if (error || !data?.success) {
      toast.error(data?.error || error?.message || "Activation failed");
      return;
    }

    await refreshProfile();
    toast.success("Subagent account activated successfully");
    navigate("/my-store");
  };

  const activateViaPaystack = async () => {
    if (!slug || !profile?.email || !paystackPublicKey) {
      toast.error("Paystack is not configured");
      return;
    }

    setProcessingPaystack(true);
    try {
      const reference = await startPaystackCheckout({
        publicKey: paystackPublicKey,
        email: profile.email,
        amountInGhs: paystackTotal,
        metadata: {
          purpose: "subagent_activation",
          store_slug: slug,
          topup_amount: totalFee,
          paystack_charge: calcPaystackCharge(totalFee),
        },
      });

      const { data, error } = await supabase.functions.invoke("activate-subagent", {
        body: {
          store_slug: slug,
          payment_method: "paystack",
          reference,
        },
      });

      if (error || !data?.success) {
        toast.error(data?.error || error?.message || "Activation failed");
        return;
      }

      await refreshProfile();
      toast.success("Subagent account activated successfully");
      navigate("/my-store");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Payment failed";
      if (message !== "Payment cancelled") toast.error(message);
    } finally {
      setProcessingPaystack(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  if (storeError) {
    return (
      <div className="min-h-screen bg-background store-canvas">
        <section className="max-w-5xl mx-auto px-6 lg:px-10 py-12">
          <Card className="p-8 w-full max-w-xl mx-auto text-center store-panel">
            <h1 className="text-2xl font-bold">Subagent Program</h1>
            <p className="text-muted-foreground mt-2">{storeError}</p>
            <Button className="mt-6" onClick={() => window.location.reload()}>Retry</Button>
          </Card>
        </section>
      </div>
    );
  }

  if (storeMissing || !store) {
    return (
      <div className="min-h-screen bg-background store-canvas">
        <section className="max-w-5xl mx-auto px-6 lg:px-10 py-12">
          <Card className="p-8 w-full max-w-xl mx-auto text-center store-panel">
          <h1 className="text-2xl font-bold">Subagent Program</h1>
          <p className="text-muted-foreground mt-2">Store not found.</p>
          </Card>
        </section>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background store-canvas">
      <section className="max-w-5xl mx-auto px-6 lg:px-10 py-12">
        <div className="w-full max-w-2xl mx-auto">
        <Card className="p-6 sm:p-8 border-primary/30 store-panel store-panel-strong store-reveal">
          <div className="text-center mb-8">
            <p className="inline-flex rounded-full px-3 py-1 text-xs tracking-wider uppercase store-chip mb-3">Subagent Access Program</p>
            <h1 className="text-3xl font-bold">{store.store_name} Subagent Program</h1>
            <p className="text-muted-foreground mt-2">
              {totalFee === 0
                ? "Create your account on this page and activate for free."
                : "Create your account on this page, pay activation, and unlock your subagent dashboard."}
            </p>
          </div>

          <div className="flex flex-col items-center text-center gap-2 mb-5">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <div className="space-y-1">
              <p className="font-semibold">Subagent Activation Fee</p>
              <p className="text-sm text-muted-foreground">One-time fee to unlock your subagent account under this store.</p>
            </div>
          </div>

          <div className="rounded-lg border border-border p-4 mb-8 text-center">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Final Price</p>
            {totalFee === 0 ? (
              <p className="text-3xl font-bold mt-1 text-primary">FREE</p>
            ) : (
              <p className="text-3xl font-bold mt-1">{formatGHS(totalFee)}</p>
            )}
          </div>

          {!user && (
            <div className="rounded-lg border border-border p-4 mb-8 max-w-lg mx-auto w-full store-panel">
              <div className="flex gap-2 mb-4">
                <Button
                  type="button"
                  variant={authMode === "signup" ? "default" : "outline"}
                  className="flex-1"
                  onClick={() => setAuthMode("signup")}
                >
                  Create Account
                </Button>
                <Button
                  type="button"
                  variant={authMode === "signin" ? "default" : "outline"}
                  className="flex-1"
                  onClick={() => setAuthMode("signin")}
                >
                  Sign In
                </Button>
              </div>

              <div className="space-y-3">
                {authMode === "signup" && (
                  <>
                    <div className="space-y-1.5">
                      <Label htmlFor="sa-full-name">Full Name</Label>
                      <Input id="sa-full-name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="sa-phone">Phone (optional)</Label>
                      <Input id="sa-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
                    </div>
                  </>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="sa-email">Email</Label>
                  <Input id="sa-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="sa-password">Password</Label>
                  <Input id="sa-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>

                {authMode === "signup" && (
                  <div className="space-y-1.5">
                    <Label htmlFor="sa-confirm-password">Confirm Password</Label>
                    <Input id="sa-confirm-password" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
                  </div>
                )}

                <Button type="button" className="w-full" onClick={handleAuthSubmit} disabled={authLoading}>
                  {authLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                  {authMode === "signup" ? "Create Account and Continue" : "Sign In and Continue"}
                </Button>
              </div>
            </div>
          )}

          {!canActivate ? (
            <p className="text-sm text-muted-foreground text-center">{blockedReason}</p>
          ) : totalFee === 0 ? (
            <div className="max-w-lg mx-auto">
              <Button className="w-full" onClick={activateViaWallet} disabled={processingWallet}>
                {processingWallet && <Loader2 className="h-4 w-4 animate-spin" />} Activate for Free
              </Button>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-3 max-w-lg mx-auto">
              <Button variant="outline" onClick={activateViaWallet} disabled={processingWallet || processingPaystack}>
                {processingWallet && <Loader2 className="h-4 w-4 animate-spin" />} Pay {formatGHS(totalFee)} from Wallet
              </Button>
              <Button onClick={activateViaPaystack} disabled={processingWallet || processingPaystack}>
                {processingPaystack && <Loader2 className="h-4 w-4 animate-spin" />} Pay with Paystack
              </Button>
            </div>
          )}

          <p className="text-xs text-muted-foreground text-center mt-6">
            {totalFee === 0
              ? "Your subagent dashboard will unlock automatically after activation."
              : "After successful payment, your subagent dashboard will unlock automatically."}
          </p>
        </Card>
        </div>
      </section>
      </div>
    
  );
}
