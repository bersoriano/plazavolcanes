import "server-only";

import { getPublicProduct } from "@/lib/queries/catalog.server";
import { safeContinuation } from "@/lib/safe-continuation";

export async function questionSellerFromContinuation(continuation: unknown): Promise<string | null> {
  const safe = safeContinuation(continuation);
  if (!safe) return null;
  const match = /^\/productos\/([a-z0-9-]+)\?pregunta=1$/.exec(safe);
  if (!match) return null;
  return (await getPublicProduct(match[1]!))?.shop.name ?? null;
}
