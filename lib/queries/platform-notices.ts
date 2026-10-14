import type { BroadcastAudience, NoticeAudience } from "@/lib/validation/platform-notice";

export type PlatformNoticeKind = "direct" | "announcement";

/** The shape of a row of public.platform_notices, as a recipient reads it. */
export type PlatformNoticeRow = {
  id: number;
  kind: PlatformNoticeKind;
  title: string;
  body: string;
  action_href: string | null;
  action_label: string | null;
  created_at: string;
  read_at: string | null;
};

/** A message from the plaza itself, in one person's inbox. Nobody can answer it. */
export type PlatformNotice = {
  id: number;
  kind: PlatformNoticeKind;
  title: string;
  body: string;
  /** Somewhere inside the site the notice points at, with the words for its button. */
  action: { href: string; label: string } | null;
  created_at: string;
  read_at: string | null;
};

export function mapPlatformNotice(row: PlatformNoticeRow): PlatformNotice {
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    body: row.body,
    action:
      row.action_href && row.action_label
        ? { href: row.action_href, label: row.action_label }
        : null,
    created_at: row.created_at,
    read_at: row.read_at,
  };
}

/** The shape public.list_platform_notice_batches returns, one row per send. */
export type NoticeBatchRow = {
  batch_id: string;
  audience: NoticeAudience;
  recipient_label: string | null;
  title: string;
  body: string;
  action_href: string | null;
  action_label: string | null;
  recipient_count: number;
  read_count: number;
  created_at: string;
  retracted_at: string | null;
};

/** One act of sending, as administration's history shows it. */
export type NoticeBatch = {
  id: string;
  audience: NoticeAudience;
  /** Who a direct notice went to. Null for an audience, and for an account since deleted. */
  recipientLabel: string | null;
  title: string;
  body: string;
  action: { href: string; label: string } | null;
  recipientCount: number;
  readCount: number;
  createdAt: string;
  retractedAt: string | null;
};

export function mapNoticeBatches(rows: NoticeBatchRow[]): NoticeBatch[] {
  return rows.map((row) => ({
    id: row.batch_id,
    audience: row.audience,
    recipientLabel: row.recipient_label,
    title: row.title,
    body: row.body,
    action:
      row.action_href && row.action_label
        ? { href: row.action_href, label: row.action_label }
        : null,
    recipientCount: row.recipient_count,
    readCount: row.read_count,
    createdAt: row.created_at,
    retractedAt: row.retracted_at,
  }));
}

export type AudienceCounts = Record<BroadcastAudience, number>;

export function mapAudienceCounts(rows: { audience: string; people: number }[]): AudienceCounts {
  const counts: AudienceCounts = { everyone: 0, sellers: 0, buyers: 0 };

  for (const row of rows) {
    if (row.audience in counts) counts[row.audience as BroadcastAudience] = row.people;
  }

  return counts;
}
