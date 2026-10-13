/**
 * Where the inbox sits on the page, in one place.
 *
 * It lives under the signed-in site header, which is sticky and 76px tall with
 * a 1px rule (components/layout/site-header.tsx). On a phone it also lives
 * above the quick access bar: 4.5rem, a 1px rule and the home indicator's
 * inset, the same amount app/layout.tsx pads <main> by. Change either of those
 * and these follow.
 */

/** From `lg`, one frame as tall as the window under the header, less its margins. */
export const INBOX_FRAME_HEIGHT = "lg:h-[calc(100dvh-77px-3rem)] lg:min-h-[32rem]";

/** On a phone the open thread fills the window between the header and the bar. */
export const THREAD_MIN_HEIGHT =
  "min-h-[calc(100dvh-77px-4.5rem-1px-env(safe-area-inset-bottom))] md:min-h-[calc(100dvh-77px)] lg:min-h-0";

/** Holds the thread's heading under the site header while the page scrolls. */
export const STICK_UNDER_HEADER = "sticky top-[77px] z-10 lg:static";

/** Holds the composer above the quick access bar while the page scrolls. */
export const STICK_ABOVE_BAR =
  "sticky bottom-[calc(4.5rem+1px+env(safe-area-inset-bottom))] md:bottom-0 lg:static";
