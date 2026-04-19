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

    const { subagent_user_id, action } = await req.json();
    if (!subagent_user_id || typeof subagent_user_id !== "string") return fail("subagent_user_id is required", "INVALID_INPUT");
    if (!["activate", "deactivate"].includes(action)) return fail("action must be activate or deactivate", "INVALID_INPUT");

    const { data: assignment } = await supabase
      .from("subagent_assignments")
      .select("id,parent_agent_id,status")
      .eq("subagent_user_id", subagent_user_id)
      .eq("parent_agent_id", user.id)
      .maybeSingle();

    if (!assignment) return fail("Subagent assignment not found", "NOT_FOUND");

    if (action === "deactivate") {
      const { error: statusError } = await supabase
        .from("subagent_assignments")
        .update({ status: "inactive" })
        .eq("id", assignment.id);
      if (statusError) return fail(`Failed to deactivate: ${statusError.message}`, "UPDATE_FAILED");

      await supabase.from("user_roles").delete().eq("user_id", subagent_user_id).eq("role", "sub_agent");
      return json({ success: true, status: "inactive" });
    }

    const { error: roleError } = await supabase
      .from("user_roles")
      .upsert({ user_id: subagent_user_id, role: "sub_agent" }, { onConflict: "user_id,role" });
    if (roleError) return fail(`Failed to activate role: ${roleError.message}`, "ROLE_ASSIGN_FAILED");

    const { error: activateError } = await supabase
      .from("subagent_assignments")
      .update({ status: "active" })
      .eq("id", assignment.id);
    if (activateError) return fail(`Failed to activate assignment: ${activateError.message}`, "UPDATE_FAILED");

    return json({ success: true, status: "active" });
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
