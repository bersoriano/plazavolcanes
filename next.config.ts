import type { NextConfig } from "next";

type RemotePattern = NonNullable<NonNullable<NextConfig["images"]>["remotePatterns"]>[number] & {
  hostname: string;
};

/**
 * Every origin a catalogue photo can come from, for next/image. They are the
 * same variables lib/media/url.ts builds its URLs from, so an image the app
 * can link to is an image it can optimise, and nothing else is.
 */
function mediaPatterns(): RemotePattern[] {
  const bases = [
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_MEDIA_BASE,
    process.env.NEXT_PUBLIC_MEDIA_RESIZE_BASE,
  ];
  const patterns = new Map<string, RemotePattern>();

  for (const base of bases) {
    const text = base?.trim().replace(/\/+$/, "");
    if (!text) continue;
    try {
      const url = new URL(text);
      // No `search` key on purpose: resized renditions carry their size and
      // quality in the query string, and a pattern built from a URL would
      // demand that there be none.
      patterns.set(url.href, {
        protocol: url.protocol.replace(":", "") as "http" | "https",
        hostname: url.hostname,
        port: url.port,
        pathname: `${url.pathname.replace(/\/$/, "")}/**`,
      });
    } catch {
      // A malformed variable breaks media URLs on its own; it should not also
      // take the whole config down.
    }
  }

  return [...patterns.values()];
}

const remotePatterns = mediaPatterns();

// A local Supabase (development, the e2e run) serves from a loopback address,
// which the image optimiser refuses unless told otherwise. Only then.
const localMedia = remotePatterns.some((pattern) =>
  ["127.0.0.1", "localhost", "[::1]"].includes(pattern.hostname),
);

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  experimental: {
    serverActions: {
      bodySizeLimit: "12mb",
    },
  },
  images: {
    remotePatterns,
    ...(localMedia ? { dangerouslyAllowLocalIP: true } : {}),
  },
};

export default nextConfig;
