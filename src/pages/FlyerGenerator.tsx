import { useEffect, useMemo, useRef, useState } from "react";
import html2canvas from "html2canvas";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "react-router-dom";
import { Download, Loader2, Sparkles, WandSparkles } from "lucide-react";
import { toast } from "sonner";
import bgSky from "@/assets/flyer-bg-sky.jpg";
import socialIcons from "@/assets/flyer-social-icons.png";
import person1 from "@/assets/flyer-person-1.png";
import person2 from "@/assets/flyer-person-2.png";
import person3 from "@/assets/flyer-person-3.png";

type NetworkKey = "mtn" | "telecel" | "airteltigo_ishare" | "airteltigo_bigtime";

type ColumnNetwork = "mtn" | "telecel" | "airteltigo";

const personOptions = [
  { id: "yellow-man", label: "Yellow Beanie", src: person1 },
  { id: "red-phone-woman", label: "Red Phone Lady", src: person2 },
  { id: "dread-man", label: "Dreadlocks Man", src: person3 },
];

const headlineStyles = [
  {
    id: "non-expiry",
    label: "Non-Expiry Bundle",
    headline: "Get Cheap\nNon-Expiry\nData Bundle\nOn All Networks",
    headlineColor: "#1d4ed8",
  },
  {
    id: "trusted-plug",
    label: "Trusted Data Plug",
    headline: "Your Trusted\nData Plug",
    headlineColor: "#0f172a",
  },
  {
    id: "affordable",
    label: "Affordable Data",
    headline: "Get Your\nAffordable Data\nBundles\nOn All Networks",
    headlineColor: "#0b3d91",
  },
  {
    id: "out-of-data",
    label: "Out Of Data",
    headline: "Out Of\nMobile DATA?\nWe Got You!",
    headlineColor: "#dc2626",
  },
];

const toPrice = (value: number) => {
  const num = Number(value || 0);
  const rounded = Math.round(num * 100) / 100;
  return Number.isInteger(rounded) ? `${rounded}` : rounded.toFixed(2);
};

// Map raw network keys -> column buckets (combine AT iShare + BigTime into one AirtelTigo column)
const toColumnNetwork = (net: NetworkKey): ColumnNetwork => {
  if (net === "mtn") return "mtn";
  if (net === "telecel") return "telecel";
  return "airteltigo";
};

type Row = { volume_mb: number; selling_price: number };

const NetworkColumn = ({
  network,
  rows,
  maxRows,
}: {
  network: ColumnNetwork;
  rows: Row[];
  maxRows: number;
}) => {
  const palette = {
    mtn: { bg: "#FFCC08", text: "#000", header: "#FFCC08", logoBg: "#FFCC08", border: "#000" },
    telecel: { bg: "#E60000", text: "#fff", header: "#E60000", logoBg: "#fff", border: "#fff" },
    airteltigo: { bg: "#0033A0", text: "#fff", header: "#0033A0", logoBg: "#fff", border: "#fff" },
  }[network];

  const Logo = () => {
    if (network === "mtn") {
      return (
        <div
          style={{
            background: "#FFCC08",
            color: "#000",
            border: "3px solid #000",
            borderRadius: 999,
            padding: "6px 22px",
            fontWeight: 900,
            fontSize: 22,
            letterSpacing: "0.05em",
            fontFamily: "Arial, sans-serif",
          }}
        >
          MTN
        </div>
      );
    }
    if (network === "telecel") {
      return (
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div
            style={{
              background: "#E60000",
              color: "#fff",
              borderRadius: 999,
              width: 32,
              height: 32,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 900,
              fontSize: 22,
              fontFamily: "Georgia, serif",
              border: "2px solid #fff",
            }}
          >
            t
          </div>
          <span style={{ color: "#E60000", fontWeight: 800, fontSize: 18, fontStyle: "italic" }}>telecel</span>
        </div>
      );
    }
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <span style={{ color: "#E60000", fontWeight: 900, fontSize: 22, fontStyle: "italic" }}>airtel</span>
        <span style={{ color: "#0033A0", fontWeight: 900, fontSize: 22, fontStyle: "italic" }}>tigo</span>
      </div>
    );
  };

  return (
    <div
      style={{
        background: palette.bg,
        borderRadius: 14,
        padding: 12,
        boxShadow: "0 8px 20px rgba(0,0,0,0.25)",
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 10,
          padding: "10px 8px",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          marginBottom: 4,
        }}
      >
        <Logo />
      </div>

      {rows.slice(0, maxRows).map((row, idx) => (
        <div
          key={idx}
          style={{
            background: "rgba(255,255,255,0.96)",
            borderRadius: 6,
            padding: "5px 10px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontFamily: "'Arial Black', Arial, sans-serif",
            fontWeight: 900,
            fontSize: 15,
            color: "#000",
            letterSpacing: "0.02em",
          }}
        >
          <span>{Math.round(row.volume_mb / 1024)}GB</span>
          <span style={{ opacity: 0.6 }}>-</span>
          <span>GH₵ {toPrice(row.selling_price)}</span>
        </div>
      ))}
    </div>
  );
};

export default function FlyerGenerator() {
  const { profile, isAgent } = useAuth();
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [store, setStore] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);

  const [styleId, setStyleId] = useState(headlineStyles[0].id);
  const [personId, setPersonId] = useState(personOptions[0].id);
  const [headline, setHeadline] = useState(headlineStyles[0].headline);
  const [tagline, setTagline] = useState("Delivery within 10 to 20 minutes");
  const [note, setNote] = useState("#It's non-expiry");
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
    const map: Record<ColumnNetwork, Row[]> = { mtn: [], telecel: [], airteltigo: [] };
    items.forEach((row: any) => {
      const net = row.package?.network as NetworkKey;
      if (!net) return;
      const col = toColumnNetwork(net);
      map[col].push({
        volume_mb: Number(row.package.volume_mb),
        selling_price: Number(row.selling_price),
      });
    });
    Object.keys(map).forEach((key) => {
      map[key as ColumnNetwork].sort((a, b) => a.volume_mb - b.volume_mb);
    });
    return map;
  }, [items]);

  const selectedStyle = headlineStyles.find((s) => s.id === styleId) || headlineStyles[0];
  const selectedPerson = personOptions.find((p) => p.id === personId) || personOptions[0];

  const applyStyle = (id: string) => {
    setStyleId(id);
    const s = headlineStyles.find((x) => x.id === id);
    if (s) setHeadline(s.headline);
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
      link.download = `${store.slug || "store"}-flyer.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      toast.success("Flyer downloaded");
    } catch (e) {
      console.error(e);
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
          <p className="text-sm text-muted-foreground">Your flyer pulls bundles, prices, and contacts from your store.</p>
          <Button asChild className="mt-4">
            <Link to="/my-store">Set Up My Store</Link>
          </Button>
        </Card>
      </div>
    );
  }

  const flyerWidth = 1080;
  const flyerHeight = 1350;
  // Maximum rows so all 3 columns stay visually balanced and inside the card
  const maxRows = 14;

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="AI Flyer Generator"
        description="Generate professional sales flyers in the trending Ghana data-reseller style."
      />

      <div className="grid xl:grid-cols-[360px_1fr] gap-6 items-start">
        <Card className="p-5 space-y-5 sticky top-6">
          <div>
            <h3 className="font-semibold flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" /> Flyer Studio
            </h3>
            <p className="text-xs text-muted-foreground mt-1">Switch styles, models, and copy. Updates live.</p>
          </div>

          <div className="space-y-2">
            <Label>Headline Style</Label>
            <div className="grid grid-cols-2 gap-2">
              {headlineStyles.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => applyStyle(s.id)}
                  className={`rounded-lg border p-2 text-xs font-medium text-left transition-colors ${
                    styleId === s.id ? "border-primary bg-primary/10" : "border-border hover:border-primary/40"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Featured Person</Label>
            <div className="grid grid-cols-3 gap-2">
              {personOptions.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPersonId(p.id)}
                  className={`rounded-lg border overflow-hidden transition-colors ${
                    personId === p.id ? "border-primary ring-2 ring-primary/40" : "border-border"
                  }`}
                >
                  <img src={p.src} alt={p.label} className="w-full h-20 object-cover bg-muted" />
                  <div className="p-1 text-[10px] text-center">{p.label}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="headline">Headline (use line breaks)</Label>
            <textarea
              id="headline"
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              rows={4}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tagline">Tagline</Label>
            <Input id="tagline" value={tagline} onChange={(e) => setTagline(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="note">Note Line</Label>
            <Input id="note" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>

          <Button type="button" variant="outline" className="w-full" onClick={() => applyStyle(styleId)}>
            <WandSparkles className="h-4 w-4 mr-2" /> Reset Headline
          </Button>

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
              position: "relative",
              margin: "0 auto",
              borderRadius: 24,
              overflow: "hidden",
              boxShadow: "0 30px 60px rgba(0,0,0,0.3)",
              fontFamily: "'Arial Black', Arial, sans-serif",
              backgroundImage: `url(${bgSky})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          >
            {/* Soft white overlay for readability */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                background:
                  "linear-gradient(180deg, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0.15) 35%, rgba(255,255,255,0) 60%, rgba(255,255,255,0.4) 100%)",
              }}
            />

            {/* Decorative social icons - top left */}
            <img
              src={socialIcons}
              alt=""
              style={{
                position: "absolute",
                top: -20,
                left: -30,
                width: 240,
                height: 240,
                objectFit: "contain",
                opacity: 0.95,
                transform: "rotate(-8deg)",
              }}
              crossOrigin="anonymous"
            />

            {/* Decorative social icons - right edge */}
            <img
              src={socialIcons}
              alt=""
              style={{
                position: "absolute",
                top: 320,
                right: -70,
                width: 230,
                height: 230,
                objectFit: "contain",
                opacity: 0.9,
                transform: "rotate(15deg)",
              }}
              crossOrigin="anonymous"
            />

            {/* Headline */}
            <div
              style={{
                position: "absolute",
                top: 38,
                left: 50,
                right: 280,
                zIndex: 5,
                color: selectedStyle.headlineColor,
                fontFamily: "'Arial Black', Arial, sans-serif",
                fontWeight: 900,
                fontSize: 64,
                lineHeight: 0.98,
                letterSpacing: "-0.01em",
                whiteSpace: "pre-line",
                textShadow: "0 2px 0 rgba(255,255,255,0.6)",
              }}
            >
              {headline}
            </div>

            {/* Store badge - top right */}
            <div
              style={{
                position: "absolute",
                top: 52,
                right: 50,
                background: "#FFD700",
                color: "#0b1f3a",
                borderRadius: "50%",
                width: 180,
                height: 180,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                textAlign: "center",
                padding: 14,
                fontWeight: 900,
                fontSize: 22,
                lineHeight: 1.05,
                boxShadow: "0 8px 20px rgba(0,0,0,0.25)",
                border: "4px solid #fff",
                zIndex: 6,
              }}
            >
              {store.store_name}
            </div>

            {/* Tagline strip */}
            <div
              style={{
                position: "absolute",
                top: 360,
                left: 50,
                right: 50,
                background: "linear-gradient(90deg, #FFD700, #FFB300)",
                color: "#000",
                padding: "10px 20px",
                borderRadius: 10,
                fontSize: 22,
                fontWeight: 900,
                textAlign: "center",
                boxShadow: "0 6px 14px rgba(0,0,0,0.2)",
                zIndex: 5,
              }}
            >
              Kindly note: {tagline}
            </div>

            {/* 3 Network Columns */}
            <div
              style={{
                position: "absolute",
                top: 430,
                left: 40,
                right: 40,
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr",
                gap: 14,
                zIndex: 4,
              }}
            >
              <NetworkColumn network="mtn" rows={grouped.mtn} maxRows={maxRows} />
              <NetworkColumn network="airteltigo" rows={grouped.airteltigo} maxRows={maxRows} />
              <NetworkColumn network="telecel" rows={grouped.telecel} maxRows={maxRows} />
            </div>

            {/* Person image - bottom right */}
            <img
              src={selectedPerson.src}
              alt=""
              style={{
                position: "absolute",
                bottom: 0,
                right: -40,
                height: 480,
                width: "auto",
                objectFit: "contain",
                zIndex: 7,
                filter: "drop-shadow(0 -10px 30px rgba(0,0,0,0.3))",
              }}
              crossOrigin="anonymous"
            />

            {/* Note line - bottom left */}
            <div
              style={{
                position: "absolute",
                bottom: 200,
                left: 50,
                color: "#dc2626",
                fontWeight: 900,
                fontSize: 28,
                fontStyle: "italic",
                zIndex: 6,
                textShadow: "0 2px 0 rgba(255,255,255,0.6)",
              }}
            >
              {note}
            </div>

            {/* Bullet info - bottom left */}
            <div
              style={{
                position: "absolute",
                bottom: 100,
                left: 50,
                width: 460,
                color: "#0b1f3a",
                fontSize: 16,
                fontWeight: 800,
                lineHeight: 1.5,
                zIndex: 6,
              }}
            >
              <div>• Delivery is within 10 to 20 minutes</div>
              <div>• Does not work for agent SIMs</div>
              <div>• Does not work on broadband SIMs</div>
              <div>• Avoid SIMs with outstanding airtime</div>
            </div>

            {/* Contact strip - very bottom */}
            <div
              style={{
                position: "absolute",
                bottom: 24,
                left: 50,
                width: 460,
                background: "linear-gradient(90deg, #16a34a, #15803d)",
                color: "#fff",
                padding: "12px 18px",
                borderRadius: 12,
                fontSize: 22,
                fontWeight: 900,
                display: "flex",
                alignItems: "center",
                gap: 12,
                boxShadow: "0 8px 18px rgba(0,0,0,0.3)",
                zIndex: 8,
              }}
            >
              <div
                style={{
                  background: "#fff",
                  color: "#16a34a",
                  borderRadius: "50%",
                  width: 36,
                  height: 36,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 22,
                }}
              >
                ✆
              </div>
              <span>{store.support_phone}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
