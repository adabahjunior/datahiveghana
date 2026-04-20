import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const NETWORK_KEY_MAP: Record<string, string> = {
  mtn: "YELLO",
  telecel: "TELECEL",
  airteltigo_ishare: "AT_PREMIUM",
  airteltigo_bigtime: "AT_BIGTIME",
};

const toProviderCapacity = (volumeMb: number): number => {
  const gb = Number(volumeMb) / 1000;
  return Number.isFinite(gb) ? Number(gb.toFixed(2)) : 0;
};

const appendNotes = (existing: string | null | undefined, line: string): string => {
  if (!existing) return line;
  return `${existing}\n${line}`;
};

const purchaseFromProvider = async (
  purchaseUrl: string,
  apiKey: string,
  payload: { networkKey: string; recipient: string; capacity: number; webhook_url?: string },
) => {
  const response = await fetch(purchaseUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": apiKey,
    },
    body: JSON.stringify(payload),
  });

  const text = await response.text();
  let parsed: any = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = { raw: text };
  }

  return { ok: response.ok, status: response.status, body: parsed };
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ success: false, error: "Method not allowed" }, 200);

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const providerApiKey = Deno.env.get("SPENDLESS_API_KEY");
    const providerPurchaseUrl = Deno.env.get("SPENDLESS_PURCHASE_URL") || "https://spendless.top/api/purchase";
    const providerWebhookUrl = Deno.env.get("SPENDLESS_WEBHOOK_URL") || undefined;

    if (!providerApiKey) return json({ success: false, error: "Provider API key is not configured" }, 200);

    const auth = req.headers.get("Authorization");
    if (!auth) return json({ success: false, error: "Unauthorized" }, 200);

    const { data: authData, error: authError } = await supabase.auth.getUser(auth.replace("Bearer ", ""));
    if (authError || !authData.user) return json({ success: false, error: "Unauthorized" }, 200);

    const { data: role } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", authData.user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!role) return json({ success: false, error: "Admins only" }, 200);

    const { order_id } = await req.json();
    if (!order_id || typeof order_id !== "string") return json({ success: false, error: "order_id is required" }, 200);

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("*")
      .eq("id", order_id)
      .single();
    if (orderError || !order) return json({ success: false, error: "Order not found" }, 200);

    const providerNetworkKey = NETWORK_KEY_MAP[order.network as string];
    if (!providerNetworkKey) {
      await supabase
        .from("orders")
        .update({ status: "failed", notes: appendNotes(order.notes, "Retry failed: unsupported network mapping") })
        .eq("id", order.id);
      return json({ success: false, error: "Unsupported network mapping" }, 200);
    }

    await supabase
      .from("orders")
      .update({ status: "processing", notes: appendNotes(order.notes, `Retry started by admin at ${new Date().toISOString()}`) })
      .eq("id", order.id);

    const providerRes = await purchaseFromProvider(providerPurchaseUrl, providerApiKey, {
      networkKey: providerNetworkKey,
      recipient: order.recipient_phone,
      capacity: toProviderCapacity(Number(order.volume_mb)),
      webhook_url: providerWebhookUrl,
    });

    const providerSuccess = providerRes.ok && providerRes.body?.status === "success";
    if (!providerSuccess) {
      await supabase
        .from("orders")
        .update({
          status: "failed",
          notes: appendNotes(order.notes, `Retry provider failure (${providerRes.status}): ${JSON.stringify(providerRes.body)}`),
        })
        .eq("id", order.id);

      return json({ success: false, error: "Provider still failed", provider: providerRes.body }, 200);
    }

    const providerReference = providerRes.body?.data?.reference ? String(providerRes.body.data.reference) : null;
    const providerBalance = providerRes.body?.data?.balance != null ? String(providerRes.body.data.balance) : null;

    await supabase
      .from("orders")
      .update({
        status: "delivered",
        notes: appendNotes(
          order.notes,
          `Retry provider success${providerReference ? ` | ref: ${providerReference}` : ""}${providerBalance ? ` | balance: ${providerBalance}` : ""}`,
        ),
      })
      .eq("id", order.id);

    if (order.store_id && Number(order.agent_profit || 0) > 0) {
      const { data: store } = await supabase
        .from("agent_stores")
        .select("agent_id")
        .eq("id", order.store_id)
        .maybeSingle();

      if (store?.agent_id) {
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
            const { data: subProfile } = await supabase.from("profiles").select("profit_balance").eq("user_id", store.agent_id).maybeSingle();
            const nextSubProfit = Number(subProfile?.profit_balance || 0) + sellerProfit;
            await supabase.from("profiles").update({ profit_balance: nextSubProfit }).eq("user_id", store.agent_id);
            await supabase.from("transactions").insert({
              user_id: store.agent_id,
              type: "store_sale",
              status: "success",
              amount: sellerProfit,
              related_order_id: order.id,
              reference: providerReference,
              description: `Subagent sale profit credited after retry for order ${order.id}`,
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
              description: `Subagent network override profit credited after retry for order ${order.id}`,
            });
          }
        } else if (sellerProfit > 0 && !(await hasProfitTx(supabase, order.id, store.agent_id))) {
          const { data: agent } = await supabase.from("profiles").select("profit_balance").eq("user_id", store.agent_id).single();
          const newProfit = Number(agent?.profit_balance || 0) + sellerProfit;
          await supabase.from("profiles").update({ profit_balance: newProfit }).eq("user_id", store.agent_id);
          await supabase.from("transactions").insert({
            user_id: store.agent_id,
            type: "store_sale",
            status: "success",
            amount: sellerProfit,
            related_order_id: order.id,
            reference: providerReference,
            description: `Sale credited after successful retry for order ${order.id}`,
          });
        }
      }
    }

    return json({ success: true, order_id: order.id, provider_reference: providerReference }, 200);
  } catch (e) {
    console.error(e);
    return json({ success: false, error: (e as Error).message }, 200);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
