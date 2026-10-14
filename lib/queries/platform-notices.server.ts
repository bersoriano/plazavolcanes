import "server-only";

import { cache } from "react";

import {
  mapAudienceCounts,
  mapNoticeBatches,
  mapPlatformNotice,
  type AudienceCounts,
  type NoticeBatch,
  type PlatformNotice,
} from "@/lib/queries/platform-notices";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";

/** Everything but who it is for and which send it came from: neither is the reader's business. */
const NOTICE_COLUMNS = "id, kind, title, body, action_href, action_label, created_at, read_at";

/** The inbox shows a person's newest notices; older ones stay in the table. */
const INBOX_LIMIT = 100;

/**
 * The caller's notices, newest first. Row-level security is what makes them the
 * caller's: the query asks for no one in particular and is handed only its own.
 */
export const listPlatformNotices = cache(async (): Promise<PlatformNotice[]> => {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("platform_notices")
    .select(NOTICE_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(INBOX_LIMIT);
  if (error || !data) return [];

  return data.map(mapPlatformNotice);
});

/** One notice, or nothing: missing, retracted and somebody else's all read the same. */
export async function fetchPlatformNotice(noticeId: number): Promise<PlatformNotice | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("platform_notices")
    .select(NOTICE_COLUMNS)
    .eq("id", noticeId)
    .maybeSingle();

  return error || !data ? null : mapPlatformNotice(data);
}

/** How many people each audience would reach now. Administrators only; nobody else is told. */
export async function getNoticeAudienceCounts(): Promise<AudienceCounts> {
  if (!isSupabaseConfigured()) return mapAudienceCounts([]);

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("platform_notice_audience_counts");

  return mapAudienceCounts(error || !data ? [] : data);
}

/** Everything administration has sent, newest first. Administrators only. */
export async function listNoticeBatches(): Promise<NoticeBatch[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("list_platform_notice_batches");

  return error || !data ? [] : mapNoticeBatches(data);
}
