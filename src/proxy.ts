import createMiddleware from "next-intl/middleware";

import { routing } from "@/i18n/routing";

/**
 * Locale negotiation and redirects. Next 16 renamed this file convention from
 * `middleware` to `proxy`; the contract is unchanged.
 *
 * Sends `/` to `/en`, and rewrites requests so the `[locale]` segment resolves.
 */
export default createMiddleware(routing);

export const config = {
  // Everything except API routes, Next internals and files with an extension.
  matcher: "/((?!api|_next|_vercel|.*\\..*).*)",
};
