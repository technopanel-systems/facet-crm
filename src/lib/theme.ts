import { cookies } from "next/headers";

/**
 * The theme, persisted in a cookie and read on the SERVER `[22 §5]`.
 *
 * Read on the server rather than in the browser so the correct theme is in the
 * first byte of HTML: no flash of the wrong palette, no inline script, and no
 * dependency (`next-themes` is deliberately not installed).
 *
 * The cost is stated rather than hidden: reading a cookie in the root layout
 * opts the whole tree into dynamic rendering, so `/[locale]/login` stops being
 * statically rendered. Every screen under `(app)` is already `force-dynamic`,
 * so nothing else changes.
 *
 * Dark is the default `[22 §1]` — an absent cookie means dark, not light.
 */
export const THEME_COOKIE = "facet-theme";

export type Theme = "dark" | "light";

export function isTheme(value: string | undefined): value is Theme {
  return value === "dark" || value === "light";
}

export async function getTheme(): Promise<Theme> {
  const store = await cookies();
  const value = store.get(THEME_COOKIE)?.value;
  return isTheme(value) ? value : "dark";
}
