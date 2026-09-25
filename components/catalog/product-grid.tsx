import type { ReactNode } from "react";

export function ProductGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-x-3.5 gap-y-7 md:grid-cols-3 md:gap-6 lg:grid-cols-4">{children}</div>;
}
