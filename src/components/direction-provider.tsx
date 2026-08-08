"use client";

import { Direction } from "radix-ui";

/**
 * Radix primitives (dropdowns, selects, sliders) read direction from this
 * context to flip their keyboard and positioning behaviour. The <html dir>
 * attribute alone handles CSS, not interaction.
 */
export function DirectionProvider({
  dir,
  children,
}: {
  dir: "ltr" | "rtl";
  children: React.ReactNode;
}) {
  return <Direction.Provider dir={dir}>{children}</Direction.Provider>;
}
