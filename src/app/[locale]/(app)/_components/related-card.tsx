import { getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";

/**
 * How many related records a card shows before it says *5 of 46* `D70`.
 *
 * `D70`'s second clause: a long list caps and states its total. The cap is low
 * because these cards share a narrow column with several others and the wide
 * side is capped at `TIMELINE_CARD_LIMIT` — the two columns are balanced by
 * height, not by category. One company in this database carries 46 dispatches
 * and 16 quotation threads; the average is under four.
 */
export const RELATED_CARD_LIMIT = 5;

/**
 * One related-record card — `D24`'s *related records as cards*, under `D70`.
 *
 * `D70` in three of its clauses at once: the card **caps and states its total**
 * (*5 of 46*, with the way to the rest), it **sizes to what it holds** rather
 * than to its column, and it carries no shell — an empty one renders its `D52`
 * sentence and no pagination furniture.
 *
 * The empty sentence is deliberately said rather than left blank. Some of these
 * cards go empty for a *rule* rather than for want of data: a rep holding a
 * company through a share sees no projects `[04 Q7]` and no quotations, because
 * neither filter consults company membership. A blank card and a card empty by
 * rule are the same picture, and only one of them is worth telling somebody
 * about.
 *
 * **`href` is omitted where no filtered list exists to send anyone to**, and
 * that is `D70`'s own condition rather than an oversight — *where the rest live
 * behind a filtered list, that list says what it is scoped to*. `/projects` has
 * no `?companyId=` (a project is not a child of a company `S24`) and
 * `/dispatches` has no thread scope, so those cards carry the cap and no way
 * out, and the cap is chosen to cover the data.
 *
 * Lifted out of `companies/[id]/page.tsx` in session 28 unchanged, when the
 * project and quotation detail screens needed the same card. A second copy is
 * what `D24` forbids — *a new screen picks one of four shapes; it does not
 * invent a fifth*.
 */
export function RelatedCard({
  title,
  total,
  href,
  empty,
  action,
  children,
}: {
  title: string;
  total: number;
  /** Where the rest live, when there are more than the cap. */
  href?: string;
  empty: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  const shown = Math.min(total, RELATED_CARD_LIMIT);

  return (
    <Card data-slot="related-card" data-total={String(total)}>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <CardTitle className="text-start text-sm">{title}</CardTitle>
        {action}
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <p className="text-muted-foreground text-start text-sm">{empty}</p>
        ) : (
          <ul className="flex flex-col">{children}</ul>
        )}
      </CardContent>
      {total > shown && href ? (
        <CardFooterCount shown={shown} total={total} href={href} />
      ) : null}
    </Card>
  );
}

/** The stated total `D70`, and the way to the rest. Rendered only when the cap
 *  actually cut something off — a footer saying *5 of 5* is furniture. */
async function CardFooterCount({
  shown,
  total,
  href,
}: {
  shown: number;
  total: number;
  href: string;
}) {
  const t = await getTranslations();
  return (
    <div className="border-line flex items-center justify-between gap-3 border-t px-4 pt-3">
      <span className="text-faint num text-[12.5px]" dir="ltr">
        {t("common.ofTotal", { shown, total })}
      </span>
      <Button asChild size="xs" variant="ghost">
        <Link href={href}>{t("companies.detail.viewAll")}</Link>
      </Button>
    </div>
  );
}
