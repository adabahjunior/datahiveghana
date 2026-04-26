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

type ActivationFee = {
  enabled: boolean;
  amount: number;
};

export default function AdminSiteSettingsPage() {
  const [maintenance, setMaintenance] = useState<MaintenanceMode>({
    enabled: false,
    message: "BenzosData Ghana is under maintenance and will be back shortly.",
  });
  const [whatsappUrl, setWhatsappUrl] = useState("");
  const [customerCare, setCustomerCare] = useState("");
  const [agentFee, setAgentFee] = useState<ActivationFee>({ enabled: true, amount: 80 });
  const [subagentFee, setSubagentFee] = useState<ActivationFee>({ enabled: true, amount: 30 });
  const [savingFees, setSavingFees] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("key, value")
        .in("key", ["maintenance_mode", "whatsapp_channel_url", "customer_care_contact", "agent_activation_fee", "subagent_activation_fee"]);

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
        if (row.key === "agent_activation_fee") {
          const v = row.value as ActivationFee | number | null;
          if (v && typeof v === "object" && "amount" in v) {
            setAgentFee({ enabled: v.enabled !== false, amount: Number(v.amount) });
          } else if (typeof v === "number") {
            setAgentFee({ enabled: true, amount: v });
          }
        }
        if (row.key === "subagent_activation_fee") {
          const v = row.value as ActivationFee | null;
          if (v && typeof v === "object" && "amount" in v) {
            setSubagentFee({ enabled: v.enabled !== false, amount: Number(v.amount) });
          }
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

  const saveFees = async () => {
    if (agentFee.enabled && (isNaN(agentFee.amount) || agentFee.amount < 0)) {
      toast.error("Agent activation fee must be 0 or more");
      return;
    }
    if (subagentFee.enabled && (isNaN(subagentFee.amount) || subagentFee.amount < 0)) {
      toast.error("Subagent activation fee must be 0 or more");
      return;
    }

    setSavingFees(true);
    const { error } = await supabase.from("app_settings").upsert([
      { key: "agent_activation_fee", value: agentFee },
      { key: "subagent_activation_fee", value: subagentFee },
    ], { onConflict: "key" });
    setSavingFees(false);

    if (error) return toast.error(error.message);
    toast.success("Activation fees saved");
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

      <Card className="p-5 space-y-6">
        <div>
          <h3 className="font-bold">Activation Fees</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Set the one-time fee for agents and sub-agents to activate their accounts. Toggle off to allow free registration.
          </p>
        </div>

        <div className="space-y-4 border rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Agent Activation Fee</p>
              <p className="text-sm text-muted-foreground">One-time fee to become a primary agent.</p>
            </div>
            <Switch
              checked={agentFee.enabled}
              onCheckedChange={(checked) => setAgentFee({ ...agentFee, enabled: checked })}
            />
          </div>
          {agentFee.enabled ? (
            <div className="space-y-2 max-w-xs">
              <Label>Amount (GHS)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={agentFee.amount}
                onChange={(e) => setAgentFee({ ...agentFee, amount: Number(e.target.value) })}
              />
            </div>
          ) : (
            <p className="text-sm text-primary font-medium">Agents will register for free</p>
          )}
        </div>

        <div className="space-y-4 border rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Subagent Activation Fee</p>
              <p className="text-sm text-muted-foreground">Platform base fee charged on subagent signup (before store addon).</p>
            </div>
            <Switch
              checked={subagentFee.enabled}
              onCheckedChange={(checked) => setSubagentFee({ ...subagentFee, enabled: checked })}
            />
          </div>
          {subagentFee.enabled ? (
            <div className="space-y-2 max-w-xs">
              <Label>Amount (GHS)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={subagentFee.amount}
                onChange={(e) => setSubagentFee({ ...subagentFee, amount: Number(e.target.value) })}
              />
            </div>
          ) : (
            <p className="text-sm text-primary font-medium">Subagents pay only any store addon (if set), or register for free</p>
          )}
        </div>

        <Button onClick={saveFees} disabled={savingFees}>
          {savingFees ? "Saving..." : "Save Activation Fees"}
        </Button>
      </Card>
    </div>
  );
}

