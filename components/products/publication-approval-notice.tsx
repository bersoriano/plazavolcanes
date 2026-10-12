import { getShopPublicationApproval, getShopPublicationGuidance, type SellerListingFlags } from "@/lib/seller-publication";

export function PublicationApprovalNotice({ shop }: { shop: Pick<SellerListingFlags, "is_publishing_approved" | "publishing_reviewed_at"> }) {
  const approval = getShopPublicationApproval(shop);
  return <aside className="mb-6 rounded-2xl border border-line bg-background p-4" aria-label="Permiso para publicar productos">
    <p className="text-sm font-semibold text-brand">Permiso para publicar productos: {approval.label}</p>
    <p className="mt-2 text-sm leading-6 text-muted">{getShopPublicationGuidance(shop)}</p>
  </aside>;
}
