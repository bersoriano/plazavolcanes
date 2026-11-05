import path from "node:path";

import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { POSTS_DIR } from "@/lib/posts";
import { POSTS_ROOT, compilePost, getPost, getPosts } from "@/lib/posts.server";

afterEach(() => vi.unstubAllEnvs());

it("reads from the folder the rest of the code names", () => {
  expect(POSTS_ROOT).toBe(path.join(process.cwd(), POSTS_DIR));
});

/** The format template, kept as a draft on purpose: see content/posts. */
const DRAFT_TEMPLATE = "example-post";

describe("reading posts from disk", () => {
  it("finds a post by slug", async () => {
    expect(await getPost(DRAFT_TEMPLATE)).toMatchObject({ slug: DRAFT_TEMPLATE, draft: true });
  });

  it("answers null for a post that does not exist", async () => {
    expect(await getPost("no-existe")).toBeNull();
  });

  it("never reads outside the posts folder", async () => {
    expect(await getPost("../../package")).toBeNull();
  });

  it("hides drafts in production", async () => {
    vi.stubEnv("NODE_ENV", "production");

    expect(await getPost(DRAFT_TEMPLATE)).toBeNull();
    expect((await getPosts()).map((post) => post.slug)).not.toContain(DRAFT_TEMPLATE);
  });

  it("lists drafts in development", async () => {
    vi.stubEnv("NODE_ENV", "development");

    expect((await getPosts()).map((post) => post.slug)).toContain(DRAFT_TEMPLATE);
  });
});

describe("compilePost", () => {
  const post = (slug: string, body: string) => ({
    slug,
    title: "Guía",
    description: "Corta.",
    date: "2026-10-17",
    draft: false,
    body,
  });

  it("renders Markdown with GFM tables", async () => {
    const Content = await compilePost(post("tabla", "| A |\n| --- |\n| 1 |\n"));

    expect(renderToStaticMarkup(<Content />)).toContain("<table>");
  });

  it("labels footnotes as a visible list of sources in Spanish", async () => {
    const Content = await compilePost(post("notas", "Dato[^1].\n\n[^1]: Origen.\n"));
    const html = renderToStaticMarkup(<Content />);

    expect(html).toContain(">Fuentes</h2>");
    expect(html).not.toContain("sr-only");
    expect(html).toContain("Volver a la referencia 1");
  });

  it("reuses the compiled post in production", async () => {
    vi.stubEnv("NODE_ENV", "production");

    const first = await compilePost(post("una-vez", "Primera versión."));
    const second = await compilePost(post("una-vez", "Segunda versión."));

    expect(second).toBe(first);
  });

  it("recompiles on every request in development, so edits show on reload", async () => {
    vi.stubEnv("NODE_ENV", "development");

    await compilePost(post("en-edicion", "Primera versión."));
    const Content = await compilePost(post("en-edicion", "Segunda versión."));

    expect(renderToStaticMarkup(<Content />)).toContain("Segunda versión.");
  });
});
