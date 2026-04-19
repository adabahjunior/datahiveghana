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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return fail("Method not allowed", "METHOD_NOT_ALLOWED");

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const paystackSecretKey = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (!paystackSecretKey) return fail("Server Paystack secret is not configured", "PAYSTACK_NOT_CONFIGURED");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return fail("Unauthorized", "UNAUTHORIZED");

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return fail("Unauthorized", "UNAUTHORIZED");

    const { amount, charge, reference } = await req.json();
    if (typeof amount !== "number" || amount <= 0 || amount > 10000) return fail("Invalid amount", "INVALID_AMOUNT");
    if (!reference || typeof reference !== "string") return fail("Missing payment reference", "INVALID_REFERENCE");

    const expectedCharge = calcPaystackCharge(amount);
    const expectedTotal = amount + expectedCharge;

    const { data: existingTx } = await supabase
      .from("transactions")
      .select("id")
      .eq("reference", reference)
      .maybeSingle();
    if (existingTx) return fail("This payment reference has already been used", "DUPLICATE_REFERENCE");

    const verifiedPayment = await verifyPaystackReference(reference, paystackSecretKey);
    const paidAmount = Number(verifiedPayment.amount || 0) / 100;
    if (verifiedPayment.status !== "success") return fail("Payment was not successful", "PAYMENT_NOT_SUCCESSFUL");
    if (verifiedPayment.currency !== "GHS") return fail("Invalid payment currency", "INVALID_CURRENCY");
    if (paidAmount + 0.01 < expectedTotal) return fail("Paid amount is lower than expected", "AMOUNT_MISMATCH");

    // Credit wallet after verified payment success.
    const byUserId = await supabase
      .from("profiles")
      .select("id,user_id,wallet_balance")
      .eq("user_id", user.id)
      .maybeSingle();

    const profile = byUserId.data || (await supabase
      .from("profiles")
      .select("id,user_id,wallet_balance")
      .eq("id", user.id)
      .maybeSingle()).data;

    if (!profile) return fail("Profile not found", "PROFILE_NOT_FOUND");

    const newBalance = Number(profile.wallet_balance) + amount;
    const profileMatchColumn = profile.user_id === user.id ? "user_id" : "id";

    const { error: upErr } = await supabase
      .from("profiles")
      .update({ wallet_balance: newBalance })
      .eq(profileMatchColumn, user.id);
    if (upErr) throw upErr;

    const { error: txErr } = await supabase.from("transactions").insert({
      user_id: user.id, type: "wallet_topup", status: "success",
      amount,
      paystack_charge: typeof charge === "number" ? charge : expectedCharge,
      reference,
      description: "Wallet top-up (Paystack verified)",
    });
    if (txErr) {
      await supabase.from("profiles").update({ wallet_balance: Number(profile.wallet_balance) }).eq(profileMatchColumn, user.id);
      throw txErr;
    }

    return json({ success: true, new_balance: newBalance });
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
