import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    const { user_id, new_password } = await req.json();
    if (!user_id || typeof user_id !== "string") return okFail("user_id is required", "INVALID_INPUT");
    if (!new_password || typeof new_password !== "string") return okFail("new_password is required", "INVALID_INPUT");
    if (new_password.length < 6) return okFail("Password must be at least 6 characters", "INVALID_INPUT");
    if (new_password.length > 72) return okFail("Password is too long", "INVALID_INPUT");

    const { error: updateError } = await supabase.auth.admin.updateUserById(user_id, {
      password: new_password,
    });

    if (updateError) return okFail(updateError.message, "RESET_FAILED");

    return json({ success: true });
  } catch (e) {
    console.error(e);
    return okFail((e as Error).message, "UNEXPECTED_ERROR");
  }
});

function okFail(message: string, code: string) {
  return json({ success: false, error: message, code });
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
