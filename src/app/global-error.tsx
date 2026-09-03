"use client";

import "./globals.css";

/**
 * The boundary of last resort — `WORKFLOW §4` row 45, session 55.
 *
 * Next renders this only when the locale layout itself failed, which is the
 * one case where there is no `<html>`, no theme, no locale and no message
 * provider to lean on: the layout is what supplies them. So this file breaks
 * `S113`'s rule deliberately and visibly — **both languages are written here
 * by hand**, one under the other, because a translation layer that lives in
 * the thing that just crashed cannot be asked for the words. Nothing else in
 * `src/` may do this, and `check:messages` does not read this file.
 *
 * The stylesheet is imported directly so the palette is `D5`'s tokens and
 * not a hex typed here; the `dark` class picks the default theme, since the
 * cookie that would say otherwise is read by the layout that just failed.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en" className="dark">
      <body
        data-slot="failed-global"
        className="bg-background text-foreground grid min-h-svh place-items-center font-sans"
      >
        <main className="flex max-w-2xl flex-col gap-3 p-8">
          <h1 className="text-xl font-semibold tracking-tight">
            Something went wrong
          </h1>
          <p className="text-muted-foreground text-sm">
            The screen could not be drawn. Nothing you typed was saved. Try
            again; if it happens twice, tell your manager and quote the code
            below.
          </p>
          <h1 dir="rtl" lang="ar" className="mt-4 text-xl font-semibold tracking-tight">
            حدث خطأ
          </h1>
          <p dir="rtl" lang="ar" className="text-muted-foreground text-sm">
            تعذّر رسم الشاشة. لم يُحفظ ما كتبته. حاول مرة أخرى، وإن تكرّر
            الأمر فأخبر مديرك واذكر الرمز أدناه.
          </p>
          {error.digest ? (
            <p dir="ltr" className="num text-muted-foreground text-sm">
              {error.digest}
            </p>
          ) : null}
          <div>
            <button
              type="button"
              onClick={reset}
              className="bg-primary text-primary-foreground mt-2 rounded-[10px] px-4 py-2 text-sm font-medium"
            >
              Try again · حاول مرة أخرى
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
