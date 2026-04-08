import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, CheckCircle } from "lucide-react";

interface CheckoutDialogProps {
  open: boolean;
  onClose: () => void;
  pkg: { id: string; name: string; base_price: number; network_id: string } | null;
}

export default function CheckoutDialog({ open, onClose, pkg }: CheckoutDialogProps) {
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);

  if (!pkg) return null;

  const handlePurchase = async () => {
    if (!phone || phone.length < 10) {
      toast.error("Please enter a valid phone number");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.from("orders").insert({
        package_id: pkg.id,
        phone_number: phone,
        buyer_type: "guest",
        final_price: pkg.base_price,
        status: "pending",
      }).select("id").single();

      if (error) throw error;
      setOrderId(data.id);
      toast.success("Order placed successfully!");
    } catch (err: any) {
      toast.error(err.message || "Failed to place order");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setOrderId(null);
    setPhone("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="glass-card border-border/50 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">
            {orderId ? "Order Confirmed!" : "Quick Checkout"}
          </DialogTitle>
        </DialogHeader>

        {orderId ? (
          <div className="flex flex-col items-center gap-4 py-6">
            <CheckCircle className="h-16 w-16 text-primary animate-pulse-glow" />
            <p className="text-center text-muted-foreground">
              Your order has been placed. Track it with ID:
            </p>
            <code className="px-4 py-2 rounded-lg bg-secondary text-sm font-mono text-primary">
              {orderId.slice(0, 8).toUpperCase()}
            </code>
            <Button onClick={handleClose} className="w-full mt-2">Done</Button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="glass-card rounded-lg p-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Package</span>
                <span className="font-heading font-bold">{pkg.name}</span>
              </div>
              <div className="flex justify-between items-center mt-2">
                <span className="text-sm text-muted-foreground">Price</span>
                <span className="font-bold text-gradient">GH₵{pkg.base_price.toFixed(2)}</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                placeholder="0XX XXX XXXX"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                maxLength={15}
                className="bg-secondary/50"
              />
            </div>

            <Button onClick={handlePurchase} disabled={loading} className="w-full glow-sm">
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Pay GH₵{pkg.base_price.toFixed(2)}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
