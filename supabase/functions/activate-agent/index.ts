import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return fail("Method not allowed", "METHOD_NOT_ALLOWED");

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const auth = req.headers.get("Authorization");
    if (!auth) return fail("Unauthorized", "UNAUTHORIZED");
    const { data: { user }, error: userError } = await supabase.auth.getUser(auth.replace("Bearer ", ""));
    if (userError) return fail(userError.message, "UNAUTHORIZED");
    if (!user) return fail("Unauthorized", "UNAUTHORIZED");

    // Load activation fee config from app_settings
    const { data: feeSetting } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "agent_activation_fee")
      .maybeSingle();

    const feeConfig = feeSetting?.value as { enabled?: boolean; amount?: number } | null;
    const feeEnabled = feeConfig?.enabled !== false;
    const ACTIVATION_FEE = feeEnabled ? Number(feeConfig?.amount ?? 80) : 0;

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("user_id,wallet_balance,is_agent")
      .eq("user_id", user.id)
      .single();
    if (profileError || !profile) return fail("Profile not found", "PROFILE_NOT_FOUND");
    if (profile.is_agent) return fail("Already an agent", "ALREADY_AGENT");

    if (ACTIVATION_FEE > 0 && Number(profile.wallet_balance) < ACTIVATION_FEE) {
      return fail(`Need ${ACTIVATION_FEE} GHS in wallet to activate.`, "INSUFFICIENT_BALANCE");
    }

    const newBalance = Number(profile.wallet_balance) - ACTIVATION_FEE;

    if (ACTIVATION_FEE > 0) {
      const { error: debitError } = await supabase
        .from("profiles")
        .update({ wallet_balance: newBalance, is_agent: true })
        .eq("user_id", user.id)
        .gte("wallet_balance", ACTIVATION_FEE);
      if (debitError) return fail(`Activation debit failed: ${debitError.message}`, "ACTIVATION_DEBIT_FAILED");
    } else {
      const { error: activateError } = await supabase
        .from("profiles")
        .update({ is_agent: true })
        .eq("user_id", user.id);
      if (activateError) return fail(`Activation failed: ${activateError.message}`, "ACTIVATION_FAILED");
    }

    const { error: roleError } = await supabase
      .from("user_roles")
      .upsert({ user_id: user.id, role: "agent" }, { onConflict: "user_id,role" });
    if (roleError) {
      await supabase.from("profiles").update({
        ...(ACTIVATION_FEE > 0 ? { wallet_balance: Number(profile.wallet_balance) } : {}),
        is_agent: false,
      }).eq("user_id", user.id);
      return fail(`Role assignment failed: ${roleError.message}`, "ROLE_ASSIGN_FAILED");
    }

    if (ACTIVATION_FEE > 0) {
      const { error: txError } = await supabase.from("transactions").insert({
        user_id: user.id, type: "agent_activation", status: "success",
        amount: ACTIVATION_FEE, description: "Agent account activation (one-time)",
      });
      if (txError) {
        await supabase.from("user_roles").delete().eq("user_id", user.id).eq("role", "agent");
        await supabase.from("profiles").update({ wallet_balance: Number(profile.wallet_balance), is_agent: false }).eq("user_id", user.id);
        return fail(`Transaction logging failed: ${txError.message}`, "TRANSACTION_LOG_FAILED");
      }
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

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
