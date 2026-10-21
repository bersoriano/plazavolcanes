import { LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/actions/auth";

export function SignOutButton() {
  return (
    <form action={signOut}>
      <Button
        variant="secondary"
        aria-label="Salir"
        className="min-h-11 min-w-11 gap-0 border border-line bg-surface px-3 text-sm text-brand hover:border-brand md:gap-2 md:px-4"
        type="submit"
      >
        <LogOut aria-hidden="true" className="size-4" />
        <span className="hidden md:inline">Salir</span>
      </Button>
    </form>
  );
}
