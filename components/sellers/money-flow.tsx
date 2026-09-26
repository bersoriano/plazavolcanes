import { Store, UserRound } from "lucide-react";

const FLOW_SUMMARY =
  "Diagrama: tu cliente te paga $1,999.00 directo a tu tienda, con el método que acuerden; Plaza Volcanes recibe $0.00.";

/**
 * The payment going straight from the customer to the store, with Plaza
 * Volcanes' $0.00 tagged on top. It names no payment method: which one is
 * the buyer and the seller's agreement, not the plaza's.
 */
export function MoneyFlow() {
  return (
    <>
      <p className="sr-only">{FLOW_SUMMARY}</p>
      <div
        aria-hidden="true"
        className="relative mt-auto flex h-[150px] items-center justify-between rounded-[20px] bg-background px-4 pt-6 lg:h-[170px] lg:rounded-[24px] lg:px-7"
      >
        <span className="absolute left-1/2 top-3 flex h-7 -translate-x-1/2 -rotate-3 items-center whitespace-nowrap rounded-full bg-brand px-3 text-[12px] font-bold text-accent">
          Plaza Volcanes: $0.00
        </span>
        <Party className="bg-lilac-tint" icon={<UserRound className="size-6 lg:size-7" strokeWidth={1.8} />} label="Tu cliente" />
        <span className="flex grow flex-col items-center gap-1.5 px-3 lg:px-4">
          <span className="font-display text-[20px] font-bold text-brand lg:text-[26px]">$1,999.00</span>
          <span className="relative h-1 w-full rounded-full bg-brand">
            <span className="absolute -right-1.5 -top-1.5 size-0 border-y-8 border-l-12 border-y-transparent border-l-brand" />
          </span>
          <span className="text-center text-[11px] font-semibold text-muted lg:text-[12px]">Con el método que acuerden</span>
        </span>
        <Party className="bg-accent" icon={<Store className="size-6 lg:size-7" strokeWidth={1.8} />} label="Tu tienda" />
      </div>
    </>
  );
}

function Party({ icon, label, className }: { icon: React.ReactNode; label: string; className: string }) {
  return (
    <span className="flex shrink-0 flex-col items-center gap-2">
      <span className={`grid size-12 place-items-center rounded-full text-brand lg:size-16 ${className}`}>{icon}</span>
      <span className="text-[13px] font-bold lg:text-[14px]">{label}</span>
    </span>
  );
}
