import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { searchEventSelectionSchema } from "@/lib/validation/search-event";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response(null, { status: 400 });
  }

  const parsed = searchEventSelectionSchema.safeParse(body);
  if (!parsed.success) {
    return new Response(null, { status: 400 });
  }

  if (!isSupabaseConfigured()) {
    return new Response(null, { status: 503 });
  }

  try {
    const supabase = await createServerSupabaseClient();
    const { data: product } = await supabase
      .from("products")
      .select("id, shops!inner(is_publishing_approved)")
      .eq("id", parsed.data.productId)
      .eq("status", "published")
      .eq("is_admin_enabled", true)
      .eq("shops.is_publishing_approved", true)
      .not("expires_at", "is", null)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (!product) {
      return new Response(null, { status: 400 });
    }

    const { error } = await supabase.rpc("record_search_selection", {
      p_event_id: parsed.data.eventId,
      p_product_id: parsed.data.productId,
      p_position: parsed.data.position,
    });

    return new Response(null, { status: error ? 500 : 204 });
  } catch {
    return new Response(null, { status: 500 });
  }
}
