import { llmsText } from "@/lib/seo/llms-text";

// Nothing here changes between requests: the numbers come from lib/launch and
// the host from the build's environment, the same as robots.txt.
export const dynamic = "force-static";

export function GET() {
  return new Response(llmsText(), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
