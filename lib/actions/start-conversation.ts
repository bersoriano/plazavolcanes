"use server";

import { redirect } from "next/navigation";

import type { ActionState } from "@/lib/action-state";
import { startPreSaleConversation } from "@/lib/actions/messages";

/**
 * Opens, or re-opens, the pre-sale thread between the signed-in shopper and a
 * shop, then sends them to it.
 *
 * A product page passes the product it loaded, so the thread stays about that
 * listing; a shop page passes none, and the shopper gets the general enquiry.
 * Both identifiers come from bound arguments rather than the form, so the page
 * decides what is being written to and a crafted POST cannot pair a shop with
 * somebody else's product.
 */
export async function openConversation(
  shopId: number,
  productId: number | null,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _previousState: ActionState,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _formData: FormData,
): Promise<ActionState> {
  const result = await startPreSaleConversation(shopId, productId);
  if ("error" in result) return { status: "error", message: result.error };

  redirect(`/mensajes/${result.conversationId}`);
}
