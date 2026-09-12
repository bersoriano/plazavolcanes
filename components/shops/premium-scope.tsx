import type { ReactNode } from "react";

/**
 * The room a distinguished shop is shown in.
 *
 * Every component below already draws its colour from tokens, so the whole
 * subtree turns obsidian and gold the moment those tokens are redefined. An
 * ordinary shop is left unwrapped rather than given a second, identical
 * wrapper, so nothing about its markup changes.
 */
export function PremiumScope({
  premium,
  children,
  className = "",
}: {
  premium: boolean;
  children: ReactNode;
  className?: string;
}) {
  if (!premium) return <>{children}</>;

  return (
    <div className={`bg-background text-ink ${className}`.trim()} data-theme="premium">
      {children}
    </div>
  );
}
