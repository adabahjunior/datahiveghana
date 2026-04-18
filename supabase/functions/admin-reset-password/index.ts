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
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const token = authHeader.replace("Bearer ", "");
    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !authData.user) return json({ error: "Unauthorized" }, 401);

    const { data: role } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", authData.user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!role) return json({ error: "Admins only" }, 403);

    const { user_id, new_password } = await req.json();
    if (!user_id || typeof user_id !== "string") return json({ error: "user_id is required" }, 400);
    if (!new_password || typeof new_password !== "string") return json({ error: "new_password is required" }, 400);
    if (new_password.length < 6) return json({ error: "Password must be at least 6 characters" }, 400);
    if (new_password.length > 72) return json({ error: "Password is too long" }, 400);

    const { error: updateError } = await supabase.auth.admin.updateUserById(user_id, {
      password: new_password,
    });

    if (updateError) return json({ error: updateError.message }, 400);

    return json({ success: true });
  } catch (e) {
    console.error(e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
