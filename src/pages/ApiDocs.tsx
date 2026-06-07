import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Code2, KeyRound, Copy, CheckCircle2, Plus, Trash2, ShieldOff, Sparkles,
  BookOpen, Zap, ListChecks, Wallet as WalletIcon, ArrowRight, Terminal, AlertCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const SUPABASE_URL = "https://cscakblvipadupebrpkh.supabase.co";
const API_BASE = `${SUPABASE_URL}/functions/v1/developer-api`;

type ApiKey = {
  id: string;
  label: string;
  key_prefix: string;
  is_active: boolean;
  last_used_at: string | null;
  created_at: string;
};

function CodeBlock({ code, language = "bash" }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="relative group">
      <div className="absolute top-2 right-2 z-10 flex items-center gap-2">
        <Badge variant="secondary" className="text-[10px] uppercase tracking-wider">{language}</Badge>
        <Button size="icon" variant="ghost" className="h-7 w-7 bg-background/80 backdrop-blur" onClick={copy}>
          {copied ? <CheckCircle2 className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
        </Button>
      </div>
      <pre className="overflow-x-auto rounded-lg border border-border bg-muted/40 p-4 pr-24 text-xs leading-relaxed">
        <code className="font-mono text-foreground">{code}</code>
      </pre>
    </div>
  );
}

function Endpoint({ method, path, desc }: { method: string; path: string; desc: string }) {
  const colors: Record<string, string> = {
    GET: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30",
    POST: "bg-blue-500/15 text-blue-500 border-blue-500/30",
  };
  return (
    <div className="flex items-start gap-3 rounded-lg border border-border/60 bg-card/60 p-3">
      <Badge variant="outline" className={`font-mono text-[11px] font-bold ${colors[method] || ""}`}>{method}</Badge>
      <div className="flex-1 min-w-0">
        <code className="text-sm font-mono text-foreground break-all">{path}</code>
        <p className="text-xs text-muted-foreground mt-1">{desc}</p>
      </div>
    </div>
  );
}

export default function ApiDocs() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [revealedKey, setRevealedKey] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("manage-api-keys", { body: { action: "list" } });
    if (error) toast.error("Failed to load keys");
    else setKeys((data as any)?.keys || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const createKey = async () => {
    setCreating(true);
    const { data, error } = await supabase.functions.invoke("manage-api-keys", {
      body: { action: "create", label: newLabel || "Default" },
    });
    setCreating(false);
    if (error) { toast.error(error.message); return; }
    const payload = data as any;
    if (payload?.error) { toast.error(payload.error); return; }
    setRevealedKey(payload.api_key);
    setNewLabel("");
    load();
  };

  const revoke = async (id: string) => {
    const { error } = await supabase.functions.invoke("manage-api-keys", { body: { action: "revoke", id } });
    if (error) toast.error(error.message);
    else { toast.success("Key revoked"); load(); }
  };

  const remove = async (id: string) => {
    const { error } = await supabase.functions.invoke("manage-api-keys", { body: { action: "delete", id } });
    if (error) toast.error(error.message);
    else { toast.success("Key deleted"); load(); }
  };

  const sampleKey = useMemo(() => keys.find((k) => k.is_active)?.key_prefix + "..." || "dh_live_xxxxxxxx...", [keys]);
  const exampleKey = "dh_live_YOUR_API_KEY_HERE";

  const curlPurchase = `curl -X POST ${API_BASE}/purchase \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: ${exampleKey}" \\
  -d '{
    "package_id": "PACKAGE_UUID_FROM_PACKAGES_ENDPOINT",
    "recipient_phone": "0241234567"
  }'`;

  const curlPackages = `curl ${API_BASE}/packages \\
  -H "x-api-key: ${exampleKey}"`;

  const curlBalance = `curl ${API_BASE}/balance \\
  -H "x-api-key: ${exampleKey}"`;

  const curlOrder = `curl "${API_BASE}/order?id=ORDER_UUID" \\
  -H "x-api-key: ${exampleKey}"`;

  const jsExample = `// Node.js / Browser (fetch)
const API_KEY = "${exampleKey}";
const API_BASE = "${API_BASE}";

async function buyData(packageId, phone) {
  const res = await fetch(\`\${API_BASE}/purchase\`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": API_KEY,
    },
    body: JSON.stringify({
      package_id: packageId,
      recipient_phone: phone,
    }),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error);
  return data;
}

// Example
buyData("uuid-from-packages-endpoint", "0241234567")
  .then((r) => console.log("Order:", r.order_id, "Status:", r.status))
  .catch(console.error);`;

  const phpExample = `<?php
$apiKey = "${exampleKey}";
$apiBase = "${API_BASE}";

$payload = json_encode([
    "package_id"      => "uuid-from-packages-endpoint",
    "recipient_phone" => "0241234567",
]);

$ch = curl_init("$apiBase/purchase");
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST           => true,
    CURLOPT_POSTFIELDS     => $payload,
    CURLOPT_HTTPHEADER     => [
        "Content-Type: application/json",
        "x-api-key: $apiKey",
    ],
]);
$response = curl_exec($ch);
curl_close($ch);

$data = json_decode($response, true);
if (!empty($data["success"])) {
    echo "Order ID: " . $data["order_id"];
} else {
    echo "Error: " . $data["error"];
}`;

  const pyExample = `# Python (requests)
import requests

API_KEY  = "${exampleKey}"
API_BASE = "${API_BASE}"

def buy_data(package_id: str, phone: str):
    r = requests.post(
        f"{API_BASE}/purchase",
        headers={"x-api-key": API_KEY, "Content-Type": "application/json"},
        json={"package_id": package_id, "recipient_phone": phone},
        timeout=30,
    )
    data = r.json()
    if not data.get("success"):
        raise RuntimeError(data.get("error"))
    return data

print(buy_data("uuid-from-packages-endpoint", "0241234567"))`;

  const successResponse = `{
  "success": true,
  "order_id": "9c0b1f2d-...",
  "status": "delivered",
  "provider_status": "delivered",
  "provider_reference": "REF12345",
  "amount_charged": 5.50,
  "new_balance": 94.50,
  "recipient_phone": "0241234567",
  "network": "mtn",
  "volume_mb": 1024
}`;

  const errorResponse = `{
  "success": false,
  "error": "Insufficient wallet balance",
  "code": "INSUFFICIENT_BALANCE"
}`;

  return (
    <div className="space-y-8">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-background to-background p-8">
        <div className="absolute -top-20 -right-20 h-64 w-64 rounded-full bg-primary/20 blur-3xl" />
        <div className="relative">
          <Badge className="mb-3 gap-1.5"><Sparkles className="h-3 w-3" /> Developer API · v1</Badge>
          <h1 className="text-4xl font-bold tracking-tight">Sell data from your own app</h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            Plug our data network straight into your website, bot, or POS. Three endpoints, one header,
            and you're live. Designed so beginners can ship in under 10 minutes.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Badge variant="outline" className="gap-1.5"><Zap className="h-3 w-3" /> Realtime delivery</Badge>
            <Badge variant="outline" className="gap-1.5"><WalletIcon className="h-3 w-3" /> Charged from your wallet</Badge>
            <Badge variant="outline" className="gap-1.5"><ShieldOff className="h-3 w-3" /> Revokable keys</Badge>
          </div>
        </div>
      </div>

      {/* Quickstart */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <BookOpen className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-bold">Quickstart — 3 steps</h2>
        </div>
        <ol className="space-y-4">
          {[
            { n: 1, t: "Generate an API key", d: "Scroll to the API Keys section below and click “Create new key”. Copy it once — you won't see it again." },
            { n: 2, t: "List available packages", d: "Call GET /packages to see all data bundles with their package_id and your price." },
            { n: 3, t: "Send a purchase", d: "POST /purchase with the package_id and the recipient phone. We charge your wallet and push data to the customer." },
          ].map((s) => (
            <li key={s.n} className="flex gap-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">{s.n}</div>
              <div>
                <div className="font-semibold">{s.t}</div>
                <p className="text-sm text-muted-foreground mt-0.5">{s.d}</p>
              </div>
            </li>
          ))}
        </ol>
      </Card>

      {/* API Keys */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-bold">Your API keys</h2>
          </div>
          <div className="flex items-end gap-2">
            <div>
              <Label className="text-xs">Label (optional)</Label>
              <Input
                value={newLabel} onChange={(e) => setNewLabel(e.target.value)}
                placeholder="e.g. My website"
                className="h-9 w-44"
              />
            </div>
            <Button onClick={createKey} disabled={creating}>
              <Plus className="h-4 w-4 mr-1" />{creating ? "Creating…" : "Create new key"}
            </Button>
          </div>
        </div>

        <Alert className="mb-4 border-primary/30 bg-primary/5">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Keep keys secret</AlertTitle>
          <AlertDescription>
            Anyone with your key can spend your wallet. Never paste keys in frontend code visible to users — call from a server.
          </AlertDescription>
        </Alert>

        {loading ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Loading…</p>
        ) : keys.length === 0 ? (
          <div className="text-center py-10 border border-dashed border-border rounded-lg">
            <KeyRound className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">No keys yet. Create one to start using the API.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {keys.map((k) => (
              <div key={k.id} className="flex items-center justify-between rounded-lg border border-border/60 bg-card/60 p-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{k.label}</span>
                    {k.is_active ? (
                      <Badge variant="secondary" className="text-[10px]">Active</Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] text-destructive border-destructive/40">Revoked</Badge>
                    )}
                  </div>
                  <code className="text-xs text-muted-foreground font-mono">{k.key_prefix}••••••••••••</code>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Created {new Date(k.created_at).toLocaleDateString()}
                    {k.last_used_at && ` · last used ${new Date(k.last_used_at).toLocaleString()}`}
                  </p>
                </div>
                <div className="flex gap-1">
                  {k.is_active && (
                    <Button size="sm" variant="ghost" onClick={() => revoke(k.id)}>
                      <ShieldOff className="h-4 w-4 mr-1" /> Revoke
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => remove(k.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Base URL & Auth */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Terminal className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-bold">Base URL & authentication</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-3">
          All endpoints live under one base URL. Send your key in the <code className="px-1.5 py-0.5 rounded bg-muted text-xs">x-api-key</code> header on every request.
        </p>
        <div className="space-y-3">
          <div>
            <Label className="text-xs text-muted-foreground">Base URL</Label>
            <CodeBlock code={API_BASE} language="url" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Required header</Label>
            <CodeBlock code={`x-api-key: ${sampleKey}`} language="header" />
          </div>
        </div>
      </Card>

      {/* Endpoints overview */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <ListChecks className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-bold">Endpoints</h2>
        </div>
        <div className="grid gap-2">
          <Endpoint method="GET" path="/packages" desc="List all active data bundles with your effective price." />
          <Endpoint method="GET" path="/balance" desc="Check your current wallet balance (GHS)." />
          <Endpoint method="POST" path="/purchase" desc="Charge your wallet and send data to a phone number." />
          <Endpoint method="GET" path="/order?id=<uuid>" desc="Look up the latest status of an order you placed." />
        </div>
      </Card>

      {/* Details per endpoint */}
      <Card className="p-6 space-y-8">
        <h2 className="text-xl font-bold flex items-center gap-2"><Code2 className="h-5 w-5 text-primary" /> Endpoint reference</h2>

        {/* /packages */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Badge className="bg-emerald-500/15 text-emerald-500 border-emerald-500/30 font-mono">GET</Badge>
            <code className="font-mono">/packages</code>
          </div>
          <p className="text-sm text-muted-foreground">Returns every active package. The <code className="text-xs px-1 bg-muted rounded">package_id</code> is what you pass to <code className="text-xs px-1 bg-muted rounded">/purchase</code>.</p>
          <CodeBlock code={curlPackages} language="cURL" />
          <div>
            <Label className="text-xs text-muted-foreground">Sample response</Label>
            <CodeBlock language="json" code={`{
  "success": true,
  "count": 12,
  "packages": [
    {
      "package_id": "f1e2...-d3c4",
      "name": "1GB",
      "network": "mtn",
      "volume_mb": 1024,
      "volume_gb": 1.0,
      "validity_days": 90,
      "price_ghs": 5.50
    }
  ]
}`} />
          </div>
        </section>

        {/* /balance */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Badge className="bg-emerald-500/15 text-emerald-500 border-emerald-500/30 font-mono">GET</Badge>
            <code className="font-mono">/balance</code>
          </div>
          <p className="text-sm text-muted-foreground">Check available funds before placing big batches.</p>
          <CodeBlock code={curlBalance} language="cURL" />
          <CodeBlock language="json" code={`{
  "success": true,
  "wallet_balance": 94.50,
  "profit_balance": 12.20,
  "currency": "GHS"
}`} />
        </section>

        {/* /purchase */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Badge className="bg-blue-500/15 text-blue-500 border-blue-500/30 font-mono">POST</Badge>
            <code className="font-mono">/purchase</code>
          </div>
          <p className="text-sm text-muted-foreground">Charge your wallet and dispatch data to a recipient.</p>
          <div>
            <Label className="text-xs text-muted-foreground">Body parameters</Label>
            <div className="rounded-lg border border-border overflow-hidden mt-1">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                  <tr><th className="text-left p-2.5">Field</th><th className="text-left p-2.5">Type</th><th className="text-left p-2.5">Description</th></tr>
                </thead>
                <tbody className="divide-y divide-border">
                  <tr><td className="p-2.5 font-mono">package_id</td><td className="p-2.5">string (UUID)</td><td className="p-2.5">From /packages</td></tr>
                  <tr><td className="p-2.5 font-mono">recipient_phone</td><td className="p-2.5">string</td><td className="p-2.5">Ghana phone, ≥10 digits (e.g. 0241234567)</td></tr>
                </tbody>
              </table>
            </div>
          </div>

          <Tabs defaultValue="curl" className="w-full">
            <TabsList>
              <TabsTrigger value="curl">cURL</TabsTrigger>
              <TabsTrigger value="js">JavaScript</TabsTrigger>
              <TabsTrigger value="php">PHP</TabsTrigger>
              <TabsTrigger value="py">Python</TabsTrigger>
            </TabsList>
            <TabsContent value="curl"><CodeBlock code={curlPurchase} language="cURL" /></TabsContent>
            <TabsContent value="js"><CodeBlock code={jsExample} language="JavaScript" /></TabsContent>
            <TabsContent value="php"><CodeBlock code={phpExample} language="PHP" /></TabsContent>
            <TabsContent value="py"><CodeBlock code={pyExample} language="Python" /></TabsContent>
          </Tabs>

          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground flex items-center gap-1.5"><CheckCircle2 className="h-3 w-3 text-emerald-500" /> Success</Label>
              <CodeBlock code={successResponse} language="json" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground flex items-center gap-1.5"><AlertCircle className="h-3 w-3 text-destructive" /> Failure</Label>
              <CodeBlock code={errorResponse} language="json" />
            </div>
          </div>
        </section>

        {/* /order */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Badge className="bg-emerald-500/15 text-emerald-500 border-emerald-500/30 font-mono">GET</Badge>
            <code className="font-mono">/order?id=&lt;uuid&gt;</code>
          </div>
          <p className="text-sm text-muted-foreground">Poll status of an order. Returns <code className="text-xs px-1 bg-muted rounded">processing</code>, <code className="text-xs px-1 bg-muted rounded">delivered</code>, or <code className="text-xs px-1 bg-muted rounded">failed</code>.</p>
          <CodeBlock code={curlOrder} language="cURL" />
        </section>
      </Card>

      {/* Status / Errors */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card className="p-6">
          <h3 className="font-bold mb-3 flex items-center gap-2"><ArrowRight className="h-4 w-4 text-primary" /> Order statuses</h3>
          <ul className="space-y-2 text-sm">
            <li><Badge variant="secondary" className="mr-2">processing</Badge> Sent to network, awaiting delivery.</li>
            <li><Badge className="mr-2 bg-emerald-500/15 text-emerald-500 border-emerald-500/30" variant="outline">delivered</Badge> Data successfully credited.</li>
            <li><Badge variant="destructive" className="mr-2">failed</Badge> Wallet refunded automatically when applicable.</li>
            <li><Badge variant="outline" className="mr-2">queued</Badge> Provider temporarily down; will retry.</li>
          </ul>
        </Card>
        <Card className="p-6">
          <h3 className="font-bold mb-3 flex items-center gap-2"><AlertCircle className="h-4 w-4 text-destructive" /> Common error codes</h3>
          <ul className="space-y-1.5 text-sm font-mono">
            <li><span className="text-destructive">MISSING_API_KEY</span> — header not sent</li>
            <li><span className="text-destructive">INVALID_API_KEY</span> — key revoked or wrong</li>
            <li><span className="text-destructive">INSUFFICIENT_BALANCE</span> — top up wallet</li>
            <li><span className="text-destructive">PACKAGE_NOT_FOUND</span> — wrong package_id</li>
            <li><span className="text-destructive">INVALID_INPUT</span> — missing/invalid field</li>
            <li><span className="text-destructive">ACCOUNT_BANNED</span> — contact support</li>
          </ul>
        </Card>
      </div>

      {/* Rate limits / Best practices */}
      <Card className="p-6">
        <h3 className="font-bold mb-3">Best practices</h3>
        <ul className="space-y-2 text-sm text-muted-foreground list-disc pl-5">
          <li>Cache <code className="text-xs px-1 bg-muted rounded">/packages</code> for a few minutes — it changes rarely.</li>
          <li>Always validate the phone number on your side before calling <code className="text-xs px-1 bg-muted rounded">/purchase</code>.</li>
          <li>Store the returned <code className="text-xs px-1 bg-muted rounded">order_id</code> so you can poll status or display receipts.</li>
          <li>Rotate API keys periodically. Use one key per environment (dev / production).</li>
          <li>Never expose keys in mobile apps or browser code — proxy through your own backend.</li>
        </ul>
      </Card>

      {/* Reveal-once dialog */}
      <Dialog open={!!revealedKey} onOpenChange={(o) => !o && setRevealedKey(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><KeyRound className="h-5 w-5 text-primary" /> Your new API key</DialogTitle>
            <DialogDescription>
              Copy this now. For your security, the full key will never be displayed again.
            </DialogDescription>
          </DialogHeader>
          {revealedKey && <CodeBlock code={revealedKey} language="API KEY" />}
          <DialogFooter>
            <Button
              onClick={() => {
                navigator.clipboard.writeText(revealedKey!);
                toast.success("Copied to clipboard");
              }}
            >
              <Copy className="h-4 w-4 mr-1" /> Copy & close
            </Button>
            <Button variant="outline" onClick={() => setRevealedKey(null)}>I've saved it</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
