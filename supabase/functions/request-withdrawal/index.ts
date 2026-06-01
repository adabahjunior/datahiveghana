import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MIN = 20;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const auth = req.headers.get("Authorization");
    if (!auth) return json({ error: "Unauthorized" }, 401);
    const { data: { user } } = await supabase.auth.getUser(auth.replace("Bearer ", ""));
    if (!user) return json({ error: "Unauthorized" }, 401);

    const { amount, momo_number, momo_name, network } = await req.json();
    const amt = Number(amount);
    if (isNaN(amt) || amt < MIN) return json({ error: `Min ${MIN} GHS` }, 400);
    if (!momo_number || !momo_name || !network) return json({ error: "Missing fields" }, 400);

    const { data: profile } = await supabase
      .from("profiles")
      .select("user_id,profit_balance,is_banned,is_agent")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!profile) return json({ error: "Profile not found" }, 404);

    const { data: roleRows } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    const roles = (roleRows || []).map((r: { role: string }) => r.role);
    const isSeller = profile.is_agent === true || roles.includes("agent") || roles.includes("sub_agent");

    if (profile.is_banned) return json({ error: "This account is banned" }, 403);
    if (!isSeller) return json({ error: "Only agents and sub-agents can withdraw" }, 403);
    if (Number(profile.profit_balance) < amt) return json({ error: "Exceeds profit balance" }, 400);

    const { data: withdrawal, error: withdrawalError } = await supabase.from("withdrawals").insert({
      agent_id: user.id, amount: amt, momo_number, momo_name, network, status: "pending",
    }).select("id").single();

    if (withdrawalError) {
      return json({ error: "Withdrawal request failed" }, 500);
    }

    const { error: txError } = await supabase.from("transactions").insert({
      user_id: user.id, type: "withdrawal", status: "pending",
      amount: amt,
      reference: `withdrawal:${withdrawal.id}`,
      description: `Withdrawal request to ${network} ${momo_number}`,
    });
    if (txError) {
      await supabase.from("withdrawals").delete().eq("id", withdrawal.id);
      return json({ error: "Withdrawal transaction log failed" }, 500);
    }

    return json({ success: true });
  } catch (e) {
    console.error(e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
