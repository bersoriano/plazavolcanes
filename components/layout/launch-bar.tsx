import { cookies } from "next/headers";

import { LaunchBarFrame } from "@/components/layout/launch-bar-frame";
import { dismissLaunchBar } from "@/lib/actions/launch-bar";
import { FOUNDERS_CAP, resolveFoundersProgress } from "@/lib/launch";
import { LAUNCH_BAR_DISMISS_COOKIE } from "@/lib/launch-bar";
import { viewerOwnsAnyShop } from "@/lib/queries/seller-standing.server";

/**
 * The launch promotion, one line above the header.
 *
 * Nothing feeds `spotsTaken` yet: until the launch window and the qualifying
 * rule are settled the bar names the cap and leaves the tally out rather than
 * printing a number nobody could check. Pass a count here and the "Quedan …"
 * clause appears, and a full house takes the bar down.
 *
 * The dismissal is read here, on the server, so a browser that has already put
 * the bar away never receives it. The route test lives in the frame, which is
 * the one thing that needs to know where the visitor is.
 */
export async function LaunchBar({ spotsTaken }: { spotsTaken?: number | null } = {}) {
  const [cookieStore, ownsShop] = await Promise.all([cookies(), viewerOwnsAnyShop()]);

  if (ownsShop) return null;
  if (cookieStore.get(LAUNCH_BAR_DISMISS_COOKIE)) return null;

  const progress = resolveFoundersProgress(spotsTaken);
  // A full house has nothing left to offer, so the bar stops asking.
  if (progress?.left === 0) return null;

  return (
    <LaunchBarFrame
      cap={FOUNDERS_CAP}
      dismissAction={dismissLaunchBar}
      spotsLeft={progress?.left ?? null}
    />
  );
}
