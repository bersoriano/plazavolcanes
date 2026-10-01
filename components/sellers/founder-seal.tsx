/**
 * The gold "Tienda fundadora" seal, drawn with premium tokens. Decorative
 * wherever it appears: the text beside it, or
 * the card it sits on, already says what it means. `labelled` false keeps the
 * mark alone, for small sizes such as the perk tile.
 */
export function FounderSeal({ className = "", labelled = true }: { className?: string; labelled?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`flex -rotate-10 flex-col items-center justify-center gap-1 rounded-full border-premium-ink bg-premium-gold text-center text-premium-ink shadow-[0_20px_36px_-16px_rgb(0_0_0/0.6)] ${className}`}
    >
      <svg className={labelled ? "w-[26%]" : "w-[46%]"} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} viewBox="0 0 24 24">
        <path d="M2 18 8 9.5l2.5 2.5 3-4.5L22 18" />
      </svg>
      {labelled ? (
        <span className="font-extrabold leading-[1.15] tracking-[0.08em]">
          TIENDA
          <br />
          FUNDADORA
        </span>
      ) : null}
    </span>
  );
}
