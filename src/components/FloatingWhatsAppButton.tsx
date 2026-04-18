import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const FloatingWhatsAppButton = () => {
  const [url, setUrl] = useState("");
  const location = useLocation();

  const shouldHide = useMemo(() => location.pathname.startsWith("/admin"), [location.pathname]);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "whatsapp_channel_url")
        .maybeSingle();

      const value = typeof data?.value === "string" ? data.value : "";
      setUrl(value);
    };

    load();
  }, []);

  if (shouldHide || !url) return null;

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="fixed bottom-5 right-5 z-50 h-12 w-12 rounded-full bg-green-600 text-white shadow-lg flex items-center justify-center hover:bg-green-700 transition-colors"
      aria-label="Join our WhatsApp channel"
    >
      <MessageCircle className="h-6 w-6" />
    </a>
  );
};
