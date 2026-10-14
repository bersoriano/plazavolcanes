"use client";

import { createBrowserSupabaseClient } from "@/lib/supabase/client";

type InsertSubscription<Row> = {
  /** Both are published for live delivery, each behind its own read policy. */
  table: "messages" | "platform_notices";
  /** One conversation, for messages. Left out, it is every row the reader may see. */
  conversationId?: number;
  name: string;
  onInsert: (row: Row) => void;
  onStatus?: (status: string) => void;
};

/**
 * Listens for new rows, and returns the way to stop.
 *
 * Row-level security decides what arrives: a subscriber is only ever delivered
 * messages from conversations it is part of and notices addressed to it,
 * filtered or not.
 */
export function subscribeToInserts<Row = unknown>({
  table,
  conversationId,
  name,
  onInsert,
  onStatus,
}: InsertSubscription<Row>) {
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
          table,
          ...(conversationId === undefined ? {} : { filter: `conversation_id=eq.${conversationId}` }),
        },
        // The row arrives untyped; the caller names the table and so knows its shape.
        (payload: { new: unknown }) => onInsert(payload.new as Row),
      )
      .subscribe((status: string) => onStatus?.(status));
  })();

  return () => {
    cancelled = true;
    if (channel) supabase.removeChannel(channel);
  };
}
