import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/PageHeader";
import { formatGHS, formatDateTime } from "@/lib/format";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs as InnerTabs, TabsContent as InnerTabsContent, TabsList as InnerTabsList, TabsTrigger as InnerTabsTrigger } from "@/components/ui/tabs";

type Row = {
  id: string;
  status: string;
  paid_amount: number;
  paid_via: string;
  created_at: string;
  subagent_user_id: string;
  parent_agent_id: string;
  source_store_id: string | null;
  subagent?: { full_name: string | null; email: string; phone: string | null };
  parent?: { full_name: string | null; email: string };
  store?: { store_name: string; slug: string } | null;
};

type AgentOption = { user_id: string; full_name: string | null; email: string };
type StoreOption = { id: string; agent_id: string; store_name: string };

export default function AdminSubAgentsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [agents, setAgents] = useState<AgentOption[]>([]);
  const [stores, setStores] = useState<StoreOption[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [addMode, setAddMode] = useState<"create" | "promote">("create");
  const [addBusy, setAddBusy] = useState(false);
  // create form
  const [cEmail, setCEmail] = useState("");
  const [cPassword, setCPassword] = useState("");
  const [cFullName, setCFullName] = useState("");
  const [cPhone, setCPhone] = useState("");
  const [cParent, setCParent] = useState("");
  const [cStore, setCStore] = useState("");
  // promote form
  const [pEmail, setPEmail] = useState("");
  const [pParent, setPParent] = useState("");
  const [pStore, setPStore] = useState("");

  const load = async () => {
    setLoading(true);
    const { data: assignments, error } = await supabase
      .from("subagent_assignments")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }

    const subagentIds = Array.from(new Set((assignments || []).map((a: any) => a.subagent_user_id)));
    const parentIds = Array.from(new Set((assignments || []).map((a: any) => a.parent_agent_id)));
    const storeIds = Array.from(new Set((assignments || []).map((a: any) => a.source_store_id).filter(Boolean)));

    const [{ data: subs }, { data: parents }, { data: stores }] = await Promise.all([
      supabase.from("profiles").select("user_id,full_name,email,phone").in("user_id", subagentIds.length ? subagentIds : ["00000000-0000-0000-0000-000000000000"]),
      supabase.from("profiles").select("user_id,full_name,email").in("user_id", parentIds.length ? parentIds : ["00000000-0000-0000-0000-000000000000"]),
      supabase.from("agent_stores").select("id,store_name,slug").in("id", storeIds.length ? storeIds : ["00000000-0000-0000-0000-000000000000"]),
    ]);

    const enriched = (assignments || []).map((a: any) => ({
      ...a,
      subagent: subs?.find((s: any) => s.user_id === a.subagent_user_id),
      parent: parents?.find((p: any) => p.user_id === a.parent_agent_id),
      store: stores?.find((s: any) => s.id === a.source_store_id) || null,
    }));

    setRows(enriched as Row[]);
    setLoading(false);
  };

  const loadAgents = async () => {
    const { data: agentRoles } = await supabase.from("user_roles").select("user_id").eq("role", "agent");
    const ids = (agentRoles || []).map((r: any) => r.user_id);
    if (ids.length === 0) { setAgents([]); setStores([]); return; }
    const [{ data: profs }, { data: strs }] = await Promise.all([
      supabase.from("profiles").select("user_id,full_name,email").in("user_id", ids),
      supabase.from("agent_stores").select("id,agent_id,store_name").in("agent_id", ids),
    ]);
    setAgents((profs || []) as AgentOption[]);
    setStores((strs || []) as StoreOption[]);
  };

  useEffect(() => { load(); loadAgents(); }, []);

  const filteredCreateStores = useMemo(() => stores.filter((s) => s.agent_id === cParent), [stores, cParent]);
  const filteredPromoteStores = useMemo(() => stores.filter((s) => s.agent_id === pParent), [stores, pParent]);

  const submitCreate = async () => {
    if (!cEmail || !cPassword || !cParent) { toast.error("Email, password and parent agent are required"); return; }
    setAddBusy(true);
    const { data, error } = await supabase.functions.invoke("admin-manage-subagent", {
      body: {
        action: "create_account",
        email: cEmail, password: cPassword, full_name: cFullName, phone: cPhone,
        parent_agent_id: cParent, source_store_id: cStore || null,
      },
    });
    setAddBusy(false);
    if (error || !data?.success) { toast.error(data?.error || error?.message || "Failed"); return; }
    toast.success("Subagent account created and activated");
    setCEmail(""); setCPassword(""); setCFullName(""); setCPhone(""); setCParent(""); setCStore("");
    setAddOpen(false);
    load();
  };

  const submitPromote = async () => {
    if (!pEmail || !pParent) { toast.error("User email and parent agent are required"); return; }
    setAddBusy(true);
    const { data: prof } = await supabase.from("profiles").select("user_id").eq("email", pEmail.trim()).maybeSingle();
    if (!prof?.user_id) { setAddBusy(false); toast.error("No user found with that email"); return; }
    const { data, error } = await supabase.functions.invoke("admin-manage-subagent", {
      body: {
        action: "promote_user",
        subagent_user_id: prof.user_id, parent_agent_id: pParent, source_store_id: pStore || null,
      },
    });
    setAddBusy(false);
    if (error || !data?.success) { toast.error(data?.error || error?.message || "Failed"); return; }
    toast.success("User promoted to subagent");
    setPEmail(""); setPParent(""); setPStore("");
    setAddOpen(false);
    load();
  };

  const act = async (id: string, action: "approve" | "revoke" | "reject") => {
    setBusyId(id);
    const { data, error } = await supabase.functions.invoke("admin-manage-subagent", {
      body: { assignment_id: id, action },
    });
    setBusyId(null);
    if (error || !data?.success) {
      toast.error(data?.error || error?.message || "Action failed");
      return;
    }
    toast.success(action === "approve" ? "Subagent approved" : action === "reject" ? "Account rejected" : "Subagent revoked");
    load();
  };

  const pending = rows.filter((r) => r.status === "pending");
  const active = rows.filter((r) => r.status === "active");
  const inactive = rows.filter((r) => r.status === "inactive");

  const renderTable = (items: Row[], showApprove = false) => (
    <Card className="overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Subagent</TableHead>
            <TableHead>Parent Agent</TableHead>
            <TableHead>Store</TableHead>
            <TableHead>Paid</TableHead>
            <TableHead>Via</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.length === 0 ? (
            <TableRow><TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-8">No records.</TableCell></TableRow>
          ) : items.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="text-xs">{formatDateTime(r.created_at)}</TableCell>
              <TableCell className="text-sm">
                <div className="font-medium">{r.subagent?.full_name || "—"}</div>
                <div className="text-xs text-muted-foreground">{r.subagent?.email}</div>
                {r.subagent?.phone && <div className="text-xs text-muted-foreground">{r.subagent.phone}</div>}
              </TableCell>
              <TableCell className="text-sm">
                <div>{r.parent?.full_name || "—"}</div>
                <div className="text-xs text-muted-foreground">{r.parent?.email}</div>
              </TableCell>
              <TableCell className="text-sm">{r.store?.store_name || "—"}</TableCell>
              <TableCell className="text-sm">{formatGHS(Number(r.paid_amount || 0))}</TableCell>
              <TableCell className="text-xs">{r.paid_via}</TableCell>
              <TableCell>
                <Badge variant={r.status === "active" ? "default" : r.status === "pending" ? "secondary" : "outline"}>
                  {r.status}
                </Badge>
              </TableCell>
              <TableCell className="space-x-2">
                {showApprove && r.status === "pending" && (
                  <>
                    <Button size="sm" disabled={busyId === r.id} onClick={() => act(r.id, "approve")}>
                      {busyId === r.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Approve (Free)"}
                    </Button>
                    <Button size="sm" variant="destructive" disabled={busyId === r.id} onClick={() => act(r.id, "reject")}>
                      Reject
                    </Button>
                  </>
                )}
                {r.status === "active" && (
                  <Button size="sm" variant="outline" disabled={busyId === r.id} onClick={() => act(r.id, "revoke")}>
                    Revoke
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );

  return (
    <div className="animate-fade-in">
      <PageHeader title="Subagents" description="Approve subagent accounts and override activation payment." />
      {loading ? (
        <div className="py-12 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>
      ) : (
        <Tabs defaultValue="pending">
          <TabsList className="mb-6">
            <TabsTrigger value="pending">Pending ({pending.length})</TabsTrigger>
            <TabsTrigger value="active">Active ({active.length})</TabsTrigger>
            <TabsTrigger value="inactive">Inactive ({inactive.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="pending">{renderTable(pending, true)}</TabsContent>
          <TabsContent value="active">{renderTable(active)}</TabsContent>
          <TabsContent value="inactive">{renderTable(inactive)}</TabsContent>
        </Tabs>
      )}
    </div>
  );
}
