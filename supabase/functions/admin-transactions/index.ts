import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PAGE_SIZE = 1000;

async function fetchAll(supabase: any, table: string, columns: string) {
  const rows: any[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .order("created_at", { ascending: false })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`${table} fetch failed: ${error.message}`);
    const chunk = data || [];
    rows.push(...chunk);
    if (chunk.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return rows;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ success: false, error: "Unauthorized" });

    const { data: authData, error: authError } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !authData.user) return json({ success: false, error: "Unauthorized" });

    const { data: adminRole } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", authData.user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!adminRole) return json({ success: false, error: "Admins only" });

    const [txns, orders, checkerOrders, storeFormOrders, formOrders, profiles, stores] = await Promise.all([
      fetchAll(supabase, "transactions", "id,user_id,type,status,amount,paystack_charge,reference,description,created_at"),
      fetchAll(supabase, "orders", "id,buyer_user_id,store_id,recipient_phone,network,volume_mb,amount_paid,cost_price,agent_profit,seller_profit,status,paid_via,provider_reference,created_at"),
      fetchAll(supabase, "checker_orders", "id,buyer_user_id,store_id,recipient_phone,exam_type,quantity,amount_paid,cost_price,status,paid_via,paystack_reference,created_at"),
      fetchAll(supabase, "store_university_form_orders", "id,store_id,school_name,form_type_name,full_name,phone,amount_paid,status,paid_via,paystack_reference,created_at"),
      fetchAll(supabase, "university_form_orders", "id,user_id,school_name,form_type_name,full_name,phone,amount_paid,status,reference,created_at"),
      fetchAll(supabase, "profiles", "user_id,full_name,email,phone"),
      fetchAll(supabase, "agent_stores", "id,store_name,slug"),
    ]);

    const profileMap = new Map(profiles.map((p: any) => [p.user_id, p]));
    const storeMap = new Map(stores.map((s: any) => [s.id, s]));

    const who = (userId: string | null) => {
      const p = userId ? profileMap.get(userId) : null;
      return p ? (p.full_name || p.email) : null;
    };
    const storeName = (storeId: string | null) => (storeId ? storeMap.get(storeId)?.store_name || null : null);

    const entries: any[] = [];

    for (const t of txns) {
      const isTopup = t.type === "wallet_topup";
      entries.push({
        id: `txn-${t.id}`,
        created_at: t.created_at,
        category: "wallet",
        kind: t.type,
        description: t.description || null,
        amount: Number(t.amount || 0),
        direction: isTopup || t.type === "store_sale" ? "in" : "out",
        status: t.status,
        method: t.reference ? (String(t.reference).startsWith("manual") ? "manual" : "paystack") : "wallet",
        reference: t.reference || null,
        customer: who(t.user_id),
        customer_email: t.user_id ? profileMap.get(t.user_id)?.email || null : null,
        store_name: null,
      });
    }

    for (const o of orders) {
      entries.push({
        id: `order-${o.id}`,
        created_at: o.created_at,
        category: "data_order",
        kind: `${o.network} ${(Number(o.volume_mb || 0) / 1000).toFixed(o.volume_mb % 1000 === 0 ? 0 : 1)}GB`,
        description: `Data to ${o.recipient_phone}`,
        amount: Number(o.amount_paid || 0),
        direction: "in",
        status: o.status,
        method: o.paid_via,
        reference: o.provider_reference || null,
        customer: who(o.buyer_user_id) || o.recipient_phone,
        customer_email: o.buyer_user_id ? profileMap.get(o.buyer_user_id)?.email || null : null,
        store_name: storeName(o.store_id),
      });
    }

    for (const c of checkerOrders) {
      entries.push({
        id: `checker-${c.id}`,
        created_at: c.created_at,
        category: "checker_order",
        kind: `${c.exam_type} x${c.quantity || 1}`,
        description: `Checker to ${c.recipient_phone}`,
        amount: Number(c.amount_paid || 0),
        direction: "in",
        status: c.status,
        method: c.paid_via,
        reference: c.paystack_reference || null,
        customer: who(c.buyer_user_id) || c.recipient_phone,
        customer_email: c.buyer_user_id ? profileMap.get(c.buyer_user_id)?.email || null : null,
        store_name: storeName(c.store_id),
      });
    }

    for (const f of storeFormOrders) {
      entries.push({
        id: `store-form-${f.id}`,
        created_at: f.created_at,
        category: "university_form",
        kind: `${f.school_name} — ${f.form_type_name}`,
        description: `Form for ${f.full_name} (${f.phone})`,
        amount: Number(f.amount_paid || 0),
        direction: "in",
        status: f.status,
        method: f.paid_via,
        reference: f.paystack_reference || null,
        customer: f.full_name,
        customer_email: null,
        store_name: storeName(f.store_id),
      });
    }

    for (const f of formOrders) {
      entries.push({
        id: `form-${f.id}`,
        created_at: f.created_at,
        category: "university_form",
        kind: `${f.school_name} — ${f.form_type_name}`,
        description: `Form for ${f.full_name} (${f.phone})`,
        amount: Number(f.amount_paid || 0),
        direction: "in",
        status: f.status,
        method: "paystack",
        reference: f.reference || null,
        customer: who(f.user_id) || f.full_name,
        customer_email: f.user_id ? profileMap.get(f.user_id)?.email || null : null,
        store_name: null,
      });
    }

    entries.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const isSuccess = (e: any) => ["success", "delivered", "paid", "completed"].includes(String(e.status));

    const stats = {
      total: entries.length,
      walletTopups: entries
        .filter((e) => e.kind === "wallet_topup" && isSuccess(e))
        .reduce((s, e) => s + e.amount, 0),
      paystackTopups: entries
        .filter((e) => e.kind === "wallet_topup" && isSuccess(e) && e.method === "paystack")
        .reduce((s, e) => s + e.amount, 0),
      manualTopups: entries
        .filter((e) => e.kind === "wallet_topup" && isSuccess(e) && e.method === "manual")
        .reduce((s, e) => s + e.amount, 0),
      dataRevenue: entries
        .filter((e) => e.category === "data_order" && e.status !== "failed")
        .reduce((s, e) => s + e.amount, 0),
      checkerRevenue: entries
        .filter((e) => e.category === "checker_order" && e.status !== "failed")
        .reduce((s, e) => s + e.amount, 0),
      formRevenue: entries
        .filter((e) => e.category === "university_form" && e.status !== "failed")
        .reduce((s, e) => s + e.amount, 0),
    };

    return json({ success: true, entries, stats });
  } catch (e) {
    console.error(e);
    return json({ success: false, error: (e as Error).message || "Unexpected error" });
  }
});

function json(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
