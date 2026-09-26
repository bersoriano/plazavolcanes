import { CrossingTapes, type TapePromise } from "@/components/home/landing/crossing-tapes";
import { REPUTATION_IMPORT_AVAILABLE } from "@/lib/launch";

const FOUNDER_PERKS: TapePromise[] = [
  { text: "0% comisión", italic: false },
  { text: "pago directo", italic: true },
  { text: "Hasta 50 artículos gratis", italic: false },
  { text: "insignia fundadora", italic: true },
  { text: "Premium por 1 año", italic: false },
];

/** What every shop keeps once the founders promotion is over. */
const STANDING_PROMISES: TapePromise[] = [
  { text: "0% comisión", italic: false },
  { text: "pago directo", italic: true },
  { text: "Sin retenciones", italic: false },
  { text: "todo por escrito", italic: true },
  { text: "100% mexicana", italic: false },
];

const PLATFORMS = ["Mercado Libre", "Facebook Marketplace", "Amazon", "Etsy", "Instagram"];

/**
 * /vender's crossing tapes: the founder perks on lime (the standing promises
 * once the promotion ends) and, on plum, the platforms a reputation comes
 * from, for as long as the import exists.
 */
export function SellerTapes({ promoActive }: { promoActive: boolean }) {
  return REPUTATION_IMPORT_AVAILABLE ? (
    <CrossingTapes
      categories={PLATFORMS}
      lead="Trae tu reputación de"
      promises={promoActive ? FOUNDER_PERKS : STANDING_PROMISES}
    />
  ) : (
    <CrossingTapes categories={["Nuevo y usado"]} promises={promoActive ? FOUNDER_PERKS : STANDING_PROMISES} />
  );
}
