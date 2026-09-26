import { FOUNDER_EARN_RULE, FOUNDERS_CAP, resolveFoundersProgress } from "@/lib/launch";

const LANDING_NOTE = `${FOUNDER_EARN_RULE} 50 productos, insignia fundadora y 0% comisión fija 12 meses.`;

const TONES = {
  light: {
    card: "border-line bg-surface shadow-card",
    label: "text-brand",
    value: "text-ink",
    track: "bg-progress-track",
    fill: "border-[1.5px] border-brand",
    note: "text-muted",
  },
  // On the plum /vender hero: a translucent card and a plain lime bar.
  dark: {
    card: "border-white/15 bg-white/5",
    label: "text-accent",
    value: "text-white",
    track: "bg-white/15",
    fill: "",
    note: "text-white/70",
  },
} as const;

/**
 * The founding-stores card, on the home hero (light) and the /vender hero
 * (dark).
 *
 * Without a trustworthy count the card names the offer and leaves the tally
 * and the bar out, as the launch bar does. With one, both appear: "[n] de 100
 * lugares disponibles" ("libres" on a phone when `compactOnPhone`) and a bar
 * filled to the share already claimed.
 */
export function FoundersCounter({
  spotsTaken,
  tone = "light",
  note = LANDING_NOTE,
  compactOnPhone = false,
}: {
  spotsTaken?: number | null;
  tone?: keyof typeof TONES;
  note?: string;
  /** The phone card drops the note and shortens "lugares disponibles". */
  compactOnPhone?: boolean;
}) {
  const progress = resolveFoundersProgress(spotsTaken);
  const colors = TONES[tone];

  return (
    <div
      className={`flex w-full flex-col gap-3 rounded-[20px] border px-[18px] py-4 sm:max-w-[560px] lg:rounded-[22px] lg:px-[22px] lg:py-5 ${colors.card}`}
    >
      <p className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span className={`text-[11px] font-bold uppercase tracking-[0.12em] lg:text-[12px] ${colors.label}`}>
          Tiendas fundadoras
        </span>
        <span className={`text-[14px] font-semibold lg:text-[15px] ${colors.value}`}>
          {progress ? (
            <>
              <span className="tabular-nums">{progress.left}</span> de {FOUNDERS_CAP}{" "}
              {compactOnPhone ? (
                <>
                  <span className="sm:hidden">libres</span>
                  <span className="hidden sm:inline">lugares disponibles</span>
                </>
              ) : (
                "lugares disponibles"
              )}
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
          className={`h-2.5 overflow-hidden rounded-full lg:h-3 ${colors.track}`}
          role="progressbar"
        >
          <div className={`h-full rounded-full bg-accent ${colors.fill}`} style={{ width: `${progress.percent}%` }} />
        </div>
      ) : null}
      <p className={`text-[13px] leading-[1.5] lg:text-[14px] ${colors.note} ${compactOnPhone ? "hidden sm:block" : ""}`}>
        {note}
      </p>
    </div>
  );
}
