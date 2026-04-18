import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function AdminAgentsPage() {
  const [agents, setAgents] = useState<any[]>([]);
  const [stores, setStores] = useState<any[]>([]);

  const load = async () => {
    const [{ data: a }, { data: s }] = await Promise.all([
      supabase.from("profiles").select("*").eq("is_agent", true).order("created_at", { ascending: false }),
      supabase.from("agent_stores").select("agent_id,store_name"),
    ]);
    setAgents(a || []);
    setStores(s || []);
  };

  useEffect(() => {
    load();
  }, []);

  const storeMap = useMemo(() => {
    const map = new Map<string, string>();
    stores.forEach((s) => map.set(s.agent_id, s.store_name));
    return map;
  }, [stores]);

  const revokeAgentAccess = async (agent: any) => {
    const { error: profileError } = await supabase
      .from("profiles")
      .update({ is_agent: false })
      .eq("user_id", agent.user_id);

    if (profileError) {
      toast.error(profileError.message);
      return;
    }

    await supabase.from("user_roles").delete().eq("user_id", agent.user_id).eq("role", "agent");

    toast.success("Agent access revoked");
    load();
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-3xl font-bold">Agents</h2>
        <p className="text-muted-foreground mt-1">Manage agent accounts and store visibility.</p>
      </div>

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Store Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {agents.map((agent) => (
              <TableRow key={agent.id}>
                <TableCell>{agent.full_name || "-"}</TableCell>
                <TableCell>{agent.email}</TableCell>
                <TableCell>{storeMap.get(agent.user_id) || "No store"}</TableCell>
                <TableCell>
                  <Badge>Active</Badge>
                </TableCell>
                <TableCell>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => revokeAgentAccess(agent)}
                  >
                    Revoke Agent Access
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
