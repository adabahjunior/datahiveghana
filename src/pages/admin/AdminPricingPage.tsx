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

const initialCheckerForm = {
  id: "",
  exam_type: "wassce",
  name: "",
  user_price: 0,
  agent_price: 0,
  is_active: true,
};

export default function AdminPricingPage() {
  const [packages, setPackages] = useState<any[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<any>(initialForm);
  const [checkers, setCheckers] = useState<any[]>([]);
  const [editingCheckerId, setEditingCheckerId] = useState<string | null>(null);
  const [checkerForm, setCheckerForm] = useState<any>(initialCheckerForm);

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
    const [{ data }, { data: checkerProducts }] = await Promise.all([
      supabase.from("data_packages").select("*").order("network").order("display_order"),
      (supabase as any).from("checker_products").select("*").order("display_order"),
    ]);
    setPackages(data || []);
    setCheckers(checkerProducts || []);
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

  const submitChecker = async (e: React.FormEvent) => {
    e.preventDefault();

    if (editingCheckerId) {
      const { error } = await (supabase as any)
        .from("checker_products")
        .update({
          exam_type: checkerForm.exam_type,
          name: checkerForm.name,
          user_price: Number(checkerForm.user_price),
          agent_price: Number(checkerForm.agent_price),
          is_active: !!checkerForm.is_active,
        })
        .eq("id", editingCheckerId);

      if (error) return toast.error(error.message);
      toast.success("Checker product updated");
    } else {
      const nextOrder = (checkers || []).length + 1;
      const { error } = await (supabase as any).from("checker_products").insert({
        exam_type: checkerForm.exam_type,
        name: checkerForm.name,
        user_price: Number(checkerForm.user_price),
        agent_price: Number(checkerForm.agent_price),
        is_active: !!checkerForm.is_active,
        display_order: nextOrder,
      });
      if (error) return toast.error(error.message);
      toast.success("Checker product added");
    }

    setEditingCheckerId(null);
    setCheckerForm(initialCheckerForm);
    load();
  };

  const editChecker = (checker: any) => {
    setEditingCheckerId(checker.id);
    setCheckerForm({
      id: checker.id,
      exam_type: checker.exam_type,
      name: checker.name,
      user_price: Number(checker.user_price),
      agent_price: Number(checker.agent_price),
      is_active: !!checker.is_active,
    });
  };

  const removeChecker = async (id: string) => {
    const { error } = await (supabase as any).from("checker_products").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Checker product deleted");
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

      <Card className="p-5">
        <h3 className="font-bold mb-4">Result Checker Pricing</h3>
        <form onSubmit={submitChecker} className="grid lg:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Exam Type</Label>
            <Select value={checkerForm.exam_type} onValueChange={(v) => setCheckerForm({ ...checkerForm, exam_type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="wassce">WASSCE</SelectItem>
                <SelectItem value="bece">BECE</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Product Name</Label>
            <Input value={checkerForm.name} onChange={(e) => setCheckerForm({ ...checkerForm, name: e.target.value })} required />
          </div>
          <div className="space-y-2">
            <Label>User/Admin Price</Label>
            <Input type="number" step="0.01" value={checkerForm.user_price} onChange={(e) => setCheckerForm({ ...checkerForm, user_price: e.target.value })} required />
          </div>
          <div className="space-y-2">
            <Label>Agent Base Price</Label>
            <Input type="number" step="0.01" value={checkerForm.agent_price} onChange={(e) => setCheckerForm({ ...checkerForm, agent_price: e.target.value })} required />
          </div>
          <div className="flex items-center gap-3 mt-7">
            <Switch checked={!!checkerForm.is_active} onCheckedChange={(checked) => setCheckerForm({ ...checkerForm, is_active: checked })} />
            <span className="text-sm">Active</span>
          </div>
          <div className="flex items-end gap-2">
            <Button type="submit">{editingCheckerId ? "Update" : "Add"} Checker</Button>
            {editingCheckerId && (
              <Button type="button" variant="outline" onClick={() => { setEditingCheckerId(null); setCheckerForm(initialCheckerForm); }}>
                Cancel
              </Button>
            )}
          </div>
        </form>
      </Card>

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Exam</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>User/Admin Price</TableHead>
              <TableHead>Agent Base Price</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {checkers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-10">
                  No checker products yet.
                </TableCell>
              </TableRow>
            ) : checkers.map((checker) => (
              <TableRow key={checker.id}>
                <TableCell>{String(checker.exam_type).toUpperCase()}</TableCell>
                <TableCell>{checker.name}</TableCell>
                <TableCell>{checker.user_price}</TableCell>
                <TableCell>{checker.agent_price}</TableCell>
                <TableCell>{checker.is_active ? "Active" : "Inactive"}</TableCell>
                <TableCell className="space-x-2">
                  <Button size="sm" variant="outline" onClick={() => editChecker(checker)}>Edit</Button>
                  <Button size="sm" variant="destructive" onClick={() => removeChecker(checker.id)}>Delete</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
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
