import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-signature",
};

const appendNotes = (existing: string | null | undefined, line: string): string => {
  if (!existing) return line;
  return `${existing}\n${line}`;
};

const hex = (buffer: ArrayBuffer): string =>
  Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

const timingSafeEqual = (a: string, b: string): boolean => {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
};

const computeSignature = async (payload: string, webhookSecret: string) => {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(webhookSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const digest = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return `sha256=${hex(digest)}`;
};

const hasProfitTx = async (supabase: ReturnType<typeof createClient>, orderId: string, userId: string) => {
  const { data } = await supabase
    .from("transactions")
    .select("id")
    .eq("related_order_id", orderId)
    .eq("type", "store_sale")
    .eq("user_id", userId)
    .maybeSingle();

  return !!data;
};

const mapOrderStatus = (event: string, providerStatus: string): "processing" | "delivered" | "failed" => {
  const s = providerStatus.toLowerCase();
  const e = event.toLowerCase();

  if (s === "delivered" || e.includes("delivered")) return "delivered";
  if (s === "failed" || s === "cancelled" || s === "rejected" || e.includes("failed")) return "failed";
  return "processing";
};

const creditStoreProfitsIfNeeded = async (supabase: ReturnType<typeof createClient>, order: any, providerReference: string | null) => {
  if (!order.store_id || Number(order.agent_profit || 0) <= 0) return;

  const { data: store } = await supabase
    .from("agent_stores")
    .select("agent_id")
    .eq("id", order.store_id)
    .maybeSingle();

  if (!store?.agent_id) return;

  const { data: assignment } = await supabase
    .from("subagent_assignments")
    .select("parent_agent_id,status")
    .eq("subagent_user_id", store.agent_id)
    .eq("status", "active")
    .maybeSingle();

  const sellerProfit = Number(order.seller_profit ?? order.agent_profit ?? 0);
  const parentProfit = Number(order.upstream_agent_profit ?? 0);

  if (assignment?.parent_agent_id) {
    if (sellerProfit > 0 && !(await hasProfitTx(supabase, order.id, store.agent_id))) {
      const { data: sellerProfile } = await supabase.from("profiles").select("profit_balance").eq("user_id", store.agent_id).maybeSingle();
      const nextSellerProfit = Number(sellerProfile?.profit_balance || 0) + sellerProfit;
      await supabase.from("profiles").update({ profit_balance: nextSellerProfit }).eq("user_id", store.agent_id);
      await supabase.from("transactions").insert({
        user_id: store.agent_id,
        type: "store_sale",
        status: "success",
        amount: sellerProfit,
        related_order_id: order.id,
        reference: providerReference,
        description: `Subagent sale profit credited by webhook for order ${order.id}`,
      });
    }

    if (parentProfit > 0 && !(await hasProfitTx(supabase, order.id, assignment.parent_agent_id))) {
      const { data: parentProfile } = await supabase.from("profiles").select("profit_balance").eq("user_id", assignment.parent_agent_id).maybeSingle();
      const nextParentProfit = Number(parentProfile?.profit_balance || 0) + parentProfit;
      await supabase.from("profiles").update({ profit_balance: nextParentProfit }).eq("user_id", assignment.parent_agent_id);
      await supabase.from("transactions").insert({
        user_id: assignment.parent_agent_id,
        type: "store_sale",
        status: "success",
        amount: parentProfit,
        related_order_id: order.id,
        reference: providerReference,
        description: `Subagent network override profit credited by webhook for order ${order.id}`,
      });
    }
  } else if (sellerProfit > 0 && !(await hasProfitTx(supabase, order.id, store.agent_id))) {
    const { data: agentProfile } = await supabase.from("profiles").select("profit_balance").eq("user_id", store.agent_id).maybeSingle();
    const nextAgentProfit = Number(agentProfile?.profit_balance || 0) + sellerProfit;
    await supabase.from("profiles").update({ profit_balance: nextAgentProfit }).eq("user_id", store.agent_id);
    await supabase.from("transactions").insert({
      user_id: store.agent_id,
      type: "store_sale",
      status: "success",
      amount: sellerProfit,
      related_order_id: order.id,
      reference: providerReference,
      description: `Store sale profit credited by webhook for order ${order.id}`,
    });
  }
};

const requireAdmin = async (supabase: ReturnType<typeof createClient>, req: Request) => {
  const auth = req.headers.get("Authorization");
  if (!auth) return null;

  const token = auth.replace("Bearer ", "");
  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authData.user) return null;

  const { data: role } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", authData.user.id)
    .eq("role", "admin")
    .maybeSingle();

  return role ? authData.user : null;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  if (req.method === "GET") {
    const admin = await requireAdmin(supabase, req);
    if (!admin) return json({ success: false, error: "Unauthorized" }, 401);

    const url = new URL(req.url);
    const reference = String(url.searchParams.get("reference") || "").trim();
    if (!reference) return json({ success: false, error: "reference is required" }, 400);

    const { data: order } = await supabase
      .from("orders")
      .select("id,status,provider_reference,provider_order_id,provider_status,recipient_phone,network,volume_mb,updated_at")
      .eq("provider_reference", reference)
      .maybeSingle();

    if (!order) return json({ success: false, error: "Order not found" }, 404);
    return json({ success: true, order }, 200);
  }

  if (req.method !== "POST") return json({ success: false, error: "Method not allowed" }, 405);

  try {
    const webhookSecret = Deno.env.get("SPENDLESS_WEBHOOK_SECRET");
    if (!webhookSecret) return json({ success: false, error: "Webhook secret is not configured" }, 500);

    const rawBody = await req.text();
    const receivedSignature = req.headers.get("X-WEBHOOK-SIGNATURE") || "";
    const expectedSignature = await computeSignature(rawBody, webhookSecret);

    if (!timingSafeEqual(receivedSignature, expectedSignature)) {
      return json({ success: false, error: "Invalid signature" }, 401);
    }

    const payload = rawBody ? JSON.parse(rawBody) : {};
    const reference = String(payload?.data?.reference || "").trim();
    const providerStatus = String(payload?.data?.status || payload?.status || "processing");
    const event = String(payload?.event || "");

    if (!reference) return json({ success: false, error: "Missing reference" }, 400);

    const nextStatus = mapOrderStatus(event, providerStatus);

    const { data: order } = await supabase
      .from("orders")
      .select("*")
      .eq("provider_reference", reference)
      .maybeSingle();

    if (!order) return json({ success: true, message: "No matching order found" }, 200);

    await supabase
      .from("orders")
      .update({
        status: nextStatus,
        provider_status: providerStatus,
        provider_response: payload,
        notes: appendNotes(order.notes, `Webhook update (${event || "order.update"}): ${providerStatus}`),
      })
      .eq("id", order.id);

    if (nextStatus === "delivered") {
      await creditStoreProfitsIfNeeded(supabase, order, reference);
    }

    return json({ success: true, status: nextStatus }, 200);
  } catch (error) {
    console.error(error);
    return json({ success: false, error: (error as Error).message || "Unexpected error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
