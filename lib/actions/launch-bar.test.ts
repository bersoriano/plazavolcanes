import { cookies } from "next/headers";
import { describe, expect, it, vi } from "vitest";

import { dismissLaunchBar } from "@/lib/actions/launch-bar";
import { LAUNCH_BAR_DISMISS_COOKIE, LAUNCH_BAR_DISMISS_DAYS } from "@/lib/launch-bar";

const set = vi.fn();

vi.mock("next/headers", () => ({ cookies: vi.fn(async () => ({ set })) }));

describe("dismissLaunchBar", () => {
  it("remembers the dismissal for a month, and nothing else", async () => {
    await dismissLaunchBar();

    expect(vi.mocked(cookies)).toHaveBeenCalled();
    expect(set).toHaveBeenCalledWith(LAUNCH_BAR_DISMISS_COOKIE, "1", {
      httpOnly: true,
      maxAge: LAUNCH_BAR_DISMISS_DAYS * 24 * 60 * 60,
      path: "/",
      sameSite: "lax",
      secure: false,
    });
    expect(LAUNCH_BAR_DISMISS_DAYS).toBe(30);
  });
});
