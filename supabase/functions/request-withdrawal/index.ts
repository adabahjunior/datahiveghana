import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEFAULT_MIN = 20;
const ACTIVE_WITHDRAWAL_STATUSES = new Set(["pending", "approved", "paid"]);

async function getMinWithdrawal(supabase: ReturnType<typeof createClient>): Promise<number> {
  try {
    const { data } = await supabase.from("app_settings").select("value").eq("key", "min_withdrawal").maybeSingle();
    const raw = data?.value;
    const n = typeof raw === "number" ? raw : typeof raw === "string" ? parseFloat(raw) : NaN;
    return Number.isFinite(n) && n > 0 ? n : DEFAULT_MIN;
  } catch {
    return DEFAULT_MIN;
  }
}

const profitFromSaleRow = (row: any) => Math.max(Number(row?.seller_profit || 0), Number(row?.agent_profit || 0), 0);

async function getWithdrawalProfit(supabase: ReturnType<typeof createClient>, userId: string, profileProfit: number) {
  const [{ data: stores }, { data: withdrawals }, { data: txns }] = await Promise.all([
    supabase.from("agent_stores").select("id").eq("agent_id", userId),
    supabase.from("withdrawals").select("amount,status").eq("agent_id", userId),
    supabase.from("transactions").select("amount").eq("user_id", userId).eq("type", "store_sale").eq("status", "success"),
  ]);

  const storeIds = (stores || []).map((store: any) => store.id);
  let orderRows: any[] = [];
  let checkerRows: any[] = [];
  let formRows: any[] = [];

  if (storeIds.length > 0) {
    const [orders, checkerOrders, formOrders] = await Promise.all([
      supabase.from("orders").select("agent_profit,seller_profit,status").in("store_id", storeIds),
      supabase.from("checker_orders").select("agent_profit,seller_profit,status").in("store_id", storeIds),
      supabase.from("store_university_form_orders").select("seller_profit,status").in("store_id", storeIds),
    ]);
    orderRows = orders.data || [];
    checkerRows = checkerOrders.data || [];
    formRows = formOrders.data || [];
  }

  const pendingWithdrawals = (withdrawals || [])
    .filter((w: any) => w.status === "pending")
    .reduce((sum, w: any) => sum + Number(w.amount || 0), 0);
  const committedWithdrawals = (withdrawals || [])
    .filter((w: any) => ACTIVE_WITHDRAWAL_STATUSES.has(w.status))
    .reduce((sum, w: any) => sum + Number(w.amount || 0), 0);
  const processedWithdrawals = (withdrawals || [])
    .filter((w: any) => w.status === "approved" || w.status === "paid")
    .reduce((sum, w: any) => sum + Number(w.amount || 0), 0);

  const orderProfit = orderRows.filter((row) => row.status !== "failed").reduce((sum, row) => sum + profitFromSaleRow(row), 0);
  const checkerProfit = checkerRows.filter((row) => row.status !== "failed").reduce((sum, row) => sum + profitFromSaleRow(row), 0);
  const formProfit = formRows
    .filter((row: any) => row.status !== "failed" && row.status !== "rejected")
    .reduce((sum, row: any) => sum + Number(row.seller_profit || 0), 0);
  const transactionProfit = (txns || []).reduce((sum, row: any) => sum + Number(row.amount || 0), 0);
  const legacyProfit = Math.max(orderProfit + checkerProfit + formProfit, transactionProfit);

  return {
    available: Math.max(Math.max(profileProfit - pendingWithdrawals, 0), Math.max(legacyProfit - committedWithdrawals, 0)),
    syncBalance: Math.max(profileProfit, legacyProfit - processedWithdrawals, 0),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const auth = req.headers.get("Authorization");
    if (!auth) return json({ error: "Unauthorized" }, 401);
    const { data: { user } } = await supabase.auth.getUser(auth.replace("Bearer ", ""));
    if (!user) return json({ error: "Unauthorized" }, 401);

    const { amount, momo_number, momo_name, network } = await req.json();
    const amt = Number(amount);
    const minWithdrawal = await getMinWithdrawal(supabase);
    if (isNaN(amt) || amt < minWithdrawal) return json({ error: `Minimum withdrawal is ${minWithdrawal} GHS` }, 400);
    if (!momo_number || !momo_name || !network) return json({ error: "Missing fields" }, 400);

    const { data: profile } = await supabase
      .from("profiles")
      .select("user_id,profit_balance,is_banned,is_agent")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!profile) return json({ error: "Profile not found" }, 404);

    const { data: roleRows } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    const roles = (roleRows || []).map((r: { role: string }) => r.role);
    const isSeller = profile.is_agent === true || roles.includes("agent") || roles.includes("sub_agent");

    if (profile.is_banned) return json({ error: "This account is banned" }, 403);
    if (!isSeller) return json({ error: "Only agents and sub-agents can withdraw" }, 403);
    const profit = await getWithdrawalProfit(supabase, user.id, Number(profile.profit_balance || 0));
    if (profit.available < amt) return json({ error: "Exceeds profit balance" }, 400);

    if (profit.syncBalance > Number(profile.profit_balance || 0)) {
      await supabase.from("profiles").update({ profit_balance: profit.syncBalance }).eq("user_id", user.id);
    }

    const { data: withdrawal, error: withdrawalError } = await supabase.from("withdrawals").insert({
      agent_id: user.id, amount: amt, momo_number, momo_name, network, status: "pending",
    }).select("id").single();

    if (withdrawalError) {
      return json({ error: "Withdrawal request failed" }, 500);
    }

    const { error: txError } = await supabase.from("transactions").insert({
      user_id: user.id, type: "withdrawal", status: "pending",
      amount: amt,
      reference: `withdrawal:${withdrawal.id}`,
      description: `Withdrawal request to ${network} ${momo_number}`,
    });
    if (txError) {
      await supabase.from("withdrawals").delete().eq("id", withdrawal.id);
      return json({ error: "Withdrawal transaction log failed" }, 500);
    }

    return json({ success: true });
  } catch (e) {
    console.error(e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
