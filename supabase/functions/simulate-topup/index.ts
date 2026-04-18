import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const token = authHeader.replace("Bearer ", "");
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) return json({ error: "Unauthorized" }, 401);

    const { amount, charge } = await req.json();
    if (typeof amount !== "number" || amount <= 0 || amount > 10000) return json({ error: "Invalid amount" }, 400);

    // Credit wallet (simulated payment success)
    const { data: profile } = await supabase.from("profiles").select("wallet_balance").eq("user_id", user.id).single();
    const newBalance = Number(profile.wallet_balance) + amount;

    const { error: upErr } = await supabase.from("profiles").update({ wallet_balance: newBalance }).eq("user_id", user.id);
    if (upErr) throw upErr;

    await supabase.from("transactions").insert({
      user_id: user.id, type: "wallet_topup", status: "success",
      amount, paystack_charge: charge || 0,
      reference: `SIM-${Date.now()}`,
      description: `Wallet top-up (simulated)`,
    });

    return json({ success: true, new_balance: newBalance });
  } catch (e) {
    console.error(e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
