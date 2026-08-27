import { getTranslations, setRequestLocale } from "next-intl/server";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "@/i18n/navigation";
import { formatSqm } from "@/lib/decimal";
import { can, listActiveUsers, requireSession } from "@/lib/authz";
import {
  listDispatchableThreads,
  searchDispatchCompanies,
} from "@/lib/dispatches";
import {
  listProductClasses,
  listProductFireRatings,
  listProductSuppliers,
  listProductThicknesses,
} from "@/lib/lookups";

import { requestDispatchAction } from "../actions";
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

  // **No gate** `S72`. *A rep requests a dispatch* — this screen used to
  // `notFound()` for anyone without `can_dispatch`, which was the whole act
  // being behind the flag. What is left behind the flag is the approving,
  // which happens on the detail screen and nowhere near this form.
  //
  // The rep still sees only what they hold: `listDispatchableThreads` composes
  // `visibleQuotationThreadsFilter`, the project picker composes
  // `visibleProjectsFilter`, and `searchDispatchCompanies` degrades to
  // `visibleCompaniesFilter` for anyone without the flag. Not one of those
  // needed widening for this screen to work for a rep.
  const canNameRep = can(session, "canDispatch");

  const mode = rawMode === "direct" ? "direct" : "linked";
  const query = companyQ?.trim() ?? "";

  // The four product lookups are loaded on both routes `S116`: the linked form
  // prefills its rows from the quotation and the free-entry form types them,
  // and both render the same selects. No colour list `[17 §2]`.
  const [
    threads,
    companies,
    reps,
    suppliers,
    classes,
    fireRatings,
    thicknesses,
  ] = await Promise.all([
    mode === "linked" ? listDispatchableThreads(session) : [],
    mode === "direct" ? searchDispatchCompanies(session, query) : [],
    // `S108` — only somebody who may name another rep gets the picker at all.
    mode === "direct" && canNameRep ? listActiveUsers() : [],
    listProductSuppliers(),
    listProductClasses(),
    listProductFireRatings(),
    listProductThicknesses(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("dispatches.requestTitle")}
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
        action={requestDispatchAction}
        mode={mode}
        canNameRep={canNameRep}
        threads={threads.map((thread) => {
          // `S50` — every quotation names one, so the option always has it and
          // the company fallback that stood here is gone with the null.
          const projectLabel = thread.projectName;
          return {
            id: thread.id,
            label: `${thread.smacReference} · ${projectLabel} · ${t("dispatches.fields.dispatchedSoFar")} ${formatSqm(thread.dispatchedSqm)}`,
            companyLabel: thread.companyName,
            raisedByName: thread.raisedByName,
            quotedSqm: thread.quotedSqm,
            dispatchedSqm: thread.dispatchedSqm,
            projectLabel,
            // `S118` — the quotation's stock, which the form offers as the
            // DEFAULT for the dispatch's own `S130`. It travels with the
            // option for the lines' reason: choosing a quotation is what makes
            // the right default knowable, and a second navigation to fetch it
            // would be a round trip for one enum value.
            stock: thread.stock,
            // `S116` — the issued version's lines, which fill the rows the
            // moment this option is chosen.
            lines: thread.lines,
          };
        })}
        companies={companies.map((company) => ({
          id: company.id,
          label: company.name,
        }))}
        reps={reps}
        products={{ suppliers, classes, fireRatings, thicknesses }}
        locale={locale}
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
