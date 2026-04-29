import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const calcPaystackCharge = (amount: number, percent = 1.95, cap = 100): number => {
  const charge = (amount * percent) / 100;
  return Math.min(charge, cap);
};

const verifyPaystackReference = async (reference: string, secretKey: string) => {
  const res = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
    },
  });

  const payload = await res.json();
  if (!res.ok || !payload?.status || !payload?.data) {
    throw new Error(payload?.message || "Paystack verification failed");
  }

  return payload.data as { status: string; amount: number; currency: string; reference: string };
};

const toQuantity = (value: unknown): number | null => {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0 || n > 50) return null;
  return n;
};

const hasProfitTx = async (supabase: ReturnType<typeof createClient>, orderId: string, userId: string) => {
  const { data } = await supabase
    .from("transactions")
    .select("id")
    .eq("description", `checker_sale:${orderId}`)
    .eq("type", "store_sale")
    .eq("user_id", userId)
    .maybeSingle();

  return !!data;
};

const creditStoreSaleProfit = async (
  supabase: ReturnType<typeof createClient>,
  payload: {
    orderId: string;
    subagentUserId?: string;
    subagentProfit: number;
    parentAgentId?: string;
    parentAgentProfit: number;
    fallbackAgentId?: string;
    fallbackProfit: number;
  },
) => {
  const {
    orderId,
    subagentUserId,
    subagentProfit,
    parentAgentId,
    parentAgentProfit,
    fallbackAgentId,
    fallbackProfit,
  } = payload;

  if (subagentUserId && subagentProfit > 0 && !(await hasProfitTx(supabase, orderId, subagentUserId))) {
    const { data: subProfile } = await supabase.from("profiles").select("profit_balance").eq("user_id", subagentUserId).maybeSingle();
    const nextSubProfit = Number(subProfile?.profit_balance || 0) + subagentProfit;
    await supabase.from("profiles").update({ profit_balance: nextSubProfit }).eq("user_id", subagentUserId);
    await supabase.from("transactions").insert({
      user_id: subagentUserId,
      type: "store_sale",
      status: "success",
      amount: subagentProfit,
      description: `checker_sale:${orderId}`,
    });
  }

  if (parentAgentId && parentAgentProfit > 0 && !(await hasProfitTx(supabase, orderId, parentAgentId))) {
    const { data: parentProfile } = await supabase.from("profiles").select("profit_balance").eq("user_id", parentAgentId).maybeSingle();
    const nextParentProfit = Number(parentProfile?.profit_balance || 0) + parentAgentProfit;
    await supabase.from("profiles").update({ profit_balance: nextParentProfit }).eq("user_id", parentAgentId);
    await supabase.from("transactions").insert({
      user_id: parentAgentId,
      type: "store_sale",
      status: "success",
      amount: parentAgentProfit,
      description: `checker_sale:${orderId}`,
    });
  }

  if (!subagentUserId && fallbackAgentId && fallbackProfit > 0 && !(await hasProfitTx(supabase, orderId, fallbackAgentId))) {
    const { data: agentProfile } = await supabase.from("profiles").select("profit_balance").eq("user_id", fallbackAgentId).maybeSingle();
    const nextAgentProfit = Number(agentProfile?.profit_balance || 0) + fallbackProfit;
    await supabase.from("profiles").update({ profit_balance: nextAgentProfit }).eq("user_id", fallbackAgentId);
    await supabase.from("transactions").insert({
      user_id: fallbackAgentId,
      type: "store_sale",
      status: "success",
      amount: fallbackProfit,
      description: `checker_sale:${orderId}`,
    });
  }

};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const paystackSecretKey = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (!paystackSecretKey) return json({ error: "Server Paystack secret is not configured" }, 500);

    const { store_id, checker_id, recipient_phone, reference, quantity } = await req.json();
    const phone = String(recipient_phone || "").trim();
    const qty = toQuantity(quantity);

    if (!store_id || !checker_id || !reference || phone.length < 10 || !qty) {
      return json({ error: "Invalid input" }, 400);
    }

    const { data: duplicate } = await supabase
      .from("checker_orders")
      .select("id")
      .eq("paystack_reference", reference)
      .maybeSingle();
    if (duplicate) return json({ error: "This payment reference has already been used" }, 409);

    const [{ data: store }, { data: checkerPrice }] = await Promise.all([
      supabase.from("agent_stores").select("*").eq("id", store_id).eq("is_active", true).single(),
      supabase
        .from("store_checker_prices")
        .select("selling_price,is_listed,checker:checker_products(*)")
        .eq("store_id", store_id)
        .eq("checker_id", checker_id)
        .eq("is_listed", true)
        .maybeSingle(),
    ]);

    if (!store || !checkerPrice?.checker) return json({ error: "Checker product not available in this store" }, 404);

    const checker = checkerPrice.checker as any;
    if (!checker.is_active) return json({ error: "Checker product is inactive" }, 400);

    const unitSellingPrice = Number(checkerPrice.selling_price);
    const adminAgentBase = Number(checker.agent_price);

    let costPrice = adminAgentBase;
    let sellerProfit = Math.max(0, unitSellingPrice - adminAgentBase);
    let parentAgentProfit = 0;

    let subagentUserId: string | undefined;
    let parentAgentId: string | undefined;

    const { data: assignment } = await supabase
      .from("subagent_assignments")
      .select("parent_agent_id,status")
      .eq("subagent_user_id", store.agent_id)
      .eq("status", "active")
      .maybeSingle();

    if (assignment?.parent_agent_id) {
      subagentUserId = store.agent_id;
      parentAgentId = assignment.parent_agent_id;

      const { data: subagentPrice } = await supabase
        .from("subagent_checker_prices")
        .select("base_price,is_active")
        .eq("parent_agent_id", assignment.parent_agent_id)
        .eq("checker_id", checker.id)
        .eq("is_active", true)
        .maybeSingle();

      const subagentBase = Number(subagentPrice?.base_price ?? adminAgentBase);
      costPrice = adminAgentBase;
      parentAgentProfit = Math.max(0, subagentBase - adminAgentBase);
      sellerProfit = Math.max(0, unitSellingPrice - subagentBase);
    }

    const totalProfit = Number(((sellerProfit + parentAgentProfit) * qty).toFixed(2));
    const totalSellingPrice = Number((unitSellingPrice * qty).toFixed(2));
    const expectedTotal = totalSellingPrice + calcPaystackCharge(totalSellingPrice);

    const verifiedPayment = await verifyPaystackReference(reference, paystackSecretKey);
    const paidAmount = Number(verifiedPayment.amount || 0) / 100;

    if (verifiedPayment.status !== "success") return json({ error: "Payment was not successful" }, 400);
    if (verifiedPayment.currency !== "GHS") return json({ error: "Invalid payment currency" }, 400);
    if (paidAmount + 0.01 < expectedTotal) return json({ error: "Paid amount is lower than expected" }, 400);

    const { data: order, error: orderError } = await supabase.from("checker_orders").insert({
      store_id: store.id,
      checker_id: checker.id,
      recipient_phone: phone,
      exam_type: checker.exam_type,
      quantity: qty,
      amount_paid: totalSellingPrice,
      cost_price: costPrice,
      agent_profit: totalProfit,
      seller_profit: Number((sellerProfit * qty).toFixed(2)),
      upstream_agent_profit: Number((parentAgentProfit * qty).toFixed(2)),
      status: "delivered",
      paid_via: "paystack",
      paystack_reference: reference,
      checker_serial: null,
      checker_pin: null,
      checker_codes: null,
      notes: `Store checker purchase. Checker details will be delivered via SMS.`,
    }).select().single();

    if (orderError || !order) return json({ error: orderError?.message || "Order creation failed" }, 500);

    await creditStoreSaleProfit(supabase, {
      orderId: order.id,
      subagentUserId,
      subagentProfit: Number((sellerProfit * qty).toFixed(2)),
      parentAgentId,
      parentAgentProfit: Number((parentAgentProfit * qty).toFixed(2)),
      fallbackAgentId: store.agent_id,
      fallbackProfit: Number((sellerProfit * qty).toFixed(2)),
    });

    return json({
      success: true,
      order_id: order.id,
      checker: {
        name: checker.name,
        exam_type: checker.exam_type,
        quantity: qty,
      },
    });
  } catch (e) {
    console.error(e);
    return json({ error: (e as Error).message || "Unexpected error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
