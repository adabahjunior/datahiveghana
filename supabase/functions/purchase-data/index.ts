import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const auth = req.headers.get("Authorization");
    if (!auth) return json({ error: "Unauthorized" }, 401);
    const { data: { user } } = await supabase.auth.getUser(auth.replace("Bearer ", ""));
    if (!user) return json({ error: "Unauthorized" }, 401);

    const { package_id, recipient_phone } = await req.json();
    if (!package_id || !recipient_phone || recipient_phone.length < 10) return json({ error: "Invalid input" }, 400);

    const [{ data: profile }, { data: pkg }, { data: roles }] = await Promise.all([
      supabase.from("profiles").select("*").eq("user_id", user.id).single(),
      supabase.from("data_packages").select("*").eq("id", package_id).eq("is_active", true).single(),
      supabase.from("user_roles").select("role").eq("user_id", user.id),
    ]);
    if (!profile || !pkg) return json({ error: "Not found" }, 404);

    const isAgent = profile.is_agent || (roles || []).some((r: any) => r.role === "agent");
    const price = isAgent ? Number(pkg.agent_price) : Number(pkg.guest_price);

    if (Number(profile.wallet_balance) < price) return json({ error: "Insufficient wallet balance. Please top up." }, 400);

    // Debit wallet
    const newBalance = Number(profile.wallet_balance) - price;
    await supabase.from("profiles").update({ wallet_balance: newBalance }).eq("user_id", user.id);

    // Create order — TODO: replace with real data API call (Hubtel/Datamart) when keys are added
    const { data: order } = await supabase.from("orders").insert({
      buyer_user_id: user.id,
      package_id: pkg.id,
      recipient_phone,
      network: pkg.network,
      volume_mb: pkg.volume_mb,
      amount_paid: price,
      cost_price: Number(pkg.agent_price),
      agent_profit: 0,
      status: "pending",
      paid_via: "wallet",
    }).select().single();

    await supabase.from("transactions").insert({
      user_id: user.id, type: "data_purchase", status: "success",
      amount: price, related_order_id: order?.id,
      description: `${pkg.name} ${pkg.network.toUpperCase()} → ${recipient_phone}`,
    });

    return json({ success: true, order_id: order?.id, new_balance: newBalance });
  } catch (e) {
    console.error(e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
