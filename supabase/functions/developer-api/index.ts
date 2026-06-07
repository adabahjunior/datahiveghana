// Public Developer API — authenticated via x-api-key header.
// Routes:
//   GET  /packages           -> list active data packages
//   GET  /balance            -> wallet balance for key owner
//   POST /purchase           -> { package_id, recipient_phone } buy data
//   GET  /order?id=<uuid>    -> fetch order status

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { callProvider, getActiveProvider, type NetworkSlug } from "../_shared/dataProvider.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const fail = (message: string, code: string, status = 400) =>
  json({ success: false, error: message, code }, status);

const appendNotes = (existing: string | null | undefined, line: string) =>
  existing ? `${existing}\n${line}` : line;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const url = new URL(req.url);
  // Path normalization: /functions/v1/developer-api/<route>
  const segments = url.pathname.split("/").filter(Boolean);
  const idx = segments.indexOf("developer-api");
  const route = idx >= 0 ? "/" + segments.slice(idx + 1).join("/") : url.pathname;

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // Authenticate via API key
  const apiKey = req.headers.get("x-api-key") || req.headers.get("X-API-Key");
  if (!apiKey) return fail("Missing x-api-key header", "MISSING_API_KEY", 401);
  const keyHash = await sha256Hex(apiKey);
  const { data: keyRow } = await supabase
    .from("api_keys")
    .select("id,user_id,is_active")
    .eq("key_hash", keyHash)
    .maybeSingle();
  if (!keyRow || !keyRow.is_active) return fail("Invalid or revoked API key", "INVALID_API_KEY", 401);
  // Fire-and-forget update of last_used_at
  supabase.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", keyRow.id).then(() => {});
  const userId: string = keyRow.user_id;

  try {
    // -------- GET /packages --------
    if (req.method === "GET" && (route === "/packages" || route === "/packages/")) {
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
      const { data: profile } = await supabase.from("profiles").select("is_agent").eq("user_id", userId).maybeSingle();
      const roleList = (roles || []).map((r: any) => r.role);
      const isAgent = !!profile?.is_agent || roleList.includes("agent");
      const isSubAgent = roleList.includes("sub_agent");

      const { data: pkgs } = await supabase
        .from("data_packages")
        .select("id,name,network,volume_mb,validity_days,guest_price,agent_price,is_active")
        .eq("is_active", true)
        .order("network")
        .order("volume_mb");

      // Resolve per-user effective price
      let agentOverrides: Record<string, number> = {};
      if (isAgent && !isSubAgent) {
        const { data } = await supabase
          .from("agent_package_base_prices")
          .select("package_id,base_price,is_active")
          .eq("agent_user_id", userId)
          .eq("is_active", true);
        for (const r of data || []) agentOverrides[r.package_id] = Number(r.base_price);
      }

      let subPrices: Record<string, number> = {};
      if (isSubAgent) {
        const { data: assignment } = await supabase
          .from("subagent_assignments")
          .select("parent_agent_id,status")
          .eq("subagent_user_id", userId)
          .eq("status", "active")
          .maybeSingle();
        if (assignment) {
          const { data } = await supabase
            .from("subagent_package_prices")
            .select("package_id,base_price,is_active")
            .eq("parent_agent_id", assignment.parent_agent_id)
            .eq("is_active", true);
          for (const r of data || []) subPrices[r.package_id] = Number(r.base_price);
        }
      }

      const out = (pkgs || []).map((p: any) => {
        let price = isAgent ? Number(p.agent_price) : Number(p.guest_price);
        if (isAgent && !isSubAgent && agentOverrides[p.id] != null) price = agentOverrides[p.id];
        if (isSubAgent) price = subPrices[p.id] ?? Number(p.agent_price);
        return {
          package_id: p.id,
          name: p.name,
          network: p.network,
          volume_mb: p.volume_mb,
          volume_gb: Number((p.volume_mb / 1024).toFixed(2)),
          validity_days: p.validity_days,
          price_ghs: Number(price.toFixed(2)),
        };
      });
      return json({ success: true, count: out.length, packages: out });
    }

    // -------- GET /balance --------
    if (req.method === "GET" && (route === "/balance" || route === "/balance/")) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("wallet_balance,profit_balance")
        .eq("user_id", userId)
        .maybeSingle();
      if (!profile) return fail("Profile not found", "PROFILE_NOT_FOUND", 404);
      return json({
        success: true,
        wallet_balance: Number(profile.wallet_balance),
        profit_balance: Number(profile.profit_balance || 0),
        currency: "GHS",
      });
    }

    // -------- GET /order?id=... --------
    if (req.method === "GET" && (route === "/order" || route === "/order/")) {
      const id = url.searchParams.get("id");
      if (!id) return fail("Missing ?id=", "INVALID_INPUT");
      const { data: order } = await supabase
        .from("orders")
        .select("id,status,provider_status,network,volume_mb,recipient_phone,amount_paid,provider_reference,created_at")
        .eq("id", id)
        .eq("buyer_user_id", userId)
        .maybeSingle();
      if (!order) return fail("Order not found", "ORDER_NOT_FOUND", 404);
      return json({ success: true, order });
    }

    // -------- POST /purchase --------
    if (req.method === "POST" && (route === "/purchase" || route === "/purchase/")) {
      const active = await getActiveProvider(supabase);
      if (!active.api_key) return fail("Service temporarily unavailable", "PROVIDER_NOT_CONFIGURED", 503);

      let body: any;
      try { body = await req.json(); } catch { return fail("Invalid JSON body", "INVALID_INPUT"); }
      const package_id = body?.package_id;
      const recipient_phone = String(body?.recipient_phone || "").trim();
      if (!package_id || !recipient_phone || recipient_phone.length < 10) {
        return fail("package_id and recipient_phone (>=10 digits) are required", "INVALID_INPUT");
      }

      const [{ data: profile }, { data: pkg }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("id,user_id,wallet_balance,is_agent,is_banned").eq("user_id", userId).maybeSingle(),
        supabase.from("data_packages").select("id,name,network,volume_mb,guest_price,agent_price,is_active").eq("id", package_id).eq("is_active", true).single(),
        supabase.from("user_roles").select("role").eq("user_id", userId),
      ]);
      if (!profile) return fail("Profile not found", "PROFILE_NOT_FOUND", 404);
      if (profile.is_banned) return fail("Account is banned", "ACCOUNT_BANNED", 403);
      if (!pkg) return fail("Package not found or inactive", "PACKAGE_NOT_FOUND", 404);

      const roleList = (roles || []).map((r: any) => r.role);
      const isSubAgent = roleList.includes("sub_agent");
      const isAgent = !!profile.is_agent || roleList.includes("agent");

      let effectiveAgentBase = Number(pkg.agent_price);
      if (isAgent && !isSubAgent) {
        const { data: ov } = await supabase.from("agent_package_base_prices")
          .select("base_price,is_active").eq("agent_user_id", userId).eq("package_id", pkg.id).eq("is_active", true).maybeSingle();
        if (ov) effectiveAgentBase = Number(ov.base_price);
      }

      let price = isAgent ? Number(pkg.agent_price) : Number(pkg.guest_price);
      if (isAgent && !isSubAgent) price = effectiveAgentBase;
      if (isSubAgent) {
        const { data: assignment } = await supabase.from("subagent_assignments")
          .select("parent_agent_id,status").eq("subagent_user_id", userId).eq("status", "active").maybeSingle();
        if (!assignment) return fail("No active subagent assignment", "SUBAGENT_NOT_ASSIGNED", 403);
        const { data: subPrice } = await supabase.from("subagent_package_prices")
          .select("base_price,is_active").eq("parent_agent_id", assignment.parent_agent_id).eq("package_id", pkg.id).eq("is_active", true).maybeSingle();
        if (!subPrice) return fail("Subagent price not set for this package", "SUBAGENT_PRICE_NOT_SET", 403);
        price = Number(subPrice.base_price);
      }

      if (!Number.isFinite(price) || price <= 0) return fail("Invalid package price", "INVALID_PRICE");
      if (Number(profile.wallet_balance) < price) return fail("Insufficient wallet balance", "INSUFFICIENT_BALANCE", 402);

      const newBalance = Number(profile.wallet_balance) - price;
      const matchCol = profile.user_id === userId ? "user_id" : "id";
      const { error: debitError } = await supabase.from("profiles")
        .update({ wallet_balance: newBalance }).eq(matchCol, userId).gte("wallet_balance", price);
      if (debitError) return fail("Wallet debit failed", "WALLET_DEBIT_FAILED", 500);

      const { data: order, error: orderError } = await supabase.from("orders").insert({
        buyer_user_id: userId,
        package_id: pkg.id,
        recipient_phone,
        network: pkg.network,
        volume_mb: pkg.volume_mb,
        amount_paid: price,
        cost_price: effectiveAgentBase,
        agent_profit: 0,
        status: "processing",
        paid_via: "wallet",
        notes: "Order via Developer API",
      }).select().single();
      if (orderError || !order) {
        await supabase.from("profiles").update({ wallet_balance: Number(profile.wallet_balance) }).eq(matchCol, userId);
        return fail("Order creation failed", "ORDER_CREATE_FAILED", 500);
      }

      const providerRes = await callProvider(active, {
        network: pkg.network as NetworkSlug,
        recipient: recipient_phone,
        volumeMb: Number(pkg.volume_mb),
      });

      if (!providerRes.ok) {
        await supabase.from("orders").update({
          status: "failed", provider_status: "failed", provider_response: providerRes.body,
          notes: appendNotes(order.notes, `[api] Provider failure (${providerRes.status})`),
        }).eq("id", order.id);
        await supabase.from("transactions").insert({
          user_id: userId, type: "data_purchase", status: "success", amount: price,
          related_order_id: order.id,
          description: `[API] Provider failed: ${pkg.name} ${pkg.network.toUpperCase()} → ${recipient_phone}`,
        });
        return json({
          success: true, order_id: order.id, status: "queued",
          new_balance: newBalance, message: "Order queued — provider temporarily unavailable.",
        });
      }

      const providerOrderStatus = providerRes.providerStatus;
      const finalStatus = providerOrderStatus === "delivered" ? "delivered" : "processing";
      await supabase.from("orders").update({
        status: finalStatus,
        provider_reference: providerRes.reference,
        provider_order_id: providerRes.orderId,
        provider_status: providerOrderStatus,
        provider_response: providerRes.body,
        notes: appendNotes(order.notes, `[api] Provider accepted${providerRes.reference ? ` | ref: ${providerRes.reference}` : ""}`),
      }).eq("id", order.id);

      await supabase.from("transactions").insert({
        user_id: userId, type: "data_purchase", status: "success", amount: price,
        related_order_id: order.id, reference: providerRes.reference,
        description: `[API] ${pkg.name} ${pkg.network.toUpperCase()} ${finalStatus} → ${recipient_phone}`,
      });

      return json({
        success: true,
        order_id: order.id,
        status: finalStatus,
        provider_status: providerOrderStatus,
        provider_reference: providerRes.reference,
        amount_charged: price,
        new_balance: newBalance,
        recipient_phone,
        network: pkg.network,
        volume_mb: pkg.volume_mb,
      });
    }

    return fail(`Route not found: ${req.method} ${route}`, "ROUTE_NOT_FOUND", 404);
  } catch (e) {
    console.error("developer-api error", e);
    return fail((e as Error).message || "Unexpected error", "UNEXPECTED_ERROR", 500);
  }
});
