import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ACTIVATION_FEE = 80;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const auth = req.headers.get("Authorization");
    if (!auth) return json({ error: "Unauthorized" }, 401);
    const { data: { user } } = await supabase.auth.getUser(auth.replace("Bearer ", ""));
    if (!user) return json({ error: "Unauthorized" }, 401);

    const { data: profile } = await supabase.from("profiles").select("*").eq("user_id", user.id).single();
    if (!profile) return json({ error: "Profile not found" }, 404);
    if (profile.is_agent) return json({ error: "Already an agent" }, 400);
    if (Number(profile.wallet_balance) < ACTIVATION_FEE) return json({ error: `Need ${ACTIVATION_FEE} GHS in wallet to activate.` }, 400);

    const newBalance = Number(profile.wallet_balance) - ACTIVATION_FEE;
    await supabase.from("profiles").update({ wallet_balance: newBalance, is_agent: true }).eq("user_id", user.id);

    // Add agent role
    await supabase.from("user_roles").insert({ user_id: user.id, role: "agent" });

    await supabase.from("transactions").insert({
      user_id: user.id, type: "agent_activation", status: "success",
      amount: ACTIVATION_FEE, description: "Agent account activation (one-time)",
    });

    return json({ success: true });
  } catch (e) {
    console.error(e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
