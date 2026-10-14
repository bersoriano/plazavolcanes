import type { Metadata } from "next";
import type { ReactNode } from "react";

import { InboxShell } from "@/components/messages/inbox-shell";
import { mergeInbox } from "@/lib/queries/messages";
import { listConversations } from "@/lib/queries/messages.server";
import { listPlatformNotices } from "@/lib/queries/platform-notices.server";
import { viewerOwnsAnyShop } from "@/lib/queries/seller-standing.server";
import { requireSignedIn } from "@/lib/require-signed-in.server";

export const metadata: Metadata = { title: "Mensajes" };

/**
 * The inbox around every conversation.
 *
 * The list is here rather than on a page because a layout stays mounted while
 * the reader moves between threads, so the list keeps its place, its filter and
 * its search. The price is that it is not rendered again on navigation; the
 * shell asks for a refresh whenever something in it may have changed.
 */
export default async function MessagesLayout({ children }: { children: ReactNode }) {
  const userId = await requireSignedIn("/mensajes");

  const [buying, selling, notices, ownsShop] = await Promise.all([
    listConversations("buyer"),
    listConversations("seller"),
    listPlatformNotices(),
    viewerOwnsAnyShop(),
  ]);
  const entries = mergeInbox(buying, selling, notices);

  return (
    <InboxShell
      currentUserId={userId}
      entries={entries}
      now={new Date().toISOString()}
      // A shop nobody has written to yet still has a selling side to look at,
      // and threads that outlived their shop still have to be reachable.
      showSelling={ownsShop || entries.some((entry) => entry.role === "seller")}
    >
      {children}
    </InboxShell>
  );
}
