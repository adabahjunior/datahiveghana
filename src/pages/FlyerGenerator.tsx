import { useEffect, useMemo, useRef, useState } from "react";
import html2canvas from "html2canvas";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { networkLabel } from "@/lib/format";
import { Link } from "react-router-dom";
import { Download, Loader2, Sparkles, WandSparkles } from "lucide-react";
import { toast } from "sonner";

type NetworkKey = "mtn" | "telecel" | "airteltigo_ishare" | "airteltigo_bigtime";

type TemplateStyle = {
  id: string;
  name: string;
  bg: string;
  cardBg: string;
  text: string;
  mute: string;
  strip: string;
};

type FlyerSize = "1080x1080" | "1080x1350";

const templates: TemplateStyle[] = [
  {
    id: "urban-sky",
    name: "Urban Sky",
    bg: "linear-gradient(130deg, #4cc9f0 0%, #90e0ef 38%, #e0fbfc 100%)",
    cardBg: "rgba(255,255,255,0.92)",
    text: "#0b1f3a",
    mute: "#224b75",
    strip: "linear-gradient(90deg, #1d4ed8, #0ea5e9)",
  },
  {
    id: "midnight-pro",
    name: "Midnight Pro",
    bg: "linear-gradient(135deg, #0f172a 0%, #1e293b 44%, #334155 100%)",
    cardBg: "rgba(255,255,255,0.95)",
    text: "#06122a",
    mute: "#203a5f",
    strip: "linear-gradient(90deg, #ef4444, #f59e0b)",
  },
  {
    id: "sunset-drive",
    name: "Sunset Drive",
    bg: "linear-gradient(132deg, #fef08a 0%, #fde68a 30%, #fca5a5 100%)",
    cardBg: "rgba(255,255,255,0.96)",
    text: "#1f2937",
    mute: "#374151",
    strip: "linear-gradient(90deg, #f97316, #ef4444)",
  },
];

const networkBlocks: Record<NetworkKey, { title: string; color: string; light: string }> = {
  mtn: { title: "MTN", color: "#facc15", light: "#fff8d6" },
  telecel: { title: "Telecel", color: "#ef4444", light: "#ffe0df" },
  airteltigo_ishare: { title: "AirtelTigo iShare", color: "#2563eb", light: "#dce9ff" },
  airteltigo_bigtime: { title: "AirtelTigo BigTime", color: "#1d4ed8", light: "#dbeafe" },
};

const order: NetworkKey[] = ["mtn", "airteltigo_ishare", "airteltigo_bigtime", "telecel"];

const tonePool = {
  trusted: {
    heads: ["Your Trusted Data Plug", "Affordable Data That Works", "Steady Bundles On All Networks"],
    subs: ["Fast delivery with clear pricing", "Reliable delivery in minutes", "Smart prices for daily users"],
  },
  urgent: {
    heads: ["Out of Data? We Have You", "Need Data Now?", "Quick Top-Up, No Stress"],
    subs: ["Delivery starts in 10 to 20 minutes", "Buy now and stay connected", "Get back online fast"],
  },
  premium: {
    heads: ["Premium Data Deals", "Pro Data Bundles", "Elite Data Storefront"],
    subs: ["Clean pricing. Fast dispatch.", "Branded delivery experience", "Built for agents who sell big"],
  },
};

type ToneKey = keyof typeof tonePool;

const toPrice = (value: number) => {
  const num = Number(value || 0);
  const rounded = Math.round(num * 100) / 100;
  return Number.isInteger(rounded) ? `${rounded}` : rounded.toFixed(2);
};

export default function FlyerGenerator() {
  const { profile, isAgent } = useAuth();
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [store, setStore] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [templateId, setTemplateId] = useState(templates[0].id);
  const [flyerSize, setFlyerSize] = useState<FlyerSize>("1080x1080");
  const [tone, setTone] = useState<ToneKey>("trusted");
  const [headline, setHeadline] = useState("Affordable Data Bundles On All Networks");
  const [subline, setSubline] = useState("Fast delivery and clean prices");
  const [deliveryNote, setDeliveryNote] = useState("Delivery within 10 to 20 minutes");
  const previewRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!profile || !isAgent) {
      setLoading(false);
      return;
    }

    (async () => {
      const { data: s } = await supabase
        .from("agent_stores")
        .select("*")
        .eq("agent_id", profile.user_id)
        .maybeSingle();

      setStore(s);
      if (!s) {
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from("store_package_prices")
        .select("selling_price, is_listed, package:data_packages(*)")
        .eq("store_id", s.id)
        .eq("is_listed", true);

      const active = (data || []).filter((row: any) => row.package?.is_active);
      setItems(active);
      setLoading(false);
    })();
  }, [profile, isAgent]);

  const grouped = useMemo(() => {
    const map: Record<NetworkKey, Array<{ name: string; volume_mb: number; selling_price: number }>> = {
      mtn: [],
      telecel: [],
      airteltigo_ishare: [],
      airteltigo_bigtime: [],
    };

    items.forEach((row: any) => {
      const net = row.package?.network as NetworkKey;
      if (!map[net]) return;
      map[net].push({
        name: row.package.name,
        volume_mb: Number(row.package.volume_mb),
        selling_price: Number(row.selling_price),
      });
    });

    Object.keys(map).forEach((key) => {
      map[key as NetworkKey].sort((a, b) => a.volume_mb - b.volume_mb);
    });

    return map;
  }, [items]);

  const activeNetworks = useMemo(() => order.filter((net) => grouped[net].length > 0), [grouped]);

  const selectedTemplate = templates.find((t) => t.id === templateId) || templates[0];
  const flyerWidth = 1080;
  const flyerHeight = flyerSize === "1080x1080" ? 1080 : 1350;
  const compactMode = flyerSize === "1080x1080";
  const maxRowsPerNetwork = compactMode ? 7 : 11;

  const aiRefreshCopy = () => {
    const pool = tonePool[tone];
    const nextHead = pool.heads[Math.floor(Math.random() * pool.heads.length)];
    const nextSub = pool.subs[Math.floor(Math.random() * pool.subs.length)];
    setHeadline(nextHead);
    setSubline(nextSub);
  };

  const downloadPng = async () => {
    if (!previewRef.current || !store) return;

    try {
      setDownloading(true);
      const canvas = await html2canvas(previewRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: null,
      });

      const link = document.createElement("a");
      link.download = `${store.slug || "store"}-${flyerSize}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      toast.success("Flyer downloaded successfully");
    } catch (error) {
      console.error(error);
      toast.error("Could not download flyer");
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <div className="py-20 text-center text-muted-foreground flex items-center justify-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading flyer studio...
      </div>
    );
  }

  if (!isAgent) {
    return (
      <div className="animate-fade-in">
        <PageHeader title="Flyer Generator" description="Available for paid agents only." />
        <Card className="p-8 max-w-xl">
          <p className="text-sm text-muted-foreground">Upgrade to agent to unlock branded flyer generation.</p>
          <Button asChild className="mt-4">
            <Link to="/my-store">Become an Agent</Link>
          </Button>
        </Card>
      </div>
    );
  }

  if (!store) {
    return (
      <div className="animate-fade-in">
        <PageHeader title="Flyer Generator" description="Create your store first, then generate your flyer." />
        <Card className="p-8 max-w-xl">
          <p className="text-sm text-muted-foreground">Your flyer pulls data bundles, prices, and contacts from your store setup.</p>
          <Button asChild className="mt-4">
            <Link to="/my-store">Set Up My Store</Link>
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="AI Flyer Generator"
        description="Auto-build a branded sales flyer from your store pricing and contact details."
      />

      <div className="grid xl:grid-cols-[360px_1fr] gap-6 items-start">
        <Card className="p-5 space-y-5 sticky top-6">
          <div>
            <h3 className="font-semibold flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" /> Flyer Controls
            </h3>
            <p className="text-xs text-muted-foreground mt-1">Everything below updates your flyer in real-time.</p>
          </div>

          <div className="space-y-2">
            <Label>Template Style</Label>
            <div className="grid grid-cols-3 gap-2">
              {templates.map((tpl) => (
                <button
                  key={tpl.id}
                  onClick={() => setTemplateId(tpl.id)}
                  className={`rounded-lg border p-2 text-xs font-medium transition-colors ${
                    templateId === tpl.id ? "border-primary bg-primary/10" : "border-border hover:border-primary/40"
                  }`}
                  type="button"
                >
                  {tpl.name}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Flyer Size</Label>
            <div className="grid grid-cols-2 gap-2">
              {(["1080x1080", "1080x1350"] as FlyerSize[]).map((size) => (
                <button
                  key={size}
                  onClick={() => setFlyerSize(size)}
                  className={`rounded-lg border p-2 text-xs font-medium transition-colors ${
                    flyerSize === size ? "border-primary bg-primary/10" : "border-border hover:border-primary/40"
                  }`}
                  type="button"
                >
                  {size}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>AI Tone</Label>
            <div className="grid grid-cols-3 gap-2">
              {(["trusted", "urgent", "premium"] as ToneKey[]).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setTone(option)}
                  className={`rounded-lg border p-2 text-xs capitalize transition-colors ${
                    tone === option ? "border-primary bg-primary/10" : "border-border"
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
            <Button type="button" variant="outline" className="w-full" onClick={aiRefreshCopy}>
              <WandSparkles className="h-4 w-4 mr-2" /> Regenerate AI Copy
            </Button>
          </div>

          <div className="space-y-2">
            <Label htmlFor="headline">Headline</Label>
            <Input id="headline" value={headline} onChange={(e) => setHeadline(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="subline">Subline</Label>
            <Input id="subline" value={subline} onChange={(e) => setSubline(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="delivery">Delivery Note</Label>
            <Input id="delivery" value={deliveryNote} onChange={(e) => setDeliveryNote(e.target.value)} />
          </div>

          <Button type="button" className="w-full" onClick={downloadPng} disabled={downloading || items.length === 0}>
            {downloading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
            Download Flyer PNG
          </Button>
        </Card>

        <div className="overflow-auto rounded-xl border border-border p-4 bg-muted/30">
          <div
            ref={previewRef}
            style={{
              width: flyerWidth,
              height: flyerHeight,
              boxSizing: "border-box",
              background: selectedTemplate.bg,
              color: selectedTemplate.text,
              borderRadius: 24,
              padding: compactMode ? 22 : 30,
              fontFamily: "'Trebuchet MS', 'Segoe UI', sans-serif",
              position: "relative",
              margin: "0 auto",
              boxShadow: "0 20px 50px rgba(0,0,0,0.25)",
              overflow: "hidden",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
              <div>
                <div style={{ fontSize: compactMode ? 38 : 48, lineHeight: 1.05, fontWeight: 900, letterSpacing: "-0.02em", maxWidth: 680 }}>
                  {store.store_name}
                </div>
                <div style={{ fontSize: compactMode ? 44 : 54, lineHeight: 1.02, fontWeight: 900, marginTop: 8, textTransform: "uppercase" }}>
                  {headline}
                </div>
                <p style={{ marginTop: 8, fontSize: compactMode ? 18 : 22, color: selectedTemplate.mute }}>{subline}</p>
              </div>
              <div
                style={{
                  background: "#ffffff",
                  borderRadius: 16,
                  padding: compactMode ? "8px 12px" : "10px 14px",
                  fontWeight: 800,
                  fontSize: compactMode ? 15 : 18,
                  color: "#1e293b",
                  border: "2px solid rgba(0,0,0,0.08)",
                }}
              >
                DATA SERVICES
              </div>
            </div>

            <div
              style={{
                marginTop: compactMode ? 14 : 22,
                background: selectedTemplate.strip,
                borderRadius: 14,
                color: "#fff",
                fontSize: compactMode ? 18 : 22,
                fontWeight: 800,
                letterSpacing: "0.01em",
                padding: "10px 16px",
              }}
            >
              {deliveryNote}
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  activeNetworks.length <= 2
                    ? "repeat(2, minmax(0, 1fr))"
                    : activeNetworks.length === 3
                      ? "repeat(3, minmax(0, 1fr))"
                      : "repeat(2, minmax(0, 1fr))",
                gap: 14,
                marginTop: compactMode ? 14 : 20,
              }}
            >
              {activeNetworks.map((net) => (
                  <div
                    key={net}
                    style={{
                      background: selectedTemplate.cardBg,
                      borderRadius: 18,
                      padding: 10,
                      border: `3px solid ${networkBlocks[net].color}`,
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        background: networkBlocks[net].color,
                        color: net === "mtn" ? "#111" : "#fff",
                        fontWeight: 900,
                        textAlign: "center",
                        borderRadius: 12,
                        padding: "8px 10px",
                        fontSize: compactMode ? 17 : 20,
                      }}
                    >
                      {networkLabel[net]}
                    </div>
                    <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
                      {grouped[net].slice(0, maxRowsPerNetwork).map((row, idx) => (
                        <div
                          key={`${net}-${idx}`}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: 6,
                            fontWeight: 800,
                            fontSize: compactMode ? 16 : 20,
                            padding: compactMode ? "5px 8px" : "6px 9px",
                            borderRadius: 8,
                            background: idx % 2 === 0 ? "#ffffff" : networkBlocks[net].light,
                          }}
                        >
                          <span>{Math.round(row.volume_mb / 1024)}GB</span>
                          <span>GHS {toPrice(row.selling_price)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
            </div>

            <div
              style={{
                marginTop: compactMode ? 12 : 18,
                background: "rgba(255,255,255,0.94)",
                borderRadius: 18,
                padding: compactMode ? 12 : 16,
              }}
            >
              <div style={{ fontSize: compactMode ? 28 : 36, fontWeight: 900, color: "#dc2626", lineHeight: 1 }}>Buy Affordable Data</div>
              <div style={{ marginTop: 6, fontSize: compactMode ? 16 : 20, color: "#1f2937", fontWeight: 700 }}>Non-expiry bundles on major networks</div>
              <div style={{ marginTop: compactMode ? 8 : 10, fontSize: compactMode ? 20 : 26, fontWeight: 900 }}>Call / WhatsApp: {store.support_phone}</div>
              <div style={{ marginTop: 6, fontSize: compactMode ? 14 : 16, color: "#475569" }}>
                {store.whatsapp_link ? `WhatsApp Group: ${store.whatsapp_link}` : "Instant support available"}
              </div>
              <div style={{ marginTop: 8, fontSize: compactMode ? 13 : 15, color: "#64748b", fontWeight: 700 }}>
                Powered by DataHive Ghana | {new Date().toLocaleDateString("en-GH")}
              </div>
            </div>

            <div
              style={{
                position: "absolute",
                right: 24,
                top: 24,
                width: 170,
                height: 170,
                borderRadius: "999px",
                background: "radial-gradient(circle at 40% 35%, rgba(255,255,255,0.8), rgba(255,255,255,0.08))",
                border: "2px solid rgba(255,255,255,0.35)",
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
