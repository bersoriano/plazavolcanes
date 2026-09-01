"use client";

import { MEDIA_BUCKET } from "@/lib/media/keys";
import type { UploadTicket } from "@/lib/actions/media";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

/**
 * Sends the chosen pictures straight to storage, one ticket each.
 *
 * Nothing is decoded and nothing passes through the application, so a phone
 * photo costs the browser only what it costs to read the file off disk.
 */
export async function uploadWithTickets(tickets: readonly UploadTicket[], files: readonly File[]) {
  const supabase = createBrowserSupabaseClient();
  const uploaded: string[] = [];

  for (const [index, ticket] of tickets.entries()) {
    const file = files[index];
    if (!file) break;

    const { error } = await supabase.storage
      .from(MEDIA_BUCKET)
      .uploadToSignedUrl(ticket.key, ticket.token, file, { contentType: file.type });

    if (error) return { error: "No pudimos subir las imágenes.", keys: uploaded };
    uploaded.push(ticket.key);
  }

  return { error: null, keys: uploaded };
}
