import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const auth = req.headers.get("Authorization");
    if (!auth) return json({ error: "Unauthorized" }, 401);
    const { data: { user }, error: userError } = await supabase.auth.getUser(auth.replace("Bearer ", ""));
    if (userError) return json({ error: userError.message }, 401);
    if (!user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json();
    const package_id = body?.package_id;
    const recipient_phone = String(body?.recipient_phone || "").trim();
    if (!package_id || !recipient_phone || recipient_phone.length < 10) return json({ error: "Invalid input" }, 400);

    const [{ data: profile, error: profileError }, { data: pkg, error: pkgError }, { data: roles, error: rolesError }] = await Promise.all([
      supabase.from("profiles").select("user_id,wallet_balance,is_agent").eq("user_id", user.id).single(),
      supabase.from("data_packages").select("id,name,network,volume_mb,guest_price,agent_price,is_active").eq("id", package_id).eq("is_active", true).single(),
      supabase.from("user_roles").select("role").eq("user_id", user.id),
    ]);
    if (profileError || !profile) return json({ error: "Profile not found" }, 404);
    if (pkgError || !pkg) return json({ error: "Package not found" }, 404);

    const isAgent = profile.is_agent || (!rolesError && (roles || []).some((r: any) => r.role === "agent"));
    const price = isAgent ? Number(pkg.agent_price) : Number(pkg.guest_price);
    if (!Number.isFinite(price) || price <= 0) return json({ error: "Invalid package price" }, 400);

    if (Number(profile.wallet_balance) < price) return json({ error: "Insufficient wallet balance. Please top up." }, 400);

    const newBalance = Number(profile.wallet_balance) - price;
    const { error: debitError } = await supabase
      .from("profiles")
      .update({ wallet_balance: newBalance })
      .eq("user_id", user.id)
      .gte("wallet_balance", price);
    if (debitError) return json({ error: `Wallet debit failed: ${debitError.message}` }, 500);

    const { data: order, error: orderError } = await supabase.from("orders").insert({
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
    if (orderError || !order) {
      await supabase.from("profiles").update({ wallet_balance: Number(profile.wallet_balance) }).eq("user_id", user.id);
      return json({ error: `Order creation failed: ${orderError?.message || "Unknown error"}` }, 500);
    }

    const { error: txError } = await supabase.from("transactions").insert({
      user_id: user.id, type: "data_purchase", status: "success",
      amount: price, related_order_id: order?.id,
      description: `${pkg.name} ${pkg.network.toUpperCase()} → ${recipient_phone}`,
    });
    if (txError) {
      await supabase.from("orders").delete().eq("id", order.id);
      await supabase.from("profiles").update({ wallet_balance: Number(profile.wallet_balance) }).eq("user_id", user.id);
      return json({ error: `Transaction logging failed: ${txError.message}` }, 500);
    }

    return json({ success: true, order_id: order?.id, new_balance: newBalance });
  } catch (e) {
    console.error(e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
