import { verifyNumberSwiftData } from "../_shared/dataProvider.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return json({ success: false, error: "Method not allowed" }, 405);
  }
  try {
    const body = await req.json().catch(() => ({}));
    const phone = String(body?.phone || "").trim();
    const network = String(body?.network || "mtn").toLowerCase();
    if (phone.replace(/\D/g, "").length < 9) {
      return json({ success: false, error: "Invalid phone number" }, 400);
    }
    // Verification is MTN-only per provider; other networks return unknown
    if (!["mtn", "yello"].includes(network)) {
      return json({ success: true, supported: false, verified: null, status: "unsupported" });
    }
    const result = await verifyNumberSwiftData(phone);
    if ("error" in result) {
      return json({ success: false, error: result.error }, 502);
    }
    return json({ success: true, supported: true, verified: result.verified, status: result.status, message: result.message });
  } catch (e) {
    return json({ success: false, error: (e as Error).message || "Unexpected error" }, 500);
  }
});

function json(b: any, status = 200) {
  return new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
