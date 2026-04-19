import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MIN = 50;

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

    const { data: profile } = await supabase.from("profiles").select("*").eq("user_id", user.id).single();
    if (profile?.is_banned) return json({ error: "This account is banned" }, 403);
    if (!profile?.is_agent) return json({ error: "Agents only" }, 403);
    if (Number(profile.profit_balance) < amt) return json({ error: "Exceeds profit balance" }, 400);

    // Lock funds: subtract from profit_balance immediately
    const newProfit = Number(profile.profit_balance) - amt;
    await supabase.from("profiles").update({ profit_balance: newProfit }).eq("user_id", user.id);

    await supabase.from("withdrawals").insert({
      agent_id: user.id, amount: amt, momo_number, momo_name, network, status: "pending",
    });

    await supabase.from("transactions").insert({
      user_id: user.id, type: "withdrawal", status: "pending",
      amount: amt, description: `Withdrawal request to ${network} ${momo_number}`,
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
