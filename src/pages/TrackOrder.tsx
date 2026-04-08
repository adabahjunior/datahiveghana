import { useState } from "react";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Search, CheckCircle, Clock, XCircle } from "lucide-react";

const statusConfig: Record<string, { icon: any; color: string; label: string }> = {
  pending: { icon: Clock, color: "text-yellow-400", label: "Pending" },
  completed: { icon: CheckCircle, color: "text-green-400", label: "Completed" },
  failed: { icon: XCircle, color: "text-red-400", label: "Failed" },
};

export default function TrackOrder() {
  const [orderId, setOrderId] = useState("");
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handleTrack = async () => {
    if (!orderId.trim()) {
      toast.error("Enter an order ID");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("orders")
        .select("*, data_packages(name, network_id)")
        .or(`id.eq.${orderId.toLowerCase()},id.ilike.${orderId}%`)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        toast.error("Order not found");
        setOrder(null);
      } else {
        setOrder(data);
      }
    } catch {
      toast.error("Could not find order");
    } finally {
      setLoading(false);
    }
  };

  const status = order ? statusConfig[order.status] : null;
  const StatusIcon = status?.icon;

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="container mx-auto px-4 py-16 max-w-md">
        <h1 className="font-heading text-3xl font-bold mb-8 text-center">Track Your Order</h1>

        <div className="glass-card rounded-xl p-6">
          <div className="space-y-2 mb-4">
            <Label htmlFor="order-id">Order ID</Label>
            <div className="flex gap-2">
              <Input
                id="order-id"
                placeholder="Enter order ID"
                value={orderId}
                onChange={(e) => setOrderId(e.target.value)}
                className="bg-secondary/50"
              />
              <Button onClick={handleTrack} disabled={loading}>
                <Search className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {order && status && StatusIcon && (
            <div className="mt-6 p-4 rounded-lg bg-secondary/30 space-y-3">
              <div className="flex items-center gap-2">
                <StatusIcon className={`h-5 w-5 ${status.color}`} />
                <span className="font-heading font-bold">{status.label}</span>
              </div>
              <div className="text-sm space-y-1 text-muted-foreground">
                <p>Package: <span className="text-foreground">{order.data_packages?.name}</span></p>
                <p>Phone: <span className="text-foreground">{order.phone_number}</span></p>
                <p>Price: <span className="text-gradient font-bold">GH₵{Number(order.final_price).toFixed(2)}</span></p>
                <p>Date: <span className="text-foreground">{new Date(order.created_at).toLocaleDateString()}</span></p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
