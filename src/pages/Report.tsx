import { useState } from "react";
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

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setLoading(true);
    const { error } = await supabase.from("issue_reports").insert({
      user_id: profile.user_id, subject: form.subject.trim(), message: form.message.trim(),
    });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Thanks. We'll get back to you soon.");
    setForm({ subject: "", message: "" });
  };

  return (
    <div className="animate-fade-in">
      <PageHeader title="Report an Issue" description="Tell us what went wrong. Our team responds within 24 hours." />
      <Card className="p-8 max-w-xl">
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
