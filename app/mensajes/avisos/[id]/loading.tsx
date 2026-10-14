/** Same shape as an open notice, so the pane answers the tap at once. */
export default function NoticeLoading() {
  return (
    <div
      aria-busy="true"
      aria-label="Cargando aviso"
      className="flex flex-1 animate-pulse flex-col"
      role="status"
    >
      <div className="border-b border-line px-4 py-3 sm:px-6">
        <div className="h-6 w-40 rounded-full bg-line/60" />
        <div className="mt-2 h-3 w-24 rounded-full bg-line/60" />
      </div>
      <div className="flex-1 space-y-3 px-4 py-6 sm:px-6">
        <div className="h-8 w-2/3 rounded-2xl bg-line/60" />
        <div className="h-4 w-32 rounded-full bg-line/50" />
        <div className="h-16 w-3/5 rounded-2xl bg-line/50" />
      </div>
    </div>
  );
}
