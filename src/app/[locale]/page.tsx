import { getTranslations, getFormatter } from "next-intl/server";

import { checkDatabase } from "@/db";
import { LocaleSwitcher } from "@/components/locale-switcher";

// The database is checked per request, so this page cannot be static.
export const dynamic = "force-dynamic";

function StatusRow({ label, ok, value }: { label: string; ok: boolean; value: string }) {
  return (
    <div className="flex items-center justify-between border-b py-3 last:border-b-0">
      <span className="text-muted-foreground text-sm">{label}</span>
      <span className="flex items-center gap-2 text-sm font-medium">
        <span
          className={`size-2 rounded-full ${ok ? "bg-success" : "bg-destructive"}`}
          aria-hidden
        />
        {value}
      </span>
    </div>
  );
}

export default async function HomePage() {
  const t = await getTranslations();
  const format = await getFormatter();

  const dbUp = await checkDatabase();
  const now = new Date();

  return (
    <main className="mx-auto flex min-h-svh max-w-2xl flex-col gap-8 px-6 py-16">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">{t("app.name")}</h1>
          <p className="text-muted-foreground mt-1 text-sm">{t("app.tagline")}</p>
        </div>
        <LocaleSwitcher />
      </header>

      <section className="rounded-lg border p-5">
        <h2 className="mb-2 text-sm font-semibold">{t("status.heading")}</h2>
        <StatusRow label={t("status.app")} ok value={t("status.running")} />
        <StatusRow
          label={t("status.database")}
          ok={dbUp}
          value={dbUp ? t("status.up") : t("status.down")}
        />
        <p className="text-muted-foreground mt-3 text-xs">
          {t("status.checkedAt", {
            time: format.dateTime(now, { timeStyle: "medium" }),
          })}
        </p>
      </section>

      <section className="rounded-lg border border-dashed p-5">
        <h2 className="text-sm font-semibold">{t("skeleton.heading")}</h2>
        <p className="text-muted-foreground mt-1 text-sm">{t("skeleton.body")}</p>
      </section>
    </main>
  );
}
