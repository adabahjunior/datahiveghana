import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import NetworkCard from "@/components/NetworkCard";
import PackageCard from "@/components/PackageCard";
import CheckoutDialog from "@/components/CheckoutDialog";

export default function Packages() {
  const [selectedNetwork, setSelectedNetwork] = useState<string | null>(null);
  const [checkoutPkg, setCheckoutPkg] = useState<any>(null);

  const { data: networks } = useQuery({
    queryKey: ["networks"],
    queryFn: async () => {
      const { data, error } = await supabase.from("networks").select("*").eq("status", "active");
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
      <div className="container mx-auto px-4 py-12">
        <h1 className="font-heading text-3xl font-bold mb-8 text-center">Data Packages</h1>

        <div className="grid grid-cols-3 gap-4 max-w-lg mx-auto mb-10">
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
      </div>

      <CheckoutDialog
        open={!!checkoutPkg}
        onClose={() => setCheckoutPkg(null)}
        pkg={checkoutPkg ? { id: checkoutPkg.id, name: checkoutPkg.name, base_price: Number(checkoutPkg.base_price), network_id: checkoutPkg.network_id } : null}
      />
    </div>
  );
}
