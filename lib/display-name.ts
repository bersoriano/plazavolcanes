/**
 * The label for a person in a conversation.
 *
 * Accounts that predate display names, and anyone who has not set one, read as
 * a handle derived from their id. It is stable, so a seller still recognises a
 * shopper who comes back. This mirrors `private.display_label` in SQL; the two
 * must agree, because a seller sees the database's answer in the inbox and this
 * one in a thread.
 */
export function displayNameOrHandle(name: string | null, userId: string) {
  const trimmed = name?.trim();
  if (trimmed) return trimmed;

  return `Comprador #${userId.replace(/-/g, "").slice(0, 4).toUpperCase()}`;
}
