import { LogOut } from "lucide-react";

import { signOut } from "@/lib/actions/auth";

export function SignOutButton() {
  return (
    <form action={signOut}>
      <button
        className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line bg-surface px-3.5 text-sm font-semibold text-brand transition-colors hover:border-brand sm:px-4"
        type="submit"
      >
        <LogOut aria-hidden="true" className="size-4" />
        <span className="hidden sm:inline">Salir</span>
      </button>
    </form>
  );
}
