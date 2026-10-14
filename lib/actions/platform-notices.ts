"use server";

import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";

/**
 * Opening a notice reads it. The database only ever marks the caller's own, so
 * the number needs no checking here.
 */
export async function markPlatformNoticeRead(noticeId: number) {
  if (!isSupabaseConfigured()) return;

  const supabase = await createServerSupabaseClient();
  // Read state is a convenience. A failure here must never break a notice.
  await supabase.rpc("mark_platform_notice_read", { p_notice_id: noticeId });
}
