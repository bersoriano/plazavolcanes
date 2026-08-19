type StatusBadgeProps = {
  status: "draft" | "published";
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const published = status === "published";

  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${published ? "bg-accent text-brand-hover" : "bg-background text-muted"}`}>
      {published ? "Publicado" : "Borrador"}
    </span>
  );
}
