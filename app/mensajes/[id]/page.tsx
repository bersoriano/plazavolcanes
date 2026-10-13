import { notFound } from "next/navigation";

import { ThreadConversation } from "@/components/messages/thread-conversation";
import { ThreadHeader } from "@/components/messages/thread-header";
import { sendMessage } from "@/lib/actions/messages";
import { fetchThread } from "@/lib/queries/messages.server";

export default async function MessageThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const conversationId = Number(id);
  if (!Number.isInteger(conversationId)) notFound();

  const thread = await fetchThread(conversationId);
  // A thread the caller does not participate in reads as missing rather than
  // as forbidden, so its existence is never disclosed.
  if (!thread) notFound();

  // A seller's reply takes the thread off the action queue on /panel.
  const action = sendMessage.bind(null, thread.id, [
    `/mensajes/${thread.id}`,
    "/mensajes",
    ...(thread.viewer_role === "seller" ? ["/panel"] : []),
  ]);

  return (
    <>
      <ThreadHeader thread={thread} />
      {/* Keyed, so nothing typed or received in one thread follows into the next. */}
      <ThreadConversation
        action={action}
        conversationId={thread.id}
        currentUserId={thread.current_user_id}
        key={thread.id}
        messages={thread.messages}
        now={new Date().toISOString()}
      />
    </>
  );
}
