"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { setProductStatus } from "@/lib/actions/products";
import { useFormAction } from "@/lib/use-form-action";

export function ProductStatusAction({
  productId,
  nextStatus,
  label,
}: {
  productId: number;
  nextStatus: "draft" | "published";
  label: string;
}) {
  const action = setProductStatus.bind(null, productId, nextStatus);
  const [state, formAction, pending] = useFormAction(action);

  return (
    <form action={formAction}>
      <Button variant="unstyled" className="inline-flex min-h-11 items-center text-xs font-semibold text-brand" disabled={pending} type="submit">
        {label}
      </Button>
      {state.message ? (
        <div
          className={`mt-2 text-xs ${state.status === "error" ? "text-sale" : "text-success"}`}
          role="status"
        >
          <p>{state.message}</p>
          {state.status === "error" && nextStatus === "published" ? (
            <>
              {state.errors ? (
                <ul className="mt-1 list-inside list-disc">
                  {Object.entries(state.errors).flatMap(([field, messages]) => messages.map((message, index) => (
                    <li key={`${field}-${index}`}>{message}</li>
                  )))}
                </ul>
              ) : null}
              <Link className="inline-flex min-h-11 items-center font-semibold underline" href={`/panel/productos/${productId}/editar`}>
                Completar producto
              </Link>
            </>
          ) : null}
        </div>
      ) : null}
    </form>
  );
}
