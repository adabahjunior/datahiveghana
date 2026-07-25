import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { bytebossGetCheckerOrder, bytebossListCheckers } from "../_shared/dataProvider.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const auth = req.headers.get("Authorization");
    if (!auth) return json({ error: "Unauthorized" }, 401);
    const { data: userData, error: userErr } = await supabase.auth.getUser(auth.replace("Bearer ", ""));
    if (userErr || !userData.user) return json({ error: "Unauthorized" }, 401);

    const { data: role } = await supabase.from("user_roles").select("role").eq("user_id", userData.user.id).eq("role", "admin").maybeSingle();
    if (!role) return json({ error: "Forbidden" }, 403);

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "sync_order");

    if (action === "list_products") {
      const res = await bytebossListCheckers();
      return json({ ok: res.ok, products: res.products, raw: res.raw }, res.ok ? 200 : 502);
    }

    if (action === "sync_order") {
      const orderId = String(body?.order_id || "");
      if (!orderId) return json({ error: "order_id required" }, 400);
      const { data: order } = await supabase.from("checker_orders").select("*").eq("id", orderId).maybeSingle();
      if (!order) return json({ error: "Order not found" }, 404);
      if (!order.provider_order_id) return json({ error: "Order has no ByteBoss reference" }, 400);

      const res = await bytebossGetCheckerOrder(order.provider_order_id);
      const nextStatus = res.providerStatus === "sent" || res.providerStatus === "delivered" || res.providerStatus === "completed"
        ? "delivered"
        : res.providerStatus === "failed" || res.providerStatus === "cancelled"
          ? "failed"
          : "processing";

      await supabase.from("checker_orders").update({
        provider_status: res.providerStatus,
        status: nextStatus,
        checker_codes: res.codes ?? order.checker_codes,
      }).eq("id", order.id);

      return json({ ok: true, provider_status: res.providerStatus, status: nextStatus, codes: res.codes });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
