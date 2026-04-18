import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type NoticeValue = {
  enabled?: boolean;
  title?: string;
  message?: string;
};

type NoticeRow = {
  key: string;
  value: NoticeValue;
  updated_at: string;
};

export const LoginNotificationPopup = () => {
  const { user, isAdmin, isAgent } = useAuth();
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState<NoticeRow | null>(null);

  const targetKey = useMemo(() => {
    if (isAdmin) return null;
    return isAgent ? "notification_agents" : "notification_users";
  }, [isAdmin, isAgent]);

  useEffect(() => {
    const load = async () => {
      if (!user || !targetKey) return;

      const { data } = await supabase
        .from("app_settings")
        .select("key, value, updated_at")
        .eq("key", targetKey)
        .maybeSingle();

      const row = data as NoticeRow | null;
      if (!row) return;
      if (!row.value?.enabled || !row.value?.message?.trim()) return;

      const dismissKey = `notice:${row.key}:${row.updated_at}:${user.id}`;
      if (localStorage.getItem(dismissKey) === "closed") return;

      setNotice(row);
      setOpen(true);
    };

    load();
  }, [user, targetKey]);

  const close = () => {
    if (notice && user) {
      const dismissKey = `notice:${notice.key}:${notice.updated_at}:${user.id}`;
      localStorage.setItem(dismissKey, "closed");
    }
    setOpen(false);
  };

  if (!notice) return null;

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : close())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{notice.value.title || "Notification"}</DialogTitle>
          <DialogDescription className="whitespace-pre-wrap">
            {notice.value.message}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button onClick={close}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
