import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { searchEventSelectionSchema } from "@/lib/validation/search-event";

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return new Response(null, { status: 503 });
  }

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

  try {
    const supabase = await createServerSupabaseClient();
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
