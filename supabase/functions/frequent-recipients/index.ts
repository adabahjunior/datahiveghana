import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PAGE_SIZE = 1000;

function normalize(phone: string): string | null {
  const digits = String(phone || "").replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("233") && digits.length >= 12) return `0${digits.slice(3)}`;
  if (digits.startsWith("0") && digits.length >= 10) return digits.slice(0, 10);
  if (digits.length === 9) return `0${digits}`;
  return digits;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ success: false, error: "Unauthorized" });

    const { data: authData } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (!authData?.user) return json({ success: false, error: "Unauthorized" });

    const { data: adminRole } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", authData.user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!adminRole) return json({ success: false, error: "Admins only" });

    const counts = new Map<string, number>();
    let from = 0;
    while (true) {
      const { data, error } = await supabase
        .from("orders")
        .select("recipient_phone,network")
        .eq("network", "mtn")
        .range(from, from + PAGE_SIZE - 1);
      if (error) throw new Error(error.message);
      const chunk = data || [];
      for (const row of chunk) {
        const phone = normalize((row as any).recipient_phone);
        if (!phone) continue;
        counts.set(phone, (counts.get(phone) || 0) + 1);
      }
      if (chunk.length < PAGE_SIZE) break;
      from += PAGE_SIZE;
    }

    const contacts = Array.from(counts.entries())
      .filter(([, count]) => count > 2)
      .map(([phone, count]) => ({ phone, orders: count }))
      .sort((a, b) => b.orders - a.orders || a.phone.localeCompare(b.phone));

    return json({ success: true, contacts, total: contacts.length });
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
