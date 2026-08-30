import "server-only";

import {
  mapConversationRows,
  oldestFirst,
  type ConversationSummary,
  type InboxRole,
  type Thread,
} from "@/lib/queries/messages";
import type { ConversationType, ThreadMessage } from "@/lib/queries/messages";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type ThreadRow = {
  id: number;
  type: ConversationType;
  order_id: number | null;
  buyer_id: string;
  messages: ThreadMessage[];
};

export async function listConversations(role: InboxRole): Promise<ConversationSummary[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("list_conversations", { p_role: role });
  if (error || !data) return [];

  return mapConversationRows(data);
}

export async function fetchUnreadCount(): Promise<number> {
  if (!isSupabaseConfigured()) return 0;

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("unread_message_count");

  return error ? 0 : (data ?? 0);
}

export async function fetchThread(conversationId: number): Promise<Thread | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = await createServerSupabaseClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = typeof claims?.claims?.sub === "string" ? claims.claims.sub : null;
  if (!userId) return null;

  // The row-level policy already limits this to conversations the caller is in,
  // so a thread that belongs to somebody else simply returns nothing.
  const { data: raw, error } = await supabase
    .from("conversations")
    .select("id, type, order_id, buyer_id, messages(id, sender_id, body, created_at)")
    .eq("id", conversationId)
    .maybeSingle();

  // The hand-written database types carry no Relationships, so PostgREST embeds
  // are cast at the boundary here, as getOrderDetail already does.
  const data = raw as unknown as ThreadRow | null;
  if (error || !data) return null;

  // The label lives in the inbox query, which already knows to show a shop name
  // to a buyer and a display name to a seller. Asking it again keeps that rule
  // in one place rather than reimplementing it here.
  const role: InboxRole = data.buyer_id === userId ? "buyer" : "seller";
  // Unfiltered on purpose: the inbox drops threads nobody has written in yet, but
  // this is the page you land on to write the first one, so it has to find them.
  const summary = (await listConversations(role)).find((entry) => entry.id === conversationId);

  return {
    id: data.id,
    type: data.type,
    order_id: data.order_id,
    viewer_role: role,
    counterpart_label: summary?.counterpart_label ?? "Conversación",
    shop_name: summary?.shop_name ?? "",
    shop_slug: summary?.shop_slug ?? "",
    // The product travels with the inbox row for the same reason the label does,
    // and for one more: row level security hides a listing that is no longer
    // published, so reading it through an embed here would blank out exactly the
    // thread that needs to say the listing is gone.
    product: summary?.product ?? null,
    current_user_id: userId,
    messages: oldestFirst(data.messages),
  };
}
