import type { InputHTMLAttributes } from "react";

type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
};

export function Field({ label, error, id, className = "", ...props }: FieldProps) {
  const inputId = id ?? props.name;

  return (
    <div className="space-y-2">
      <label className="block text-sm font-semibold text-ink" htmlFor={inputId}>
        {label}
      </label>
      <input
        aria-describedby={error ? `${inputId}-error` : undefined}
        aria-invalid={Boolean(error)}
        className={`min-h-12 w-full rounded-2xl border border-line bg-surface px-4 text-ink placeholder:text-muted/70 focus:border-brand focus:outline-none ${className}`}
        id={inputId}
        {...props}
      />
      {error ? (
        <p className="text-sm font-medium text-sale" id={`${inputId}-error`}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
