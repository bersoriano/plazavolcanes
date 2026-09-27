import { cookies } from "next/headers";

import { LaunchBarFrame } from "@/components/layout/launch-bar-frame";
import { dismissLaunchBar } from "@/lib/actions/launch-bar";
import { FOUNDERS_CAP, resolveFoundersProgress } from "@/lib/launch";
import { LAUNCH_BAR_DISMISS_COOKIE } from "@/lib/launch-bar";
import { getFoundersProgram } from "@/lib/queries/founders.server";
import { viewerOwnsAnyShop } from "@/lib/queries/seller-standing.server";

/**
 * The launch promotion, one line above the header.
 *
 * The founders status says whether the promotion is still open and how many
 * spots are taken. Without a trustworthy count the bar names the cap and
 * leaves the tally out; with one the "Quedan …" clause appears. A closed
 * promotion or a full house takes the bar down.
 *
 * The dismissal is read here, on the server, so a browser that has already put
 * the bar away never receives it. The route test lives in the frame, which is
 * the one thing that needs to know where the visitor is.
 */
export async function LaunchBar() {
  const [cookieStore, ownsShop, founders] = await Promise.all([
    cookies(),
    viewerOwnsAnyShop(),
    getFoundersProgram(),
  ]);

  if (!founders.open) return null;
  if (ownsShop) return null;
  if (cookieStore.get(LAUNCH_BAR_DISMISS_COOKIE)) return null;

  const progress = resolveFoundersProgress(founders.taken);
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
