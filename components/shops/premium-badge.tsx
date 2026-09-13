import { CircleHelp, Sparkles } from "lucide-react";

/**
 * The mark of a shop administration has distinguished.
 *
 * The tooltip names Plaza Volcanes as the one who grants it: the trust tier
 * beside it is measured, this is chosen, and a buyer deserves to know which is
 * which.
 */
export function PremiumBadge({
  className = "",
  showDetails = true,
}: {
  /** Outer spacing belongs to the row the badge joins, so none is built in. */
  className?: string;
  showDetails?: boolean;
}) {
  return (
    <div
      aria-label="Tienda Premium"
      className={`group relative inline-flex items-center gap-2 rounded-full border border-premium-gold bg-premium-ink px-3 py-2 text-sm font-bold text-premium-gold ${className}`.trim()}
      role="group"
    >
      <Sparkles aria-hidden="true" className="size-4" />
      Premium
      {showDetails ? (
        <>
          <button
            aria-describedby="premium-badge-tooltip"
            aria-label="Más información sobre la distinción Premium"
            className="tap-halo grid size-5 place-items-center rounded-full text-premium-gold/70 hover:text-premium-gold"
            type="button"
          >
            <CircleHelp aria-hidden="true" className="size-3.5" />
          </button>
          <span
            className="pointer-events-none absolute left-0 top-[calc(100%+.5rem)] z-30 w-72 rounded-xl bg-premium-ink px-3 py-2 text-xs font-normal leading-5 text-[#f5f1ea] opacity-0 shadow-lg transition-opacity group-focus-within:opacity-100 group-hover:opacity-100"
            id="premium-badge-tooltip"
            role="tooltip"
          >
            Plaza Volcanes distingue a esta tienda. No sustituye a las métricas de
            confianza, que se miden aparte y nadie puede editar.
          </span>
        </>
      ) : null}
    </div>
  );
}
