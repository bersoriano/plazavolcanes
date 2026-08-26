import { LogOut } from "lucide-react";

import { signOut } from "@/lib/actions/auth";

export function SignOutButton() {
  return (
    <form action={signOut}>
      <button
        aria-label="Salir"
        className="inline-flex min-h-11 min-w-11 items-center justify-center gap-0 rounded-full border border-line bg-surface px-3 text-sm font-semibold text-brand transition-colors hover:border-brand min-[400px]:gap-2 min-[400px]:px-3.5 sm:px-4"
        type="submit"
      >
        <LogOut aria-hidden="true" className="size-4" />
        <span className="hidden min-[400px]:inline">Salir</span>
      </button>
    </form>
  );
}
