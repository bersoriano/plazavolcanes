import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getSupabaseConfig,
  isSupabaseConfigured,
} from "@/lib/supabase/config";

describe("isSupabaseConfigured", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns false when credentials are missing", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");

    expect(isSupabaseConfigured()).toBe(false);
  });

  it("returns false for example credentials", () => {
    vi.stubEnv(
      "NEXT_PUBLIC_SUPABASE_URL",
      "https://your-project.supabase.co",
    );
    vi.stubEnv(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      "sb_publishable_your-key",
    );

    expect(isSupabaseConfigured()).toBe(false);
  });

  it("returns true for configured public credentials", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://abc.supabase.co");
    vi.stubEnv(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      "sb_publishable_live",
    );

    expect(isSupabaseConfigured()).toBe(true);
  });

  it("returns trimmed public credentials", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", " https://abc.supabase.co ");
    vi.stubEnv(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      " sb_publishable_live ",
    );

    expect(getSupabaseConfig()).toEqual({
      url: "https://abc.supabase.co",
      publishableKey: "sb_publishable_live",
    });
  });

  it("throws a Spanish setup error when credentials are absent", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");

    expect(() => getSupabaseConfig()).toThrow(
      "Configura las variables públicas de Supabase",
    );
  });
});
