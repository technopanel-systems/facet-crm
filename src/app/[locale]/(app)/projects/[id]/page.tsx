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
import {
  can,
  canViewRecord,
  listActiveUsers,
  requireSession,
} from "@/lib/authz";
import { chainOwner } from "@/lib/chain";
import { listCompanyOptions } from "@/lib/companies";
import { getCreditSplitInForce } from "@/lib/credit-splits";
import { formatSqm } from "@/lib/decimal";
import { pickName } from "@/lib/lookups";
import { getProject, projectState } from "@/lib/projects";
import { listQuotationThreads } from "@/lib/quotations";
import { projectTimeline, TIMELINE_CARD_LIMIT } from "@/lib/timeline";

import { setCreditSplitAction } from "../actions";
import { ChainStrip } from "../../_components/chain-strip";
import { CommentBox } from "../../_components/comment-box";
import { NextFollowUpPanel } from "../../_components/next-follow-up-panel";
import { projectStateKey } from "../../_components/project-state";
import {
  RelatedCard,
  RELATED_CARD_LIMIT,
} from "../../_components/related-card";
import { SharingPanel } from "../../_components/sharing-panel";
import {
  TurnPanel,
  chainTurnKey,
  initials,
  turnTone,
} from "../../_components/turn";
import { CreditSplit } from "./credit-split";
import { ProjectLinks } from "./project-links";

export const dynamic = "force-dynamic";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const session = await requireSession();
  const project = await getProject(session, id);
  if (!project) notFound();

  const t = await getTranslations();
  const format = await getFormatter();
  // The add-a-company select is scoped to what this identity may use; the
  // action re-checks it, so a tampered option cannot link an unseen company.
  const companies = await listCompanyOptions(session);

  // **May this viewer ACT on the project, or only read it?** `S76` separated
  // the two: the coordinator reads every project and writes to none, and
  // `canViewRecord` is the gate every one of those writes already goes through
  // `[authz:370]`. False for exactly that reader — anybody else who reaches
  // this page owns the project, was shared it, or sees every rep. What it
  // decides here is presentation only `D51`; the data layer refuses regardless
  // `S109`.
  const mayEdit = await canViewRecord(session, "project", project.id);
  // `D2` speaks in the second person to the identity that owes the move, and
  // the coordinator is the one FACET can name exactly — the same split
  // `/projects` and `/quotations` make.
  const viewerIsCoordinator = can(session, "canApproveQuotation");

  // `18 §3` — the split names people, so the picker is the user directory.
  const [split, people, timeline, threads] = await Promise.all([
    getCreditSplitInForce(session, project.id),
    listActiveUsers(),
    projectTimeline(session, project.id, { limit: TIMELINE_CARD_LIMIT }),
    listQuotationThreads(session, { projectId: project.id }),
  ]);

  /**
   * **One position, one clock, and neither is derived here** `S132` `D27`.
   *
   * `getProject` carries `chainByProject`'s answer — the furthest of the live
   * threads, plus the two rungs a thread cannot reach, asked of the PROJECT.
   * This screen used to build its own out of one thread and two extra
   * `listDispatches` calls, and only where there was exactly one live thread:
   * so a project won by a direct dispatch `S75`, or by a dispatch against a
   * second thread, was won on `/projects` and on the board and drew nothing
   * here. `S132` settled the count question outright — *a project may carry
   * several threads; it has one position* — which is why the strip is no longer
   * conditional on there being one.
   */
  const chain = project.chain;
  const state = projectState(project);
  /**
   * **Lost ends it; committed does not** `S28` `S29` `S31`.
   *
   * `projectState` is the one precedence and this reads it rather than ranking
   * the fields again. A lost project is closed and owes nobody. `won` needs no
   * branch of its own — it is `S132`'s sixth position and `chainOwner` already
   * answers `null` for it. A committed project is still moving, so its turn
   * stays whatever the chain says and the commitment reads as a fact below:
   * `D2` exactly, a status beside the line that says whose move it is and never
   * that line.
   */
  const owedBy = state === "lost" ? null : chainOwner(chain.position);

  const dash = t("common.none");

  return (
    <div className="flex flex-col gap-6">
      <DetailHeader
        name={project.name}
        state={[project.ownerName, t(projectStateKey(project))].join(" · ")}
        action={
          mayEdit ? (
            <Button asChild size="sm" variant="outline">
              <Link href={`/projects/${project.id}/edit`}>
                {t("common.edit")}
              </Link>
            </Button>
          ) : undefined
        }
      />

      {/* `D24`'s turn panel — the most important element on the screen, and the
          one place this page says whose move it is `D2`.

          **It reads the chain, not the owner.** The line was *"waiting on
          {owner} — the next move on this project"* on every open project, while
          the strip below labelled each step with whose move that step is — so a
          requested quotation said the owner here and the coordinator there. Two
          answers to `D2` on one screen is the company panel's own defect, found
          again. `chainTurnKey` is the same key `/projects` renders in its
          whose-move column, so the list, the board and this screen say one
          thing.

          **The tone is elapsed time and nothing else** `D6`. It was amber for
          every open project and calm for every settled one, which colours the
          outcome. `stale` is `S89`'s stage-unchanged threshold, resolved in the
          data layer against `projectMovement`, and the sentence beneath reads
          the same figure that chose the colour — not, as before, the newest
          timeline event of seven kinds. */}
      <TurnPanel
        who={initials(project.ownerName)}
        tone={owedBy === null ? "calm" : turnTone({ overdue: chain.stale })}
        line={
          owedBy === null && state === "lost"
            ? t(projectStateKey(project))
            : t(
                chainTurnKey(
                  { position: chain.position, owedBy },
                  viewerIsCoordinator,
                ),
                { name: project.ownerName },
              )
        }
        // Nothing waits on a closed or won project, so there is no duration to
        // give — the quotation panel's own reasoning `D6`.
        detail={
          owedBy === null
            ? undefined
            : t("projects.detail.movedFor", { count: chain.ageDays })
        }
      />

      {/* `D27`'s strip, and it derives nothing: every node comes from
          `chain.ts` through the position `getProject` resolved. No explanation
          paragraph here — that belongs on the quotation, which is where the
          acts are. */}
      <Card>
        <CardHeader>
          <CardTitle className="text-start text-sm">
            {t("projects.chain.title")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* **`reached: position` is true here, not fabricated.**
              `chainByProject` skips closed threads, so a project always carries
              one of the six columns and never the terminal case — which is the
              one condition under which the two fields are the same fact. */}
          <ChainStrip
            chain={{ position: chain.position, owedBy, reached: chain.position }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-start text-sm">
            {t("projects.detail.details")}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          <Facts>
            {/* **The expected metres lead** `D70`. `S29` calls it the rep's
                estimate, the anchor number, and it is what a rep opens a
                project to check. Name, owner and state used to stand here and
                are gone: `DetailHeader` carries all three, and twelve equal
                cells with nothing leading is the wall `D70` names. */}
            <Fact
              label={t("projects.fields.sqmExpected")}
              name="sqmExpected"
              numeric
              lead
            >
              <span dir="ltr">
                {project.sqmExpected ? (
                  `${formatSqm(project.sqmExpected)} ${t("common.sqm")}`
                ) : (
                  <Absent>{dash}</Absent>
                )}
              </span>
            </Fact>
            <Fact label={t("common.region")}>
              {project.region ? t(`enums.region.${project.region}`) : dash}
            </Fact>
            <Fact label={t("common.city")}>
              {pickName(locale, project.cityNameEn, project.cityNameAr) ?? dash}
            </Fact>
            {/* `S29`'s fifth item, and the one thing the header's single word
                cannot carry: a won project the rep had also marked committed
                reads *Won* above, and the judgement is still worth seeing
                `S31`. */}
            <Fact label={t("projects.fields.committed")} name="committed">
              {project.committed ? t("common.yes") : t("common.no")}
            </Fact>
            {/* `25 §4` — a plain label the rep set, nothing derived. */}
            <Fact label={t("projects.fields.inProduction")}>
              {project.inProduction ? t("common.yes") : t("common.no")}
            </Fact>
            {project.endState === "lost" ? (
              <Fact label={t("projects.fields.lossReason")}>
                {pickName(
                  locale,
                  project.lostReasonNameEn,
                  project.lostReasonNameAr,
                ) ?? dash}
              </Fact>
            ) : null}
            <Fact label={t("common.createdBy")}>
              {/* Who FOUND it `S123`, which is not who holds it — the turn
                  panel's avatar answers that. A person's name may be written in
                  either script, so the value carries `dir="auto"` `D62`. */}
              <span dir="auto">
                {project.createdByName ?? t("common.unknownUser")}
              </span>
            </Fact>
            <Fact label={t("common.createdAt")} numeric>
              {format.dateTime(project.createdAt, { dateStyle: "medium" })}
            </Fact>
            {/* A sentence, not a datum — it spans the grid so it is readable
                rather than squeezed into one column, and it renders only where
                the rep wrote one `D70`. */}
            {project.endState === "lost" && project.lossReason ? (
              <Fact label={t("projects.fields.lossReasonDetail")} wide>
                <span dir="auto">{project.lossReason}</span>
              </Fact>
            ) : null}
          </Facts>
        </CardContent>
      </Card>

      {/* `D24` — related records as cards, in the concept's two-column grid,
          **balanced by height and not by category** `D70`. The timeline is the
          wide side: it is the longest thing on the page and it is the rep's
          payoff for logging `[20 §6]`. The narrow side leads with the
          quotations, because *where is this* is what a project is opened to
          answer, and puts the participants and the money rules below. */}
      <div className="grid items-start gap-4 lg:grid-cols-[1.25fr_1fr]">
        <div className="flex flex-col gap-4">
          {/* `20 §6` — the project's own history. A report naming this project
              appears here AND on its company's timeline; a direct dispatch has
              no project and appears only on the company's `[07 C6]`. There is
              no Log button here: an interaction is anchored to a COMPANY
              `[20 §2]`, and the company page is where one starts. */}
          <Timeline
            events={timeline.events}
            total={timeline.total}
            fullHistoryHref={`/projects/${project.id}/timeline`}
            // A comment is not an interaction, so it IS offered here `S114`:
            // what it needs is a record to hang on, not a company to have
            // visited. Offered to whoever may act on the project — `addComment`
            // gates on the same check, and `S76` gives its reader sight and no
            // voice `S131`.
            composer={
              mayEdit ? (
                <CommentBox
                  session={session}
                  recordType="project"
                  recordId={project.id}
                />
              ) : undefined
            }
          />
        </div>

        <div className="flex flex-col gap-4">
          {/* **The threads were unreachable from here until now.** The page
              drew a strip for a project with exactly one live thread and a flag
              for a project with more, and neither listed them or linked to one.
              Every row is the company page's quotations card exactly — `D26`'s
              avatar and whose-move — rather than a third variant of it. */}
          <RelatedCard
            title={t("quotations.title")}
            total={threads.total}
            href={`/quotations?projectId=${project.id}`}
            empty={t("projects.detail.noQuotations")}
            // `S69` — *the project shows when it has more than one open
            // quotation*. `liveThreads` counts the threads the chain has not
            // closed, which is what open means here; `total` beside it counts
            // every thread ever raised. No tone: `D6` gives colour to elapsed
            // time and this is a count.
            action={
              chain.liveThreads > 1 ? (
                <Badge variant="outline" data-slot="many-threads">
                  {t("projects.chain.manyThreads", {
                    count: chain.liveThreads,
                  })}
                </Badge>
              ) : undefined
            }
          >
            {threads.rows.slice(0, RELATED_CARD_LIMIT).map((row) => (
              <RecordRow
                key={row.id}
                href={`/quotations/${row.id}`}
                // `D26`'s lead cell for a quotation is an avatar and whose move
                // it is. The avatar is decorative; the name is in the meta line
                // where a screen reader reaches it.
                mark={
                  <span
                    aria-hidden
                    className="grid size-7 place-items-center rounded-full bg-(image:--avatar-person-grad) text-[10.5px] font-semibold text-white"
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
                    // Not issued yet is a state, not a blank.
                    <Absent>{t("quotations.fields.endStateOpen")}</Absent>
                  )
                }
                // The row carries its own position `S132`, resolved in SQL by
                // `listQuotationThreads`; nothing is re-derived here `D27`.
                meta={t(
                  chainTurnKey(
                    {
                      position: row.position,
                      owedBy: chainOwner(row.position),
                    },
                    viewerIsCoordinator,
                  ),
                  { name: row.raisedByName },
                )}
                // `S68` — never summed. One thread's own metres, per row, and
                // no total anywhere on this page.
                when={row.totalSqm ? formatSqm(row.totalSqm) : undefined}
              />
            ))}
          </RelatedCard>

          <Card>
            <CardHeader>
              <CardTitle className="text-start text-sm">
                {t("projects.detail.companies")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ProjectLinks
                projectId={project.id}
                links={project.links}
                companies={companies}
                mayEdit={mayEdit}
              />
            </CardContent>
          </Card>

          {/* Credit split `[07 D3]`, `[18 §3]` — the rare exception, read-only
              for any project viewer because it is how a rep learns why they
              were credited half; the editor is `can_set_credit_split` only
              `[12 §1]`.

              **Absent rather than an empty shell** `D70`. With no split in
              force and no flag to set one, the whole card was a heading over
              one sentence saying nothing had been decided — the case `D70`
              names outright, and the same finding the company page's dormancy
              block produced. There is nothing to explain until there is a
              split. */}
          {split || can(session, "canSetCreditSplit") ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-start text-sm">
                  {t("credit.title")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CreditSplit
                  action={setCreditSplitAction.bind(null, project.id)}
                  candidates={people.map((person) => ({
                    id: person.id,
                    name: person.name,
                    // Prefilled: whoever is on the split now, or the owner when
                    // there is none — `07 D3`'s baseline is 100% to the owner.
                    inForce: split
                      ? split.rows.some((row) => row.userId === person.id)
                      : person.id === project.ownerUserId,
                  }))}
                  inForce={split?.rows ?? null}
                  effectiveFrom={split?.effectiveFrom ?? null}
                  today={new Intl.DateTimeFormat("en-CA", {
                    timeZone: "Asia/Riyadh",
                    dateStyle: "short",
                  }).format(new Date())}
                  mayEdit={can(session, "canSetCreditSplit")}
                />
              </CardContent>
            </Card>
          ) : null}

          {/* `25 §18` — the rep's own date. On a project it suppresses the
              stage-unchanged chase until it arrives, and then becomes the
              follow-up itself.

              Not rendered for a reader who may not set one `S76`: the date is a
              rep's note to themself about work they hold, `setNextFollowUp`
              refuses anyone else, and a panel whose only control is refused is
              `D51`'s control that does nothing. */}
          {mayEdit ? (
            <NextFollowUpPanel
              session={session}
              recordType="project"
              recordId={project.id}
              value={project.nextFollowUpAt}
            />
          ) : null}

          {/* Sharing `[07 B1]`, `[07 B2]`. A project share is the one that
              carries furthest: `11 §2` cascades it to the threads raised on the
              project and `18 §2` cascades that to their dispatches. It still
              does not reach the project's companies `[04 Q7]`. Renders nothing
              at all for a viewer with no shares to see and no flag to act. */}
          <SharingPanel
            session={session}
            recordType="project"
            recordId={project.id}
          />
        </div>
      </div>
    </div>
  );
}
