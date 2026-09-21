import { Check, Star, Store } from "lucide-react";

/**
 * Text only, never a logo: the marketplaces named here are not partners, and a
 * borrowed wordmark would imply an endorsement none of them have given.
 */
const PLATFORMS = ["Mercado Libre", "Facebook Marketplace", "Amazon", "Etsy", "Instagram"];

const FLOW_SUMMARY =
  "Diagrama: las calificaciones que ya tienes en Mercado Libre, Facebook Marketplace, Amazon, Etsy e Instagram llegan a tu tienda de Plaza Volcanes.";

/** The five dashed strands, drawn in the 608×300 box the desktop diagram uses. */
const CONNECTORS = [
  "M234 44C300 44 296 150 364 150",
  "M234 96C300 96 300 150 364 150",
  "M234 148C300 148 300 150 364 150",
  "M234 200C300 200 300 150 364 150",
  "M234 252C300 252 296 150 364 150",
];

function StoreCard({ compact }: { compact?: boolean }) {
  return (
    <div
      className={
        compact
          ? "flex flex-col gap-3 self-stretch rounded-[1.125rem] border border-line bg-surface p-4 shadow-[0_20px_40px_-24px_rgba(50,23,77,0.4)]"
          : "absolute left-[364px] top-[95px] flex w-[220px] flex-col gap-3 rounded-[1.25rem] border border-line bg-surface p-[18px] shadow-[0_24px_44px_-24px_rgba(50,23,77,0.4)]"
      }
    >
      <div className="flex items-center gap-3">
        <span
          className={`grid shrink-0 place-items-center rounded-xl bg-brand text-accent ${compact ? "size-[42px]" : "size-11"}`}
        >
          <Store className={compact ? "size-5" : "size-[22px]"} strokeWidth={1.8} />
        </span>
        <span className="flex flex-col gap-0.5">
          <span className={`font-display font-bold ${compact ? "text-[17px]" : "text-[18px]"}`}>
            Tu tienda
          </span>
          <span className="text-[13px] text-muted">Ciudad de México</span>
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span className="flex gap-0.5 text-brand">
          {Array.from({ length: 5 }, (_, index) => (
            <Star className="size-3.5" fill="currentColor" key={index} strokeWidth={0} />
          ))}
        </span>
        <span className="text-[12px] font-semibold text-muted">Reputación importada</span>
      </div>
    </div>
  );
}

export function ReputationFlow() {
  return (
    <>
      <p className="sr-only">{FLOW_SUMMARY}</p>

      {/* Below xl the 608px diagram is wider than the card that holds it, so the
          strands become one downward arrow and the chips wrap above it. */}
      <div
        aria-hidden="true"
        className="mt-1.5 flex flex-col items-center gap-3 rounded-[1.25rem] bg-background px-4 py-5 xl:hidden"
      >
        <div className="flex flex-wrap justify-center gap-2">
          {PLATFORMS.map((platform) => (
            <span
              className="flex h-[34px] items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-[13px] font-semibold"
              key={platform}
            >
              {platform}
              <Check className="size-3.5 text-success" strokeWidth={2.8} />
            </span>
          ))}
        </div>
        <svg className="h-9 w-6" fill="none" viewBox="0 0 24 36">
          <path
            className="text-brand/45"
            d="M12 2v28M5 23l7 7 7-7"
            stroke="currentColor"
            strokeDasharray="3 4"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.8"
          />
        </svg>
        <StoreCard compact />
      </div>

      <div
        aria-hidden="true"
        className="relative hidden h-[300px] w-[608px] shrink-0 rounded-[1.5rem] bg-background xl:block"
      >
        <svg className="absolute inset-0 text-brand/30" fill="none" height="300" viewBox="0 0 608 300" width="608">
          <g stroke="currentColor" strokeDasharray="4 5" strokeWidth="1.5">
            {CONNECTORS.map((path) => (
              <path d={path} key={path} />
            ))}
          </g>
        </svg>
        <div className="absolute left-6 top-6 flex w-[210px] flex-col gap-3">
          {PLATFORMS.map((platform) => (
            <span
              className="flex h-10 items-center justify-between rounded-full border border-line bg-surface px-3.5 text-[14px] font-semibold"
              key={platform}
            >
              {platform}
              <Check className="size-4 text-success" strokeWidth={2.6} />
            </span>
          ))}
        </div>
        <StoreCard />
      </div>
    </>
  );
}
