/** How long a dismissal sticks before the bar is allowed to ask again. */
export const LAUNCH_BAR_DISMISS_DAYS = 30;

export const LAUNCH_BAR_DISMISS_COOKIE = "pv_launch_bar";

/**
 * Routes the launch bar keeps out of.
 *
 * /vender is the bar's own destination; the auth routes are a form somebody is
 * already filling in; /panel and /admin belong to people who are past being
 * recruited. A prefix match, so nested routes are covered too.
 */
const SILENT_ROUTES = [
  "/vender",
  "/registro",
  "/ingresar",
  "/recuperar",
  "/nueva-contrasena",
  "/auth",
  "/panel",
  "/admin",
];

export function isLaunchBarRoute(pathname: string) {
  return !SILENT_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}
