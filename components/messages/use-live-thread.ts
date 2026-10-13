"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { markConversationRead } from "@/lib/actions/messages";
import type { ThreadMessage } from "@/lib/queries/messages";
import { subscribeToMessageInserts } from "@/lib/realtime-messages";

/** How often a thread with a broken socket falls back to asking the server. */
const DEGRADED_POLL_MS = 20_000;

/**
 * A subscription reports SUBSCRIBED before the server has finished registering
 * it, so there is a window where the socket is silently not yet live. It is
 * short against a warm Realtime and several seconds against one that just
 * started, which is exactly when everyone reconnects at once. For that window
 * the thread also asks the server, so a message sent into the gap still lands.
 */
const CATCH_UP_MS = 4_000;
const CATCH_UP_WINDOW_MS = 30_000;

/**
 * A conversation that stays current while it is open: the server's history, the
 * messages the socket delivers on top of it, and the reader's place in it.
 */
export function useLiveThread({
  conversationId,
  currentUserId,
  messages,
  refreshOnRead = false,
}: {
  conversationId: number;
  currentUserId: string;
  messages: ThreadMessage[];
  /**
   * The inbox shows this thread's unread state beside it, so reading it has to
   * reach the list. A thread shown on its own has nothing else to update.
   */
  refreshOnRead?: boolean;
}) {
  const [live, setLive] = useState<ThreadMessage[]>([]);
  const [degraded, setDegraded] = useState(false);
  const [catchingUp, setCatchingUp] = useState(false);
  const router = useRouter();

  // The server render is the truth. Anything the socket delivers is merged on
  // top of it, and a message already rendered is dropped rather than doubled.
  const shown = useMemo(() => {
    const byId = new Map(messages.map((message) => [message.id, message]));
    for (const message of live) byId.set(message.id, message);

    return [...byId.values()].sort((left, right) => left.id - right.id);
  }, [messages, live]);

  useEffect(
    () =>
      subscribeToMessageInserts({
        conversationId,
        name: `conversation-${conversationId}`,
        onInsert: (message) => setLive((current) => [...current, message]),
        onStatus: (status) => {
          // A dropped socket falls back to refreshing, which is how this thread
          // behaved before live delivery existed. It must never read as empty.
          setDegraded(status === "CHANNEL_ERROR" || status === "TIMED_OUT");
          if (status === "SUBSCRIBED") setCatchingUp(true);
        },
      }),
    [conversationId],
  );

  useEffect(() => {
    if (!degraded) return;

    const refresh = () => router.refresh();
    const timer = setInterval(refresh, DEGRADED_POLL_MS);
    window.addEventListener("focus", refresh);

    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, [degraded, router]);

  useEffect(() => {
    if (!catchingUp) return;

    const timer = setInterval(() => router.refresh(), CATCH_UP_MS);
    const stop = setTimeout(() => setCatchingUp(false), CATCH_UP_WINDOW_MS);

    return () => {
      clearInterval(timer);
      clearTimeout(stop);
    };
  }, [catchingUp, router]);

  const latest = shown.at(-1);
  const latestId = latest?.id ?? null;
  const latestIsTheirs = latest ? latest.sender_id !== currentUserId : false;

  // Keyed on the newest message, not on the list: a refresh hands over a new
  // array with the same messages in it, and that is not something new to read.
  useEffect(() => {
    if (latestId === null) return;

    void (async () => {
      await markConversationRead(conversationId, latestId);
      // Not cancelled when the thread closes: the list it leaves behind still
      // has to learn that this one was read.
      if (refreshOnRead && latestIsTheirs) router.refresh();
    })();
  }, [conversationId, latestId, latestIsTheirs, refreshOnRead, router]);

  return { latestId, shown };
}
