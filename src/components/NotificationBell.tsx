import { useEffect, useState } from "react";
import { Bell, CheckCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { KIND_META, type NotificationRow } from "@/lib/notifications";

export function NotificationBell({ userId }: { userId: string }) {
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [open, setOpen] = useState(false);

  const load = async () => {
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);
    setItems((data as NotificationRow[]) ?? []);
  };

  useEffect(() => {
    if (!userId) return;
    load();
    const channel = supabase
      .channel(`notif-${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        (payload) => {
          setItems((prev) => [payload.new as NotificationRow, ...prev]);
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const unread = items.filter((n) => !n.read).length;

  const markAllRead = async () => {
    await supabase.from("notifications").update({ read: true }).eq("user_id", userId).eq("read", false);
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const markRead = async (id: string) => {
    await supabase.from("notifications").update({ read: true }).eq("id", id);
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader>
          <div className="flex items-center justify-between pr-6">
            <SheetTitle>Notifications</SheetTitle>
            {unread > 0 && (
              <Button variant="ghost" size="sm" onClick={markAllRead}>
                <CheckCheck className="mr-1 h-4 w-4" /> Mark all read
              </Button>
            )}
          </div>
        </SheetHeader>
        <div className="mt-4 space-y-2 overflow-y-auto pb-6">
          {items.length === 0 && (
            <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              No notifications yet.
            </p>
          )}
          {items.map((n) => {
            const meta = KIND_META[n.kind];
            return (
              <button
                key={n.id}
                onClick={() => markRead(n.id)}
                className={`w-full rounded-lg border p-3 text-left transition ${
                  n.read ? "border-border bg-card" : "border-primary/40 bg-primary/5"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="text-xl leading-none">{meta.emoji}</div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${meta.color}`}>
                        {meta.label}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(n.created_at).toLocaleString()}
                      </span>
                    </div>
                    <div className="mt-1 text-sm font-semibold">{n.title}</div>
                    {n.body && <div className="text-xs text-muted-foreground">{n.body}</div>}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}
