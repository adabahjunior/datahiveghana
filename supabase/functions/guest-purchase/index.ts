import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Public guest checkout on agent stores. No auth required.
// Simulates Paystack payment success and credits agent's profit balance.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { store_id, package_id, recipient_phone } = await req.json();

    if (!store_id || !package_id || !recipient_phone || recipient_phone.length < 10) {
      return json({ error: "Invalid input" }, 400);
    }

    const [{ data: store }, { data: pkg }, { data: storePrice }] = await Promise.all([
      supabase.from("agent_stores").select("*").eq("id", store_id).eq("is_active", true).single(),
      supabase.from("data_packages").select("*").eq("id", package_id).eq("is_active", true).single(),
      supabase
        .from("store_package_prices")
        .select("*")
        .eq("store_id", store_id)
        .eq("package_id", package_id)
        .eq("is_listed", true)
        .maybeSingle(),
    ]);
    if (!store || !pkg || !storePrice) return json({ error: "Package not available in this store" }, 404);

    // Always derive price from server-side store pricing; never trust client input.
    const sellingPrice = Number(storePrice.selling_price);
    const costPrice = Number(pkg.agent_price);
    const profit = Math.max(0, sellingPrice - costPrice);

    const { data: order } = await supabase.from("orders").insert({
      store_id: store.id,
      package_id: pkg.id,
      recipient_phone,
      network: pkg.network,
      volume_mb: pkg.volume_mb,
      amount_paid: sellingPrice,
      cost_price: costPrice,
      agent_profit: profit,
      status: "pending",
      paid_via: "paystack",
    }).select().single();

    // Credit agent profit
    if (profit > 0) {
      const { data: agent } = await supabase.from("profiles").select("profit_balance").eq("user_id", store.agent_id).single();
      const newProfit = Number(agent?.profit_balance || 0) + profit;
      await supabase.from("profiles").update({ profit_balance: newProfit }).eq("user_id", store.agent_id);
      await supabase.from("transactions").insert({
        user_id: store.agent_id, type: "store_sale", status: "success",
        amount: profit, related_order_id: order?.id,
        description: `Sale on store: ${pkg.name} ${pkg.network.toUpperCase()}`,
      });
    }

    return json({ success: true, order_id: order?.id });
  } catch (e) {
    console.error(e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
