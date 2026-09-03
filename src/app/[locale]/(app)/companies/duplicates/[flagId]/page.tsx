import { notFound } from "next/navigation";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";

import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { requireSession } from "@/lib/authz";
import { getDuplicateFlag, type DuplicateSide } from "@/lib/duplicates";
import { pickName } from "@/lib/lookups";

import { resolveDuplicateAction } from "../../actions";
import { ResolveForms } from "./resolve-forms";

export const dynamic = "force-dynamic";

/**
 * `S22` — the manager's side-by-side. **Two records, what each already
 * has, and three outcomes**; a `can_resolve_duplicate` door `S8`, and
 * `notFound()` for anyone else `D53`. Inside `/companies` rather than a
 * rail item of its own `D49`: it is reached from Stuck's row `D41`.
 *
 * The decision forms render only while the flag is open; a decided flag
 * shows who decided what and when, and the record that continues.
 */
export default async function DuplicatePage({
  params,
}: {
  params: Promise<{ locale: string; flagId: string }>;
}) {
  const { locale, flagId } = await params;
  setRequestLocale(locale);

  const session = await requireSession();
  const flag = await getDuplicateFlag(session, flagId);
  if (!flag) notFound();

  const t = await getTranslations();
  const format = await getFormatter();

  const survivorName =
    flag.survivorId === flag.a.id
      ? flag.a.name
      : flag.survivorId === flag.b.id
        ? flag.b.name
        : null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("duplicates.title")}
        description={t("duplicates.samePhone", { phone: flag.a.phone })}
        action={
          <Button asChild size="sm" variant="outline">
            <Link href="/">{t("common.back")}</Link>
          </Button>
        }
      />

      {/* Side by side `S22` — the newer record at the inline start, the one
          it matched beside it. Same card, same facts, so the eye compares. */}
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Side side={flag.a} label={t("duplicates.newer")} locale={locale} />
        <Side side={flag.b} label={t("duplicates.older")} locale={locale} />
      </div>

      {flag.status === "open" ? (
        <ResolveForms
          action={resolveDuplicateAction.bind(null, flag.id)}
          a={{ id: flag.a.id, name: flag.a.name }}
          b={{ id: flag.b.id, name: flag.b.name }}
        />
      ) : (
        <Card data-slot="duplicate-decided" data-resolution={flag.resolution ?? ""}>
          <CardHeader>
            <CardTitle className="text-start text-sm">
              {t("duplicates.decided.title")}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1 text-start text-sm">
            <p className="font-medium">
              <span dir="auto">
                {flag.resolution
                  ? t(`duplicates.decided.${flag.resolution}`, {
                      name: survivorName ?? t("common.none"),
                    })
                  : t("common.none")}
              </span>
            </p>
            {flag.decidedByName && flag.decidedAt ? (
              <p className="text-muted-foreground">
                <span dir="auto">{flag.decidedByName}</span>
                <span className="text-faint"> · </span>
                {format.dateTime(flag.decidedAt, { dateStyle: "medium" })}
              </p>
            ) : null}
            {flag.survivorId ? (
              <p>
                <Link
                  href={`/companies/${flag.survivorId}`}
                  className="hover:underline"
                  data-slot="duplicate-survivor"
                >
                  {t("duplicates.decided.open")}
                </Link>
              </p>
            ) : null}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

async function Side({
  side,
  label,
  locale,
}: {
  side: DuplicateSide;
  label: string;
  locale: string;
}) {
  const t = await getTranslations();
  const format = await getFormatter();
  const dash = t("common.none");
  const place = [
    pickName(locale, side.categoryNameEn, side.categoryNameAr),
    pickName(locale, side.cityNameEn, side.cityNameAr),
  ]
    .filter(Boolean)
    .join(" · ");

  const figures: [keyof DuplicateSide["counts"], number][] = [
    ["projects", side.counts.projects],
    ["quotations", side.counts.quotations],
    ["dispatches", side.counts.dispatches],
    ["reports", side.counts.reports],
    ["contacts", side.counts.contacts],
  ];

  return (
    <Card data-slot="duplicate-side" data-company={side.id}>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1 text-start">
          <p className="text-faint text-[10.5px] font-semibold tracking-[.09em] uppercase">
            {label}
          </p>
          <CardTitle className="text-base wrap-break-word">
            {/* `dir="auto"` on the NAME, never the card `D62`. */}
            <Link href={`/companies/${side.id}`} className="hover:underline">
              <span dir="auto">{side.name}</span>
            </Link>
          </CardTitle>
        </div>
        <div className="flex flex-none flex-wrap gap-1">
          {side.archived ? (
            <Badge variant="secondary">{t("duplicates.archivedMark")}</Badge>
          ) : null}
          {side.mergedIntoId ? (
            <Badge variant="secondary">{t("companies.detail.merged")}</Badge>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-start text-sm">
        <p className="num text-base font-semibold" dir="ltr">
          {side.phone}
        </p>
        <p className="text-muted-foreground">{place || dash}</p>
        <p className="text-muted-foreground">
          <span dir="auto">
            {t("duplicates.registered", {
              date: format.dateTime(side.createdAt, { dateStyle: "medium" }),
              name: side.createdByName ?? t("common.unknownUser"),
            })}
          </span>
        </p>
        <div className="flex flex-col gap-1">
          <p className="text-faint text-[10.5px] font-semibold tracking-[.09em] uppercase">
            {t("duplicates.holders")}
          </p>
          {side.holders.length === 0 ? (
            <p className="text-muted-foreground">{t("duplicates.nobody")}</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {side.holders.map((holder) => (
                <li
                  key={holder.id}
                  data-slot="duplicate-holder"
                  data-user={holder.id}
                  className="flex flex-wrap items-center gap-2"
                >
                  <span className="font-medium" dir="auto">
                    {holder.name}
                  </span>
                  {holder.isPrimary ? (
                    <Badge variant="secondary">{t("companies.detail.primary")}</Badge>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
        {/* What each already has — five figures, each a word run `D73`, so
            the pair can be read against each other across the two cards. */}
        <p className="text-muted-foreground flex flex-wrap gap-x-3 gap-y-1">
          {figures.map(([key, value]) => (
            <span key={key} data-slot={`duplicate-${key}`} data-count={value} dir="auto">
              {t(`duplicates.counts.${key}`, { count: value })}
            </span>
          ))}
        </p>
      </CardContent>
    </Card>
  );
}
