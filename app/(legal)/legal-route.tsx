import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { LegalDocument } from "@/components/legal/legal-document";
import { LegalUnavailable } from "@/components/legal/legal-unavailable";
import { LEGAL_ROUTES, type LegalDocumentType } from "@/lib/legal/document-types";
import { getPublishedLegalDocument } from "@/lib/queries/legal.server";

function findRoute(type: LegalDocumentType) {
  return LEGAL_ROUTES.find((route) => route.type === type);
}

export async function buildLegalMetadata(type: LegalDocumentType): Promise<Metadata> {
  const route = findRoute(type);
  if (!route) return {};

  const document = await getPublishedLegalDocument(type);

  // An unpublished document is a configuration failure, not content. Keeping it
  // out of the index stops a crawler from surfacing the notice as if it were
  // the policy itself.
  if (!document) {
    return { title: route.title, robots: { index: false, follow: false } };
  }

  return { title: document.title };
}

export async function LegalRoutePage({ type }: { type: LegalDocumentType }) {
  const route = findRoute(type);
  if (!route) notFound();

  const document = await getPublishedLegalDocument(type);

  return document ? (
    <LegalDocument document={document} />
  ) : (
    <LegalUnavailable route={route} />
  );
}
