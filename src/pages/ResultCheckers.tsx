import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatGHS, formatDateTime } from "@/lib/format";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const examLabel: Record<string, string> = {
  wassce: "WASSCE",
  bece: "BECE",
};

export default function ResultCheckers() {
  const { profile, roles, refreshProfile } = useAuth();
  const [products, setProducts] = useState<any[]>([]);
  const [subagentBase, setSubagentBase] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [recipientPhone, setRecipientPhone] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [successOrder, setSuccessOrder] = useState<any>(null);

  const isSubAgent = roles.includes("sub_agent");
  const isAgent = profile?.is_agent || roles.includes("agent");
  const isAdmin = roles.includes("admin");

  const resolvePrice = (product: any) => {
    if (isSubAgent) return Number(subagentBase[product.id] ?? product.agent_price);
    if (isAgent) return Number(product.agent_price);
    return Number(product.user_price);
  };

  const load = async () => {
    if (!profile?.user_id) return;
    setLoading(true);

    const [{ data: checkerProducts }, { data: checkerOrders }] = await Promise.all([
      (supabase as any).from("checker_products").select("*").eq("is_active", true).order("display_order"),
      (supabase as any)
        .from("checker_orders")
        .select("id,exam_type,quantity,amount_paid,checker_serial,checker_pin,created_at,checker:checker_products(name)")
        .eq("buyer_user_id", profile.user_id)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

    if (isSubAgent) {
      const { data: assignment } = await supabase
        .from("subagent_assignments")
        .select("parent_agent_id,status")
        .eq("subagent_user_id", profile.user_id)
        .eq("status", "active")
        .maybeSingle();

      if (assignment?.parent_agent_id) {
        const { data: basePrices } = await (supabase as any)
          .from("subagent_checker_prices")
          .select("checker_id,base_price")
          .eq("parent_agent_id", assignment.parent_agent_id)
          .eq("is_active", true);

        const map: Record<string, number> = {};
        (basePrices || []).forEach((p: any) => {
          map[p.checker_id] = Number(p.base_price);
        });
        setSubagentBase(map);
      } else {
        setSubagentBase({});
      }
    }

    setProducts(checkerProducts || []);
    setHistory(checkerOrders || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [profile?.user_id, isSubAgent]);

  const totalSpent = useMemo(() => history.reduce((sum, h) => sum + Number(h.amount_paid || 0), 0), [history]);

  const handleBuy = async () => {
    if (!selected) return;
    const phone = recipientPhone.trim();
    const qty = Number(quantity);
    if (phone.length < 10) {
      toast.error("Enter a valid phone number");
      return;
    }
    if (!Number.isInteger(qty) || qty <= 0 || qty > 50) {
      toast.error("Quantity must be between 1 and 50");
      return;
    }

    setBuying(true);
    const { data, error } = await supabase.functions.invoke("purchase-checker", {
      body: {
        checker_id: selected.id,
        recipient_phone: phone,
        quantity: qty,
      },
    });
    setBuying(false);

    if (error || !data?.success) {
      toast.error(data?.error || error?.message || "Failed to buy checker");
      return;
    }

    toast.success("Purchase successful. Checker details will be sent via SMS.");
    setSuccessOrder(data?.checker ? { ...data.checker, recipient_phone: phone } : null);
    setSelected(null);
    setRecipientPhone("");
    setQuantity("1");
    await refreshProfile();
    await load();
  };

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Result Checkers"
        description="Buy WASSCE and BECE checkers instantly from your dashboard."
      />

      {successOrder && (
        <Card className="p-6 mb-6 border-success/40 bg-success/5">
          <h3 className="text-xl font-bold">Purchase Successful</h3>
          <p className="text-sm text-muted-foreground mt-1">Your payment was successful. Please check your SMS for checker details.</p>
          <div className="mt-4 space-y-2 text-sm">
            <p><span className="text-muted-foreground">Checker:</span> {successOrder.name} ({String(successOrder.exam_type || "").toUpperCase()})</p>
            <p><span className="text-muted-foreground">Quantity:</span> {successOrder.quantity}</p>
            <p><span className="text-muted-foreground">Phone:</span> {successOrder.recipient_phone || "Provided phone number"}</p>
          </div>
          <div className="mt-4 rounded-lg border border-border bg-card p-3 text-sm text-muted-foreground">
            Checker serial and PIN are no longer shown on-screen. They will be sent to the provided phone number via SMS.
          </div>
          <Button className="mt-4" variant="outline" onClick={() => setSuccessOrder(null)}>Close Success Page</Button>
        </Card>
      )}

      <div className="grid sm:grid-cols-3 gap-4 mb-8">
        <Card className="p-5">
          <p className="text-xs uppercase text-muted-foreground">Wallet Balance</p>
          <p className="text-2xl font-bold mt-1">{formatGHS(Number(profile?.wallet_balance || 0))}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs uppercase text-muted-foreground">Checker Purchases</p>
          <p className="text-2xl font-bold mt-1">{history.length}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs uppercase text-muted-foreground">Total Spent</p>
          <p className="text-2xl font-bold mt-1">{formatGHS(totalSpent)}</p>
        </Card>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-2 text-xs">
        <Badge variant="secondary">{isAdmin ? "Admin" : "User"} dashboard pricing: {isAgent ? "Agent base" : "User/Admin base"}</Badge>
        {isSubAgent && <Badge variant="secondary">Subagent base is set by your parent agent</Badge>}
      </div>

      {loading ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin inline mr-2" /> Loading checkers...
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 gap-5 mb-10">
          {products.map((p) => (
            <Card key={p.id} className="p-6">
              <div className="flex items-center justify-between mb-3">
                <Badge variant="outline">{examLabel[p.exam_type] || p.exam_type.toUpperCase()}</Badge>
                <span className="text-xs text-muted-foreground">{p.name}</span>
              </div>

              <p className="text-3xl font-bold">{formatGHS(resolvePrice(p))}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {isSubAgent ? "Your subagent base price" : isAgent ? "Your agent base price" : "User/Admin price"}
              </p>

              <Button className="w-full mt-5" onClick={() => setSelected(p)}>
                Buy {examLabel[p.exam_type] || "Checker"}
              </Button>
            </Card>
          ))}
        </div>
      )}

      <h3 className="font-bold mb-3">My Recent Checker Purchases</h3>
      <Card className="overflow-hidden">
        {history.length === 0 ? (
          <div className="p-10 text-sm text-muted-foreground text-center">No checker purchases yet.</div>
        ) : (
          <div className="divide-y divide-border">
            {history.map((h) => (
              <div key={h.id} className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <p className="font-medium">{h.checker?.name || "Checker"} ({examLabel[h.exam_type] || h.exam_type?.toUpperCase()})</p>
                  <p className="text-xs text-muted-foreground">{formatDateTime(h.created_at)}</p>
                </div>
                <div className="text-sm text-right">
                  <p className="font-bold">{formatGHS(Number(h.amount_paid || 0))}</p>
                  <p className="text-xs text-muted-foreground">Qty: {h.quantity || 1} | Checker details sent via SMS</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Buy {selected?.name}</DialogTitle>
            <DialogDescription>
              Enter the recipient phone number. Payment is deducted from wallet.
            </DialogDescription>
          </DialogHeader>

          {selected && (
            <div className="space-y-3">
              <div className="rounded-lg bg-muted p-4 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Exam</span><span>{examLabel[selected.exam_type] || selected.exam_type}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Unit Price</span><span>{formatGHS(resolvePrice(selected))}</span></div>
                <div className="flex justify-between font-bold"><span>Total</span><span>{formatGHS(resolvePrice(selected) * (Number(quantity) || 1))}</span></div>
              </div>
              <div className="space-y-2">
                <Label>Quantity</Label>
                <Input type="number" min="1" max="50" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Phone Number</Label>
                <Input placeholder="0244000000" value={recipientPhone} onChange={(e) => setRecipientPhone(e.target.value)} />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelected(null)}>Cancel</Button>
            <Button onClick={handleBuy} disabled={buying}>
              {buying && <Loader2 className="h-4 w-4 animate-spin" />} Confirm Purchase
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
