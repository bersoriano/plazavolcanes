// Deno entry for the seller notification sender. Everything it does lives in
// ../_shared/seller-notifications.ts, which the app's typecheck and Vitest cover.
import { handleDispatch } from "../_shared/seller-notifications.ts";

Deno.serve((request) => handleDispatch(request, { env: Deno.env.toObject(), fetch }));
