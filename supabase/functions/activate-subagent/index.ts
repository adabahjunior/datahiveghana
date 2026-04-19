import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUBAGENT_BASE_FEE = 30;

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

const creditParentAddonProfit = async (
  supabase: ReturnType<typeof createClient>,
  parentAgentId: string,
  addonAmount: number,
  subagentUserId: string,
  storeName: string,
) => {
  if (addonAmount <= 0) return { success: true };

  const { data: parentProfile, error: parentProfileError } = await supabase
    .from("profiles")
    .select("profit_balance")
    .eq("user_id", parentAgentId)
    .maybeSingle();

  if (parentProfileError || !parentProfile) {
    return { success: false, error: parentProfileError?.message || "Parent profile not found" };
  }

  const nextProfit = Number(parentProfile.profit_balance || 0) + addonAmount;
  const { error: updateProfitError } = await supabase
    .from("profiles")
    .update({ profit_balance: nextProfit })
    .eq("user_id", parentAgentId);

  if (updateProfitError) return { success: false, error: updateProfitError.message };

  const { error: profitTxError } = await supabase.from("transactions").insert({
    user_id: parentAgentId,
    type: "store_sale",
    status: "success",
    amount: addonAmount,
    description: `Subagent signup addon earned from ${subagentUserId} under ${storeName}`,
  });

  if (profitTxError) return { success: false, error: profitTxError.message };

  return { success: true };
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return fail("Method not allowed", "METHOD_NOT_ALLOWED");

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const paystackSecretKey = Deno.env.get("PAYSTACK_SECRET_KEY");

    const auth = req.headers.get("Authorization");
    if (!auth) return fail("Unauthorized", "UNAUTHORIZED");

    const { data: { user }, error: userError } = await supabase.auth.getUser(auth.replace("Bearer ", ""));
    if (userError || !user) return fail("Unauthorized", "UNAUTHORIZED");

    const { store_slug, payment_method, reference } = await req.json();
    if (!store_slug || typeof store_slug !== "string") return fail("store_slug is required", "INVALID_INPUT");
    if (!["wallet", "paystack"].includes(payment_method)) return fail("payment_method must be wallet or paystack", "INVALID_INPUT");

    const [{ data: store }, { data: profile }, { data: roles }, { data: existingAssignment }] = await Promise.all([
      supabase.from("agent_stores").select("id,agent_id,store_name,is_active,subagent_fee_addon").eq("slug", store_slug).maybeSingle(),
      supabase.from("profiles").select("wallet_balance").eq("user_id", user.id).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", user.id),
      supabase.from("subagent_assignments").select("id,status").eq("subagent_user_id", user.id).maybeSingle(),
    ]);

    if (!store || !store.is_active) return fail("Store not found", "STORE_NOT_FOUND");
    if (store.agent_id === user.id) return fail("You cannot be a subagent under your own store", "INVALID_ACCOUNT");
    if (!profile) return fail("Profile not found", "PROFILE_NOT_FOUND");

    const roleList = (roles || []).map((r: any) => r.role);
    if (roleList.includes("admin")) return fail("Admin accounts cannot become subagents", "INVALID_ACCOUNT");
    if (roleList.includes("agent")) return fail("Primary agent accounts cannot become subagents", "INVALID_ACCOUNT");
    if (roleList.includes("sub_agent") || existingAssignment?.status === "active") {
      return fail("Already an active subagent", "ALREADY_SUBAGENT");
    }

    const addon = Number(store.subagent_fee_addon || 0);
    const activationFee = SUBAGENT_BASE_FEE + addon;

    if (payment_method === "wallet") {
      if (Number(profile.wallet_balance) < activationFee) {
        return fail(`Need ${activationFee} GHS in wallet to activate.`, "INSUFFICIENT_BALANCE");
      }

      const newBalance = Number(profile.wallet_balance) - activationFee;
      const { error: debitError } = await supabase
        .from("profiles")
        .update({ wallet_balance: newBalance })
        .eq("user_id", user.id)
        .gte("wallet_balance", activationFee);

      if (debitError) return fail(`Wallet debit failed: ${debitError.message}`, "WALLET_DEBIT_FAILED");

      const { error: roleError } = await supabase
        .from("user_roles")
        .upsert({ user_id: user.id, role: "sub_agent" }, { onConflict: "user_id,role" });
      if (roleError) {
        await supabase.from("profiles").update({ wallet_balance: Number(profile.wallet_balance) }).eq("user_id", user.id);
        return fail(`Role assignment failed: ${roleError.message}`, "ROLE_ASSIGN_FAILED");
      }

      const { error: assignError } = await supabase.from("subagent_assignments").upsert({
        parent_agent_id: store.agent_id,
        subagent_user_id: user.id,
        source_store_id: store.id,
        paid_amount: activationFee,
        paid_via: "wallet",
        status: "active",
      }, { onConflict: "subagent_user_id" });

      if (assignError) {
        await supabase.from("user_roles").delete().eq("user_id", user.id).eq("role", "sub_agent");
        await supabase.from("profiles").update({ wallet_balance: Number(profile.wallet_balance) }).eq("user_id", user.id);
        return fail(`Subagent assignment failed: ${assignError.message}`, "ASSIGNMENT_FAILED");
      }

      const { error: txError } = await supabase.from("transactions").insert({
        user_id: user.id,
        type: "agent_activation",
        status: "success",
        amount: activationFee,
        description: `Subagent activation under ${store.store_name} (wallet)`,
      });
      if (txError) return fail(`Transaction log failed: ${txError.message}`, "TRANSACTION_LOG_FAILED");

      const profitCredit = await creditParentAddonProfit(supabase, store.agent_id, addon, user.id, store.store_name);
      if (!profitCredit.success) return fail(`Parent profit credit failed: ${profitCredit.error}`, "PARENT_PROFIT_CREDIT_FAILED");

      return json({ success: true, new_balance: newBalance });
    }

    if (!paystackSecretKey) return fail("Server Paystack secret is not configured", "PAYSTACK_NOT_CONFIGURED");
    if (!reference || typeof reference !== "string") return fail("Missing payment reference", "INVALID_REFERENCE");

    const { data: duplicateTx } = await supabase
      .from("transactions")
      .select("id")
      .eq("reference", reference)
      .maybeSingle();
    if (duplicateTx) return fail("This payment reference has already been used", "DUPLICATE_REFERENCE");

    const verifiedPayment = await verifyPaystackReference(reference, paystackSecretKey);
    const paidAmount = Number(verifiedPayment.amount || 0) / 100;
    const expectedTotal = activationFee + calcPaystackCharge(activationFee);

    if (verifiedPayment.status !== "success") return fail("Payment was not successful", "PAYMENT_NOT_SUCCESSFUL");
    if (verifiedPayment.currency !== "GHS") return fail("Invalid payment currency", "INVALID_CURRENCY");
    if (paidAmount + 0.01 < expectedTotal) return fail("Paid amount is lower than expected", "AMOUNT_MISMATCH");

    const { error: roleError } = await supabase
      .from("user_roles")
      .upsert({ user_id: user.id, role: "sub_agent" }, { onConflict: "user_id,role" });
    if (roleError) return fail(`Role assignment failed: ${roleError.message}`, "ROLE_ASSIGN_FAILED");

    const { error: assignError } = await supabase.from("subagent_assignments").upsert({
      parent_agent_id: store.agent_id,
      subagent_user_id: user.id,
      source_store_id: store.id,
      paid_amount: activationFee,
      paid_via: "paystack",
      status: "active",
    }, { onConflict: "subagent_user_id" });
    if (assignError) return fail(`Subagent assignment failed: ${assignError.message}`, "ASSIGNMENT_FAILED");

    const { error: txError } = await supabase.from("transactions").insert({
      user_id: user.id,
      type: "agent_activation",
      status: "success",
      amount: activationFee,
      paystack_charge: calcPaystackCharge(activationFee),
      reference,
      description: `Subagent activation under ${store.store_name} (Paystack verified)`,
    });
    if (txError) return fail(`Transaction log failed: ${txError.message}`, "TRANSACTION_LOG_FAILED");

    const profitCredit = await creditParentAddonProfit(supabase, store.agent_id, addon, user.id, store.store_name);
    if (!profitCredit.success) return fail(`Parent profit credit failed: ${profitCredit.error}`, "PARENT_PROFIT_CREDIT_FAILED");

    return json({ success: true });
  } catch (e) {
    console.error(e);
    return fail((e as Error).message || "Unexpected error", "UNEXPECTED_ERROR");
  }
});

function fail(message: string, code: string) {
  return json({ success: false, error: message, code });
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
