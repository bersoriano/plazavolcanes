"use server";

import { redirect } from "next/navigation";

import type { ActionState } from "@/lib/action-state";
import { startPreSaleConversation } from "@/lib/actions/messages";

/**
 * Opens, or re-opens, the pre-sale thread between the signed-in shopper and a
 * shop, then sends them to it.
 *
 * The shop comes from a bound argument rather than the form, so the page
 * decides which shop is being written to. The two trailing parameters are the
 * shape useActionState calls with; neither carries anything this action needs.
 */
export async function openConversation(
  shopId: number,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _previousState: ActionState,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _formData: FormData,
): Promise<ActionState> {
  const result = await startPreSaleConversation(shopId);
  if ("error" in result) return { status: "error", message: result.error };

  redirect(`/mensajes/${result.conversationId}`);
}
