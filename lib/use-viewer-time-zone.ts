"use client";

import { useSyncExternalStore } from "react";

import { DEFAULT_CATALOG_TIME_ZONE } from "@/lib/catalog-locale";

/** A browser's zone does not change under an open page, so there is nothing to listen to. */
const subscribe = () => () => {};

function browserTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_CATALOG_TIME_ZONE;
}

/**
 * The zone to tell the time in. The server cannot know where the reader is, so
 * it renders the plaza's own clock and the browser corrects it once it takes
 * over; going through the store is what lets the two differ without the
 * hydration mismatch a plain read during render would cause.
 */
export function useViewerTimeZone() {
  return useSyncExternalStore(subscribe, browserTimeZone, () => DEFAULT_CATALOG_TIME_ZONE);
}
