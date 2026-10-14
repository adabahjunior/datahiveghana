import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/PageHeader";
import { formatGHS } from "@/lib/format";
import { toast } from "sonner";
import { Wallet as WalletIcon, Copy, Landmark, Info } from "lucide-react";

const details = {
  number: "0538973984",
  name: "Jeff Gyamfi Boakye",
  network: "MTN MoMo",
};

export default function Wallet() {
  const { profile } = useAuth();

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied`);
    } catch {
      toast.error("Unable to copy right now");
    }
  };

  return (
    <div className="animate-fade-in">
      <PageHeader title="Wallet" description="Top up your wallet manually via MTN MoMo." />

      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1 p-8 bg-primary text-primary-foreground border-0">
          <WalletIcon className="h-6 w-6 mb-6" />
          <p className="text-xs uppercase tracking-wider opacity-80">Current Balance</p>
          <p className="text-4xl font-bold mt-2">{formatGHS(profile?.wallet_balance || 0)}</p>
        </Card>

        <Card className="lg:col-span-2 p-8 border-primary/20 bg-primary/5">
          <div className="flex items-start gap-3">
            <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <Landmark className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-lg">Manual Wallet Top-up</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Send money to the MoMo account below and use your 5-digit code as the payment reference. Your wallet is credited once the admin confirms the payment.
              </p>
              <div className="grid sm:grid-cols-2 gap-4 mt-5 text-sm">
                <div className="rounded-lg border border-border bg-background p-4 space-y-2">
                  <div className="flex justify-between gap-4 items-center">
                    <span className="text-muted-foreground">Number</span>
                    <button className="font-semibold flex items-center gap-1" onClick={() => copy(details.number, "Number")}>
                      {details.number} <Copy className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="flex justify-between gap-4"><span className="text-muted-foreground">Name</span><span className="font-semibold text-right">{details.name}</span></div>
                  <div className="flex justify-between gap-4"><span className="text-muted-foreground">Network</span><span className="font-semibold">{details.network}</span></div>
                </div>
                <div className="rounded-lg border border-border bg-background p-4">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Your reference code</p>
                  <div className="flex items-center gap-3 mt-3">
                    <p className="text-3xl font-bold tracking-[0.3em]">{profile?.manual_topup_code || "-----"}</p>
                    <Button type="button" variant="outline" size="icon" onClick={() => profile?.manual_topup_code && copy(profile.manual_topup_code, "Code")} disabled={!profile?.manual_topup_code}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground flex items-start gap-2 mt-4">
                <Info className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                Always include this exact code as the reference, otherwise your payment cannot be matched to your account.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
