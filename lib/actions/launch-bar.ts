"use server";

import { cookies } from "next/headers";

import { LAUNCH_BAR_DISMISS_COOKIE, LAUNCH_BAR_DISMISS_DAYS } from "@/lib/launch-bar";

/**
 * Puts the launch bar away for a month.
 *
 * A Server Function, because `cookies().set` is only legal in one of those or
 * a Route Handler — and because a plain form means the cookie is written
 * before the next render, so the bar is simply absent rather than painted and
 * then removed. It carries no session and no personal data: one flag saying
 * this browser has read the notice.
 */
export async function dismissLaunchBar() {
  const cookieStore = await cookies();

  cookieStore.set(LAUNCH_BAR_DISMISS_COOKIE, "1", {
    httpOnly: true,
    maxAge: LAUNCH_BAR_DISMISS_DAYS * 24 * 60 * 60,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}
