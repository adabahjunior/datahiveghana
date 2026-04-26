import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/PageHeader";
import { formatGHS, calcPaystackCharge } from "@/lib/format";
import { startPaystackCheckout } from "@/lib/paystack";
import { toast } from "sonner";
import { Wallet as WalletIcon, Loader2, Info } from "lucide-react";

export default function Wallet() {
  const { profile, refreshProfile } = useAuth();
  const [amount, setAmount] = useState("");
  const [recoveryReference, setRecoveryReference] = useState("");
  const [recoveryAmount, setRecoveryAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [recovering, setRecovering] = useState(false);
  const paystackPublicKey = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY;

  const numAmount = parseFloat(amount) || 0;
  const charge = numAmount > 0 ? calcPaystackCharge(numAmount) : 0;
  const total = numAmount + charge;

  const handleTopUp = async () => {
    if (numAmount < 1) { toast.error("Enter a valid amount"); return; }
    if (!paystackPublicKey) { toast.error("Paystack is not configured"); return; }
    if (!profile?.email) { toast.error("Your account email is required for payment"); return; }

    setLoading(true);
    try {
      const reference = await startPaystackCheckout({
        publicKey: paystackPublicKey,
        email: profile.email,
        amountInGhs: total,
        metadata: {
          purpose: "wallet_topup",
          user_id: profile.user_id,
          topup_amount: numAmount,
          paystack_charge: charge,
        },
      });

      const { data, error } = await supabase.functions.invoke("simulate-topup", {
        body: { amount: numAmount, charge, reference },
      });

      if (error || !data?.success) {
        toast.error(data?.error || error?.message || "Top-up verification failed");
        return;
      }

      toast.success(`Wallet topped up with ${formatGHS(numAmount)}`);
      setAmount("");
      await refreshProfile();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Payment failed";
      if (message !== "Payment cancelled") toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleRecoverTopUp = async () => {
    const reference = recoveryReference.trim();
    if (!reference) {
      toast.error("Enter your Paystack reference");
      return;
    }

    setRecovering(true);
    try {
      const parsedAmount = recoveryAmount.trim() ? Number(recoveryAmount) : undefined;
      const payload: Record<string, unknown> = { reference };
      if (typeof parsedAmount === "number" && Number.isFinite(parsedAmount) && parsedAmount > 0) {
        payload.amount = parsedAmount;
      }

      const { data, error } = await supabase.functions.invoke("simulate-topup", {
        body: payload,
      });

      if (error || !data?.success) {
        toast.error(data?.error || error?.message || "Top-up recovery failed");
        return;
      }

      toast.success("Previous top-up recovered successfully");
      setRecoveryReference("");
      setRecoveryAmount("");
      await refreshProfile();
    } finally {
      setRecovering(false);
    }
  };

  return (
    <div className="animate-fade-in">
      <PageHeader title="Wallet" description="Top up your wallet to buy data instantly." />

      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1 p-8 bg-primary text-primary-foreground border-0">
          <WalletIcon className="h-6 w-6 mb-6" />
          <p className="text-xs uppercase tracking-wider opacity-80">Current Balance</p>
          <p className="text-4xl font-bold mt-2">{formatGHS(profile?.wallet_balance || 0)}</p>
        </Card>

        <Card className="lg:col-span-2 p-8">
          <h3 className="font-bold text-lg mb-6">Top Up Wallet</h3>
          <div className="space-y-5 max-w-md">
            <div className="space-y-2">
              <Label htmlFor="amount">Amount (GHS)</Label>
              <Input id="amount" type="number" step="0.01" min="1" placeholder="0.00"
                value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>

            <div className="grid grid-cols-4 gap-2">
              {[10, 50, 100, 200].map((q) => (
                <Button key={q} type="button" variant="outline" size="sm" onClick={() => setAmount(q.toString())}>
                  {q}
                </Button>
              ))}
            </div>

            {numAmount > 0 && (
              <div className="rounded-lg bg-muted p-4 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Top-up amount</span><span>{formatGHS(numAmount)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Paystack charges</span><span>{formatGHS(charge)}</span></div>
                <div className="flex justify-between font-bold pt-2 border-t border-border"><span>You'll be charged</span><span>{formatGHS(total)}</span></div>
              </div>
            )}

            <Button onClick={handleTopUp} disabled={loading || numAmount < 1} className="w-full" size="lg">
              {loading && <Loader2 className="h-4 w-4 animate-spin" />} Top Up {formatGHS(total)}
            </Button>

            <p className="text-xs text-muted-foreground flex items-start gap-2">
              <Info className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
              Top-up is processed with Paystack and credited after secure server verification.
            </p>

            <div className="pt-4 border-t border-border space-y-3">
              <p className="text-sm font-semibold">Recover Previous Top-up</p>
              <p className="text-xs text-muted-foreground">
                If an older payment succeeded but was not credited, enter the Paystack reference to recover it.
              </p>
              <div className="space-y-2">
                <Label htmlFor="recovery-reference">Paystack Reference</Label>
                <Input
                  id="recovery-reference"
                  placeholder="e.g. T1234567890"
                  value={recoveryReference}
                  onChange={(e) => setRecoveryReference(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="recovery-amount">Top-up Amount (optional)</Label>
                <Input
                  id="recovery-amount"
                  type="number"
                  step="0.01"
                  min="1"
                  placeholder="e.g. 50"
                  value={recoveryAmount}
                  onChange={(e) => setRecoveryAmount(e.target.value)}
                />
              </div>
              <Button onClick={handleRecoverTopUp} disabled={recovering || !recoveryReference.trim()} variant="outline" className="w-full">
                {recovering && <Loader2 className="h-4 w-4 animate-spin" />} Recover Top-up
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
