import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type NoticeConfig = {
  enabled: boolean;
  title: string;
  message: string;
};

const defaultConfig: NoticeConfig = {
  enabled: false,
  title: "Notice",
  message: "",
};

export default function AdminNotificationsPage() {
  const [usersNotice, setUsersNotice] = useState<NoticeConfig>(defaultConfig);
  const [agentsNotice, setAgentsNotice] = useState<NoticeConfig>({ ...defaultConfig, title: "Agent Notice" });

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("key, value")
        .in("key", ["notification_users", "notification_agents"]);

      (data || []).forEach((row) => {
        if (row.key === "notification_users") setUsersNotice((row.value as NoticeConfig) || defaultConfig);
        if (row.key === "notification_agents") setAgentsNotice((row.value as NoticeConfig) || defaultConfig);
      });
    };

    load();
  }, []);

  const save = async () => {
    const payload = [
      { key: "notification_users", value: usersNotice },
      { key: "notification_agents", value: agentsNotice },
    ];

    const { error } = await supabase.from("app_settings").upsert(payload, { onConflict: "key" });
    if (error) return toast.error(error.message);
    toast.success("Notification settings saved");
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-3xl font-bold">Notification</h2>
        <p className="text-muted-foreground mt-1">Send closeable login popup messages for users and agents.</p>
      </div>

      <Card className="p-5 space-y-4">
        <h3 className="font-bold">Users Notification</h3>
        <div className="flex items-center gap-3">
          <Switch checked={usersNotice.enabled} onCheckedChange={(checked) => setUsersNotice({ ...usersNotice, enabled: checked })} />
          <span className="text-sm">Enable popup for users</span>
        </div>
        <div className="space-y-2">
          <Label>Title</Label>
          <Input value={usersNotice.title} onChange={(e) => setUsersNotice({ ...usersNotice, title: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>Message</Label>
          <Textarea rows={4} value={usersNotice.message} onChange={(e) => setUsersNotice({ ...usersNotice, message: e.target.value })} />
        </div>
      </Card>

      <Card className="p-5 space-y-4">
        <h3 className="font-bold">Agents Notification</h3>
        <div className="flex items-center gap-3">
          <Switch checked={agentsNotice.enabled} onCheckedChange={(checked) => setAgentsNotice({ ...agentsNotice, enabled: checked })} />
          <span className="text-sm">Enable popup for agents</span>
        </div>
        <div className="space-y-2">
          <Label>Title</Label>
          <Input value={agentsNotice.title} onChange={(e) => setAgentsNotice({ ...agentsNotice, title: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>Message</Label>
          <Textarea rows={4} value={agentsNotice.message} onChange={(e) => setAgentsNotice({ ...agentsNotice, message: e.target.value })} />
        </div>
      </Card>

      <Button onClick={save}>Save Notifications</Button>
    </div>
  );
}
