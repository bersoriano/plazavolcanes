import { FOUNDERS_CAP, resolveFoundersProgress } from "@/lib/launch";

/**
 * The hero's founding-stores card.
 *
 * Nothing counts the spots yet, so by default the card names the offer and
 * leaves the tally and the bar out, as the launch bar does. Pass a real count
 * and both appear: "[n] de 100 lugares disponibles" and a bar filled to the
 * share already claimed.
 */
export function FoundersCounter({ spotsTaken }: { spotsTaken?: number | null }) {
  const progress = resolveFoundersProgress(spotsTaken);

  return (
    <div className="flex w-full flex-col gap-3 rounded-[20px] border border-line bg-surface px-[18px] py-4 shadow-card sm:max-w-[560px] lg:rounded-[22px] lg:px-[22px] lg:py-5">
      <p className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-brand lg:text-[12px]">Tiendas fundadoras</span>
        <span className="text-[14px] font-semibold text-ink lg:text-[15px]">
          {progress ? (
            <>
              <span className="tabular-nums">{progress.left}</span> de {FOUNDERS_CAP} lugares disponibles
            </>
          ) : (
            `Primeras ${FOUNDERS_CAP} tiendas`
          )}
        </span>
      </p>
      {progress ? (
        <div
          aria-label="Lugares de tiendas fundadoras ocupados"
          aria-valuemax={FOUNDERS_CAP}
          aria-valuemin={0}
          aria-valuenow={progress.taken}
          className="h-2.5 overflow-hidden rounded-full bg-progress-track lg:h-3"
          role="progressbar"
        >
          <div
            className="h-full rounded-full bg-accent shadow-[inset_0_0_0_1.5px_var(--brand)]"
            style={{ width: `${progress.percent}%` }}
          />
        </div>
      ) : null}
      <p className="text-[13px] leading-[1.5] text-muted lg:text-[14px]">
        Publican gratis y no pagan comisión por venta si se registran durante los primeros tres meses.
      </p>
    </div>
  );
}
