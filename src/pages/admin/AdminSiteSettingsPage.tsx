import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type MaintenanceMode = {
  enabled: boolean;
  message: string;
};

export default function AdminSiteSettingsPage() {
  const [maintenance, setMaintenance] = useState<MaintenanceMode>({
    enabled: false,
    message: "DataHive Ghana is under maintenance and will be back shortly.",
  });
  const [whatsappUrl, setWhatsappUrl] = useState("");
  const [customerCare, setCustomerCare] = useState("");

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("key, value")
        .in("key", ["maintenance_mode", "whatsapp_channel_url", "customer_care_contact"]);

      (data || []).forEach((row) => {
        if (row.key === "maintenance_mode") {
          setMaintenance((row.value as MaintenanceMode) || maintenance);
        }
        if (row.key === "whatsapp_channel_url") {
          setWhatsappUrl(typeof row.value === "string" ? row.value : "");
        }
        if (row.key === "customer_care_contact") {
          setCustomerCare(typeof row.value === "string" ? row.value : "");
        }
      });
    };

    load();
  }, []);

  const save = async () => {
    const updates = [
      { key: "maintenance_mode", value: maintenance },
      { key: "whatsapp_channel_url", value: whatsappUrl },
      { key: "customer_care_contact", value: customerCare },
    ];

    const { error } = await supabase.from("app_settings").upsert(updates, { onConflict: "key" });
    if (error) return toast.error(error.message);

    toast.success("Site settings saved");
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-3xl font-bold">Site Setting</h2>
        <p className="text-muted-foreground mt-1">Control maintenance mode, WhatsApp channel, and support contacts.</p>
      </div>

      <Card className="p-5 space-y-4">
        <h3 className="font-bold">Maintenance System</h3>
        <div className="flex items-center gap-3">
          <Switch checked={maintenance.enabled} onCheckedChange={(checked) => setMaintenance({ ...maintenance, enabled: checked })} />
          <span className="text-sm">Enable maintenance mode (admins still have access)</span>
        </div>
        <div className="space-y-2">
          <Label>Maintenance message</Label>
          <Textarea rows={3} value={maintenance.message} onChange={(e) => setMaintenance({ ...maintenance, message: e.target.value })} />
        </div>
      </Card>

      <Card className="p-5 space-y-4">
        <h3 className="font-bold">WhatsApp Channel</h3>
        <div className="space-y-2">
          <Label>Channel Link</Label>
          <Input
            value={whatsappUrl}
            onChange={(e) => setWhatsappUrl(e.target.value)}
            placeholder="https://chat.whatsapp.com/..."
          />
        </div>
      </Card>

      <Card className="p-5 space-y-4">
        <h3 className="font-bold">Customer Care</h3>
        <div className="space-y-2">
          <Label>Contact shown on Report Issue page</Label>
          <Input value={customerCare} onChange={(e) => setCustomerCare(e.target.value)} placeholder="+233 XX XXX XXXX" />
        </div>
      </Card>

      <Button onClick={save}>Save Site Settings</Button>
    </div>
  );
}
