import Link from "next/link";

/**
 * Who is asking. Read only: the account is edited in one place, and a second
 * form here would let the two drift apart. Whoever actually receives or collects
 * the item is a separate, optional answer in FulfillmentChoice.
 */
export function BuyerPanel({
  buyer,
}: {
  buyer: { displayName: string; email: string | null; phone: string | null };
}) {
  return (
    <div className="rounded-[2rem] border border-line bg-surface p-6">
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand">Tus datos</p>
      <p className="mt-2 font-display text-2xl font-semibold">{buyer.displayName}</p>
      <dl className="mt-4 space-y-2 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-muted">Correo</dt>
          <dd className="text-right font-medium text-ink">{buyer.email ?? "Sin correo"}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted">Teléfono</dt>
          <dd className="text-right font-medium text-ink">{buyer.phone ?? "Sin teléfono guardado"}</dd>
        </div>
      </dl>
      <Link className="mt-5 inline-flex text-sm font-semibold text-brand" href="/panel/cuenta">
        Editar mis datos
      </Link>
    </div>
  );
}
