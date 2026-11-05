import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { pageContainer } from "@/components/layout/container";
import { JsonLd } from "@/components/seo/json-ld";
import { Badge } from "@/components/ui/badge";
import { formatPostDate } from "@/lib/posts";
import { compilePost, getPost, getPosts } from "@/lib/posts.server";
import { BLOG_PATH, buildPostJsonLd, buildPostMetadata } from "@/lib/seo/blog";
import { SITE_NAME } from "@/lib/seo/home-metadata";

import styles from "../blog.module.css";
import { postComponents } from "../mdx";

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  return (await getPosts()).map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const post = await getPost((await params).slug);
  if (!post) notFound();

  return buildPostMetadata(post);
}

export default async function BlogPostPage({ params }: Props) {
  const post = await getPost((await params).slug);
  if (!post) notFound();

  const Content = await compilePost(post);

  return (
    <div className={`${pageContainer} py-12 sm:py-16`}>
      <JsonLd data={buildPostJsonLd(post)} />
      <div className="mx-auto max-w-[68ch]">
        <nav aria-label="Ruta de navegación" className="flex flex-wrap gap-x-2 text-sm text-muted">
          <Link className="transition-colors hover:text-brand" href="/">
            Inicio
          </Link>
          <span aria-hidden="true">/</span>
          <Link className="transition-colors hover:text-brand" href={BLOG_PATH}>
            Blog
          </Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">{post.title}</span>
        </nav>

        <article className="mt-6">
          <header className="border-b border-line pb-7">
            {post.draft ? <Badge className="mb-3">Borrador</Badge> : null}
            <h1 className="font-display text-4xl font-semibold tracking-[-0.03em] text-ink">{post.title}</h1>
            <p className="mt-3 leading-7 text-muted">{post.description}</p>
            <p className="mt-3 flex flex-wrap gap-x-4 text-sm text-muted">
              <span>Por {SITE_NAME}</span>
              <span>
                Publicado el <time dateTime={post.date}>{formatPostDate(post.date)}</time>
              </span>
              {post.updated && post.updated !== post.date ? (
                <span>
                  Actualizado el <time dateTime={post.updated}>{formatPostDate(post.updated)}</time>
                </span>
              ) : null}
            </p>
          </header>
          <div className={`${styles.prose} mt-8`}>
            <Content components={postComponents} />
          </div>
        </article>
      </div>
    </div>
  );
}
