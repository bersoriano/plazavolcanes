import { NAVIDAD_ACTIVA } from "@/lib/navidad";

/**
 * The Christmas layer's overlays (public/navidad/LEEME.md). Each one is
 * absolute, ignores the pointer (`.nv` in public/navidad/navidad.css) and is
 * hidden from assistive technology, so the page reads, lays out and responds
 * exactly as it does without it. All of them render nothing once
 * NAVIDAD_ACTIVA is off.
 *
 * Plain <img>, not next/image: these are a few hundred bytes of static SVG
 * each and the optimizer has nothing to add.
 */

export type Pieza =
  | "guirnalda.svg"
  | "gorro.svg"
  | "nochebuena.svg"
  | "posada.svg"
  | "acebo.svg"
  | "mono.svg"
  | "rama.svg"
  | "luces.svg"
  | "nieve.svg"
  | "sello-navidad.svg"
  | "esfera-roja.svg"
  | "esfera-oro.svg"
  | "esfera-pino.svg";

/**
 * The anchor class, with its leading space, for an element that is not
 * positioned yet. Never add it to one that already is (sticky, absolute,
 * relative): the stylesheet is unlayered, so its `position: relative` would
 * beat the Tailwind utility on the same element.
 */
export function anclaje() {
  return NAVIDAD_ACTIVA ? " nv-anclaje" : "";
}

/**
 * One piece, appended as the last child of its anchor. `as="span"` inside
 * phrasing content (a heading's <em>, a <span> badge), where a <div> would
 * not be valid HTML; position: absolute lays both out the same.
 */
export function Adorno({
  src,
  className,
  lazy = false,
  as: Tag = "div",
}: {
  src: Pieza;
  /** The piece's nv--* placement classes from navidad.css. */
  className: string;
  /** Below the fold on every width. */
  lazy?: boolean;
  as?: "div" | "span";
}) {
  if (!NAVIDAD_ACTIVA) return null;

  return (
    <Tag aria-hidden="true" className={`nv ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- static decorative SVG */}
      <img alt="" loading={lazy ? "lazy" : undefined} src={`/navidad/${src}`} />
    </Tag>
  );
}

export type Copo = {
  /** copo-pino on light grounds, copo-lima on the plum bar and footer. */
  src: "copo-pino.svg" | "copo-lima.svg";
  left: `${number}%`;
  top: `${number}%`;
  /** Between .13 and .22, so a flake never competes with the text. */
  opacity: number;
};

/** A section's loose snowflakes, spread across it by percentage. */
export function Copos({ copos, lazy = false }: { copos: readonly Copo[]; lazy?: boolean }) {
  if (!NAVIDAD_ACTIVA) return null;

  return (
    <div aria-hidden="true" className="nv nv--copos">
      {copos.map(({ src, left, top, opacity }) => (
        // eslint-disable-next-line @next/next/no-img-element -- static decorative SVG
        <img alt="" key={`${left}-${top}`} loading={lazy ? "lazy" : undefined} src={`/navidad/${src}`} style={{ left, top, opacity }} />
      ))}
    </div>
  );
}

/**
 * The bow on an "Abrir mi tienda gratis" button, hung from the link itself:
 * pass `anclaje().trim()` as the button's className and this as its last
 * child. A wrapper would have been the gentler touch, but beside "Ver una
 * tienda de ejemplo" at 1280px Chrome shares the row's shrink differently
 * between a wrapper and the bare link, and both buttons moved 3.5px.
 */
export function Mono({ lazy = false }: { lazy?: boolean }) {
  return <Adorno as="span" className="nv--mono" lazy={lazy} src="mono.svg" />;
}
