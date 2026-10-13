/** Same shape as an open conversation, so the pane answers the tap at once. */
export default function ThreadLoading() {
  return (
    <div
      aria-busy="true"
      aria-label="Cargando conversación"
      className="flex flex-1 animate-pulse flex-col"
      role="status"
    >
      <div className="border-b border-line px-4 py-3 sm:px-6">
        <div className="h-6 w-40 rounded-full bg-line/60" />
        <div className="mt-2 h-3 w-24 rounded-full bg-line/60" />
        <div className="mt-3 h-18 rounded-2xl bg-line/50" />
      </div>
      <div className="flex-1 space-y-3 px-4 py-5 sm:px-6">
        <div className="h-12 w-2/3 rounded-2xl bg-line/50" />
        <div className="ml-auto h-12 w-1/2 rounded-2xl bg-brand/15" />
        <div className="h-16 w-3/5 rounded-2xl bg-line/50" />
      </div>
    </div>
  );
}
