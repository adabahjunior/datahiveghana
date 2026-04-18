import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { PageHeader } from "@/components/PageHeader";
import { formatGHS, formatVolume, networkLabel } from "@/lib/format";
import { ArrowRight, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

const networkSlugMap: Record<string, "mtn" | "telecel" | "airteltigo_ishare" | "airteltigo_bigtime"> = {
  mtn: "mtn",
  telecel: "telecel",
  "airteltigo-ishare": "airteltigo_ishare",
  "airteltigo-bigtime": "airteltigo_bigtime",
};

const accentClass: Record<string, string> = {
  mtn: "border-mtn/40 hover:border-mtn",
  telecel: "border-telecel/40 hover:border-telecel",
  airteltigo_ishare: "border-airteltigo/40 hover:border-airteltigo",
  airteltigo_bigtime: "border-airteltigo/40 hover:border-airteltigo",
};

const dotClass: Record<string, string> = {
  mtn: "bg-mtn",
  telecel: "bg-telecel",
  airteltigo_ishare: "bg-airteltigo",
  airteltigo_bigtime: "bg-airteltigo",
};

export default function BuyData() {
  const { network: networkSlug } = useParams<{ network: string }>();
  const network = networkSlugMap[networkSlug || ""];
  const { isAgent, profile, refreshProfile } = useAuth();
  const [packages, setPackages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any>(null);
  const [phone, setPhone] = useState("");
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    if (!network) return;
    setLoading(true);
    supabase.from("data_packages").select("*").eq("network", network).eq("is_active", true)
      .order("display_order").then(({ data }) => {
        setPackages(data || []);
        setLoading(false);
      });
  }, [network]);

  if (!network) return <div className="p-8">Unknown network.</div>;

  const priceFor = (p: any) => isAgent ? Number(p.agent_price) : Number(p.guest_price);

  const handleBuy = async () => {
    if (!selected || !phone || phone.length < 10) {
      toast.error("Enter a valid recipient phone number");
      return;
    }
    setPaying(true);
    const { data, error } = await supabase.functions.invoke("purchase-data", {
      body: { package_id: selected.id, recipient_phone: phone },
    });
    setPaying(false);
    if (error || !data?.success) {
      toast.error(data?.error || error?.message || "Purchase failed");
      return;
    }
    toast.success("Order placed! Data is being delivered.");
    setSelected(null);
    setPhone("");
    await refreshProfile();
  };

  return (
    <div className="animate-fade-in">
      <PageHeader
        title={networkLabel[network]}
        description="Choose a bundle and enter the recipient's number to complete your order."
      />

      {!isAgent && (
        <Card className="p-5 mb-8 bg-primary/5 border-primary/30 flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
              <Sparkles className="h-4 w-4 text-primary-foreground" />
            </div>
            <div>
              <p className="font-bold text-sm">Agents get significantly cheaper prices</p>
              <p className="text-xs text-muted-foreground mt-0.5">Become an agent and unlock wholesale pricing across all networks.</p>
            </div>
          </div>
          <Button asChild size="sm"><Link to="/my-store">Become an Agent <ArrowRight className="h-3 w-3 ml-1" /></Link></Button>
        </Card>
      )}

      <p className="text-sm text-muted-foreground mb-4">
        Wallet balance: <span className="font-bold text-foreground">{formatGHS(profile?.wallet_balance || 0)}</span>
      </p>

      {loading ? (
        <div className="py-20 text-center text-sm text-muted-foreground">Loading bundles...</div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {packages.map((p) => (
            <Card key={p.id} className={`p-6 transition-colors ${accentClass[network]}`}>
              <div className="flex items-center gap-2 mb-4">
                <span className={`h-2 w-2 rounded-full ${dotClass[network]}`} />
                <span className="text-xs uppercase tracking-wider text-muted-foreground">{networkLabel[network]}</span>
              </div>
              <p className="text-3xl font-bold">{formatVolume(p.volume_mb)}</p>
              {p.validity_days && <p className="text-sm text-muted-foreground mt-1">Valid for {p.validity_days} days</p>}
              <div className="my-5 pt-5 border-t border-border">
                <p className="text-2xl font-bold">{formatGHS(priceFor(p))}</p>
                {!isAgent && <p className="text-xs text-muted-foreground line-through mt-0.5">Agent: {formatGHS(p.agent_price)}</p>}
              </div>
              <Button className="w-full" onClick={() => setSelected(p)}>Buy Now</Button>
            </Card>
          ))}
          {packages.length === 0 && (
            <p className="col-span-full py-12 text-center text-sm text-muted-foreground">No bundles available for this network yet.</p>
          )}
        </div>
      )}

      {/* Checkout dialog */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Purchase</DialogTitle>
            <DialogDescription>Enter the phone number that will receive the data bundle.</DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="space-y-5">
              <div className="rounded-lg bg-muted p-4 space-y-1.5 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Network</span><span className="font-medium">{networkLabel[selected.network]}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Bundle</span><span className="font-medium">{formatVolume(selected.volume_mb)}</span></div>
                <div className="flex justify-between pt-2 border-t border-border"><span className="text-muted-foreground">Total</span><span className="font-bold">{formatGHS(priceFor(selected))}</span></div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Recipient Phone Number</Label>
                <Input id="phone" placeholder="0244000000" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
              <p className="text-xs text-muted-foreground">Paid from wallet. Balance: {formatGHS(profile?.wallet_balance || 0)}</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelected(null)}>Cancel</Button>
            <Button onClick={handleBuy} disabled={paying}>
              {paying && <Loader2 className="h-4 w-4 animate-spin" />} Confirm & Pay
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
