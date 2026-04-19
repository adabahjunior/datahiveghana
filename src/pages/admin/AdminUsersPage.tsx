import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function AdminUsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [resettingUserId, setResettingUserId] = useState<string | null>(null);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [resetTarget, setResetTarget] = useState<any | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

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

  const submitPasswordOverride = async () => {
    if (!resetTarget) return;
    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setResettingUserId(resetTarget.user_id);
    const { data, error } = await supabase.functions.invoke("admin-manage-user", {
      body: {
        action: "reset_password",
        user_id: resetTarget.user_id,
        new_password: newPassword,
      },
    });
    setResettingUserId(null);

    if (error || !data?.success) {
      toast.error(data?.error || error?.message || "Failed to reset password");
      return;
    }

    toast.success(`Password updated for ${resetTarget.email}`);
    setResetTarget(null);
    setNewPassword("");
    setConfirmPassword("");
  };

  const setBanStatus = async (user: any, shouldBan: boolean) => {
    setUpdatingUserId(user.user_id);

    const reason = shouldBan
      ? window.prompt("Optional reason for banning this account:", "") || ""
      : "";

    const { data, error } = await supabase.functions.invoke("admin-manage-user", {
      body: {
        action: shouldBan ? "ban" : "unban",
        user_id: user.user_id,
        reason,
      },
    });

    setUpdatingUserId(null);
    if (error || !data?.success) {
      toast.error(data?.error || error?.message || "Failed to update account status");
      return;
    }

    toast.success(shouldBan ? "User account banned." : "User account unbanned.");
    load();
  };

  const filteredUsers = users.filter((u) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return (
      String(u.full_name || "").toLowerCase().includes(q) ||
      String(u.email || "").toLowerCase().includes(q) ||
      String(u.phone || "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-3xl font-bold">Users</h2>
        <p className="text-muted-foreground mt-1">All users including agents.</p>
      </div>

      <Card className="p-4">
        <Input
          placeholder="Search by name, email, or phone"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </Card>

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
            {filteredUsers.map((u) => (
              <TableRow key={u.id}>
                <TableCell>{u.full_name || "-"}</TableCell>
                <TableCell>{u.email}</TableCell>
                <TableCell>{u.is_agent ? <Badge>Agent</Badge> : <Badge variant="secondary">User</Badge>}</TableCell>
                <TableCell>
                  {u.is_banned ? (
                    <Badge variant="destructive">Banned</Badge>
                  ) : u.is_agent ? (
                    <Badge>Agent Access Enabled</Badge>
                  ) : (
                    <Badge variant="secondary">No Agent Access</Badge>
                  )}
                </TableCell>
                <TableCell className="space-x-2 whitespace-nowrap">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={resettingUserId === u.user_id || updatingUserId === u.user_id}
                    onClick={() => setResetTarget(u)}
                  >
                    {resettingUserId === u.user_id ? "Updating..." : "Reset Password"}
                  </Button>
                  {u.is_banned ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={updatingUserId === u.user_id}
                      onClick={() => setBanStatus(u, false)}
                    >
                      {updatingUserId === u.user_id ? "Updating..." : "Unban"}
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={updatingUserId === u.user_id}
                      onClick={() => setBanStatus(u, true)}
                    >
                      {updatingUserId === u.user_id ? "Updating..." : "Ban"}
                    </Button>
                  )}
                  {!u.is_agent && (
                    <Button size="sm" disabled={updatingUserId === u.user_id} onClick={() => grantAgentAccess(u)}>
                      Grant Agent Access
                    </Button>
                  )}
                  {u.is_agent && (
                    <Button size="sm" variant="destructive" disabled={updatingUserId === u.user_id} onClick={() => revokeAgentAccess(u)}>
                      Revoke Agent Access
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {filteredUsers.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">
                  No users found for your search.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog
        open={!!resetTarget}
        onOpenChange={(open) => {
          if (!open) {
            setResetTarget(null);
            setNewPassword("");
            setConfirmPassword("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set New Password</DialogTitle>
            <DialogDescription>
              This will immediately override the current password for {resetTarget?.email || "this user"}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm Password</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setResetTarget(null)}>Cancel</Button>
            <Button onClick={submitPasswordOverride} disabled={!resetTarget || resettingUserId === resetTarget.user_id}>
              {resetTarget && resettingUserId === resetTarget.user_id ? "Updating..." : "Update Password"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
