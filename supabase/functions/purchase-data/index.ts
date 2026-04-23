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
  const gb = Number(volumeMb) / 1024;
  return Number.isFinite(gb) ? Number(gb.toFixed(2)) : 0;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const appendNotes = (existing: string | null | undefined, line: string): string => {
  if (!existing) return line;
  return `${existing}\n${line}`;
};

const purchaseFromProvider = async (
  purchaseUrl: string,
  apiKey: string,
  payload: { networkKey: string; recipient: string; capacity: number; webhook_url?: string },
) => {
  const maxAttempts = 4;
  let lastResult: { ok: boolean; status: number; body: any } | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
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

    lastResult = { ok: response.ok, status: response.status, body: parsed };

    const retriable = response.status === 429 || response.status >= 500;
    if (!retriable || attempt === maxAttempts) break;

    await sleep(500 * 2 ** (attempt - 1));
  }

  return lastResult || { ok: false, status: 500, body: { status: "error", message: "No provider response" } };
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return fail("Method not allowed", "METHOD_NOT_ALLOWED");

  try {
    const providerApiKey = Deno.env.get("SPENDLESS_API_KEY");
    const providerPurchaseUrl = Deno.env.get("SPENDLESS_PURCHASE_URL") || "https://spendless.top/api/purchase";
    if (!providerApiKey) return fail("Provider API key is not configured", "PROVIDER_NOT_CONFIGURED");

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const providerWebhookUrl = Deno.env.get("SPENDLESS_WEBHOOK_URL") || undefined;

    const auth = req.headers.get("Authorization");
    if (!auth) return fail("Unauthorized", "UNAUTHORIZED");
    const { data: { user }, error: userError } = await supabase.auth.getUser(auth.replace("Bearer ", ""));
    if (userError) return fail(userError.message, "UNAUTHORIZED");
    if (!user) return fail("Unauthorized", "UNAUTHORIZED");

    let body: any;
    try {
      body = await req.json();
    } catch {
      return fail("Invalid request body", "INVALID_INPUT");
    }
    const package_id = body?.package_id;
    const recipient_phone = String(body?.recipient_phone || "").trim();
    if (!package_id || !recipient_phone || recipient_phone.length < 10) return fail("Invalid input", "INVALID_INPUT");

    const [{ data: byUserIdProfile, error: profileError }, { data: pkg, error: pkgError }, { data: roles, error: rolesError }] = await Promise.all([
      supabase.from("profiles").select("id,user_id,wallet_balance,is_agent,is_banned").eq("user_id", user.id).maybeSingle(),
      supabase.from("data_packages").select("id,name,network,volume_mb,guest_price,agent_price,is_active").eq("id", package_id).eq("is_active", true).single(),
      supabase.from("user_roles").select("role").eq("user_id", user.id),
    ]);
    let profile = byUserIdProfile;
    if (!profile && !profileError) {
      const { data: byIdProfile } = await supabase
        .from("profiles")
        .select("id,user_id,wallet_balance,is_agent,is_banned")
        .eq("id", user.id)
        .maybeSingle();
      profile = byIdProfile;
    }
    if (profileError || !profile) return fail("Profile not found", "PROFILE_NOT_FOUND");
    if (profile.is_banned) return fail("This account is banned", "ACCOUNT_BANNED");
    if (pkgError || !pkg) return fail("Package not found", "PACKAGE_NOT_FOUND");

    const profileMatchColumn = profile.user_id === user.id ? "user_id" : "id";

    const roleList = !rolesError ? (roles || []).map((r: any) => r.role) : [];
    const isSubAgent = roleList.includes("sub_agent");
    const isAgent = profile.is_agent || roleList.includes("agent");

    let price = isAgent ? Number(pkg.agent_price) : Number(pkg.guest_price);
    if (isSubAgent) {
      const { data: assignment } = await supabase
        .from("subagent_assignments")
        .select("parent_agent_id,status")
        .eq("subagent_user_id", user.id)
        .eq("status", "active")
        .maybeSingle();

      if (!assignment) return fail("No active subagent assignment found", "SUBAGENT_NOT_ASSIGNED");

      const { data: subagentPrice } = await supabase
        .from("subagent_package_prices")
        .select("base_price,is_active")
        .eq("parent_agent_id", assignment.parent_agent_id)
        .eq("package_id", pkg.id)
        .eq("is_active", true)
        .maybeSingle();

      if (!subagentPrice) return fail("Subagent base price is not set for this package", "SUBAGENT_PRICE_NOT_SET");
      price = Number(subagentPrice.base_price);
    }

    if (!Number.isFinite(price) || price <= 0) return fail("Invalid package price", "INVALID_PRICE");

    if (Number(profile.wallet_balance) < price) return fail("Insufficient wallet balance. Please top up.", "INSUFFICIENT_BALANCE");

    const newBalance = Number(profile.wallet_balance) - price;
    const { error: debitError } = await supabase
      .from("profiles")
      .update({ wallet_balance: newBalance })
      .eq(profileMatchColumn, user.id)
      .gte("wallet_balance", price);
    if (debitError) return fail(`Wallet debit failed: ${debitError.message}`, "WALLET_DEBIT_FAILED");

    const { data: order, error: orderError } = await supabase.from("orders").insert({
      buyer_user_id: user.id,
      package_id: pkg.id,
      recipient_phone,
      network: pkg.network,
      volume_mb: pkg.volume_mb,
      amount_paid: price,
      cost_price: Number(pkg.agent_price),
      agent_profit: 0,
      status: "processing",
      paid_via: "wallet",
      notes: "Routing order to provider...",
    }).select().single();
    if (orderError || !order) {
      await supabase.from("profiles").update({ wallet_balance: Number(profile.wallet_balance) }).eq(profileMatchColumn, user.id);
      return fail(`Order creation failed: ${orderError?.message || "Unknown error"}`, "ORDER_CREATE_FAILED");
    }

    const providerNetworkKey = NETWORK_KEY_MAP[pkg.network as string];
    if (!providerNetworkKey) {
      await supabase.from("orders").update({ status: "failed", notes: appendNotes(order.notes, "Unsupported network mapping") }).eq("id", order.id);
      await supabase.from("profiles").update({ wallet_balance: Number(profile.wallet_balance) }).eq(profileMatchColumn, user.id);
      return fail("Unsupported network for provider", "UNSUPPORTED_NETWORK");
    }

    const providerRes = await purchaseFromProvider(providerPurchaseUrl, providerApiKey, {
      networkKey: providerNetworkKey,
      recipient: recipient_phone,
      capacity: toProviderCapacity(Number(pkg.volume_mb)),
      webhook_url: providerWebhookUrl,
    });

    const providerSuccess = providerRes.ok && providerRes.body?.status === "success";
    if (!providerSuccess) {
      await supabase
        .from("orders")
        .update({
          status: "failed",
          provider_status: "failed",
          provider_response: providerRes.body,
          notes: appendNotes(order.notes, `Provider failure (${providerRes.status}): ${JSON.stringify(providerRes.body)}`),
        })
        .eq("id", order.id);

      await supabase.from("transactions").insert({
        user_id: user.id,
        type: "data_purchase",
        status: "success",
        amount: price,
        related_order_id: order.id,
        description: `Provider failed for ${pkg.name} ${pkg.network.toUpperCase()} → ${recipient_phone}`,
      });

      // Do not block user flow. Order is accepted and can be retried by admin.
      return json({
        success: true,
        order_id: order.id,
        new_balance: newBalance,
        queued: true,
        provider_ok: false,
      });
    }

    const providerOrderStatus = String(providerRes.body?.data?.status || "processing").toLowerCase();
    const finalOrderStatus = providerOrderStatus === "delivered" ? "delivered" : "processing";
    const providerReference = providerRes.body?.data?.reference ? String(providerRes.body.data.reference) : null;
    const providerOrderId = providerRes.body?.data?.orderId != null ? String(providerRes.body.data.orderId) : null;
    const providerBalance = providerRes.body?.data?.balance != null ? String(providerRes.body.data.balance) : null;

    await supabase
      .from("orders")
      .update({
        status: finalOrderStatus,
        provider_reference: providerReference,
        provider_order_id: providerOrderId,
        provider_status: providerOrderStatus,
        provider_response: providerRes.body,
        notes: appendNotes(
          order.notes,
          `Provider accepted${providerReference ? ` | ref: ${providerReference}` : ""}${providerBalance ? ` | balance: ${providerBalance}` : ""}${providerOrderStatus ? ` | status: ${providerOrderStatus}` : ""}`,
        ),
      })
      .eq("id", order.id);

    const { error: txError } = await supabase.from("transactions").insert({
      user_id: user.id, type: "data_purchase", status: "success",
      amount: price, related_order_id: order?.id,
      reference: providerReference,
      description: `${pkg.name} ${pkg.network.toUpperCase()} ${finalOrderStatus === "delivered" ? "delivered" : "queued"} → ${recipient_phone}`,
    });
    if (txError) {
      await supabase.from("orders").delete().eq("id", order.id);
      await supabase.from("profiles").update({ wallet_balance: Number(profile.wallet_balance) }).eq(profileMatchColumn, user.id);
      return fail(`Transaction logging failed: ${txError.message}`, "TRANSACTION_LOG_FAILED");
    }

    return json({ success: true, order_id: order?.id, new_balance: newBalance, provider_status: providerOrderStatus });
  } catch (e) {
    console.error(e);
    return fail((e as Error).message || "Unexpected error", "UNEXPECTED_ERROR");
  }
});

function fail(message: string, code: string) {
  return json({ success: false, error: message, code });
}

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
