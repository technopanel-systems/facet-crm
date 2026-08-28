import { Moon, Sun } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { getTheme } from "@/lib/theme";

import { setThemeAction } from "../actions";

/**
 * The theme toggle `[22 §5]`.
 *
 * A server component and a plain form: no `"use client"`, no hydration, no
 * JavaScript. The theme is a cookie read on the server, so the button's whole
 * job is to POST the *other* theme and let the layout re-render.
 *
 * The label names the theme being switched TO, which is what a screen reader
 * user needs to hear before pressing it. `LocaleSwitcher` beside it is now the
 * same shape for the same reason `38c`.
 *
 * `max-md:size-11` is `D74`'s floor. `38a` put it on `Button`'s base and this
 * is a bare `<button>`, so it was missed — as was the bell in the layout, for
 * the same reason.
 */
export async function ThemeToggle() {
  const theme = await getTheme();
  const t = await getTranslations("theme");
  const next = theme === "dark" ? "light" : "dark";

  return (
    <form action={setThemeAction}>
      <input type="hidden" name="theme" value={next} />
      <button
        type="submit"
        aria-label={t(next)}
        title={t(next)}
        className="text-muted-foreground hover:bg-surface hover:border-line hover:text-foreground grid size-8 place-items-center rounded-lg border border-transparent transition-colors max-md:size-11"
      >
        {theme === "dark" ? (
          <Sun className="size-4" aria-hidden />
        ) : (
          <Moon className="size-4" aria-hidden />
        )}
      </button>
    </form>
  );
}
