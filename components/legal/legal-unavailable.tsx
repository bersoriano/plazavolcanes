import type { LegalRoute } from "@/lib/legal/document-types";

/**
 * Shown when no approved version is published. It is deliberately not a 404 and
 * deliberately not placeholder text: a person arriving here must be able to
 * tell that the document does not exist yet, rather than read something that
 * looks binding and is not.
 */
export function LegalUnavailable({ route }: { route: LegalRoute }) {
  return (
    <article className="mx-auto max-w-[68ch]">
      <h1 className="font-display text-4xl font-semibold tracking-[-0.03em] text-ink">
        {route.title}
      </h1>
      <p
        className="mt-6 rounded-[1.5rem] border border-sale/30 bg-sale/5 p-6 leading-7 text-ink"
        role="status"
      >
        Este documento aún no está disponible: no hay una versión aprobada y
        publicada. Plaza Volcanes no puede aceptar solicitudes de compra hasta
        que exista.
      </p>
      <p className="mt-5 leading-7 text-muted">
        Si necesitas esta información para una compra o una aclaración,
        escríbenos y te respondemos directamente.
      </p>
    </article>
  );
}
