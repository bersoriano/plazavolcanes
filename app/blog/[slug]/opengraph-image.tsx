import { notFound } from "next/navigation";
import { ImageResponse } from "next/og";

import { getPost } from "@/lib/posts.server";

// A shared post previews its own title on the same brand card as the root image.
export const alt = "Publicación del blog de Plaza Volcanes";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const BRAND = "#32174d";
const ACCENT = "#b8ff6a";

export default async function PostOpengraphImage({ params }: { params: Promise<{ slug: string }> }) {
  const post = await getPost((await params).slug);
  if (!post) notFound();

  return new ImageResponse(
    (
      <div
        style={{
          background: BRAND,
          color: "white",
          display: "flex",
          flexDirection: "column",
          height: "100%",
          justifyContent: "space-between",
          padding: "72px 80px",
          width: "100%",
        }}
      >
        <div style={{ alignItems: "center", display: "flex", fontSize: 30, fontWeight: 700, gap: 16, letterSpacing: 4 }}>
          <div style={{ background: ACCENT, borderRadius: 999, height: 18, width: 18 }} />
          PLAZA VOLCANES · BLOG
        </div>
        <div style={{ display: "flex", fontSize: post.title.length > 60 ? 60 : 76, fontWeight: 700, lineHeight: 1.08 }}>
          {post.title}
        </div>
        <div style={{ color: "rgba(255,255,255,0.7)", display: "flex", fontSize: 26 }}>plazavolcanes.com</div>
      </div>
    ),
    size,
  );
}
