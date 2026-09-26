import { CrossingTapes, type TapePromise } from "@/components/home/landing/crossing-tapes";
import { REPUTATION_IMPORT_AVAILABLE } from "@/lib/launch";

const FOUNDER_PERKS: TapePromise[] = [
  { text: "50 productos", italic: false },
  { text: "insignia fundadora", italic: true },
  { text: "0% comisión 12 meses", italic: false },
  { text: "pago directo", italic: true },
  { text: "25 productos gratis para todas", italic: false },
];

/** What every shop keeps once the founders promotion is over. */
const STANDING_PROMISES: TapePromise[] = [
  { text: "25 productos gratis", italic: false },
  { text: "pago directo", italic: true },
  { text: "Sin retenciones", italic: false },
  { text: "todo por escrito", italic: true },
  { text: "100% mexicana", italic: false },
];

/** Only what a shop can show today: a profile on these, visible in the shop. */
const PLATFORMS = ["Mercado Libre", "Facebook Marketplace"];

/**
 * /vender's crossing tapes: the founder perks on lime (the standing promises
 * once the promotion ends) and, on plum, the platforms whose profile a shop
 * can show, for as long as that exists.
 */
export function SellerTapes({ promoActive }: { promoActive: boolean }) {
  return REPUTATION_IMPORT_AVAILABLE ? (
    <CrossingTapes
      categories={PLATFORMS}
      lead="Muestra tu perfil de"
      promises={promoActive ? FOUNDER_PERKS : STANDING_PROMISES}
    />
  ) : (
    <CrossingTapes categories={["Nuevo y usado"]} promises={promoActive ? FOUNDER_PERKS : STANDING_PROMISES} />
  );
}
