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
 * user needs to hear before pressing it.
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
        className="text-muted-foreground hover:bg-surface hover:border-line hover:text-foreground grid size-8 place-items-center rounded-lg border border-transparent transition-colors"
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
