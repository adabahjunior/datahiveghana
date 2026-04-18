import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { networkLabel } from "@/lib/format";
import { toast } from "sonner";

const initialForm = {
  id: "",
  network: "mtn",
  name: "",
  volume_gb: 1,
  validity_days: "",
  guest_price: 0,
  agent_price: 0,
  is_active: true,
};

export default function AdminPricingPage() {
  const [packages, setPackages] = useState<any[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<any>(initialForm);

  const groupedPackages = useMemo(() => {
    const groups: Record<string, any[]> = {
      mtn: [],
      telecel: [],
      airteltigo_ishare: [],
      airteltigo_bigtime: [],
    };

    packages.forEach((pkg) => {
      if (!groups[pkg.network]) groups[pkg.network] = [];
      groups[pkg.network].push(pkg);
    });

    return groups;
  }, [packages]);

  const load = async () => {
    const { data } = await supabase.from("data_packages").select("*").order("network").order("display_order");
    setPackages(data || []);
  };

  useEffect(() => {
    load();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (editingId) {
      const payload = {
        network: form.network,
        name: form.name,
        volume_mb: Math.round(Number(form.volume_gb) * 1024),
        validity_days: form.validity_days ? Number(form.validity_days) : null,
        guest_price: Number(form.guest_price),
        agent_price: Number(form.agent_price),
        is_active: !!form.is_active,
      };
      const { error } = await supabase.from("data_packages").update(payload).eq("id", editingId);
      if (error) return toast.error(error.message);
      toast.success("Package updated");
    } else {
      const nextDisplayOrder = groupedPackages[form.network]?.length || 0;
      const payload = {
        network: form.network,
        name: form.name,
        volume_mb: Math.round(Number(form.volume_gb) * 1024),
        validity_days: form.validity_days ? Number(form.validity_days) : null,
        guest_price: Number(form.guest_price),
        agent_price: Number(form.agent_price),
        display_order: nextDisplayOrder,
        is_active: !!form.is_active,
      };
      const { error } = await supabase.from("data_packages").insert(payload);
      if (error) return toast.error(error.message);
      toast.success("Package added");
    }

    setEditingId(null);
    setForm(initialForm);
    load();
  };

  const editPackage = (pkg: any) => {
    setEditingId(pkg.id);
    setForm({
      ...pkg,
      volume_gb: Number((Number(pkg.volume_mb) / 1024).toFixed(2)),
      validity_days: pkg.validity_days ?? "",
    });
  };

  const removePackage = async (id: string) => {
    const { error } = await supabase.from("data_packages").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Package deleted");
    load();
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-3xl font-bold">Pricing</h2>
        <p className="text-muted-foreground mt-1">Add, edit, and remove package pricing for all networks.</p>
      </div>

      <Card className="p-5">
        <form onSubmit={submit} className="grid lg:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Network</Label>
            <Select value={form.network} onValueChange={(v) => setForm({ ...form, network: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="mtn">MTN</SelectItem>
                <SelectItem value="telecel">Telecel</SelectItem>
                <SelectItem value="airteltigo_ishare">AirtelTigo iShare</SelectItem>
                <SelectItem value="airteltigo_bigtime">AirtelTigo BigTime</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Package Name</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div className="space-y-2">
            <Label>Volume (GB)</Label>
            <Input type="number" step="0.01" min="0.01" value={form.volume_gb} onChange={(e) => setForm({ ...form, volume_gb: e.target.value })} required />
          </div>
          <div className="space-y-2">
            <Label>Validity (days)</Label>
            <Input type="number" placeholder="Leave empty for Non-Expiry" value={form.validity_days} onChange={(e) => setForm({ ...form, validity_days: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Guest Price</Label>
            <Input type="number" step="0.01" value={form.guest_price} onChange={(e) => setForm({ ...form, guest_price: e.target.value })} required />
          </div>
          <div className="space-y-2">
            <Label>Agent Price</Label>
            <Input type="number" step="0.01" value={form.agent_price} onChange={(e) => setForm({ ...form, agent_price: e.target.value })} required />
          </div>
          <div className="flex items-center gap-3 mt-7">
            <Switch checked={!!form.is_active} onCheckedChange={(checked) => setForm({ ...form, is_active: checked })} />
            <span className="text-sm">Active</span>
          </div>
          <div className="flex items-end gap-2">
            <Button type="submit">{editingId ? "Update" : "Add"} Package</Button>
            {editingId && <Button type="button" variant="outline" onClick={() => { setEditingId(null); setForm(initialForm); }}>Cancel</Button>}
          </div>
        </form>
      </Card>

      {Object.entries(groupedPackages).map(([network, networkPackages]) => (
        <Card key={network} className="overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-muted/40">
            <h3 className="font-semibold">{networkLabel[network]}</h3>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Volume</TableHead>
                <TableHead>Validity</TableHead>
                <TableHead>Guest</TableHead>
                <TableHead>Agent</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {networkPackages.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-10">
                    No packages yet for {networkLabel[network]}.
                  </TableCell>
                </TableRow>
              ) : networkPackages.map((pkg) => (
                <TableRow key={pkg.id}>
                  <TableCell>{pkg.name}</TableCell>
                  <TableCell>{Number((Number(pkg.volume_mb) / 1024).toFixed(2))} GB</TableCell>
                  <TableCell>{pkg.validity_days ? `${pkg.validity_days} days` : "Non-Expiry"}</TableCell>
                  <TableCell>{pkg.guest_price}</TableCell>
                  <TableCell>{pkg.agent_price}</TableCell>
                  <TableCell className="space-x-2">
                    <Button size="sm" variant="outline" onClick={() => editPackage(pkg)}>Edit</Button>
                    <Button size="sm" variant="destructive" onClick={() => removePackage(pkg.id)}>Delete</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      ))}
    </div>
  );
}
