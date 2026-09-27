/**
 * The volcano ridge the founder badge carries, sized by its container. Always
 * decorative: the badge's words name it.
 */
export function FounderMark({ className = "size-3" }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.4} viewBox="0 0 24 24">
      <path d="M2 18 8 9.5l2.5 2.5 3-4.5L22 18" />
    </svg>
  );
}
