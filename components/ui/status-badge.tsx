export type ListingStatus = "draft" | "published" | "expired";

const styles: Record<ListingStatus, { label: string; className: string }> = {
  published: { label: "Publicado", className: "bg-accent text-brand-hover" },
  draft: { label: "Borrador", className: "bg-background text-muted" },
  expired: { label: "Vencido", className: "bg-sale/15 text-sale" },
};

export function StatusBadge({ status }: { status: ListingStatus }) {
  const { label, className } = styles[status];

  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${className}`}>
      {label}
    </span>
  );
}
