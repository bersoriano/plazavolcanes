import { describe, expect, it } from "vitest";

import { formatPostDate, isValidSlug, isVisible, parsePost, sortPosts } from "@/lib/posts";

const raw = (front: string, body = "Cuerpo.\n") => `---\n${front}\n---\n\n${body}`;
const BASE = 'title: "Título: con dos puntos"\ndescription: Corta.\ndate: 2026-10-17';

describe("parsePost", () => {
  it("reads the frontmatter and keeps the body", () => {
    expect(parsePost(raw(BASE), "una-guia")).toEqual({
      slug: "una-guia",
      title: "Título: con dos puntos",
      seoTitle: undefined,
      description: "Corta.",
      date: "2026-10-17",
      updated: undefined,
      draft: false,
      body: "\nCuerpo.\n",
    });
  });

  it("accepts a search title, an update date and a draft flag", () => {
    const post = parsePost(raw(`${BASE}\nseoTitle: Corto\nupdated: 2026-10-18\ndraft: true`), "una-guia");

    expect(post).toMatchObject({ seoTitle: "Corto", updated: "2026-10-18", draft: true });
  });

  it.each([
    ["a missing title", "description: x\ndate: 2026-01-02", /title/],
    ["a missing description", "title: x\ndate: 2026-01-02", /description/],
    ["an unreadable date", "title: x\ndescription: x\ndate: 2 de enero", /date/],
    ["an impossible date", "title: x\ndescription: x\ndate: 2026-02-30", /date/],
    ["an empty search title", `${BASE}\nseoTitle: " "`, /seoTitle/],
    ["an update before the date", `${BASE}\nupdated: 2026-10-16`, /updated/],
    ["a draft flag that is not a boolean", `${BASE}\ndraft: "yes"`, /draft/],
  ])("rejects %s, naming the field", (_name, front, field) => {
    expect(() => parsePost(raw(front), "una-guia")).toThrow(field);
  });

  it("names the file when the frontmatter cannot be read", () => {
    expect(() => parsePost("Sin frontmatter", "una-guia")).toThrow("content/posts/una-guia.mdx");
    expect(() => parsePost(raw("title: [sin cerrar"), "una-guia")).toThrow("content/posts/una-guia.mdx");
  });

  it("rejects a slug that is not lowercase words joined by hyphens", () => {
    expect(() => parsePost(raw(BASE), "Mala_Guia")).toThrow(/slug/);
  });
});

describe("isValidSlug", () => {
  it("refuses anything that could leave the posts folder", () => {
    expect(isValidSlug("una-guia-2")).toBe(true);
    expect(isValidSlug("../secreto")).toBe(false);
    expect(isValidSlug("a/b")).toBe(false);
    expect(isValidSlug("")).toBe(false);
  });
});

describe("isVisible", () => {
  it("shows drafts in development only", () => {
    expect(isVisible({ draft: true }, false)).toBe(true);
    expect(isVisible({ draft: true }, true)).toBe(false);
    expect(isVisible({ draft: false }, true)).toBe(true);
  });
});

describe("sortPosts", () => {
  it("puts the newest first and breaks ties by slug", () => {
    const sorted = sortPosts([
      { slug: "vieja", date: "2026-01-01" },
      { slug: "b", date: "2026-02-01" },
      { slug: "a", date: "2026-02-01" },
    ]);

    expect(sorted.map((post) => post.slug)).toEqual(["a", "b", "vieja"]);
  });
});

describe("formatPostDate", () => {
  it("writes the calendar date in Mexican Spanish whatever the server's timezone", () => {
    expect(formatPostDate("2026-10-01")).toBe("1 de octubre de 2026");
  });
});
