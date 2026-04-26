import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-paystack-signature",
};

const calcPaystackCharge = (amount: number, percent = 1.95, cap = 100): number => {
  const charge = (amount * percent) / 100;
  return Math.min(charge, cap);
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

const computePaystackSignature = async (payload: string, secretKey: string) => {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secretKey),
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["sign"],
  );

  const digest = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return hex(digest);
};

const toNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ success: false, error: "Method not allowed" }, 405);

  try {
    const paystackSecretKey = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (!paystackSecretKey) return json({ success: false, error: "PAYSTACK_SECRET_KEY missing" }, 500);

    const rawBody = await req.text();
    const receivedSignature = req.headers.get("x-paystack-signature") || "";
    const expectedSignature = await computePaystackSignature(rawBody, paystackSecretKey);

    if (!receivedSignature || !timingSafeEqual(receivedSignature, expectedSignature)) {
      return json({ success: false, error: "Invalid signature" }, 401);
    }

    const payload = rawBody ? JSON.parse(rawBody) : {};
    const event = String(payload?.event || "").trim().toLowerCase();

    if (event !== "charge.success") {
      return json({ success: true, ignored: true, event }, 200);
    }

    const data = payload?.data || {};
    const reference = String(data?.reference || "").trim();
    const currency = String(data?.currency || "").trim().toUpperCase();
    const paidAmount = Number(data?.amount || 0) / 100;
    const metadata = (data?.metadata || {}) as Record<string, unknown>;
    const purpose = String(metadata?.purpose || "").trim();

    if (!reference || !currency || !Number.isFinite(paidAmount) || paidAmount <= 0) {
      return json({ success: true, ignored: true, reason: "invalid_charge_payload" }, 200);
    }

    if (currency !== "GHS") {
      return json({ success: true, ignored: true, reason: "unsupported_currency" }, 200);
    }

    // Only wallet topups are auto-credited by this webhook. Other payments are
    // already verified in their respective function flows.
    if (purpose !== "wallet_topup") {
      return json({ success: true, ignored: true, reason: "non_wallet_topup", purpose }, 200);
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: existingTx } = await supabase
      .from("transactions")
      .select("id")
      .eq("reference", reference)
      .eq("type", "wallet_topup")
      .maybeSingle();

    if (existingTx) {
      return json({ success: true, duplicate: true }, 200);
    }

    const metadataAmount = toNumber(metadata?.topup_amount);
    const resolvedAmount = metadataAmount && metadataAmount > 0 ? metadataAmount : paidAmount;

    const metadataCharge = toNumber(metadata?.paystack_charge);
    const resolvedCharge = metadataCharge ?? calcPaystackCharge(resolvedAmount);

    const metadataUserId = String(metadata?.user_id || "").trim();
    const customerEmail = String(data?.customer?.email || "").trim().toLowerCase();

    let profile: { user_id: string; wallet_balance: number; is_banned: boolean } | null = null;

    if (metadataUserId) {
      const { data: byId } = await supabase
        .from("profiles")
        .select("user_id,wallet_balance,is_banned")
        .eq("user_id", metadataUserId)
        .maybeSingle();
      profile = byId;
    }

    if (!profile && customerEmail) {
      const { data: byEmail } = await supabase
        .from("profiles")
        .select("user_id,wallet_balance,is_banned")
        .eq("email", customerEmail)
        .maybeSingle();
      profile = byEmail;
    }

    if (!profile) {
      return json({ success: true, ignored: true, reason: "profile_not_found" }, 200);
    }

    if (profile.is_banned) {
      return json({ success: true, ignored: true, reason: "account_banned" }, 200);
    }

    const previousBalance = Number(profile.wallet_balance || 0);
    const newBalance = previousBalance + resolvedAmount;

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ wallet_balance: newBalance })
      .eq("user_id", profile.user_id);

    if (updateError) {
      return json({ success: false, error: `Wallet update failed: ${updateError.message}` }, 500);
    }

    const { error: txError } = await supabase.from("transactions").insert({
      user_id: profile.user_id,
      type: "wallet_topup",
      status: "success",
      amount: resolvedAmount,
      paystack_charge: resolvedCharge,
      reference,
      description: "Wallet top-up (Paystack webhook verified)",
    });

    if (txError) {
      await supabase.from("profiles").update({ wallet_balance: previousBalance }).eq("user_id", profile.user_id);
      return json({ success: false, error: `Transaction insert failed: ${txError.message}` }, 500);
    }

    return json({ success: true, credited: true, user_id: profile.user_id, new_balance: newBalance }, 200);
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
