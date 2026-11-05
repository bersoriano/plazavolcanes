import { Newspaper } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { pageContainer } from "@/components/layout/container";
import { JsonLd } from "@/components/seo/json-ld";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { formatPostDate } from "@/lib/posts";
import { getPosts } from "@/lib/posts.server";
import { BLOG_DESCRIPTION, BLOG_HEADING, buildBlogJsonLd, buildBlogMetadata, postPath } from "@/lib/seo/blog";

export async function generateMetadata(): Promise<Metadata> {
  return buildBlogMetadata(await getPosts());
}

export default async function BlogPage() {
  const posts = await getPosts();

  return (
    <div className={`${pageContainer} py-12 sm:py-16`}>
      <JsonLd data={buildBlogJsonLd(posts)} />
      <div className="mx-auto max-w-[68ch]">
        <h1 className="font-display text-4xl font-semibold tracking-[-0.03em] text-ink">{BLOG_HEADING}</h1>
        <p className="mt-3 leading-7 text-muted">{BLOG_DESCRIPTION}</p>

        {posts.length ? (
          <ol className="mt-10">
            {posts.map((post) => (
              <li className="border-t border-line py-7" key={post.slug}>
                {post.draft ? <Badge className="mb-3">Borrador</Badge> : null}
                <h2 className="font-display text-2xl font-semibold text-ink">
                  <Link className="transition-colors hover:text-brand" href={postPath(post.slug)}>
                    {post.title}
                  </Link>
                </h2>
                <p className="mt-2 leading-7 text-muted">{post.description}</p>
                <time className="mt-2 block text-sm text-muted" dateTime={post.date}>
                  {formatPostDate(post.date)}
                </time>
              </li>
            ))}
          </ol>
        ) : (
          <div className="mt-10">
            <EmptyState
              action={<ButtonLink href="/explorar">Ver productos</ButtonLink>}
              description="Mientras tanto, explora lo que venden las tiendas de la plaza."
              icon={<Newspaper aria-hidden="true" />}
              title="Aún no hay publicaciones"
            />
          </div>
        )}
      </div>
    </div>
  );
}
