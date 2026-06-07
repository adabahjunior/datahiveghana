// User-authenticated management of developer API keys.
// POST { action: "list" }                          -> list keys
// POST { action: "create", label }                 -> create + return plaintext ONCE
// POST { action: "revoke", id }                    -> deactivate
// POST { action: "delete", id }                    -> delete

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function randomKey(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
  return `dh_live_${hex}`;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const auth = req.headers.get("Authorization");
  if (!auth) return json({ error: "Unauthorized" }, 401);
  const { data: { user } } = await supabase.auth.getUser(auth.replace("Bearer ", ""));
  if (!user) return json({ error: "Unauthorized" }, 401);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "Invalid body" }, 400); }
  const action = body?.action;

  if (action === "list") {
    const { data, error } = await supabase
      .from("api_keys")
      .select("id,label,key_prefix,is_active,last_used_at,created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (error) return json({ error: error.message }, 500);
    return json({ keys: data || [] });
  }

  if (action === "create") {
    const label = String(body?.label || "Default").slice(0, 64);
    const { count } = await supabase.from("api_keys").select("id", { count: "exact", head: true }).eq("user_id", user.id);
    if ((count || 0) >= 10) return json({ error: "Max 10 keys per account. Revoke one first." }, 400);

    const plain = randomKey();
    const hash = await sha256Hex(plain);
    const prefix = plain.slice(0, 16); // dh_live_<8 hex>

    const { error } = await supabase.from("api_keys").insert({
      user_id: user.id, label, key_hash: hash, key_prefix: prefix, is_active: true,
    });
    if (error) return json({ error: error.message }, 500);
    return json({ api_key: plain, prefix, label, message: "Save this key now — it will not be shown again." });
  }

  if (action === "revoke") {
    const id = body?.id;
    if (!id) return json({ error: "Missing id" }, 400);
    const { error } = await supabase.from("api_keys").update({ is_active: false }).eq("id", id).eq("user_id", user.id);
    if (error) return json({ error: error.message }, 500);
    return json({ ok: true });
  }

  if (action === "delete") {
    const id = body?.id;
    if (!id) return json({ error: "Missing id" }, 400);
    const { error } = await supabase.from("api_keys").delete().eq("id", id).eq("user_id", user.id);
    if (error) return json({ error: error.message }, 500);
    return json({ ok: true });
  }

  return json({ error: "Unknown action" }, 400);
});
