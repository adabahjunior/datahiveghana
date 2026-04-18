import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

type MaintenanceValue = {
  enabled?: boolean;
  message?: string;
};

export const MaintenanceGate = ({ children }: { children: React.ReactNode }) => {
  const { isAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [maintenance, setMaintenance] = useState<MaintenanceValue>({ enabled: false });

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "maintenance_mode")
        .maybeSingle();

      setMaintenance((data?.value as MaintenanceValue) || { enabled: false });
      setLoading(false);
    };

    load();
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
