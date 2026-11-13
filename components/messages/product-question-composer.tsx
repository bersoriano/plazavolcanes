"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import type { ActionState } from "@/lib/action-state";
import { useFormAction } from "@/lib/use-form-action";

export function ProductQuestionComposer({ action, productId, productPath, resume, sellerName, signedIn }: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  productId: number;
  productPath: string;
  resume: boolean;
  sellerName: string;
  signedIn: boolean;
}) {
  const router = useRouter();
  const storageKey = `pregunta:producto:${productId}`;
  const [open, setOpen] = useState(resume);
  const [body, setBody] = useState("");
  const [idempotencyKey, setIdempotencyKey] = useState("");
  const [state, formAction, pending] = useFormAction(action);

  useEffect(() => {
    let saved: { body?: string; key?: string } | null = null;
    try {
      saved = JSON.parse(localStorage.getItem(storageKey) ?? "null") as { body?: string; key?: string } | null;
    } catch { /* Ignore invalid browser storage. */ }
    const frame = requestAnimationFrame(() => {
      if (saved?.body) setBody(saved.body);
      setIdempotencyKey(saved?.key ?? crypto.randomUUID());
    });
    return () => cancelAnimationFrame(frame);
  }, [storageKey]);

  useEffect(() => {
    if (state.status !== "success" || !state.conversationId) return;
    localStorage.removeItem(storageKey);
    router.push(`/mensajes/${state.conversationId}`);
  }, [router, state, storageKey]);

  function save(value: string) {
    setBody(value);
    try { localStorage.setItem(storageKey, JSON.stringify({ body: value, key: idempotencyKey })); } catch { /* Browser storage may be unavailable. */ }
  }

  return (
    <div className="w-full">
      <Button variant="unstyled" className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line bg-surface px-5 text-sm font-semibold text-brand hover:border-brand" data-product-cta="question" onClick={() => setOpen((current) => !current)} type="button">
        <MessageCircle aria-hidden="true" className="size-4" />
        Preguntar por este producto
      </Button>
      {open ? (
        <section aria-label="Tu pregunta para la tienda" className="mt-4 rounded-2xl border border-line bg-surface p-4">
          <p className="font-semibold text-ink">Pregunta para {sellerName}</p>
          <p className="mt-1 text-sm text-muted">Escribe tu duda. Podrás revisarla antes de enviarla.</p>
          <form action={formAction} className="mt-3 space-y-3" onSubmit={() => save(body)}>
            <label className="sr-only" htmlFor="product-question">Tu pregunta</label>
            <Textarea className="min-h-28 w-full bg-background p-3 text-base" id="product-question" maxLength={2000} name="body" onChange={(event) => save(event.target.value)} placeholder="¿Podrías contarme más sobre el estado del producto?" required value={body} />
            <input name="idempotency_key" type="hidden" value={idempotencyKey} />
            {state.status === "error" ? <p className="text-sm text-sale" role="status">{state.message}</p> : null}
            {signedIn ? (
              <Button disabled={pending || !body.trim() || !idempotencyKey} type="submit">{pending ? "Enviando…" : "Enviar pregunta"}</Button>
            ) : (
              <Link className="inline-flex min-h-11 items-center rounded-full bg-brand px-5 py-2 font-semibold text-white" href={`/ingresar?continuar=${encodeURIComponent(`${productPath}?pregunta=1`)}`} onClick={() => save(body)}>Ingresa para enviar tu pregunta</Link>
            )}
          </form>
        </section>
      ) : null}
    </div>
  );
}
