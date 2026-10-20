"use server";

import { z } from "zod";
import type { ProductActivity } from "@/lib/product-activity";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const inputSchema = z.object({ productId: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  activity: z.enum(["view", "question", "purchase", "share"]), sessionId: z.string().uuid() });

export async function recordProductActivity(productId: number, activity: ProductActivity, sessionId: string): Promise<boolean> {
  const input = inputSchema.safeParse({ productId, activity, sessionId });
  if (!input.success || !isSupabaseConfigured()) return false;
  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.rpc("record_product_activity", {
      p_product_id: input.data.productId, p_action: input.data.activity, p_session_id: input.data.sessionId,
    });
    return !error && data === true;
  } catch { return false; }
}
