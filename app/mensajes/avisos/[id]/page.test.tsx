import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import NoticePage from "@/app/mensajes/avisos/[id]/page";
import { fetchPlatformNotice } from "@/lib/queries/platform-notices.server";

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NOT_FOUND");
  }),
}));
vi.mock("@/lib/queries/platform-notices.server", () => ({ fetchPlatformNotice: vi.fn() }));
// The view has its own suite; here it only reports what the page handed it.
vi.mock("@/components/messages/notice-view", () => ({
  NoticeView: ({ notice }: { notice: { title: string } }) => <p>aviso: {notice.title}</p>,
}));

const notice = {
  id: 12,
  kind: "announcement" as const,
  title: "Mantenimiento",
  body: "El sábado por la noche.",
  action: null,
  created_at: "2026-10-12T16:42:00Z",
  read_at: null,
};

beforeEach(() => {
  vi.mocked(fetchPlatformNotice).mockResolvedValue(notice);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("notice page", () => {
  it("shows the caller's notice", async () => {
    render(await NoticePage({ params: Promise.resolve({ id: "12" }) }));

    expect(fetchPlatformNotice).toHaveBeenCalledWith(12);
    expect(screen.getByText("aviso: Mantenimiento")).toBeInTheDocument();
  });

  it("reads a notice that is missing, retracted or somebody else's as not found", async () => {
    vi.mocked(fetchPlatformNotice).mockResolvedValue(null);

    await expect(NoticePage({ params: Promise.resolve({ id: "12" }) })).rejects.toThrow("NOT_FOUND");
  });

  it("reads an address that is not a notice number as not found", async () => {
    await expect(NoticePage({ params: Promise.resolve({ id: "abc" }) })).rejects.toThrow("NOT_FOUND");
    expect(fetchPlatformNotice).not.toHaveBeenCalled();
  });
});
