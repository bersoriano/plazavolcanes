"use client";

import { useId, type ComponentProps } from "react";

import { Input } from "@/components/ui/input";

type FieldProps = ComponentProps<"input"> & {
  label: string;
  error?: string;
  hint?: string;
};

export function Field({ label, error, hint, id, className, "aria-describedby": externalDescription, "aria-invalid": invalid, ...props }: FieldProps) {
  const generatedId = useId();
  const inputId = id ?? props.name ?? generatedId;
  const describedBy = [externalDescription, hint ? `${inputId}-hint` : null, error ? `${inputId}-error` : null].filter(Boolean).join(" ") || undefined;

  return (
    <div className="space-y-2">
      <label className="block text-sm font-semibold text-ink" htmlFor={inputId}>
        {label}
      </label>
      <Input
        aria-describedby={describedBy}
        aria-invalid={error ? true : invalid ?? false}
        className={className}
        id={inputId}
        {...props}
      />
      {hint ? (
        <p className="text-xs leading-5 text-muted" id={`${inputId}-hint`}>
          {hint}
        </p>
      ) : null}
      {error ? (
        <p className="text-sm font-medium text-sale" id={`${inputId}-error`}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
