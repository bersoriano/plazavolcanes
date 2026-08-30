"use client";

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
      <button className="text-xs font-semibold text-brand" disabled={pending} type="submit">
        {label}
      </button>
      {state.message ? (
        <p
          className={`mt-2 text-xs ${state.status === "error" ? "text-sale" : "text-success"}`}
          role="status"
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
