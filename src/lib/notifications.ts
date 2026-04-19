import { supabase } from "@/integrations/supabase/client";

export type NotificationKind = "weather" | "earning" | "booking" | "system" | "market";

export interface NotificationRow {
  id: string;
  user_id: string;
  kind: NotificationKind;
  title: string;
  body: string | null;
  read: boolean;
  created_at: string;
}

/** Push a notification for the current user (or for someone else if you're admin). */
export async function pushNotification(input: {
  user_id: string;
  kind: NotificationKind;
  title: string;
  body?: string;
}) {
  return supabase.from("notifications").insert({
    user_id: input.user_id,
    kind: input.kind,
    title: input.title,
    body: input.body ?? null,
  });
}

export const KIND_META: Record<NotificationKind, { emoji: string; label: string; color: string }> = {
  weather: { emoji: "🌦️", label: "Weather", color: "bg-blue-500/15 text-blue-700 dark:text-blue-300" },
  earning: { emoji: "💰", label: "Earning", color: "bg-primary/15 text-primary" },
  booking: { emoji: "📅", label: "Booking", color: "bg-accent/15 text-accent" },
  system:  { emoji: "🔔", label: "System",  color: "bg-muted text-muted-foreground" },
  market:  { emoji: "🛒", label: "Market",  color: "bg-secondary text-secondary-foreground" },
};
