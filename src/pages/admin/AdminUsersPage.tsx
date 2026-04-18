import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function AdminUsersPage() {
  const [users, setUsers] = useState<any[]>([]);

  const load = async () => {
    const { data } = await supabase.from("profiles").select("*").order("created_at", { ascending: false }).limit(1000);
    setUsers(data || []);
  };

  useEffect(() => {
    load();
  }, []);

  const revokeAgentAccess = async (user: any) => {
    const { error: profileError } = await supabase
      .from("profiles")
      .update({ is_agent: false })
      .eq("user_id", user.user_id);

    if (profileError) {
      toast.error(profileError.message);
      return;
    }

    await supabase.from("user_roles").delete().eq("user_id", user.user_id).eq("role", "agent");

    toast.success("Agent access revoked.");
    load();
  };

  const grantAgentAccess = async (user: any) => {
    const { error: profileError } = await supabase
      .from("profiles")
      .update({ is_agent: true })
      .eq("user_id", user.user_id);

    if (profileError) {
      toast.error(profileError.message);
      return;
    }

    const { error: roleError } = await supabase
      .from("user_roles")
      .upsert({ user_id: user.user_id, role: "agent" }, { onConflict: "user_id,role" });

    if (roleError) {
      toast.error(roleError.message);
      return;
    }

    await supabase.from("transactions").insert({
      user_id: user.user_id,
      type: "agent_activation",
      status: "success",
      amount: 0,
      description: "Admin granted agent access (fee waived)",
    });

    toast.success("Agent access granted instantly. Payment waived.");
    load();
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-3xl font-bold">Users</h2>
        <p className="text-muted-foreground mt-1">All users including agents.</p>
      </div>

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u) => (
              <TableRow key={u.id}>
                <TableCell>{u.full_name || "-"}</TableCell>
                <TableCell>{u.email}</TableCell>
                <TableCell>{u.is_agent ? <Badge>Agent</Badge> : <Badge variant="secondary">User</Badge>}</TableCell>
                <TableCell>
                  {u.is_agent ? <Badge>Agent Access Enabled</Badge> : <Badge variant="secondary">No Agent Access</Badge>}
                </TableCell>
                <TableCell className="space-x-2">
                  {!u.is_agent && (
                    <Button size="sm" onClick={() => grantAgentAccess(u)}>
                      Grant Agent Access
                    </Button>
                  )}
                  {u.is_agent && (
                    <Button size="sm" variant="destructive" onClick={() => revokeAgentAccess(u)}>
                      Revoke Agent Access
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
