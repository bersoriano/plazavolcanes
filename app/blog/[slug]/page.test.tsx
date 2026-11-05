import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import BlogPostPage, { generateMetadata, generateStaticParams } from "@/app/blog/[slug]/page";
import type { Post } from "@/lib/posts";
import { getPost, getPosts } from "@/lib/posts.server";

// Only the disk is replaced: the post's real MDX compiles with the real components.
vi.mock("@/lib/posts.server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/posts.server")>()),
  getPost: vi.fn(),
  getPosts: vi.fn(),
}));

const notFoundError = new Error("NEXT_NOT_FOUND");
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw notFoundError;
  },
}));

afterEach(cleanup);

const post: Post = {
  slug: "como-fijar-precios",
  title: "Cómo fijar precios",
  description: "Una guía corta.",
  date: "2026-10-01",
  draft: false,
  body: "",
};
const params = (slug = post.slug) => Promise.resolve({ slug });

async function renderPost(overrides: Partial<Post> = {}) {
  vi.mocked(getPost).mockResolvedValue({ ...post, ...overrides });
  render(await BlogPostPage({ params: params() }));
}

describe("/blog/[slug]", () => {
  it("renders the title as the only h1, with the description and date above the body", async () => {
    await renderPost({ body: "## Una sección\n\nUn párrafo." });

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(post.title);
    expect(screen.getByText(post.description)).toBeInTheDocument();
    expect(screen.getByText("1 de octubre de 2026").closest("time")).toHaveAttribute("dateTime", "2026-10-01");
    expect(screen.getByRole("heading", { level: 2, name: "Una sección" })).toBeInTheDocument();
  });

  it("shows the update date only when the post changed after publishing", async () => {
    await renderPost({ updated: "2026-10-05" });
    expect(screen.getByText("5 de octubre de 2026")).toBeInTheDocument();
    cleanup();

    await renderPost({ updated: post.date });
    expect(screen.queryByText(/Actualizado/)).not.toBeInTheDocument();
  });

  it("gives the way back through the blog", async () => {
    await renderPost();

    const trail = screen.getByRole("navigation", { name: "Ruta de navegación" });
    expect(within(trail).getByRole("link", { name: "Inicio" })).toHaveAttribute("href", "/");
    expect(within(trail).getByRole("link", { name: "Blog" })).toHaveAttribute("href", "/blog");
  });

  it("marks a draft", async () => {
    await renderPost({ draft: true });

    expect(screen.getByText("Borrador")).toBeInTheDocument();
  });

  it("describes the post in its structured data", async () => {
    await renderPost();

    const script = document.querySelector('script[type="application/ld+json"]');
    const types = JSON.parse(script?.textContent ?? "")["@graph"].map((node: { "@type": string }) => node["@type"]);

    expect(types).toContain("BlogPosting");
  });

  it("answers not found for a missing post", async () => {
    vi.mocked(getPost).mockResolvedValue(null);

    await expect(BlogPostPage({ params: params("no-existe") })).rejects.toBe(notFoundError);
    await expect(generateMetadata({ params: params("no-existe") })).rejects.toBe(notFoundError);
  });

  it("builds a page for every listed post", async () => {
    vi.mocked(getPosts).mockResolvedValue([post]);

    expect(await generateStaticParams()).toEqual([{ slug: post.slug }]);
  });
});

describe("post markup", () => {
  it("opens outside links safely and keeps site links on the site", async () => {
    await renderPost({ body: "[fuera](https://example.com) y [dentro](/vender) y [correo](mailto:a@b.mx)" });

    expect(screen.getByRole("link", { name: "fuera" })).toHaveAttribute("rel", "noopener noreferrer");
    expect(screen.getByRole("link", { name: "dentro" })).toHaveAttribute("href", "/vender");
    expect(screen.getByRole("link", { name: "dentro" })).not.toHaveAttribute("rel");
    expect(screen.getByRole("link", { name: "correo" })).toHaveAttribute("href", "mailto:a@b.mx");
  });

  it("lazy-loads images and keeps their alt text", async () => {
    await renderPost({ body: "![Un puesto](/blog/foto.jpg)" });

    expect(screen.getByRole("img", { name: "Un puesto" })).toHaveAttribute("loading", "lazy");
  });

  it("boxes a key takeaway under its label", async () => {
    await renderPost({ body: "<Takeaway>\nLo que importa.\n</Takeaway>" });

    const note = screen.getByRole("note");
    expect(within(note).getByText("Punto clave")).toBeInTheDocument();
    expect(within(note).getByText("Lo que importa.")).toBeInTheDocument();
  });

  it("wraps a table so a wide one scrolls on its own", async () => {
    await renderPost({ body: "| A |\n| --- |\n| 1 |\n" });

    expect(screen.getByRole("table").parentElement?.tagName).toBe("DIV");
    expect(screen.getByRole("table").parentElement?.className).toMatch(/tableWrap/);
  });
});
