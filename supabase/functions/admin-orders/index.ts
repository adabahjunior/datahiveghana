import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    const [{ data: orders }, { data: stores }, { data: assignments }, { data: withdrawals }] = await Promise.all([
      supabase.from("orders").select("*").order("created_at", { ascending: false }).limit(1000),
      supabase.from("agent_stores").select("id,store_name,slug,agent_id"),
      supabase.from("subagent_assignments").select("parent_agent_id,subagent_user_id,status").eq("status", "active"),
      supabase.from("withdrawals").select("amount,status"),
    ]);

    const storeMap = new Map((stores || []).map((store: any) => [store.id, store]));
    const assignmentMap = new Map((assignments || []).map((assignment: any) => [assignment.subagent_user_id, assignment]));

    const enrichedOrders = (orders || []).map((order: any) => {
      const store = order.store_id ? storeMap.get(order.store_id) : null;
      const assignment = store?.agent_id ? assignmentMap.get(store.agent_id) : null;
      return {
        ...order,
        store_name: store?.store_name || null,
        store_slug: store?.slug || null,
        store_agent_id: store?.agent_id || null,
        parent_agent_id: assignment?.parent_agent_id || null,
        source: store ? (assignment ? "subagent_store" : "agent_store") : "direct",
      };
    });

    const stats = {
      orders: enrichedOrders.length,
      successfulOrders: enrichedOrders.filter((order: any) => order.status === "delivered").length,
      pendingOrders: enrichedOrders.filter((order: any) => order.status === "pending" || order.status === "processing").length,
      failedOrders: enrichedOrders.filter((order: any) => order.status === "failed").length,
      revenue: enrichedOrders.filter((order: any) => order.status !== "failed").reduce((sum: number, order: any) => sum + Number(order.amount_paid || 0), 0),
      storeOrders: enrichedOrders.filter((order: any) => order.source === "agent_store").length,
      subagentStoreOrders: enrichedOrders.filter((order: any) => order.source === "subagent_store").length,
      totalWithdrawals: (withdrawals || []).filter((w: any) => w.status === "paid").reduce((sum: number, w: any) => sum + Number(w.amount || 0), 0),
    };

    return json({ success: true, orders: enrichedOrders, stats });
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