"use client";

export type ProductActivity = "view" | "question" | "purchase" | "share";
type Session = { id: string; expiresAt: number; sent: ProductActivity[] };
type Recorder = (productId: number, activity: ProductActivity, sessionId: string) => Promise<boolean>;
const SESSION_MS = 30 * 60 * 1000;

/** The token is tab-local, random, short-lived, and never identifies an account. */
export function createProductTracker(productId: number, record: Recorder) {
  const key = `actividad:${productId}`;
  let session: Session | undefined;
  const pending = new Set<string>();
  return async (activity: ProductActivity): Promise<void> => {
    try {
      if (!session || session.expiresAt <= Date.now()) {
        let stored: Session | undefined;
        try {
          const candidate = JSON.parse(sessionStorage.getItem(key) ?? "null") as Session | null;
          if (candidate && typeof candidate.id === "string" && candidate.expiresAt > Date.now() &&
              Array.isArray(candidate.sent)) stored = candidate;
        } catch { /* Storage is optional. */ }
        session = stored ?? { id: crypto.randomUUID(), expiresAt: Date.now() + SESSION_MS, sent: [] };
        // Persist before awaiting the server: StrictMode/remounts must reuse
        // the same token while the first view is still in flight.
        try { sessionStorage.setItem(key, JSON.stringify(session)); } catch { /* Storage is optional. */ }
      }
      if (session.sent.includes(activity)) return;
      const active = session;
      const pendingKey = `${active.id}:${activity}`;
      if (pending.has(pendingKey)) return;
      pending.add(pendingKey);
      try {
        if (await record(productId, activity, active.id)) {
          active.sent.push(activity);
          try { sessionStorage.setItem(key, JSON.stringify(active)); } catch { /* In-memory deduplication still works. */ }
        }
      } finally { pending.delete(pendingKey); }
    } catch { /* Telemetry must never interrupt a buyer's action. */ }
  };
}
