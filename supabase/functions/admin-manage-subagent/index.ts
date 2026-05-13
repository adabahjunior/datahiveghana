import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return fail("Method not allowed", "METHOD_NOT_ALLOWED");

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const auth = req.headers.get("Authorization");
    if (!auth) return fail("Unauthorized", "UNAUTHORIZED");

    const { data: { user }, error: userError } = await supabase.auth.getUser(auth.replace("Bearer ", ""));
    if (userError || !user) return fail("Unauthorized", "UNAUTHORIZED");

    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
    const isAdmin = (roles || []).some((r: any) => r.role === "admin");
    if (!isAdmin) return fail("Forbidden", "FORBIDDEN");

    const body = await req.json();
    const { action } = body;
    if (!["approve", "revoke", "reject", "create_account", "promote_user"].includes(action)) {
      return fail("invalid action", "INVALID_INPUT");
    }

    // Admin creates a brand-new subagent account (bypasses activation fee)
    if (action === "create_account") {
      const { email, password, full_name, phone, parent_agent_id, source_store_id } = body;
      if (!email || !password || !parent_agent_id) {
        return fail("email, password and parent_agent_id are required", "INVALID_INPUT");
      }

      const { data: created, error: createErr } = await supabase.auth.admin.createUser({
        email: String(email).trim(),
        password: String(password),
        email_confirm: true,
        user_metadata: { full_name: full_name || "", phone: phone || "" },
      });
      if (createErr || !created?.user) return fail(createErr?.message || "Failed to create user", "CREATE_USER_FAILED");

      const newUserId = created.user.id;

      const { error: roleErr } = await supabase
        .from("user_roles")
        .upsert({ user_id: newUserId, role: "sub_agent" }, { onConflict: "user_id,role" });
      if (roleErr) return fail(roleErr.message, "ROLE_ASSIGN_FAILED");

      const { error: assignErr } = await supabase.from("subagent_assignments").upsert({
        parent_agent_id,
        subagent_user_id: newUserId,
        source_store_id: source_store_id || null,
        paid_amount: 0,
        paid_via: "admin_created",
        status: "active",
      }, { onConflict: "subagent_user_id" });
      if (assignErr) return fail(assignErr.message, "ASSIGNMENT_FAILED");

      return json({ success: true, user_id: newUserId });
    }

    // Admin promotes an existing user to subagent under an agent (bypasses fee)
    if (action === "promote_user") {
      const { subagent_user_id, parent_agent_id, source_store_id } = body;
      if (!subagent_user_id || !parent_agent_id) {
        return fail("subagent_user_id and parent_agent_id are required", "INVALID_INPUT");
      }
      if (subagent_user_id === parent_agent_id) {
        return fail("A user cannot be a subagent of themselves", "INVALID_INPUT");
      }

      const { data: targetRoles } = await supabase.from("user_roles").select("role").eq("user_id", subagent_user_id);
      const roleNames = (targetRoles || []).map((r: any) => r.role);
      if (roleNames.includes("admin")) return fail("Cannot promote an admin", "INVALID_ACCOUNT");
      if (roleNames.includes("agent")) return fail("Cannot promote a primary agent", "INVALID_ACCOUNT");

      const { error: roleErr } = await supabase
        .from("user_roles")
        .upsert({ user_id: subagent_user_id, role: "sub_agent" }, { onConflict: "user_id,role" });
      if (roleErr) return fail(roleErr.message, "ROLE_ASSIGN_FAILED");

      const { error: assignErr } = await supabase.from("subagent_assignments").upsert({
        parent_agent_id,
        subagent_user_id,
        source_store_id: source_store_id || null,
        paid_amount: 0,
        paid_via: "admin_promoted",
        status: "active",
      }, { onConflict: "subagent_user_id" });
      if (assignErr) return fail(assignErr.message, "ASSIGNMENT_FAILED");

      return json({ success: true, user_id: subagent_user_id });
    }

    const { assignment_id } = body;
    if (!assignment_id || typeof assignment_id !== "string") return fail("assignment_id is required", "INVALID_INPUT");

    const { data: assignment } = await supabase
      .from("subagent_assignments")
      .select("id,subagent_user_id,parent_agent_id,status,source_store_id")
      .eq("id", assignment_id)
      .maybeSingle();

    if (!assignment) return fail("Assignment not found", "NOT_FOUND");

    if (action === "approve") {
      const { error: roleError } = await supabase
        .from("user_roles")
        .upsert({ user_id: assignment.subagent_user_id, role: "sub_agent" }, { onConflict: "user_id,role" });
      if (roleError) return fail(`Role assignment failed: ${roleError.message}`, "ROLE_ASSIGN_FAILED");

      const { error: updErr } = await supabase
        .from("subagent_assignments")
        .update({ status: "active", paid_via: "admin_override", paid_amount: 0 })
        .eq("id", assignment.id);
      if (updErr) return fail(updErr.message, "UPDATE_FAILED");

      return json({ success: true, status: "active" });
    }

    if (action === "reject") {
      const { error } = await supabase.from("subagent_assignments").delete().eq("id", assignment.id);
      if (error) return fail(error.message, "DELETE_FAILED");
      await supabase.from("user_roles").delete().eq("user_id", assignment.subagent_user_id).eq("role", "sub_agent");
      return json({ success: true, status: "rejected" });
    }

    // revoke
    const { error: updErr } = await supabase
      .from("subagent_assignments")
      .update({ status: "inactive" })
      .eq("id", assignment.id);
    if (updErr) return fail(updErr.message, "UPDATE_FAILED");
    await supabase.from("user_roles").delete().eq("user_id", assignment.subagent_user_id).eq("role", "sub_agent");
    return json({ success: true, status: "inactive" });
  } catch (e) {
    console.error(e);
    return fail((e as Error).message || "Unexpected error", "UNEXPECTED_ERROR");
  }
});

function fail(message: string, code: string) {
  return json({ success: false, error: message, code });
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
