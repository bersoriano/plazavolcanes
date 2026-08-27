import "server-only";

import type { LegalDocumentType } from "@/lib/legal/document-types";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type LegalSection = {
  id: string;
  heading: string;
  paragraphs: string[];
};

export type PublishedLegalDocument = {
  id: string;
  type: LegalDocumentType;
  version: number;
  title: string;
  sections: LegalSection[];
  issuerIdentity: Record<string, string> | null;
  contentHash: string;
  effectiveAt: string;
  publishedAt: string;
};

function readSections(body: unknown): LegalSection[] {
  if (!body || typeof body !== "object") return [];
  const sections = (body as { sections?: unknown }).sections;
  if (!Array.isArray(sections)) return [];

  return sections.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const { id, heading, paragraphs } = entry as Record<string, unknown>;
    if (typeof id !== "string" || typeof heading !== "string") return [];

    return [{
      id,
      heading,
      paragraphs: Array.isArray(paragraphs)
        ? paragraphs.filter((p): p is string => typeof p === "string")
        : [],
    }];
  });
}

/**
 * Resolves the published, effective version of one document type, or null.
 *
 * Null is the honest answer for every failure here — unpublished, misconfigured
 * or unreachable. The route renders an explicit configuration notice for all
 * three rather than throwing a 500 or, worse, showing placeholder legal text.
 */
export async function getPublishedLegalDocument(
  type: LegalDocumentType,
): Promise<PublishedLegalDocument | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("current_legal_document", { p_type: type });

  if (error) {
    console.error(`getPublishedLegalDocument(${type}): query failed`, error);
    return null;
  }
  if (!data) return null;

  const row = data as Record<string, unknown>;
  if (typeof row.id !== "string") return null;

  const version = Number(row.version);
  if (!Number.isInteger(version) || version <= 0) return null;

  return {
    id: row.id,
    type,
    version,
    title: String(row.title ?? ""),
    sections: readSections(row.body),
    issuerIdentity:
      row.issuer_identity && typeof row.issuer_identity === "object"
        ? (row.issuer_identity as Record<string, string>)
        : null,
    contentHash: String(row.content_hash ?? ""),
    effectiveAt: String(row.effective_at ?? ""),
    publishedAt: String(row.published_at ?? ""),
  };
}
