import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const normalizeDigits = (phone: string) => phone.replace(/\D/g, "");

const buildPhoneVariants = (phone: string): string[] => {
  const digits = normalizeDigits(phone);
  const variants = new Set<string>();

  if (!digits) return [];

  variants.add(digits);
  variants.add(`+${digits}`);

  if (digits.startsWith("0") && digits.length >= 10) {
    const intl = `233${digits.slice(1)}`;
    variants.add(intl);
    variants.add(`+${intl}`);
  }

  if (digits.startsWith("233") && digits.length >= 12) {
    const local = `0${digits.slice(3)}`;
    variants.add(local);
    variants.add(`+${local}`);
  }

  return Array.from(variants);
};

const sanitizeForIlike = (value: string) => value.replace(/[%_,]/g, "");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ success: false, error: "Method not allowed" }, 405);

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { phone } = await req.json();

    const phoneInput = String(phone || "").trim();
    const digits = normalizeDigits(phoneInput);
    if (digits.length < 9) {
      return json({ success: false, error: "Enter a valid phone number" }, 400);
    }

    const variants = buildPhoneVariants(phoneInput);
    const last9 = sanitizeForIlike(digits.slice(-9));

    let query = supabase
      .from("orders")
      .select("id,status,recipient_phone,network,volume_mb,amount_paid,created_at,updated_at,store_id")
      .order("created_at", { ascending: false })
      .limit(10);

    if (variants.length > 0) {
      query = query.in("recipient_phone", variants);
    }

    let { data: orders, error } = await query;

    if ((!orders || orders.length === 0) && !error && last9.length >= 9) {
      const { data: fallbackOrders, error: fallbackError } = await supabase
        .from("orders")
        .select("id,status,recipient_phone,network,volume_mb,amount_paid,created_at,updated_at,store_id")
        .ilike("recipient_phone", `%${last9}`)
        .order("created_at", { ascending: false })
        .limit(10);
      orders = fallbackOrders;
      error = fallbackError;
    }

    if (error) {
      return json({ success: false, error: error.message }, 500);
    }

    if (!orders || orders.length === 0) {
      return json({ success: true, found: false, message: "No order found for this phone number." });
    }

    const uniqueStoreIds = Array.from(new Set(orders.map((o: any) => o.store_id).filter(Boolean)));
    let storeMap: Record<string, string> = {};

    if (uniqueStoreIds.length > 0) {
      const { data: stores } = await supabase
        .from("agent_stores")
        .select("id,store_name")
        .in("id", uniqueStoreIds);

      storeMap = Object.fromEntries((stores || []).map((s: any) => [s.id, s.store_name]));
    }

    const enriched = orders.map((order: any) => ({
      ...order,
      store_name: order.store_id ? storeMap[order.store_id] || null : null,
      source: order.store_id ? "store" : "dashboard",
    }));

    return json({
      success: true,
      found: true,
      latest: enriched[0],
      orders: enriched,
    });
  } catch (e) {
    console.error(e);
    return json({ success: false, error: (e as Error).message || "Unexpected error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
