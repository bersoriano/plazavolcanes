"use client";

import type { ThreadMessage } from "@/lib/queries/messages";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

type MessageSubscription = {
  /** One conversation. Left out, it is every conversation the reader takes part in. */
  conversationId?: number;
  name: string;
  onInsert: (message: ThreadMessage) => void;
  onStatus?: (status: string) => void;
};

/**
 * Listens for new messages, and returns the way to stop.
 *
 * Row-level security decides what arrives: a subscriber is only ever delivered
 * messages from conversations it is part of, filtered or not.
 */
export function subscribeToMessageInserts({
  conversationId,
  name,
  onInsert,
  onStatus,
}: MessageSubscription) {
  const supabase = createBrowserSupabaseClient();
  let channel: ReturnType<typeof supabase.channel> | null = null;
  let cancelled = false;

  void (async () => {
    // Realtime authorizes each subscriber against the row-level policy, and
    // that policy grants the authenticated role. The socket opens with only
    // the publishable key, so without handing it the session it subscribes as
    // anon and is delivered nothing at all.
    const { data } = await supabase.auth.getSession();
    if (cancelled) return;

    supabase.realtime.setAuth(data.session?.access_token ?? null);
    channel = supabase
      .channel(name)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          ...(conversationId === undefined ? {} : { filter: `conversation_id=eq.${conversationId}` }),
        },
        (payload: { new: ThreadMessage }) => onInsert(payload.new),
      )
      .subscribe((status: string) => onStatus?.(status));
  })();

  return () => {
    cancelled = true;
    if (channel) supabase.removeChannel(channel);
  };
}
