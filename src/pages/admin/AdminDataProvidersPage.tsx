import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle2, Settings as SettingsIcon, Zap } from "lucide-react";

type Provider = {
  id: string;
  provider_key: string;
  display_name: string;
  base_url: string;
  api_key: string;
  webhook_url: string;
  is_active: boolean;
  notes: string | null;
  updated_at: string;
};

const PROVIDER_DOCS: Record<string, { hint: string; defaultBaseUrl: string; authStyle: string }> = {
  spendless: {
    hint: "Uses X-API-Key header. POST to base URL with networkKey/recipient/capacity payload.",
    defaultBaseUrl: "https://spendless.top/api/purchase",
    authStyle: "X-API-Key header",
  },
  superdata: {
    hint: "SuperData Ghana API — uses Authorization: Bearer <api_key>. POST /buy-data with {bundle_id, phone_number, network}.",
    defaultBaseUrl: "https://superbdatafy.com/api/v1",
    authStyle: "Bearer token",
  },
  diceconsult: {
    hint: "DiceConsult Multi-Network — uses X-API-KEY header. POST with {network, phone, bundle: '1GB'}.",
    defaultBaseUrl: "https://diceconsultgh.com/api/api_router.php",
    authStyle: "X-API-KEY header",
  },
  byteboss: {
    hint: "ByteBoss Data API — Authorization: Bearer <key>. We auto-match bundles by network + size (GB) against /plans, then POST /data.",
    defaultBaseUrl: "https://byteboss.shop/api/v1",
    authStyle: "Bearer token",
  },

};

export default function AdminDataProvidersPage() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Provider | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("data_provider_settings")
      .select("*")
      .order("display_name");
    if (error) {
      toast.error(error.message);
    } else {
      setProviders((data || []) as Provider[]);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const activate = async (p: Provider) => {
    if (!p.api_key) {
      toast.error("Add an API key before activating this provider.");
      return;
    }
    const { error } = await supabase
      .from("data_provider_settings")
      .update({ is_active: true })
      .eq("id", p.id);
    if (error) { toast.error(error.message); return; }
    toast.success(`${p.display_name} is now the active provider.`);
    load();
  };

  const saveEdit = async () => {
    if (!editing) return;
    setSaving(true);
    const { error } = await supabase
      .from("data_provider_settings")
      .update({
        display_name: editing.display_name,
        base_url: editing.base_url,
        api_key: editing.api_key,
        webhook_url: editing.webhook_url,
        notes: editing.notes,
      })
      .eq("id", editing.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Provider updated.");
    setEditing(null);
    load();
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-3xl font-bold">Data Providers</h2>
        <p className="text-muted-foreground mt-1">
          Switch between upstream data APIs. Only the active provider receives orders.
        </p>
      </div>

      {loading ? (
        <Card className="p-8 text-center text-muted-foreground">Loading…</Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {providers.map((p) => {
            const doc = PROVIDER_DOCS[p.provider_key];
            const hasKey = !!p.api_key;
            return (
              <Card key={p.id} className={`p-5 ${p.is_active ? "border-primary ring-2 ring-primary/40" : ""}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-semibold">{p.display_name}</h3>
                      {p.is_active && (
                        <Badge className="gap-1"><CheckCircle2 className="h-3 w-3" /> Active</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{p.provider_key}</p>
                  </div>
                  <Badge variant={hasKey ? "secondary" : "outline"}>
                    {hasKey ? "Key set" : "No key"}
                  </Badge>
                </div>

                <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                  <div><span className="font-medium text-foreground">Auth:</span> {doc?.authStyle || "—"}</div>
                  <div className="truncate"><span className="font-medium text-foreground">URL:</span> {p.base_url || doc?.defaultBaseUrl || "—"}</div>
                  {doc?.hint && <p className="text-[11px] leading-snug pt-1">{doc.hint}</p>}
                </div>

                <div className="mt-4 flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setEditing(p)}>
                    <SettingsIcon className="h-4 w-4 mr-1" /> Configure
                  </Button>
                  {!p.is_active && (
                    <Button size="sm" onClick={() => activate(p)} disabled={!hasKey}>
                      <Zap className="h-4 w-4 mr-1" /> Set Active
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Configure {editing?.display_name}</DialogTitle>
            <DialogDescription>
              {editing && PROVIDER_DOCS[editing.provider_key]?.hint}
            </DialogDescription>
          </DialogHeader>

          {editing && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Display name</Label>
                <Input
                  value={editing.display_name}
                  onChange={(e) => setEditing({ ...editing, display_name: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Base URL</Label>
                <Input
                  placeholder={PROVIDER_DOCS[editing.provider_key]?.defaultBaseUrl}
                  value={editing.base_url}
                  onChange={(e) => setEditing({ ...editing, base_url: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>API Key</Label>
                <Input
                  type="password"
                  placeholder="Paste API key from provider"
                  value={editing.api_key}
                  onChange={(e) => setEditing({ ...editing, api_key: e.target.value })}
                />
                <p className="text-[11px] text-muted-foreground">
                  Stored securely; only admins can read or modify.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label>Webhook URL (optional)</Label>
                <Input
                  value={editing.webhook_url}
                  onChange={(e) => setEditing({ ...editing, webhook_url: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Notes (optional)</Label>
                <Textarea
                  rows={3}
                  value={editing.notes || ""}
                  onChange={(e) => setEditing({ ...editing, notes: e.target.value })}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={saveEdit} disabled={saving}>{saving ? "Saving…" : "Save changes"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
