import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDateTime, formatVolume } from "@/lib/format";
import { Loader2, Truck, Search } from "lucide-react";

const statusVariant = (status: string | null | undefined): "default" | "secondary" | "destructive" | "outline" => {
  const s = String(status || "").toLowerCase();
  if (s === "delivered") return "default";
  if (s === "failed") return "destructive";
  if (s === "processing" || s === "pending") return "secondary";
  return "outline";
};

export const OrderTrackerBanner = () => {
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any | null>(null);
  const [message, setMessage] = useState("");

  const handleTrack = async () => {
    const value = phone.trim();
    if (value.replace(/\D/g, "").length < 9) {
      setMessage("Enter a valid phone number.");
      setResult(null);
      return;
    }

    setLoading(true);
    setMessage("");

    const { data, error } = await supabase.functions.invoke("track-order", {
      body: { phone: value },
    });

    setLoading(false);

    if (error || !data?.success) {
      setResult(null);
      setMessage(data?.error || error?.message || "Could not fetch order status.");
      return;
    }

    if (!data?.found) {
      setResult(null);
      setMessage(data?.message || "No order found for this number.");
      return;
    }

    setResult(data);
  };

  return (
    <div className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/90">
      <div className="container mx-auto px-4 py-3">
        <Card className="p-3 sm:p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="flex items-center gap-2 min-w-0 lg:w-72">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Truck className="h-4 w-4 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold">Order Tracker</p>
                <p className="text-xs text-muted-foreground">Enter your phone number to check delivery status.</p>
              </div>
            </div>

            <div className="flex-1 flex flex-col sm:flex-row gap-2">
              <Input
                placeholder="Enter phone number (e.g. 0241234567)"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="sm:flex-1"
              />
              <Button onClick={handleTrack} disabled={loading} className="sm:w-auto w-full">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                <span className="ml-2">Track</span>
              </Button>
            </div>
          </div>

          {message && (
            <p className="text-xs text-muted-foreground mt-2">{message}</p>
          )}

          {result?.latest && (
            <div className="mt-3 rounded-lg border border-border bg-muted/30 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted-foreground">Latest status:</span>
                <Badge variant={statusVariant(result.latest.status)}>{String(result.latest.status || "unknown").toUpperCase()}</Badge>
                <span className="text-xs text-muted-foreground">Phone: {result.latest.recipient_phone}</span>
                <span className="text-xs text-muted-foreground">Source: {result.latest.source === "store" ? `Store${result.latest.store_name ? ` (${result.latest.store_name})` : ""}` : "Dashboard"}</span>
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {String(result.latest.network || "").toUpperCase()} • {formatVolume(Number(result.latest.volume_mb || 0))} • Updated {formatDateTime(result.latest.updated_at || result.latest.created_at)}
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};
