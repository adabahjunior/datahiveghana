import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/PageHeader";
import { Loader2, ShieldCheck } from "lucide-react";
import { formatGHS, calcPaystackCharge } from "@/lib/format";
import { startPaystackCheckout } from "@/lib/paystack";
import { toast } from "sonner";

const SUBAGENT_BASE_FEE = 30;

export default function SubAgentSignup() {
  const { slug } = useParams<{ slug: string }>();
  const { user, profile, isSubAgent, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const paystackPublicKey = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY;

  const [loading, setLoading] = useState(true);
  const [processingWallet, setProcessingWallet] = useState(false);
  const [processingPaystack, setProcessingPaystack] = useState(false);
  const [store, setStore] = useState<any>(null);

  useEffect(() => {
    if (!slug) return;
    (async () => {
      const { data } = await supabase
        .from("agent_stores")
        .select("id,agent_id,store_name,slug,subagent_fee_addon,is_active")
        .eq("slug", slug)
        .maybeSingle();
      setStore(data);
      setLoading(false);
    })();
  }, [slug]);

  const addon = Number(store?.subagent_fee_addon || 0);
  const totalFee = SUBAGENT_BASE_FEE + addon;
  const paystackTotal = totalFee + calcPaystackCharge(totalFee);

  const canActivate = useMemo(() => {
    if (!user || !profile || !store) return false;
    if (!store.is_active) return false;
    if (isSubAgent) return false;
    if (store.agent_id === user.id) return false;
    return true;
  }, [user, profile, store, isSubAgent]);

  const activateViaWallet = async () => {
    if (!slug) return;
    setProcessingWallet(true);
    const { data, error } = await supabase.functions.invoke("activate-subagent", {
      body: {
        store_slug: slug,
        payment_method: "wallet",
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

  if (!store) {
    return (
      <div className="animate-fade-in p-6">
        <PageHeader title="Subagent Signup" description="Store not found" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="animate-fade-in p-6">
        <PageHeader title={`Become a Subagent of ${store.store_name}`} description="Sign in first to continue." />
        <Card className="p-6 max-w-xl">
          <Button asChild>
            <Link to="/auth">Sign In / Create Account</Link>
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title={`Become a Subagent of ${store.store_name}`}
        description="Unlock subagent pricing and build your own mini-store under this agent network."
      />

      <div className="max-w-2xl">
        <Card className="p-6 border-primary/30">
          <div className="flex items-start gap-3 mb-6">
            <ShieldCheck className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <p className="font-semibold">Subagent Activation Pricing</p>
              <p className="text-sm text-muted-foreground mt-1">Platform base is fixed at 30 GHS. This store may add a signup addon.</p>
            </div>
          </div>

          <div className="space-y-2 text-sm mb-6">
            <div className="flex justify-between"><span className="text-muted-foreground">Platform base fee</span><span>{formatGHS(SUBAGENT_BASE_FEE)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Agent addon</span><span>{formatGHS(addon)}</span></div>
            <div className="flex justify-between border-t border-border pt-2 font-semibold"><span>Total activation fee</span><span>{formatGHS(totalFee)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Paystack charge</span><span>{formatGHS(calcPaystackCharge(totalFee))}</span></div>
            <div className="flex justify-between font-semibold"><span>Paystack checkout total</span><span>{formatGHS(paystackTotal)}</span></div>
          </div>

          {!canActivate ? (
            <p className="text-sm text-muted-foreground">This account cannot be activated as subagent for this store.</p>
          ) : (
            <div className="grid sm:grid-cols-2 gap-3">
              <Button variant="outline" onClick={activateViaWallet} disabled={processingWallet || processingPaystack}>
                {processingWallet && <Loader2 className="h-4 w-4 animate-spin" />} Pay {formatGHS(totalFee)} from Wallet
              </Button>
              <Button onClick={activateViaPaystack} disabled={processingWallet || processingPaystack}>
                {processingPaystack && <Loader2 className="h-4 w-4 animate-spin" />} Pay {formatGHS(paystackTotal)} with Paystack
              </Button>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
