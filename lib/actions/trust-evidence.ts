"use server";

import { revalidatePath } from "next/cache";

import type { ActionState } from "@/lib/action-state";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { disputeResponseSchema, disputeSchema, resolutionSchema, reviewSchema } from "@/lib/validation/trust-evidence";

async function client() {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.auth.getClaims();
  return data?.claims?.sub ? supabase : null;
}

export async function createReview(orderId: number, _state: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = reviewSchema.safeParse({ rating: formData.get("rating"), matched_description: formData.get("matched_description"), comment: formData.get("comment") });
  if (!parsed.success) return { status: "error", message: "Revisa tu reseña.", errors: parsed.error.flatten().fieldErrors };
  const supabase = await client();
  if (!supabase) return { status: "error", message: "Tu sesión terminó." };
  const { error } = await supabase.rpc("create_order_review", { p_order_id: orderId, p_rating: parsed.data.rating, p_matched_description: parsed.data.matched_description, p_comment: parsed.data.comment });
  if (error) return { status: "error", message: error.code === "23505" ? "Este pedido ya tiene reseña." : "No pudimos guardar la reseña." };
  revalidatePath(`/compras/${orderId}`);
  return { status: "success", message: "Reseña guardada." };
}

export async function openDispute(orderId: number, _state: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = disputeSchema.safeParse({ reason: formData.get("reason"), statement: formData.get("statement") });
  if (!parsed.success) return { status: "error", message: "Revisa los datos de la disputa.", errors: parsed.error.flatten().fieldErrors };
  const supabase = await client();
  if (!supabase) return { status: "error", message: "Tu sesión terminó." };
  const { error } = await supabase.rpc("open_order_dispute", { p_order_id: orderId, p_reason: parsed.data.reason, p_statement: parsed.data.statement, p_evidence: [] });
  if (error) return { status: "error", message: error.code === "23505" ? "Este pedido ya tiene una disputa." : "No pudimos abrir la disputa." };
  revalidatePath(`/compras/${orderId}`);
  revalidatePath(`/panel/pedidos/${orderId}`);
  return { status: "success", message: "Disputa enviada a revisión." };
}

export async function respondToDispute(disputeId: number, orderId: number, _state: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = disputeResponseSchema.safeParse({ response: formData.get("response") });
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Respuesta inválida." };
  const supabase = await client();
  if (!supabase) return { status: "error", message: "Tu sesión terminó." };
  const { error } = await supabase.rpc("respond_to_dispute", { p_dispute_id: disputeId, p_response: parsed.data.response, p_evidence: [] });
  if (error) return { status: "error", message: "No pudimos guardar la respuesta." };
  revalidatePath(`/panel/pedidos/${orderId}`);
  revalidatePath(`/admin/disputas`);
  return { status: "success", message: "Respuesta enviada." };
}

export async function resolveDispute(disputeId: number, _state: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = resolutionSchema.safeParse({ resolution: formData.get("resolution"), seller_fault: formData.get("seller_fault"), notes: formData.get("notes") });
  if (!parsed.success) return { status: "error", message: "Documenta una resolución válida.", errors: parsed.error.flatten().fieldErrors };
  const supabase = await client();
  if (!supabase) return { status: "error", message: "Tu sesión terminó." };
  const { error } = await supabase.rpc("resolve_order_dispute", { p_dispute_id: disputeId, p_resolution: parsed.data.resolution, p_seller_fault: parsed.data.seller_fault, p_notes: parsed.data.notes });
  if (error) return { status: "error", message: "No pudimos resolver la disputa." };
  revalidatePath("/admin/disputas");
  return { status: "success", message: "Disputa resuelta." };
}
