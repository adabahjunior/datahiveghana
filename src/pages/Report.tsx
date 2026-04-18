import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/PageHeader";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export default function Report() {
  const { profile } = useAuth();
  const [form, setForm] = useState({ subject: "", message: "" });
  const [loading, setLoading] = useState(false);
  const [customerCare, setCustomerCare] = useState("");

  useEffect(() => {
    const loadCustomerCare = async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "customer_care_contact")
        .maybeSingle();

      if (typeof data?.value === "string") setCustomerCare(data.value);
    };

    loadCustomerCare();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    const subject = form.subject.trim();
    const message = form.message.trim();
    const waNumber = customerCare.replace(/\D/g, "");

    if (!waNumber) {
      toast.error("Customer care WhatsApp number is not configured yet.");
      return;
    }

    const waText = [
      "*DataHive Issue Report*",
      `Subject: ${subject}`,
      `Message: ${message}`,
      `User: ${profile.full_name || "N/A"}`,
      `Email: ${profile.email}`,
      `Phone: ${profile.phone || "N/A"}`,
    ].join("\n");

    const waUrl = `https://wa.me/${waNumber}?text=${encodeURIComponent(waText)}`;
    const popup = window.open(waUrl, "_blank", "noopener,noreferrer");
    if (!popup) {
      window.location.href = waUrl;
    }

    setLoading(true);
    const { error } = await supabase.from("issue_reports").insert({
      user_id: profile.user_id,
      subject,
      message,
    });
    setLoading(false);
    if (error) {
      toast.error("Report sent to WhatsApp, but local log failed.");
      return;
    }
    toast.success("Report opened on WhatsApp and logged successfully.");
    setForm({ subject: "", message: "" });
  };

  return (
    <div className="animate-fade-in">
      <PageHeader title="Report an Issue" description="Tell us what went wrong. Our team responds within 24 hours." />
      <Card className="p-8 max-w-xl">
        {customerCare && (
          <div className="mb-5 rounded-md bg-muted p-3 text-sm">
            Customer Care: <span className="font-semibold">{customerCare}</span>
          </div>
        )}
        <form onSubmit={submit} className="space-y-5">
          <div className="space-y-2">
            <Label>Subject</Label>
            <Input required maxLength={150} value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Message</Label>
            <Textarea required rows={6} maxLength={1500} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
          </div>
          <Button type="submit" disabled={loading} className="w-full">
            {loading && <Loader2 className="h-4 w-4 animate-spin" />} Submit Report
          </Button>
        </form>
      </Card>
    </div>
  );
}
