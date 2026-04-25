import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const makeCode = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const gen = (len: number) => Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  return {
    serial: `RC-${gen(4)}-${gen(4)}-${gen(4)}`,
    pin: `${Math.floor(100000000000 + Math.random() * 900000000000)}`,
  };
};

const toQuantity = (value: unknown): number | null => {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0 || n > 50) return null;
  return n;
};

const fail = (message: string, code: string) =>
  json({ success: false, error: message, code });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return fail("Method not allowed", "METHOD_NOT_ALLOWED");

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const auth = req.headers.get("Authorization");
    if (!auth) return fail("Unauthorized", "UNAUTHORIZED");

    const { data: authData, error: authError } = await supabase.auth.getUser(auth.replace("Bearer ", ""));
    if (authError || !authData.user) return fail("Unauthorized", "UNAUTHORIZED");

    const { checker_id, recipient_phone, quantity } = await req.json();
    const phone = String(recipient_phone || "").trim();
    const qty = toQuantity(quantity);
    if (!checker_id || typeof checker_id !== "string") return fail("checker_id is required", "INVALID_INPUT");
    if (phone.length < 10) return fail("Valid recipient_phone is required", "INVALID_INPUT");
    if (!qty) return fail("quantity must be an integer between 1 and 50", "INVALID_INPUT");

    const [{ data: checker }, { data: byUserProfile }, { data: roles }] = await Promise.all([
      supabase.from("checker_products").select("*").eq("id", checker_id).eq("is_active", true).maybeSingle(),
      supabase.from("profiles").select("id,user_id,wallet_balance,is_agent,is_banned").eq("user_id", authData.user.id).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", authData.user.id),
    ]);

    if (!checker) return fail("Checker product not found", "NOT_FOUND");
    if (!byUserProfile) return fail("Profile not found", "PROFILE_NOT_FOUND");
    if (byUserProfile.is_banned) return fail("This account is banned", "ACCOUNT_BANNED");

    const roleList = (roles || []).map((r: any) => String(r.role));
    const isSubAgent = roleList.includes("sub_agent");
    const isAgent = byUserProfile.is_agent || roleList.includes("agent");

    let costPrice = Number(checker.agent_price);

    if (isSubAgent) {
      const { data: assignment } = await supabase
        .from("subagent_assignments")
        .select("parent_agent_id,status")
        .eq("subagent_user_id", authData.user.id)
        .eq("status", "active")
        .maybeSingle();

      if (!assignment) return fail("No active subagent assignment found", "SUBAGENT_NOT_ASSIGNED");

      const { data: subagentPrice } = await supabase
        .from("subagent_checker_prices")
        .select("base_price,is_active")
        .eq("parent_agent_id", assignment.parent_agent_id)
        .eq("checker_id", checker.id)
        .eq("is_active", true)
        .maybeSingle();

      if (!subagentPrice) return fail("Subagent base checker price is not set", "SUBAGENT_PRICE_NOT_SET");
      costPrice = Number(subagentPrice.base_price);
    } else if (!isAgent) {
      costPrice = Number(checker.user_price);
    }

    if (!Number.isFinite(costPrice) || costPrice <= 0) return fail("Invalid checker price", "INVALID_PRICE");

    const totalCost = Number((costPrice * qty).toFixed(2));
    const wallet = Number(byUserProfile.wallet_balance || 0);
    if (wallet < totalCost) return fail("Insufficient wallet balance", "INSUFFICIENT_BALANCE");

    const newBalance = Number((wallet - totalCost).toFixed(2));

    const { data: debitedProfile, error: debitError } = await supabase
      .from("profiles")
      .update({ wallet_balance: newBalance })
      .eq("user_id", authData.user.id)
      .gte("wallet_balance", totalCost)
      .select("wallet_balance")
      .maybeSingle();

    if (debitError || !debitedProfile) return fail("Wallet debit failed", "WALLET_DEBIT_FAILED");

    const checkerCodes = Array.from({ length: qty }, () => makeCode());
    const firstCode = checkerCodes[0];

    const { data: order, error: orderError } = await supabase
      .from("checker_orders")
      .insert({
        buyer_user_id: authData.user.id,
        checker_id: checker.id,
        recipient_phone: phone,
        exam_type: checker.exam_type,
        quantity: qty,
        amount_paid: totalCost,
        cost_price: costPrice,
        agent_profit: 0,
        seller_profit: 0,
        upstream_agent_profit: 0,
        status: "delivered",
        paid_via: "wallet",
        checker_serial: firstCode.serial,
        checker_pin: firstCode.pin,
        checker_codes: checkerCodes,
        notes: "Direct dashboard checker purchase",
      })
      .select("id")
      .single();

    if (orderError || !order) {
      await supabase.from("profiles").update({ wallet_balance: wallet }).eq("user_id", authData.user.id);
      return fail("Checker order creation failed", "ORDER_CREATE_FAILED");
    }

    const { error: txError } = await supabase.from("transactions").insert({
      user_id: authData.user.id,
      type: "data_purchase",
      status: "success",
      amount: totalCost,
      description: `${String(checker.name)} checker purchase x${qty} (${String(checker.exam_type).toUpperCase()})`,
    });

    if (txError) {
      await supabase.from("checker_orders").delete().eq("id", order.id);
      await supabase.from("profiles").update({ wallet_balance: wallet }).eq("user_id", authData.user.id);
      return fail("Transaction logging failed", "TRANSACTION_LOG_FAILED");
    }

    return json({
      success: true,
      order_id: order.id,
      new_balance: newBalance,
      checker: {
        name: checker.name,
        exam_type: checker.exam_type,
        quantity: qty,
        codes: checkerCodes,
      },
    });
  } catch (e) {
    console.error(e);
    return fail((e as Error).message || "Unexpected error", "UNEXPECTED_ERROR");
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
