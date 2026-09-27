import { Check, Store } from "lucide-react";

/**
 * Text only, never a logo: the marketplaces named here are not partners, and a
 * borrowed wordmark would imply an endorsement none of them have given.
 */
const PLATFORMS = ["Mercado Libre", "Facebook Marketplace"];

const FLOW_SUMMARY =
  "Diagrama: tus perfiles de Mercado Libre y Facebook Marketplace, visibles en tu tienda de Plaza Volcanes.";

/**
 * The profiles a shop can show, beside the store card that shows them. It
 * claims visibility, not imported ratings: "tus estrellas viajan" would be a
 * promise the plaza cannot back. Stacked on a phone.
 */
export function ReputationFlow() {
  return (
    <>
      <p className="sr-only">{FLOW_SUMMARY}</p>
      <div
        aria-hidden="true"
        className="mt-auto flex flex-col gap-4 rounded-[20px] bg-background p-4 sm:flex-row sm:items-center sm:gap-[18px] lg:min-h-[170px] lg:rounded-[24px] lg:px-6"
      >
        <div className="flex flex-wrap gap-2 sm:max-w-[290px]">
          {PLATFORMS.map((platform) => (
            <span
              className="flex h-8 items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-[13px] font-semibold"
              key={platform}
            >
              {platform}
              <Check className="size-3.5 text-success" strokeWidth={2.8} />
            </span>
          ))}
        </div>
        <div className="flex grow flex-col gap-2 rounded-[18px] bg-surface p-4 shadow-card">
          <span className="flex items-center gap-2.5">
            <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-brand text-accent">
              <Store className="size-[18px]" strokeWidth={1.8} />
            </span>
            <span className="text-[15px] font-bold">Tu tienda</span>
          </span>
          <span className="text-[12px] font-bold text-brand">Perfiles de Mercado Libre y Facebook</span>
        </div>
      </div>
    </>
  );
}
