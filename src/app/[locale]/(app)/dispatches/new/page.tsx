import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "@/i18n/navigation";
import { can, listActiveUsers, requireSession } from "@/lib/authz";
import {
  listDispatchableThreads,
  searchDispatchCompanies,
} from "@/lib/dispatches";
import { lookupName } from "@/lib/lookups";

import { recordDispatchAction } from "../actions";
import { DispatchForm } from "../dispatch-form";

export const dynamic = "force-dynamic";

/** Today in Riyadh, as the date input wants it. */
function today(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Riyadh",
    dateStyle: "short",
  }).format(new Date());
}

export default async function NewDispatchPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ mode?: string; companyQ?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { mode: rawMode, companyQ } = await searchParams;

  const session = await requireSession();
  const t = await getTranslations();

  // `notFound()` rather than a message: a screen someone may not use and one
  // that does not exist must look identical, the rule the whole app follows.
  if (!can(session, "canDispatch")) notFound();

  const mode = rawMode === "direct" ? "direct" : "linked";
  const query = companyQ?.trim() ?? "";

  const [threads, companies, reps] = await Promise.all([
    mode === "linked" ? listDispatchableThreads(session) : [],
    mode === "direct" ? searchDispatchCompanies(session, query) : [],
    mode === "direct" ? listActiveUsers() : [],
  ]);

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <PageHeader
        title={t("dispatches.newTitle")}
        description={
          mode === "direct"
            ? t("dispatches.detail.directNotice")
            : t("dispatches.detail.linkedNotice")
        }
      />

      {/* The two routes of `07 C6`, side by side rather than hidden behind a
          toggle — a direct sale is a deliberate choice, not a fallback. */}
      <nav className="flex gap-2" aria-label={t("dispatches.fields.mode")}>
        <Button
          asChild
          size="sm"
          variant={mode === "linked" ? "default" : "outline"}
        >
          <Link href="/dispatches/new">
            {t("dispatches.fields.modeLinked")}
          </Link>
        </Button>
        <Button
          asChild
          size="sm"
          variant={mode === "direct" ? "default" : "outline"}
        >
          <Link href="/dispatches/new?mode=direct">
            {t("dispatches.fields.modeDirect")}
          </Link>
        </Button>
      </nav>

      {mode === "linked" && threads.length === 0 ? (
        <p className="text-muted-foreground rounded-lg border border-dashed p-8 text-center text-sm">
          {t("dispatches.detail.noneDispatchable")}
        </p>
      ) : null}

      {mode === "direct" ? (
        // A lookup, not a directory: `18 §2` grants the coordinator company
        // NAMES, and a GET form keeps the search in the URL and needs no
        // JavaScript — the same shape as `SearchForm`.
        <form method="get" className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="mode" value="direct" />
          <div className="flex min-w-60 flex-1 flex-col gap-1.5">
            <label htmlFor="companyQ" className="text-start text-sm font-medium">
              {t("dispatches.fields.companySearch")}
            </label>
            <Input
              id="companyQ"
              name="companyQ"
              defaultValue={query}
              placeholder={t("dispatches.fields.companySearchPlaceholder")}
              className="text-start"
            />
          </div>
          <Button type="submit" variant="outline">
            {t("common.search")}
          </Button>
        </form>
      ) : null}

      <DispatchForm
        action={recordDispatchAction}
        mode={mode}
        threads={threads.map((thread) => ({
          id: thread.id,
          label: `${thread.smacReference ?? t("common.none")} · ${lookupName({ nameEn: thread.projectNameEn, nameAr: thread.projectNameAr }, locale)} · ${t("dispatches.fields.dispatchedSoFar")} ${thread.dispatchedSqm}`,
          companyLabel: thread.companyName,
          raisedByName: thread.raisedByName,
          quotedSqm: thread.quotedSqm,
          dispatchedSqm: thread.dispatchedSqm,
        }))}
        companies={companies.map((company) => ({
          id: company.id,
          label: company.name,
        }))}
        reps={reps}
        companyQuery={query}
        today={today()}
      />

      <p className="text-muted-foreground text-start text-xs">
        {/* `04 quantities` — quoted, paid and dispatched are three different
            numbers, and nothing here forces them to agree. */}
        {t("dispatches.detail.partialHint")}
      </p>
    </div>
  );
}
