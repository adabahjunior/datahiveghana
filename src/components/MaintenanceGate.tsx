import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

type MaintenanceValue = {
  enabled?: boolean;
  message?: string;
};

const DEFAULT_MAINTENANCE: MaintenanceValue = {
  enabled: false,
  message: "DataHive Ghana is under maintenance and will be back shortly.",
};

const normalizeMaintenance = (value: unknown): MaintenanceValue => {
  if (!value || typeof value !== "object") return DEFAULT_MAINTENANCE;
  const v = value as Record<string, unknown>;
  return {
    enabled: typeof v.enabled === "boolean" ? v.enabled : false,
    message: typeof v.message === "string" && v.message.trim().length > 0 ? v.message : DEFAULT_MAINTENANCE.message,
  };
};

export const MaintenanceGate = ({ children }: { children: React.ReactNode }) => {
  const { isAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [maintenance, setMaintenance] = useState<MaintenanceValue>(DEFAULT_MAINTENANCE);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      const { data } = await supabase.from("app_settings").select("value").eq("key", "maintenance_mode").maybeSingle();
      if (!mounted) return;
      setMaintenance(normalizeMaintenance(data?.value));
      setLoading(false);
    };

    load();

    const channel = supabase
      .channel("maintenance_mode_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "app_settings",
          filter: "key=eq.maintenance_mode",
        },
        (payload) => {
          const nextValue = (payload.new as { value?: unknown } | null)?.value;
          setMaintenance(normalizeMaintenance(nextValue));
          setLoading(false);
        },
      )
      .subscribe();

    const intervalId = window.setInterval(load, 15000);
    const handleFocus = () => {
      load();
    };
    window.addEventListener("focus", handleFocus);

    return () => {
      mounted = false;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleFocus);
      supabase.removeChannel(channel);
    };
  }, []);

  if (loading || isAdmin || !maintenance.enabled) return <>{children}</>;

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <Card className="max-w-xl w-full p-8 text-center space-y-4">
        <h1 className="text-2xl font-bold">Site Under Maintenance</h1>
        <p className="text-muted-foreground text-sm">
          {maintenance.message || "DataHive Ghana is under maintenance and will be back shortly."}
        </p>
      </Card>
    </div>
  );
};
