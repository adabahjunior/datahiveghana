import { supabase } from "@/integrations/supabase/client";

const ACTIVE_WITHDRAWAL_STATUSES = new Set(["pending", "approved", "paid"]);

const profitFromSaleRow = (row: any) => {
  const sellerProfit = Number(row?.seller_profit || 0);
  const agentProfit = Number(row?.agent_profit || 0);
  return Math.max(sellerProfit, agentProfit, 0);
};

export async function getWithdrawableProfit(userId: string) {
  const [{ data: profile }, { data: withdrawals }, { data: stores }, { data: storeSaleTxns }] = await Promise.all([
    supabase.from("profiles").select("profit_balance").eq("user_id", userId).maybeSingle(),
    supabase.from("withdrawals").select("amount,status").eq("agent_id", userId),
    supabase.from("agent_stores").select("id").eq("agent_id", userId),
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

  const orderProfit = orderRows
    .filter((row) => row.status !== "failed")
    .reduce((sum, row) => sum + profitFromSaleRow(row), 0);
  const checkerProfit = checkerRows
    .filter((row) => row.status !== "failed")
    .reduce((sum, row) => sum + profitFromSaleRow(row), 0);
  const formProfit = formRows
    .filter((row) => row.status !== "failed" && row.status !== "rejected")
    .reduce((sum, row: any) => sum + Number(row.seller_profit || 0), 0);
  const transactionProfit = (storeSaleTxns || []).reduce((sum, row: any) => sum + Number(row.amount || 0), 0);

  const profileProfit = Number(profile?.profit_balance || 0);
  const legacyProfit = Math.max(orderProfit + checkerProfit + formProfit, transactionProfit);
  const availableFromProfile = Math.max(profileProfit - pendingWithdrawals, 0);
  const availableFromLegacy = Math.max(legacyProfit - committedWithdrawals, 0);

  return Math.max(availableFromProfile, availableFromLegacy);
}