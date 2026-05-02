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

const hasProfitTx = async (supabase: ReturnType<typeof createClient>, orderId: string, userId: string) => {
  const { data } = await supabase
    .from("transactions")
    .select("id")
    .eq("type", "store_sale")
    .eq("user_id", userId)
    .eq("description", `university_form_sale:${orderId}`)
    .maybeSingle();

  return !!data;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const paystackSecretKey = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (!paystackSecretKey) return json({ error: "Server Paystack secret is not configured" }, 500);

    const { store_id, form_type_id, full_name, phone, email, reference } = await req.json();
    const buyerPhone = String(phone || "").trim();
    const buyerName = String(full_name || "").trim();
    const buyerEmail = String(email || "").trim();

    if (!store_id || !form_type_id || !reference || buyerName.length < 3 || buyerPhone.length < 10 || !buyerEmail.includes("@")) {
      return json({ error: "Invalid input" }, 400);
    }

    const { data: duplicate } = await supabase
      .from("store_university_form_orders")
      .select("id")
      .eq("paystack_reference", reference)
      .maybeSingle();
    if (duplicate) return json({ error: "This payment reference has already been used" }, 409);

    const [{ data: store }, { data: listing }] = await Promise.all([
      supabase.from("agent_stores").select("id,agent_id,store_name,is_active").eq("id", store_id).eq("is_active", true).single(),
      (supabase as any)
        .from("store_university_form_prices")
        .select("selling_price,is_listed,form_type:university_form_types(id,name,price,school_id,is_active,school:university_schools(id,name,is_published))")
        .eq("store_id", store_id)
        .eq("form_type_id", form_type_id)
        .eq("is_listed", true)
        .maybeSingle(),
    ]);

    if (!store || !listing?.form_type) {
      return json({ error: "University form is not available in this store" }, 404);
    }

    const formType = listing.form_type as any;
    const school = formType.school as any;

    if (!formType.is_active || !school?.is_published) {
      return json({ error: "University form is currently unavailable" }, 400);
    }

    const sellingPrice = Number(listing.selling_price || 0);
    const basePrice = Number(formType.price || 0);
    if (!Number.isFinite(sellingPrice) || sellingPrice <= 0) {
      return json({ error: "Invalid selling price" }, 400);
    }

    const expectedTotal = sellingPrice + calcPaystackCharge(sellingPrice);
    const verifiedPayment = await verifyPaystackReference(reference, paystackSecretKey);
    const paidAmount = Number(verifiedPayment.amount || 0) / 100;

    if (verifiedPayment.status !== "success") return json({ error: "Payment was not successful" }, 400);
    if (verifiedPayment.currency !== "GHS") return json({ error: "Invalid payment currency" }, 400);
    if (paidAmount + 0.01 < expectedTotal) return json({ error: "Paid amount is lower than expected" }, 400);

    const sellerProfit = Math.max(0, Number((sellingPrice - basePrice).toFixed(2)));

    const { data: order, error: orderError } = await supabase
      .from("store_university_form_orders")
      .insert({
        store_id: store.id,
        school_id: school.id,
        form_type_id: formType.id,
        school_name: school.name,
        form_type_name: formType.name,
        full_name: buyerName,
        phone: buyerPhone,
        email: buyerEmail,
        amount_paid: sellingPrice,
        cost_price: basePrice,
        seller_profit: sellerProfit,
        status: "delivered",
        paid_via: "paystack",
        paystack_reference: reference,
        notes: "Store university form purchase",
      })
      .select("id,school_name,form_type_name,amount_paid,paystack_reference,full_name,phone,email")
      .single();

    if (orderError || !order) {
      return json({ error: orderError?.message || "Order creation failed" }, 500);
    }

    if (sellerProfit > 0 && !(await hasProfitTx(supabase, order.id, store.agent_id))) {
      const { data: sellerProfile } = await supabase
        .from("profiles")
        .select("profit_balance")
        .eq("user_id", store.agent_id)
        .maybeSingle();

      const nextProfit = Number(sellerProfile?.profit_balance || 0) + sellerProfit;
      await supabase.from("profiles").update({ profit_balance: nextProfit }).eq("user_id", store.agent_id);

      await supabase.from("transactions").insert({
        user_id: store.agent_id,
        type: "store_sale",
        status: "success",
        amount: sellerProfit,
        description: `university_form_sale:${order.id}`,
      });
    }

    return json({
      success: true,
      order: {
        id: order.id,
        school_name: order.school_name,
        form_type_name: order.form_type_name,
        amount_paid: Number(order.amount_paid || 0),
        reference: order.paystack_reference,
        full_name: order.full_name,
        phone: order.phone,
        email: order.email,
      },
    });
  } catch (e) {
    console.error(e);
    return json({ error: (e as Error).message || "Unexpected error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
