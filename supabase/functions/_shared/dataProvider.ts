// Shared data provider router for purchase-data and retry-order edge functions.
// Reads active provider from data_provider_settings table and dispatches accordingly.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export type NetworkSlug = "mtn" | "telecel" | "airteltigo_ishare" | "airteltigo_bigtime";

export type ProviderResult = {
  ok: boolean;
  status: number;
  body: any;
  // Normalized fields
  reference: string | null;
  orderId: string | null;
  providerStatus: string; // delivered | processing | failed | ...
  balance: string | null;
};

export type ProviderRecord = {
  provider_key: string;
  display_name: string;
  base_url: string;
  api_key: string;
  webhook_url: string;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const acceptedStatuses = new Set(["success", "ok", "accepted", "processing", "queued", "pending", "delivered"]);
const failedStatuses = new Set(["failed", "error", "rejected", "cancelled"]);

const toGB = (mb: number) => {
  const gb = Number(mb) / 1024;
  return Number.isFinite(gb) ? Number(gb.toFixed(2)) : 0;
};

const SPENDLESS_NETWORK_MAP: Record<string, string> = {
  mtn: "YELLO",
  telecel: "TELECEL",
  airteltigo_ishare: "AT_PREMIUM",
  airteltigo_bigtime: "AT_BIGTIME",
};

const SUPERDATA_NETWORK_MAP: Record<string, string> = {
  mtn: "mtn",
  telecel: "telecel",
  airteltigo_ishare: "ishare",
  airteltigo_bigtime: "bigtime",
};

const DICE_NETWORK_MAP: Record<string, string> = {
  mtn: "MTN",
  telecel: "Telecel",
  airteltigo_ishare: "iShare",
  airteltigo_bigtime: "BigTime",
};

export async function getActiveProvider(supabase: ReturnType<typeof createClient>): Promise<ProviderRecord> {
  const { data } = await supabase
    .from("data_provider_settings")
    .select("provider_key,display_name,base_url,api_key,webhook_url")
    .eq("is_active", true)
    .maybeSingle();

  if (data) {
    // Fall back to env for spendless if api_key not set in DB
    if (data.provider_key === "spendless" && !data.api_key) {
      data.api_key = Deno.env.get("SPENDLESS_API_KEY") || "";
      if (!data.base_url) data.base_url = Deno.env.get("SPENDLESS_PURCHASE_URL") || "https://spendless.top/api/purchase";
      if (!data.webhook_url) data.webhook_url = Deno.env.get("SPENDLESS_WEBHOOK_URL") || "";
    }
    if (data.provider_key === "byteboss" && !data.api_key) {
      data.api_key = Deno.env.get("BYTEBOSS_API_KEY") || "";
      if (!data.base_url) data.base_url = "https://byteboss.shop/api/v1";
    }

    return data as ProviderRecord;
  }

  // Default fallback to spendless from env
  return {
    provider_key: "spendless",
    display_name: "Spendless (env)",
    base_url: Deno.env.get("SPENDLESS_PURCHASE_URL") || "https://spendless.top/api/purchase",
    api_key: Deno.env.get("SPENDLESS_API_KEY") || "",
    webhook_url: Deno.env.get("SPENDLESS_WEBHOOK_URL") || "",
  };
}

async function doFetch(url: string, init: RequestInit) {
  const maxAttempts = 4;
  let last: { ok: boolean; status: number; body: any } | null = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const res = await fetch(url, init);
    const text = await res.text();
    let parsed: any = null;
    try { parsed = text ? JSON.parse(text) : null; } catch { parsed = { raw: text }; }
    last = { ok: res.ok, status: res.status, body: parsed };
    const retriable = res.status === 429 || res.status >= 500;
    if (!retriable || attempt === maxAttempts) break;
    await sleep(500 * 2 ** (attempt - 1));
  }
  return last || { ok: false, status: 500, body: { status: "error", message: "No response" } };
}

function normalize(provider: string, raw: { ok: boolean; status: number; body: any }): ProviderResult {
  const body = raw.body || {};
  const data = body.data || body.transaction || {};
  const topStatus = String(body.status || "").toLowerCase();
  const dataStatus = String(data.status || "").toLowerCase();
  const message = String(body.message || body.error || "").toLowerCase();

  let providerStatus = dataStatus || topStatus || (body.success ? "processing" : "failed");
  if (providerStatus === "true") providerStatus = "processing";

  const reference = (data.reference || body.reference || null) as string | null;
  const orderId = (data.orderId != null ? String(data.orderId) : (data.order_id != null ? String(data.order_id) : null));
  const balance = (data.balance != null ? String(data.balance) : (body.balance != null ? String(body.balance) : null));

  const explicitFail = failedStatuses.has(topStatus) || failedStatuses.has(dataStatus) || body.success === false;
  let ok = raw.ok && !explicitFail;
  if (ok) {
    if (
      acceptedStatuses.has(topStatus) ||
      acceptedStatuses.has(dataStatus) ||
      body.success === true ||
      reference || orderId ||
      message.includes("accepted") || message.includes("queued") ||
      message.includes("processing") || message.includes("pending") || message.includes("successful")
    ) {
      ok = true;
    } else {
      ok = false;
    }
  }

  return {
    ok,
    status: raw.status,
    body: raw.body,
    reference: reference ? String(reference) : null,
    orderId,
    providerStatus: providerStatus || (ok ? "processing" : "failed"),
    balance,
  };
}

export async function callProvider(
  provider: ProviderRecord,
  payload: { network: NetworkSlug; recipient: string; volumeMb: number },
): Promise<ProviderResult> {
  const { network, recipient, volumeMb } = payload;

  if (!provider.api_key) {
    return { ok: false, status: 500, body: { error: "Provider API key not configured" }, reference: null, orderId: null, providerStatus: "failed", balance: null };
  }

  if (provider.provider_key === "spendless") {
    const networkKey = SPENDLESS_NETWORK_MAP[network];
    if (!networkKey) return { ok: false, status: 400, body: { error: "Unsupported network" }, reference: null, orderId: null, providerStatus: "failed", balance: null };
    const url = provider.base_url || "https://spendless.top/api/purchase";
    const raw = await doFetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-Key": provider.api_key },
      body: JSON.stringify({
        networkKey,
        recipient,
        capacity: toGB(volumeMb),
        ...(provider.webhook_url ? { webhook_url: provider.webhook_url } : {}),
      }),
    });
    return normalize("spendless", raw);
  }

  if (provider.provider_key === "superdata") {
    const networkParam = SUPERDATA_NETWORK_MAP[network] || network;
    const base = (provider.base_url || "https://superbdatafy.com/api/v1").replace(/\/+$/, "");
    const url = `${base}/buy-data`;
    // bundle_id maps to capacity in GB as integer (best-effort default; admin should refine if their bundle ids differ)
    const bundle_id = Math.max(1, Math.round(toGB(volumeMb)));
    const raw = await doFetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${provider.api_key}`,
      },
      body: JSON.stringify({ bundle_id, phone_number: recipient, network: networkParam }),
    });
    return normalize("superdata", raw);
  }

  if (provider.provider_key === "diceconsult") {
    const networkParam = DICE_NETWORK_MAP[network] || "MTN";
    const url = provider.base_url || "https://diceconsultgh.com/api/api_router.php";
    const gb = toGB(volumeMb);
    const bundle = gb >= 1 ? `${Math.round(gb)}GB` : `${Math.round(volumeMb)}MB`;
    const raw = await doFetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": provider.api_key,
      },
      body: JSON.stringify({ network: networkParam, phone: recipient, bundle }),
    });
    return normalize("diceconsult", raw);
  }

  if (provider.provider_key === "byteboss") {
    const base = (provider.base_url || "https://byteboss.shop/api/v1").replace(/\/+$/, "");
    const apiKey = provider.api_key || Deno.env.get("BYTEBOSS_API_KEY") || "";
    if (!apiKey) {
      return { ok: false, status: 500, body: { error: "ByteBoss API key not configured" }, reference: null, orderId: null, providerStatus: "failed", balance: null };
    }
    const authHeaders = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "X-API-Key": apiKey,
    };

    // 1) Fetch plans and match by network + size_gb
    const plansRaw = await doFetch(`${base}/plans`, { method: "GET", headers: authHeaders });
    if (!plansRaw.ok) {
      return { ok: false, status: plansRaw.status, body: plansRaw.body, reference: null, orderId: null, providerStatus: "failed", balance: null };
    }
    const plans: any[] = Array.isArray(plansRaw.body?.plans) ? plansRaw.body.plans : [];
    const targetGb = toGB(volumeMb);
    const match = plans.find((p) => {
      const pNet = String(p.network || "").toLowerCase();
      const pSize = Number(p.size_gb);
      return pNet === network && Math.abs(pSize - targetGb) < 0.01;
    }) || plans.find((p) => String(p.network || "").toLowerCase() === network && Number(p.size_gb) === Math.round(targetGb));

    if (!match?.package_id) {
      return {
        ok: false,
        status: 422,
        body: { error: `No matching ByteBoss plan for ${network} ${targetGb}GB`, available: plans.length },
        reference: null, orderId: null, providerStatus: "failed", balance: null,
      };
    }

    // 2) Purchase
    const raw = await doFetch(`${base}/data`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ package_id: match.package_id, phone: recipient }),
    });
    const order = raw.body?.order || {};
    return {
      ok: raw.ok && raw.body?.success !== false && !failedStatuses.has(String(order.status || "").toLowerCase()),
      status: raw.status,
      body: raw.body,
      reference: order.reference || order.order_id || null,
      orderId: order.provider_order_id || order.order_id || null,
      providerStatus: String(order.status || (raw.ok ? "processing" : "failed")).toLowerCase(),
      balance: null,
    };
  }

  return { ok: false, status: 400, body: { error: `Unknown provider: ${provider.provider_key}` }, reference: null, orderId: null, providerStatus: "failed", balance: null };
}

