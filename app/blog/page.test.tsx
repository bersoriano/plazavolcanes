import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import BlogPage, { generateMetadata } from "@/app/blog/page";
import type { Post } from "@/lib/posts";
import { getPosts } from "@/lib/posts.server";

vi.mock("@/lib/posts.server", () => ({ getPosts: vi.fn() }));

afterEach(cleanup);

const post: Post = {
  slug: "como-fijar-precios",
  title: "Cómo fijar precios",
  description: "Una guía corta.",
  date: "2026-10-01",
  draft: false,
  body: "",
};

describe("/blog", () => {
  it("lists each post with its link, description and date under one h1", async () => {
    vi.mocked(getPosts).mockResolvedValue([post]);
    render(await BlogPage());

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("link", { name: post.title })).toHaveAttribute("href", "/blog/como-fijar-precios");
    expect(screen.getByText(post.description)).toBeInTheDocument();
    expect(screen.getByText("1 de octubre de 2026").closest("time")).toHaveAttribute("dateTime", "2026-10-01");
  });

  it("marks a draft, which only development lists", async () => {
    vi.mocked(getPosts).mockResolvedValue([{ ...post, draft: true }]);
    render(await BlogPage());

    expect(within(screen.getByRole("listitem")).getByText("Borrador")).toBeInTheDocument();
  });

  it("sends the reader to the catalogue while there is nothing to read", async () => {
    vi.mocked(getPosts).mockResolvedValue([]);
    render(await BlogPage());

    expect(screen.getByText("Aún no hay publicaciones")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver productos" })).toHaveAttribute("href", "/explorar");
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("describes the blog in its structured data", async () => {
    vi.mocked(getPosts).mockResolvedValue([post]);
    render(await BlogPage());

    const script = document.querySelector('script[type="application/ld+json"]');
    const types = JSON.parse(script?.textContent ?? "")["@graph"].map((node: { "@type": string }) => node["@type"]);

    expect(types).toContain("Blog");
  });

  it("stays out of the index while it is empty", async () => {
    vi.mocked(getPosts).mockResolvedValue([]);

    expect((await generateMetadata()).robots).toEqual({ index: false, follow: true });
  });
});
