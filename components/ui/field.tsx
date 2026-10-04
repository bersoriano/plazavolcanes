import type { InputHTMLAttributes } from "react";

type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
  hint?: string;
};

export function Field({ label, error, hint, id, className = "", ...props }: FieldProps) {
  const inputId = id ?? props.name;
  const describedBy = [hint ? `${inputId}-hint` : null, error ? `${inputId}-error` : null].filter(Boolean).join(" ") || undefined;

  return (
    <div className="space-y-2">
      <label className="block text-sm font-semibold text-ink" htmlFor={inputId}>
        {label}
      </label>
      <input
        aria-describedby={describedBy}
        aria-invalid={Boolean(error)}
        className={`min-h-12 w-full rounded-2xl border border-line bg-surface px-4 text-ink placeholder:text-muted/70 focus:border-brand focus:outline-none ${className}`}
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
