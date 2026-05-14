import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return okFail("Method not allowed", "METHOD_NOT_ALLOWED");

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return okFail("Unauthorized", "UNAUTHORIZED");

    const token = authHeader.replace("Bearer ", "");
    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !authData.user) return okFail("Unauthorized", "UNAUTHORIZED");

    const { data: adminRole } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", authData.user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!adminRole) return okFail("Admins only", "FORBIDDEN");

    const body = await req.json();
    const code = String(body?.manual_topup_code || "").trim();
    const amount = Number(body?.amount);

    if (!/^\d{4}$/.test(code)) return okFail("A valid 4-digit code is required", "INVALID_CODE");
    if (!Number.isFinite(amount) || amount <= 0) return okFail("Enter a valid amount", "INVALID_AMOUNT");
    if (amount > 100000) return okFail("Amount is too high", "INVALID_AMOUNT");

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id,user_id,full_name,email,wallet_balance,is_banned,manual_topup_code")
      .eq("manual_topup_code", code)
      .maybeSingle();

    if (profileError) return okFail(profileError.message, "PROFILE_LOOKUP_FAILED");
    if (!profile) return okFail("No user found for that code", "PROFILE_NOT_FOUND");
    if (profile.is_banned) return okFail("This account is banned", "ACCOUNT_BANNED");

    const { data: subAgentRole } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", profile.user_id)
      .eq("role", "sub_agent")
      .maybeSingle();

    if (subAgentRole) return okFail("Manual top-up is not available for subagents", "SUBAGENT_NOT_ALLOWED");

    const previousBalance = Number(profile.wallet_balance || 0);
    const newBalance = previousBalance + amount;

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ wallet_balance: newBalance })
      .eq("user_id", profile.user_id);

    if (updateError) return okFail(updateError.message, "TOPUP_FAILED");

    const reference = `manual-topup-${code}-${Date.now()}`;
    const description = `Manual wallet top-up credited by admin for code ${code}`;

    const { error: transactionError } = await supabase
      .from("transactions")
      .insert({
        user_id: profile.user_id,
        type: "wallet_topup",
        status: "success",
        amount,
        paystack_charge: 0,
        reference,
        description,
      });

    if (transactionError) {
      await supabase
        .from("profiles")
        .update({ wallet_balance: previousBalance })
        .eq("user_id", profile.user_id);
      return okFail(transactionError.message, "TRANSACTION_LOG_FAILED");
    }

    return ok({
      success: true,
      user: {
        full_name: profile.full_name,
        email: profile.email,
        manual_topup_code: profile.manual_topup_code,
      },
      previous_balance: previousBalance,
      new_balance: newBalance,
      amount,
      reference,
    });
  } catch (e) {
    console.error(e);
    return okFail((e as Error).message || "Unexpected error", "UNEXPECTED_ERROR");
  }
});

function ok(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function okFail(message: string, code: string) {
  return ok({ success: false, error: message, code });
}
