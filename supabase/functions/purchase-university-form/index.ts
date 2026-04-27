import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return fail("Method not allowed", "METHOD_NOT_ALLOWED");

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Authenticate the caller
    const auth = req.headers.get("Authorization");
    if (!auth) return fail("Unauthorized", "UNAUTHORIZED");
    const { data: { user }, error: userError } = await supabase.auth.getUser(
      auth.replace("Bearer ", "")
    );
    if (userError || !user) return fail("Unauthorized", "UNAUTHORIZED");

    // Parse body
    const { form_type_id, full_name, phone, email } = await req.json();
    if (!form_type_id || !full_name?.trim() || !phone?.trim() || !email?.trim()) {
      return fail("Missing required fields", "MISSING_FIELDS");
    }

    // Load form type + school
    const { data: formType, error: ftError } = await supabase
      .from("university_form_types")
      .select("id, name, price, is_active, school_id, university_schools(id, name, is_published)")
      .eq("id", form_type_id)
      .maybeSingle();

    if (ftError || !formType) return fail("Form type not found", "NOT_FOUND");
    if (!formType.is_active) return fail("This form type is not available", "NOT_ACTIVE");

    const school = (formType as any).university_schools;
    if (!school?.is_published) return fail("School is not available", "NOT_PUBLISHED");

    const price = Number(formType.price);

    // Load buyer's profile
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("user_id, wallet_balance")
      .eq("user_id", user.id)
      .single();
    if (profileError || !profile) return fail("Profile not found", "PROFILE_NOT_FOUND");

    const balance = Number(profile.wallet_balance);
    if (balance < price) {
      return fail(
        `Insufficient wallet balance. Need GH₵${price.toFixed(2)}, have GH₵${balance.toFixed(2)}.`,
        "INSUFFICIENT_BALANCE"
      );
    }

    // Deduct wallet atomically (guard with gte check)
    const newBalance = balance - price;
    const { error: debitError } = await supabase
      .from("profiles")
      .update({ wallet_balance: newBalance })
      .eq("user_id", user.id)
      .gte("wallet_balance", price);
    if (debitError) return fail("Wallet deduction failed: " + debitError.message, "DEBIT_FAILED");

    // Generate reference
    const reference = `UNI-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    // Insert order
    const { data: order, error: orderError } = await supabase
      .from("university_form_orders")
      .insert({
        user_id: user.id,
        school_id: school.id,
        form_type_id: formType.id,
        school_name: school.name,
        form_type_name: formType.name,
        full_name: full_name.trim(),
        phone: phone.trim(),
        email: email.trim(),
        amount_paid: price,
        reference,
        status: "completed",
      })
      .select("id, reference, amount_paid, school_name, form_type_name")
      .single();

    if (orderError) {
      // Roll back wallet deduction on order failure
      await supabase
        .from("profiles")
        .update({ wallet_balance: balance })
        .eq("user_id", user.id);
      return fail("Order creation failed: " + orderError.message, "ORDER_FAILED");
    }

    // Log transaction
    await supabase.from("transactions").insert({
      user_id: user.id,
      type: "university_form",
      status: "success",
      amount: price,
      description: `University form: ${school.name} - ${formType.name}`,
    });

    return json({
      success: true,
      order: {
        id: order.id,
        reference: order.reference,
        amount_paid: price,
        school_name: school.name,
        form_type_name: formType.name,
        full_name: full_name.trim(),
        phone: phone.trim(),
        email: email.trim(),
      },
      new_balance: newBalance,
    });
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
