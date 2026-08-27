import { notFound } from "next/navigation";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";

import {
  Absent,
  DetailHeader,
  Fact,
  Facts,
  RecordRow,
} from "@/components/page-header";
import { Timeline } from "@/components/timeline";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { formatSqm } from "@/lib/decimal";
import { can, listCompanyBookHolders, requireSession } from "@/lib/authz";
import { chainOwner } from "@/lib/chain";
import { getCompany, listCompanyReps } from "@/lib/companies";
import { listContacts } from "@/lib/contacts";
import { companyTurn } from "@/lib/coverage";
import { listDispatches } from "@/lib/dispatches";
import { dormancyReviews } from "@/lib/dormancy";
import { lookupName, pickName } from "@/lib/lookups";
import { listProjects } from "@/lib/projects";
import { listQuotationThreads } from "@/lib/quotations";
import { companyTimeline, TIMELINE_CARD_LIMIT } from "@/lib/timeline";

import {
  archiveCompanyAction,
  reassignCompanyAction,
  reincludeCompanyAction,
} from "../actions";
import { CommentBox } from "../../_components/comment-box";
import { NextFollowUpPanel } from "../../_components/next-follow-up-panel";
import { projectStateKey } from "../../_components/project-state";
import { SharingPanel } from "../../_components/sharing-panel";
import { SilenceMeter } from "../../_components/silence-meter";

import {
  TurnPanel,
  chainTurnKey,
  companyTurnKey,
  dispatchTurnKey,
  dispatchTurnNames,
  initials,
  turnTone,
} from "../../_components/turn";
import { DormancyPanel } from "./dormancy-panel";

export const dynamic = "force-dynamic";

/**
 * How many related records a card shows before it says *5 of 46* `D70`.
 *
 * `D70`'s second clause: a long list caps and states its total. The cap is low
 * because these cards share a column with four others and the wide side is
 * capped at `TIMELINE_CARD_LIMIT` — the two columns are balanced by height, not
 * by category. One company in this database carries 46 dispatches and 16
 * quotation threads; the average is under four.
 */
const RELATED_CARD_LIMIT = 5;

export default async function CompanyDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const session = await requireSession();
  const company = await getCompany(session, id);
  if (!company) notFound();

  const t = await getTranslations();
  const format = await getFormatter();
  const canAssign = can(session, "canAssign");
  // `22 §4` speaks in the second person to the identity that owes the move, and
  // the quotation rows below borrow `/quotations`' reading of who that is.
  const viewerIsCoordinator = can(session, "canApproveQuotation");

  const [
    reps,
    contacts,
    projects,
    quotations,
    dispatches,
    timeline,
    turn,
    reviews,
    assignableReps,
  ] = await Promise.all([
    listCompanyReps(company.id),
    // Scoped like any other contact read. Seeing the company is what grants
    // these `[14 §1]`, so on a shared company the second rep sees them too.
    listContacts(session, { companyId: company.id }),
    // And this is the opposite rule, on the same screen: `listProjects`
    // applies `visibleProjectsFilter`, which never consults company
    // membership. A rep holding this company through a share sees the company
    // and an EMPTY projects list `[04 Q7]`. `listQuotationThreads` carries no
    // company term either, so the card below it is empty for the same reason
    // and for the same rule — which is why both say so rather than rendering
    // an ambiguous blank `D52`.
    listProjects(session, { companyId: company.id }),
    listQuotationThreads(session, { companyId: company.id }),
    listDispatches(session, { companyId: company.id }),
    companyTimeline(session, company.id, { limit: TIMELINE_CARD_LIMIT }),
    // `D24`'s turn panel, in one read `[coverage.ts]`. It composes
    // `companySilence` — the same derivation `/companies`' meter and that
    // list's order are built on — and resolves `follow-ups.ts`'s precedence
    // over on hold, the rep's own date and the clock. The screen ranks nothing.
    companyTurn(session, company.id),
    dormancyReviews(company.id),
    // `S9` — the four roles that may be handed a company book.
    canAssign ? listCompanyBookHolders() : Promise.resolve([]),
  ]);

  // `getCompany` already answered the visibility question, so this cannot be
  // null in practice; narrowing it is cheaper than asserting.
  if (!turn) notFound();

  const dash = t("common.none");

  /**
   * The rep who **holds** this company — `S18`.
   *
   * Not `created_by`, which is who FOUND it and never moves `S123`. Primacy
   * moves on handover `S103` and on dormancy reassignment, so the finder and
   * the holder differ on every company that has ever changed hands, and `D2`
   * asks whose move it is rather than whose find it was. `listCompanyReps`
   * orders primary first and `S18` guarantees exactly one.
   */
  const holder = reps.find((rep) => rep.isPrimary) ?? reps[0] ?? null;
  const viewerIsHolder = holder?.userId === session.user.id;

  /** A `date` column is a calendar day in Riyadh, never an instant. */
  const day = (value: string) =>
    format.dateTime(new Date(`${value}T00:00:00Z`), {
      dateStyle: "medium",
      timeZone: "UTC",
    });

  /** Whose move it is, said in the second person to the person who owes it. */
  const turnLine = t(companyTurnKey(turn.state, viewerIsHolder), {
    name: holder?.userName ?? t("common.unknownUser"),
    date: turn.plannedFor ? day(turn.plannedFor) : "",
    count: turn.daysSince ?? turn.silentDays,
  });

  /**
   * The second line names the next act, never the counter.
   *
   * It used to read "Log a report to reset the clock — the coverage screen
   * counts from the last one", which is an instruction about internals: `D24`
   * asks who owes the next action and what it is. A calm company gets none at
   * all — nothing is owed beyond the ordinary, and a band that always speaks
   * stops being read.
   */
  const turnDetail =
    turn.state === "onHold" && turn.onHoldUntil
      ? t("companies.turn.onHoldDetail", { date: day(turn.onHoldUntil) })
      : turn.state === "planned" || turn.state === "due"
        ? t("companies.turn.plannedDetail", {
            count: turn.daysSince ?? turn.silentDays,
          })
        : turn.state === "quiet"
          ? t("companies.turn.quietDetail")
          : turn.state === "never"
            ? t("companies.turn.neverDetail", { count: turn.silentDays })
            : undefined;

  return (
    <div className="flex flex-col gap-6">
      <DetailHeader
        name={company.name}
        state={[
          pickName(locale, company.categoryNameEn, company.categoryNameAr),
          pickName(locale, company.cityNameEn, company.cityNameAr),
        ]
          .filter(Boolean)
          .join(" · ")}
        action={
          <>
            {/* `S32` — *the main entry point is a Log button on the company
                page*. It was the button in the fourth card down, below the
                header, the turn panel, an eleven-fact grid and sometimes the
                dormancy block; at 1366 that is below the fold, which is not an
                entry point. Primary here, and the timeline keeps none: one Log
                button on the page. */}
            <Button asChild size="sm">
              <Link href={`/reports/new?companyId=${company.id}`}>
                {t("reports.new")}
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href={`/companies/${company.id}/edit`}>
                {t("common.edit")}
              </Link>
            </Button>
          </>
        }
      />

      {/* `22 §3`'s turn panel — the most important element on the screen, and
          the one place this page says whose move it is `D2` `D24`.

          **Every figure comes from `companyTurn` and nothing else.** The panel
          used to take its elapsed count from the newest TIMELINE event — the
          most recent of seven kinds, a comment or a dispatch included — while
          its colour came from the interaction clock. The two disagree by
          construction `[20 §2]`, and on this database that printed "Nothing
          recorded for 0 days" beside a Gone quiet badge on the same screen. */}
      <TurnPanel
        who={holder ? initials(holder.userName) : undefined}
        tone={turnTone({
          overdue: turn.state === "quiet" || turn.state === "due",
        })}
        line={turnLine}
        detail={turnDetail}
        // `D26`'s bar, carrying the one thing the line cannot: 118 days is
        // neglected against a 60-day threshold and merely late against a
        // 30-day one. Absent where there is no clock left to run.
        meter={
          turn.state === "archived" ? undefined : (
            <SilenceMeter
              variant="inline"
              daysSince={turn.daysSince}
              silentDays={turn.silentDays}
              thresholdDays={turn.thresholdDays}
              isQuiet={turn.isQuiet}
              onHoldUntil={turn.onHoldUntil}
            />
          )
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-start text-sm">
            {t("companies.detail.details")}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          <Facts>
            {/* **Phone leads** `D70`. What leads is chosen by what the reader is
                doing when they open the screen, and a rep reads this standing
                outside the customer's office. Mandatory since `S13`, so no dash
                branch, and the primary matching key `S23`.

                A VAT number stood second until this slice. No rule asked for
                it, the live sheet never filled it, and the demo seed invented
                one on two rows in five — the column, the form field and the
                writer came out together `[0028]`. */}
            <Fact label={t("common.phone")} name="phone" numeric lead>
              <span dir="ltr">{company.phone}</span>
            </Fact>
            {/* Category is NOT here: `DetailHeader` above already carries
                "Category · City", and repeating it was one of the eleven equal
                cells that left the grid with nothing leading. City stays —
                `verify:routes` §13 asserts its dash, and it reads as `S15`'s
                place triple beside Country and Region rather than as a repeat.

                Country above the other two, the order the form asks in and the
                order they depend in `S14` `S15`. Always present, so no dash
                branch; the two below hold one for a company outside Saudi
                Arabia, which is a real and permanent state, not a gap somebody
                forgot to fill. */}
            <Fact label={t("common.country")} name="country">
              {lookupName(
                {
                  nameEn: company.countryNameEn,
                  nameAr: company.countryNameAr,
                },
                locale,
              )}
            </Fact>
            <Fact label={t("common.region")} name="region">
              {company.region ? t(`enums.region.${company.region}`) : dash}
            </Fact>
            <Fact label={t("common.city")} name="city">
              {pickName(locale, company.cityNameEn, company.cityNameAr) ?? dash}
            </Fact>
            <Fact label={t("companies.fields.leadSource")}>
              {pickName(
                locale,
                company.leadSourceNameEn,
                company.leadSourceNameAr,
              ) ?? dash}
            </Fact>
            {/* A warmth Fact stood here until `25 §6` cut it. Qualification is
                the half of `10 §1` that survives: it is what has actually
                happened, not what a rep thinks. A company is qualified because
                a quotation was requested against it — there is nothing here
                for anyone to tick `[25 §16]`. It earns its cell because it is
                what picks the threshold the meter above measures against. */}
            <Fact label={t("common.qualified")}>
              {company.isQualified ? (
                <Badge variant="outline">{t("common.yes")}</Badge>
              ) : (
                <span className="text-muted-foreground">{t("common.no")}</span>
              )}
            </Fact>
            <Fact label={t("common.createdBy")}>
              {/* Who FOUND it `S123`, which is not who holds it — the turn
                  panel's avatar answers that `S18`. A person's name may be
                  written in either script, so the value carries `dir="auto"`
                  and the label does not `D62`. */}
              <span dir="auto">
                {company.createdByName ?? t("common.unknownUser")}
              </span>
            </Fact>
            <Fact label={t("common.createdAt")} numeric>
              {format.dateTime(company.createdAt, { dateStyle: "medium" })}
            </Fact>
            {/* A sentence, not a datum — it spans the grid so it is readable
                rather than squeezed into one column. The rep's own words about
                this customer: quantity, colour, and whether it is supply-only.
                `dir="auto"` on the VALUE `D62` — the `<dd>` holds nothing but
                the value, and the label is its own element. */}
            <Fact label={t("common.notes")} wide>
              <span dir="auto">{company.notes ?? dash}</span>
            </Fact>
          </Facts>
        </CardContent>
      </Card>

      {/* `22 §3` — related records as cards, in the concept's two-column grid.
          The timeline is the wide side: it is the rep's payoff for logging
          `[20 §6]`. The narrow side leads with the WORK — quotations, projects,
          dispatches — and puts the people below it: this is the page a rep
          opens to answer where do we stand with this customer. */}
      <div className="grid items-start gap-4 lg:grid-cols-[1.25fr_1fr]">
        <div className="flex flex-col gap-4">
          <Timeline
            events={timeline.events}
            total={timeline.total}
            fullHistoryHref={`/companies/${company.id}/timeline`}
            // No Log button here any more `S32` — it is in the page header,
            // where an entry point can be reached without scrolling.
            //
            // One thread per record `[25 §9]`: the conversation sits inside the
            // timeline card, not beside it. A report is what happened with the
            // customer and a comment is what colleagues say about it, and the
            // two are not the same act.
            composer={
              <CommentBox
                session={session}
                recordType="company"
                recordId={company.id}
              />
            }
          />
        </div>

        <div className="flex flex-col gap-4">
          <RelatedCard
            title={t("quotations.title")}
            total={quotations.total}
            href={`/quotations?companyId=${company.id}`}
            empty={t("companies.detail.noQuotations")}
          >
            {quotations.rows.slice(0, RELATED_CARD_LIMIT).map((row) => {
              // `S132` — the chain is `chain.ts`'s and nothing else, and
              // since session 26 the ROW carries it: `listQuotationThreads`
              // resolves both dispatch flags in SQL and folds the ladder once.
              // This screen used to re-derive without them and said so, on the
              // grounds that `/quotations` was equally under-informed. That
              // stopped being true when the list closed the gap, so this reads
              // the answer rather than computing a second, worse one.
              const state = {
                position: row.position,
                owedBy: chainOwner(row.position),
                reached: row.position,
              } as const;
              return (
                <RecordRow
                  key={row.id}
                  href={`/quotations/${row.id}`}
                  // `D26`'s lead cell for a quotation is an avatar and whose
                  // move it is. The avatar is decorative; the name is in the
                  // meta line where a screen reader reaches it.
                  mark={
                    <span
                      aria-hidden
                      className="grid size-7 place-items-center rounded-full bg-[linear-gradient(140deg,#31527F,#1B2F4C)] text-[10px] font-semibold text-white"
                    >
                      {initials(row.raisedByName)}
                    </span>
                  }
                  title={
                    row.smacReference ? (
                      <span className="num" dir="ltr">
                        {row.smacReference}
                      </span>
                    ) : (
                      // `S50` — not issued yet is a state, not a blank.
                      <Absent>{t("quotations.fields.endStateOpen")}</Absent>
                    )
                  }
                  meta={t(chainTurnKey(state, viewerIsCoordinator), {
                    name: row.raisedByName,
                  })}
                  when={row.totalSqm ? formatSqm(row.totalSqm) : undefined}
                />
              );
            })}
          </RelatedCard>

          <RelatedCard
            title={t("companies.detail.projects")}
            total={projects.total}
            empty={t("companies.detail.noProjects")}
          >
            {projects.rows.slice(0, RELATED_CARD_LIMIT).map((project) => (
              <RecordRow
                key={project.id}
                href={`/projects/${project.id}`}
                // `dir="auto"` on the NAME, never on the row — the row also
                // holds a state label and a square-metre figure `D62`.
                title={<span dir="auto">{project.name}</span>}
                // The same answer the projects list and the project's own
                // screen give — one precedence `[projectState]`, so a project
                // cannot read as won here and open there.
                meta={t(projectStateKey(project))}
                when={
                  project.sqmExpected
                    ? formatSqm(project.sqmExpected)
                    : undefined
                }
              />
            ))}
          </RelatedCard>

          <RelatedCard
            title={t("dispatches.title")}
            total={dispatches.total}
            href={`/dispatches?companyId=${company.id}`}
            empty={t("companies.detail.noDispatches")}
          >
            {dispatches.rows.slice(0, RELATED_CARD_LIMIT).map((row) => (
              <RecordRow
                key={row.id}
                href={`/dispatches/${row.id}`}
                title={
                  row.isDirect ? (
                    // `07 C6` — the direct route, with no quotation behind it.
                    t("dispatches.fields.direct")
                  ) : (
                    <span className="num" dir="ltr">
                      {row.smacReference ?? dash}
                    </span>
                  )
                }
                // `D26` — a submitted request owes the coordinator `S88`; an
                // approved dispatch owes nobody. One ladder, in `turn.tsx`,
                // shared with `/dispatches` `[dispatchTurnKey]`.
                meta={t(
                  dispatchTurnKey(row.status),
                  dispatchTurnNames(row.status)
                    ? {
                        name:
                          (row.status === "approved"
                            ? row.approvedByName
                            : row.recordedByName) ?? dash,
                      }
                    : undefined,
                )}
                // `D26`'s lead figure — how much went out, mono.
                when={`${formatSqm(row.sqm)} ${t("common.sqm")}`}
              />
            ))}
          </RelatedCard>

          <RelatedCard
            title={t("companies.detail.contacts")}
            total={contacts.total}
            empty={t("companies.detail.noContacts")}
            action={
              <Button asChild size="xs" variant="outline">
                <Link href={`/contacts/new?companyId=${company.id}`}>
                  {t("companies.detail.addContact")}
                </Link>
              </Button>
            }
          >
            {contacts.rows.slice(0, RELATED_CARD_LIMIT).map((contact) => (
              <RecordRow
                key={contact.id}
                href={`/contacts/${contact.id}`}
                // `S19` — one name field, either script, so `dir="auto"` sits
                // on the name and not on the row `D62`.
                title={<span dir="auto">{contact.name}</span>}
                // `D26` asks for name and position. **Not one contact in this
                // database has a position** — nor an email — so the meta line
                // renders whatever is actually there and NOTHING when neither
                // is: an em dash under every contact name on every company is
                // a line that only ever says nothing, which is the call
                // `/companies` already made on the qualified mark.
                meta={
                  [contact.position, contact.phone]
                    .filter(Boolean)
                    .join(" · ") || undefined
                }
              />
            ))}
          </RelatedCard>

          {/* `25 §18` — the rep's own date, which outranks the automatic clock.
              The turn panel above now says so in words; this is where it is
              set and cleared. */}
          <NextFollowUpPanel
            session={session}
            recordType="company"
            recordId={company.id}
            value={company.nextFollowUpAt}
          />

          <Card>
            <CardHeader>
              <CardTitle className="text-start text-sm">
                {t("companies.detail.reps")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="flex flex-col gap-2">
                {reps.map((rep) => (
                  <li
                    key={rep.id}
                    className="flex flex-wrap items-center gap-2 text-start text-sm"
                  >
                    <span className="font-medium" dir="auto">
                      {rep.userName}
                    </span>
                    {rep.isPrimary ? (
                      <Badge variant="secondary">
                        {t("companies.detail.primary")}
                      </Badge>
                    ) : null}
                    <span className="text-muted-foreground text-xs">
                      {t(`enums.companyRepOrigin.${rep.origin}`)}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {/* Beside the reps, because both answer "who is on this" — a
              membership is the rep's own book `[09 §3.2]`, a share is access to
              a record somebody else still holds `[07 B2]`. Renders nothing at
              all for a viewer with no shares to see and no flag to act. */}
          <SharingPanel
            session={session}
            recordType="company"
            recordId={company.id}
          />
        </div>
      </div>

      {/* `07 E6` — rendered only when there is a decision to take: the company
          has gone quiet, or somebody has already taken one. A panel that showed
          on every company would make archiving look like an ordinary edit.

          **Last on the page** `D70`. An archive decision is rarer than reading
          the customer's work, and this stood third — above the timeline, the
          quotations and the dispatches — carrying an empty note field and a
          line saying nothing had been decided. */}
      {turn.isQuiet || turn.state === "archived" || reviews.length > 0 ? (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <CardTitle className="text-start text-sm">
              {t("dormancy.title")}
            </CardTitle>
            {turn.state === "archived" ? (
              <Badge variant="secondary">
                {t("enums.dormancyOutcome.archived")}
              </Badge>
            ) : turn.isQuiet ? (
              <Badge variant="destructive">{t("dormancy.detail.quiet")}</Badge>
            ) : null}
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            {/* Archiving is the end of the lifecycle: there is nothing left to
                decide, so no controls are offered. Nothing is deleted, so the
                record and its history stay `[12 §7]`. */}
            {turn.state === "archived" ? (
              <p className="text-muted-foreground text-start text-sm">
                {t("dormancy.detail.archived")}
              </p>
            ) : (
              <DormancyPanel
                reincludeAction={reincludeCompanyAction.bind(null, company.id)}
                reassignAction={
                  canAssign
                    ? reassignCompanyAction.bind(null, company.id)
                    : undefined
                }
                archiveAction={
                  canAssign
                    ? archiveCompanyAction.bind(null, company.id)
                    : undefined
                }
                reps={assignableReps}
              />
            )}

            {/* **Absent, not an empty shell** `D70`. A heading over "No
                decisions recorded yet" is the block telling you nothing has
                happened, which is what its absence already says. */}
            {reviews.length > 0 ? (
              <div className="flex flex-col gap-2" data-slot="dormancy-history">
                <p className="text-start text-sm font-medium">
                  {t("dormancy.detail.history")}
                </p>
                <ul className="flex flex-col gap-1">
                  {reviews.map((review) => (
                    <li
                      key={review.id}
                      className="text-muted-foreground text-start text-sm"
                    >
                      {/* The wrapper case `D62`: this line holds a date, a
                          translated outcome, a person and free text, so
                          `dir="auto"` goes on the values that may hold either
                          script and never on the `<li>`. */}
                      <span dir="ltr">
                        {format.dateTime(
                          new Date(`${review.decidedAt}T00:00:00Z`),
                          { dateStyle: "medium", timeZone: "UTC" },
                        )}
                      </span>{" "}
                      — {t(`enums.dormancyOutcome.${review.outcome}`)}{" "}
                      <span dir="auto">
                        {t("dormancy.detail.by", {
                          name: review.decidedByName,
                        })}
                        {review.toName
                          ? ` ${t("dormancy.detail.to", { name: review.toName })}`
                          : ""}
                      </span>
                      {review.note ? (
                        <>
                          {" — "}
                          <span dir="auto">{review.note}</span>
                        </>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

/**
 * One related-record card — `22 §3`'s *related records as cards*, under `D70`.
 *
 * `D70` in three of its clauses at once: the card **caps and states its total**
 * (*5 of 46*, with the way to the rest), it **sizes to what it holds** rather
 * than to its column, and it carries no shell — an empty one renders its `D52`
 * sentence and no pagination furniture.
 *
 * The empty sentence is deliberately said rather than left blank. Two of these
 * cards go empty for a *rule* rather than for want of data: a rep holding this
 * company through a share sees no projects `[04 Q7]` and no quotations, because
 * neither filter consults company membership. A blank card and a card empty by
 * rule are the same picture, and only one of them is worth telling somebody
 * about.
 *
 * **Projects deliberately takes no `href`.** `/projects` has no `?companyId=`
 * — a project is not a child of a company `S24` and its list is not indexed
 * that way — so a link would go somewhere that ignored it. Seven participants
 * on one company is the most in this database, which is inside the cap.
 */
function RelatedCard({
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
      <span className="text-faint num text-[11.5px]" dir="ltr">
        {t("common.ofTotal", { shown, total })}
      </span>
      <Button asChild size="xs" variant="ghost">
        <Link href={href}>{t("companies.detail.viewAll")}</Link>
      </Button>
    </div>
  );
}
