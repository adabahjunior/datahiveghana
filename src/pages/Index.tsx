import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import NetworkCard from "@/components/NetworkCard";
import PackageCard from "@/components/PackageCard";
import CheckoutDialog from "@/components/CheckoutDialog";
import { Button } from "@/components/ui/button";
import { ArrowRight, Zap, Shield, Users } from "lucide-react";
import { Link } from "react-router-dom";

export default function Index() {
  const [selectedNetwork, setSelectedNetwork] = useState<string | null>(null);
  const [checkoutPkg, setCheckoutPkg] = useState<any>(null);

  const { data: networks } = useQuery({
    queryKey: ["networks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("networks")
        .select("*")
        .eq("status", "active");
      if (error) throw error;
      return data;
    },
  });

  const { data: packages } = useQuery({
    queryKey: ["packages", selectedNetwork],
    queryFn: async () => {
      let query = supabase.from("data_packages").select("*").eq("is_active", true);
      if (selectedNetwork) query = query.eq("network_id", selectedNetwork);
      const { data, error } = await query.order("size_mb");
      if (error) throw error;
      return data;
    },
  });

  const getNetworkName = (id: string) => networks?.find((n: any) => n.id === id)?.name ?? id;

  return (
    <div className="min-h-screen">
      <Navbar />

      {/* Hero */}
      <section className="container mx-auto px-4 py-16 md:py-24 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass-card mb-6 text-sm">
          <Zap className="h-3.5 w-3.5 text-primary" />
          <span className="text-muted-foreground">Instant data delivery across Ghana</span>
        </div>
        <h1 className="font-heading text-4xl md:text-6xl font-bold mb-4 leading-tight">
          Buy Data <span className="text-gradient">Instantly</span>
          <br />No Account Needed
        </h1>
        <p className="text-muted-foreground text-lg max-w-xl mx-auto mb-8">
          Purchase affordable data bundles for MTN, AirtelTigo, and Telecel in seconds. Agents get wholesale pricing.
        </p>
        <div className="flex gap-3 justify-center">
          <Button size="lg" className="glow-md" onClick={() => document.getElementById("networks")?.scrollIntoView({ behavior: "smooth" })}>
            Buy Data Now <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link to="/become-agent">Become an Agent</Link>
          </Button>
        </div>
      </section>

      {/* Features */}
      <section className="container mx-auto px-4 pb-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { icon: Zap, title: "Lightning Fast", desc: "Buy data in under 5 seconds" },
            { icon: Shield, title: "Secure & Reliable", desc: "All transactions are encrypted" },
            { icon: Users, title: "Agent Network", desc: "Earn by reselling data bundles" },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="glass-card rounded-xl p-6 text-center">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 mb-3">
                <Icon className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-heading font-bold mb-1">{title}</h3>
              <p className="text-sm text-muted-foreground">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Network Selection */}
      <section id="networks" className="container mx-auto px-4 pb-8">
        <h2 className="font-heading text-2xl font-bold mb-6 text-center">Choose Your Network</h2>
        <div className="grid grid-cols-3 gap-4 max-w-lg mx-auto">
          {networks?.map((n: any) => (
            <NetworkCard
              key={n.id}
              id={n.id}
              name={n.name}
              selected={selectedNetwork === n.id}
              onClick={() => setSelectedNetwork(selectedNetwork === n.id ? null : n.id)}
            />
          ))}
        </div>
      </section>

      {/* Packages */}
      <section className="container mx-auto px-4 pb-20">
        <h2 className="font-heading text-2xl font-bold mb-6 text-center">
          {selectedNetwork ? `${getNetworkName(selectedNetwork)} Packages` : "All Packages"}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {packages?.map((p: any) => (
            <PackageCard
              key={p.id}
              id={p.id}
              name={p.name}
              sizeMb={p.size_mb}
              price={Number(p.base_price)}
              networkName={getNetworkName(p.network_id)}
              onBuy={() => setCheckoutPkg(p)}
            />
          ))}
        </div>
        {packages?.length === 0 && (
          <p className="text-center text-muted-foreground py-12">No packages available</p>
        )}
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} DataHive Ghana. All rights reserved.
        </div>
      </footer>

      <CheckoutDialog
        open={!!checkoutPkg}
        onClose={() => setCheckoutPkg(null)}
        pkg={checkoutPkg ? { id: checkoutPkg.id, name: checkoutPkg.name, base_price: Number(checkoutPkg.base_price), network_id: checkoutPkg.network_id } : null}
      />
    </div>
  );
}
