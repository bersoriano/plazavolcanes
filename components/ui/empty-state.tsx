import type { ReactNode } from "react";

type EmptyStateProps = {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
};

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="col-span-full flex min-h-72 flex-col items-center justify-center rounded-[2rem] border border-dashed border-line bg-surface px-6 text-center">
      <div className="mb-4 grid size-14 place-items-center rounded-2xl bg-accent text-brand">{icon}</div>
      <h3 className="font-display text-2xl font-semibold tracking-[-0.02em] text-ink">{title}</h3>
      <p className="mt-2 max-w-md leading-7 text-muted">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
