import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Pencil, Plus, Trash2, GraduationCap, ChevronDown, ChevronRight, MessageCircle } from "lucide-react";
import { formatGHS } from "@/lib/format";

type School = {
  id: string;
  name: string;
  description: string | null;
  is_published: boolean;
  display_order: number;
};

type FormType = {
  id: string;
  school_id: string;
  name: string;
  price: number;
  is_active: boolean;
};

type Order = {
  id: string;
  school_name: string;
  form_type_name: string;
  full_name: string;
  phone: string;
  email: string;
  amount_paid: number;
  reference: string;
  status: string;
  created_at: string;
};

export default function AdminUniversityFormsPage() {
  const [activeTab, setActiveTab] = useState<"schools" | "orders" | "settings">("schools");

  // ── Schools ──────────────────────────────────────────────────────────────────
  const [schools, setSchools] = useState<School[]>([]);
  const [loadingSchools, setLoadingSchools] = useState(true);
  const [expandedSchool, setExpandedSchool] = useState<string | null>(null);
  const [formTypesBySchool, setFormTypesBySchool] = useState<Record<string, FormType[]>>({});
  const [loadingFormTypes, setLoadingFormTypes] = useState<Record<string, boolean>>({});

  // School dialog
  const [schoolDialog, setSchoolDialog] = useState(false);
  const [editingSchool, setEditingSchool] = useState<School | null>(null);
  const [schoolName, setSchoolName] = useState("");
  const [schoolDesc, setSchoolDesc] = useState("");
  const [schoolOrder, setSchoolOrder] = useState("0");
  const [savingSchool, setSavingSchool] = useState(false);
  const [deletingSchool, setDeletingSchool] = useState<School | null>(null);

  // Form type dialog
  const [ftDialog, setFtDialog] = useState(false);
  const [ftSchoolId, setFtSchoolId] = useState("");
  const [editingFt, setEditingFt] = useState<FormType | null>(null);
  const [ftName, setFtName] = useState("");
  const [ftPrice, setFtPrice] = useState("");
  const [savingFt, setSavingFt] = useState(false);
  const [deletingFt, setDeletingFt] = useState<FormType | null>(null);

  // ── Orders ───────────────────────────────────────────────────────────────────
  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);

  // ── Settings ─────────────────────────────────────────────────────────────────
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);

  // Load schools
  const loadSchools = async () => {
    setLoadingSchools(true);
    const { data, error } = await (supabase as any)
      .from("university_schools")
      .select("id, name, description, is_published, display_order")
      .order("display_order")
      .order("name");
    if (error) toast.error(error.message);
    else setSchools(data || []);
    setLoadingSchools(false);
  };

  // Load form types for a school
  const loadFormTypes = async (schoolId: string) => {
    setLoadingFormTypes((p) => ({ ...p, [schoolId]: true }));
    const { data } = await (supabase as any)
      .from("university_form_types")
      .select("id, school_id, name, price, is_active")
      .eq("school_id", schoolId)
      .order("price");
    setFormTypesBySchool((p) => ({ ...p, [schoolId]: data || [] }));
    setLoadingFormTypes((p) => ({ ...p, [schoolId]: false }));
  };

  // Load orders
  const loadOrders = async () => {
    setLoadingOrders(true);
    const { data, error } = await (supabase as any)
      .from("university_form_orders")
      .select("id, school_name, form_type_name, full_name, phone, email, amount_paid, reference, status, created_at")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) toast.error(error.message);
    else setOrders(data || []);
    setLoadingOrders(false);
  };

  // Load settings
  const loadSettings = async () => {
    const { data } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "university_forms_whatsapp")
      .maybeSingle();
    if (data?.value) {
      const v = data.value;
      setWhatsappNumber(typeof v === "string" ? v : "");
    }
  };

  useEffect(() => {
    loadSchools();
    loadSettings();
  }, []);

  useEffect(() => {
    if (activeTab === "orders") loadOrders();
  }, [activeTab]);

  // Toggle school expand
  const toggleExpand = (schoolId: string) => {
    if (expandedSchool === schoolId) {
      setExpandedSchool(null);
    } else {
      setExpandedSchool(schoolId);
      if (!formTypesBySchool[schoolId]) loadFormTypes(schoolId);
    }
  };

  // Toggle publish
  const togglePublish = async (school: School) => {
    const { error } = await (supabase as any)
      .from("university_schools")
      .update({ is_published: !school.is_published })
      .eq("id", school.id);
    if (error) { toast.error(error.message); return; }
    setSchools((prev) =>
      prev.map((s) => s.id === school.id ? { ...s, is_published: !s.is_published } : s)
    );
    toast.success(school.is_published ? "School unpublished" : "School published");
  };

  // Toggle form type active
  const toggleFtActive = async (ft: FormType) => {
    const { error } = await (supabase as any)
      .from("university_form_types")
      .update({ is_active: !ft.is_active })
      .eq("id", ft.id);
    if (error) { toast.error(error.message); return; }
    setFormTypesBySchool((p) => ({
      ...p,
      [ft.school_id]: (p[ft.school_id] || []).map((f) =>
        f.id === ft.id ? { ...f, is_active: !f.is_active } : f
      ),
    }));
    toast.success(ft.is_active ? "Form type deactivated" : "Form type activated");
  };

  // Open school dialog for create/edit
  const openSchoolDialog = (school?: School) => {
    setEditingSchool(school || null);
    setSchoolName(school?.name || "");
    setSchoolDesc(school?.description || "");
    setSchoolOrder(String(school?.display_order ?? 0));
    setSchoolDialog(true);
  };

  const saveSchool = async () => {
    if (!schoolName.trim()) { toast.error("School name is required"); return; }
    setSavingSchool(true);

    const payload = {
      name: schoolName.trim(),
      description: schoolDesc.trim() || null,
      display_order: Number(schoolOrder) || 0,
    };

    let error;
    if (editingSchool) {
      ({ error } = await (supabase as any)
        .from("university_schools")
        .update(payload)
        .eq("id", editingSchool.id));
    } else {
      ({ error } = await (supabase as any)
        .from("university_schools")
        .insert({ ...payload, is_published: false }));
    }

    setSavingSchool(false);
    if (error) { toast.error(error.message); return; }

    toast.success(editingSchool ? "School updated" : "School added");
    setSchoolDialog(false);
    loadSchools();
  };

  const deleteSchool = async () => {
    if (!deletingSchool) return;
    const { error } = await (supabase as any)
      .from("university_schools")
      .delete()
      .eq("id", deletingSchool.id);
    if (error) { toast.error(error.message); return; }
    toast.success("School deleted");
    setDeletingSchool(null);
    setFormTypesBySchool((p) => {
      const copy = { ...p };
      delete copy[deletingSchool.id];
      return copy;
    });
    loadSchools();
  };

  // Open form type dialog
  const openFtDialog = (schoolId: string, ft?: FormType) => {
    setFtSchoolId(schoolId);
    setEditingFt(ft || null);
    setFtName(ft?.name || "");
    setFtPrice(ft ? String(ft.price) : "");
    setFtDialog(true);
  };

  const saveFt = async () => {
    if (!ftName.trim()) { toast.error("Form type name is required"); return; }
    const price = parseFloat(ftPrice);
    if (isNaN(price) || price < 0) { toast.error("Enter a valid price"); return; }
    setSavingFt(true);

    const payload = { name: ftName.trim(), price, is_active: true };
    let error;
    if (editingFt) {
      ({ error } = await (supabase as any)
        .from("university_form_types")
        .update({ name: ftName.trim(), price })
        .eq("id", editingFt.id));
    } else {
      ({ error } = await (supabase as any)
        .from("university_form_types")
        .insert({ ...payload, school_id: ftSchoolId }));
    }

    setSavingFt(false);
    if (error) { toast.error(error.message); return; }
    toast.success(editingFt ? "Form type updated" : "Form type added");
    setFtDialog(false);
    loadFormTypes(ftSchoolId);
  };

  const deleteFt = async () => {
    if (!deletingFt) return;
    const { error } = await (supabase as any)
      .from("university_form_types")
      .delete()
      .eq("id", deletingFt.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Form type deleted");
    const sid = deletingFt.school_id;
    setDeletingFt(null);
    loadFormTypes(sid);
  };

  // Save WhatsApp setting
  const saveSettings = async () => {
    const num = whatsappNumber.trim();
    if (!num) { toast.error("Enter a WhatsApp number"); return; }
    setSavingSettings(true);
    const { error } = await supabase
      .from("app_settings")
      .upsert({ key: "university_forms_whatsapp", value: num as any }, { onConflict: "key" });
    setSavingSettings(false);
    if (error) { toast.error(error.message); return; }
    toast.success("WhatsApp number saved");
  };

  const tabs: { id: "schools" | "orders" | "settings"; label: string }[] = [
    { id: "schools", label: "Schools & Forms" },
    { id: "orders", label: "Orders" },
    { id: "settings", label: "Settings" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">University Forms</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Manage schools, form types, and view orders.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === t.id
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── SCHOOLS TAB ── */}
      {activeTab === "schools" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{schools.length} school(s) total</p>
            <Button size="sm" onClick={() => openSchoolDialog()}>
              <Plus className="h-4 w-4 mr-1" /> Add School
            </Button>
          </div>

          {loadingSchools ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : schools.length === 0 ? (
            <Card className="p-10 text-center">
              <GraduationCap className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <p className="font-medium">No schools added yet.</p>
              <p className="text-sm text-muted-foreground">Click "Add School" to get started.</p>
            </Card>
          ) : (
            <div className="space-y-2">
              {schools.map((school) => {
                const isExpanded = expandedSchool === school.id;
                const fts = formTypesBySchool[school.id] || [];
                const loadingFts = loadingFormTypes[school.id];

                return (
                  <Card key={school.id} className="overflow-hidden">
                    {/* School row */}
                    <div className="flex items-center gap-3 px-4 py-3">
                      <button
                        className="flex items-center gap-2 flex-1 min-w-0 text-left"
                        onClick={() => toggleExpand(school.id)}
                      >
                        {isExpanded
                          ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                          : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
                        <div className="min-w-0">
                          <p className="font-semibold text-sm">{school.name}</p>
                          {school.description && (
                            <p className="text-xs text-muted-foreground truncate">{school.description}</p>
                          )}
                        </div>
                      </button>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant={school.is_published ? "default" : "secondary"} className="text-xs">
                          {school.is_published ? "Published" : "Draft"}
                        </Badge>
                        <Switch
                          checked={school.is_published}
                          onCheckedChange={() => togglePublish(school)}
                          title="Toggle publish"
                        />
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openSchoolDialog(school)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-500 hover:text-red-600"
                          onClick={() => setDeletingSchool(school)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>

                    {/* Form types section */}
                    {isExpanded && (
                      <div className="border-t border-border bg-muted/30 px-4 py-3">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Form Types</p>
                          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => openFtDialog(school.id)}>
                            <Plus className="h-3 w-3 mr-1" /> Add Form Type
                          </Button>
                        </div>
                        {loadingFts ? (
                          <div className="py-4 flex justify-center">
                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                          </div>
                        ) : fts.length === 0 ? (
                          <p className="text-xs text-muted-foreground py-3 text-center">No form types yet. Add one above.</p>
                        ) : (
                          <div className="space-y-1.5">
                            {fts.map((ft) => (
                              <div
                                key={ft.id}
                                className="flex items-center justify-between rounded-lg bg-background border border-border px-3 py-2"
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <Switch
                                    checked={ft.is_active}
                                    onCheckedChange={() => toggleFtActive(ft)}
                                    className="scale-90"
                                  />
                                  <span className="text-sm font-medium">{ft.name}</span>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <span className="text-sm font-bold text-primary">{formatGHS(ft.price)}</span>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() => openFtDialog(school.id, ft)}
                                  >
                                    <Pencil className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-red-500 hover:text-red-600"
                                    onClick={() => setDeletingFt(ft)}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── ORDERS TAB ── */}
      {activeTab === "orders" && (
        <div>
          {loadingOrders ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : orders.length === 0 ? (
            <Card className="p-10 text-center">
              <p className="font-medium text-muted-foreground">No form orders yet.</p>
            </Card>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="min-w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    {["School", "Form Type", "Name", "Phone", "Email", "Amount", "Reference", "Date"].map((h) => (
                      <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {orders.map((o) => (
                    <tr key={o.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-3 py-2.5 font-medium whitespace-nowrap">{o.school_name}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap">{o.form_type_name}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap">{o.full_name}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap">{o.phone}</td>
                      <td className="px-3 py-2.5">{o.email}</td>
                      <td className="px-3 py-2.5 font-semibold whitespace-nowrap text-green-600">{formatGHS(o.amount_paid)}</td>
                      <td className="px-3 py-2.5 font-mono text-xs whitespace-nowrap">{o.reference}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap text-muted-foreground">
                        {new Date(o.created_at).toLocaleDateString("en-GH", {
                          year: "numeric", month: "short", day: "numeric",
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── SETTINGS TAB ── */}
      {activeTab === "settings" && (
        <Card className="p-6 max-w-lg">
          <div className="flex items-center gap-2 mb-1">
            <MessageCircle className="h-5 w-5 text-green-500" />
            <h3 className="font-semibold">WhatsApp Contact Number</h3>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            This number will be used in the "Contact Admin via WhatsApp" button shown to users after a successful purchase.
            Enter the number in international format without the "+" sign (e.g. <span className="font-mono">233241234567</span>).
          </p>
          <div className="space-y-1.5 mb-4">
            <Label htmlFor="wa-number">WhatsApp Number</Label>
            <Input
              id="wa-number"
              placeholder="e.g. 233241234567"
              value={whatsappNumber}
              onChange={(e) => setWhatsappNumber(e.target.value)}
            />
          </div>
          <Button onClick={saveSettings} disabled={savingSettings}>
            {savingSettings && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save Number
          </Button>
        </Card>
      )}

      {/* ── School dialog ── */}
      <Dialog open={schoolDialog} onOpenChange={setSchoolDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingSchool ? "Edit School" : "Add School"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>School Name *</Label>
              <Input placeholder="e.g. University of Ghana" value={schoolName} onChange={(e) => setSchoolName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Description (optional)</Label>
              <Textarea
                placeholder="Short description…"
                value={schoolDesc}
                onChange={(e) => setSchoolDesc(e.target.value)}
                rows={2}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Display Order</Label>
              <Input type="number" min={0} value={schoolOrder} onChange={(e) => setSchoolOrder(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSchoolDialog(false)}>Cancel</Button>
            <Button onClick={saveSchool} disabled={savingSchool}>
              {savingSchool && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingSchool ? "Save Changes" : "Add School"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Form type dialog ── */}
      <Dialog open={ftDialog} onOpenChange={setFtDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingFt ? "Edit Form Type" : "Add Form Type"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Form Type Name *</Label>
              <Input placeholder="e.g. Undergraduate Admission" value={ftName} onChange={(e) => setFtName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Price (GHS) *</Label>
              <Input
                type="number"
                min={0}
                step={0.01}
                placeholder="e.g. 150"
                value={ftPrice}
                onChange={(e) => setFtPrice(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFtDialog(false)}>Cancel</Button>
            <Button onClick={saveFt} disabled={savingFt}>
              {savingFt && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingFt ? "Save Changes" : "Add Form Type"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete school confirm ── */}
      <AlertDialog open={!!deletingSchool} onOpenChange={(o) => { if (!o) setDeletingSchool(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete School?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>{deletingSchool?.name}</strong> and all its form types. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-red-500 hover:bg-red-600" onClick={deleteSchool}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Delete form type confirm ── */}
      <AlertDialog open={!!deletingFt} onOpenChange={(o) => { if (!o) setDeletingFt(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Form Type?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>{deletingFt?.name}</strong>. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-red-500 hover:bg-red-600" onClick={deleteFt}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
