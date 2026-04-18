import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/PageHeader";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { Switch } from "@/components/ui/switch";

export default function Settings() {
  const { profile, refreshProfile } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [form, setForm] = useState({ full_name: profile?.full_name || "", phone: profile?.phone || "" });
  const [loading, setLoading] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setLoading(true);
    const { error } = await supabase.from("profiles").update({
      full_name: form.full_name.trim(), phone: form.phone.trim(),
    }).eq("user_id", profile.user_id);
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Profile updated");
    await refreshProfile();
  };

  return (
    <div className="animate-fade-in">
      <PageHeader title="Settings" description="Update your account preferences." />
      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="p-8">
          <h3 className="font-bold mb-5">Profile</h3>
          <form onSubmit={save} className="space-y-5">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={profile?.email || ""} disabled />
            </div>
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />} Save Changes
            </Button>
          </form>
        </Card>

        <Card className="p-8">
          <h3 className="font-bold mb-5">Appearance</h3>
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-base">Dark Mode</Label>
              <p className="text-sm text-muted-foreground mt-1">Toggle the visual theme.</p>
            </div>
            <Switch checked={theme === "dark"} onCheckedChange={toggleTheme} />
          </div>
        </Card>
      </div>
    </div>
  );
}
