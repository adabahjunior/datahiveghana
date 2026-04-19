import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Action = "reset_password" | "ban" | "unban";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return okFail("Unauthorized", "UNAUTHORIZED");

    const token = authHeader.replace("Bearer ", "");
    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !authData.user) return okFail("Unauthorized", "UNAUTHORIZED");

    const { data: role } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", authData.user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!role) return okFail("Admins only", "FORBIDDEN");

    const body = await req.json();
    const action = String(body?.action || "") as Action;
    const user_id = String(body?.user_id || "").trim();

    if (!user_id) return okFail("user_id is required", "INVALID_INPUT");

    if (action === "reset_password") {
      const newPassword = String(body?.new_password || "");
      if (!newPassword) return okFail("new_password is required", "INVALID_INPUT");
      if (newPassword.length < 6) return okFail("Password must be at least 6 characters", "INVALID_INPUT");
      if (newPassword.length > 72) return okFail("Password is too long", "INVALID_INPUT");

      const { error: updateError } = await supabase.auth.admin.updateUserById(user_id, {
        password: newPassword,
      });

      if (updateError) return okFail(updateError.message, "RESET_FAILED");
      return ok({ success: true });
    }

    if (action === "ban") {
      const reason = String(body?.reason || "").trim();

      const { error: banError } = await supabase.auth.admin.updateUserById(user_id, {
        ban_duration: "876000h",
      });
      if (banError) return okFail(banError.message, "BAN_FAILED");

      const { error: profileError } = await supabase
        .from("profiles")
        .update({ is_banned: true, ban_reason: reason || null })
        .eq("user_id", user_id);

      if (profileError) return okFail(profileError.message, "BAN_FAILED");
      return ok({ success: true });
    }

    if (action === "unban") {
      const { error: unbanError } = await supabase.auth.admin.updateUserById(user_id, {
        ban_duration: "none",
      });
      if (unbanError) return okFail(unbanError.message, "UNBAN_FAILED");

      const { error: profileError } = await supabase
        .from("profiles")
        .update({ is_banned: false, ban_reason: null })
        .eq("user_id", user_id);

      if (profileError) return okFail(profileError.message, "UNBAN_FAILED");
      return ok({ success: true });
    }

    return okFail("Unsupported action", "INVALID_INPUT");
  } catch (e) {
    console.error(e);
    return okFail((e as Error).message || "Unexpected error", "UNEXPECTED_ERROR");
  }
});

function ok(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function okFail(message: string, code: string) {
  return ok({ success: false, error: message, code });
}
