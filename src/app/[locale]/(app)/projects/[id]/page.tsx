import { notFound } from "next/navigation";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";

import {
  DetailHeader,
  Fact,
  Facts,
} from "@/components/page-header";
import { Timeline } from "@/components/timeline";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { Link } from "@/i18n/navigation";
import {
  can,
  canViewRecord,
  listActiveUsers,
  requireSession,
} from "@/lib/authz";
import { chainState } from "@/lib/chain";
import { listCompanyOptions } from "@/lib/companies";
import { getCreditSplitInForce } from "@/lib/credit-splits";
import {
  formatSqm,
  fromScaled,
  SQM_SCALE,
  toScaled,
  ZERO,
} from "@/lib/decimal";
import { listDispatches } from "@/lib/dispatches";
import { pickName } from "@/lib/lookups";
import { getProject } from "@/lib/projects";
import { listQuotationThreads } from "@/lib/quotations";
import { projectTimeline, TIMELINE_CARD_LIMIT } from "@/lib/timeline";

import { setCreditSplitAction } from "../actions";
import { ChainStrip } from "../../_components/chain-strip";
import { CommentBox } from "../../_components/comment-box";
import { NextFollowUpPanel } from "../../_components/next-follow-up-panel";
import {
  ProjectStateBadge,
  projectStateKey,
} from "../../_components/project-state";

import { SharingPanel } from "../../_components/sharing-panel";
import {
  TurnPanel,
  daysSince,
  initials,
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

  // `18 §3` — the split names people, so the picker is the user directory.
  const [split, people, timeline, threads] = await Promise.all([
    getCreditSplitInForce(session, project.id),
    listActiveUsers(),
    projectTimeline(session, project.id, { limit: TIMELINE_CARD_LIMIT }),
    listQuotationThreads(session, { projectId: project.id }),
  ]);

  // **Live means the chain has not closed.** `closed_at` `[25 §24]` is the
  // other reading — a thread the rep closes because he knows nothing more is
  // coming — but nothing writes it yet, so the chain is the only answer
  // available and this is not a second definition of it.
  const live = threads.rows.filter((row) => row.position !== "closed");

  // `25 §22` — one thread per project is the encouraged path, and a second is
  // usually the coordinator not knowing the first exists. One gets the strip;
  // several get the flag, because a strip implies ONE position and a project
  // with three live threads does not have one.
  const only = live.length === 1 ? live[0] : null;
  // The last two nodes, made real. `listDispatches` already filters by thread,
  // and anyone who can see the thread can see its dispatches. The two statuses
  // are `S132`'s own: `submitted` is *ready to ship*, where the coordinator is
  // checking it `S88`, and `approved` is *won* `S31`. A `draft` is asked for by
  // neither — `S132` refuses it as a position because it is the rep's own to
  // edit `S125` and can sit for ever.
  const [onlyApproved, onlySubmitted] = only
    ? await Promise.all([
        listDispatches(session, { threadId: only.id, status: "approved" }),
        listDispatches(session, { threadId: only.id, status: "submitted" }),
      ])
    : [null, null];
  const onlyChain = only
    ? chainState({
        versionStatus: only.versionStatus,
        endState: only.endState,
        hasDispatch: (onlyApproved?.total ?? 0) > 0,
        hasSubmittedDispatch: (onlySubmitted?.total ?? 0) > 0,
      })
    : null;

  // **The one place quotations are summed, and only to show that summing them
  // is meaningless** — `25 §21` says quoted is never a sum, and `25 §22` asks
  // for exactly this flag: *"3 open quotations · 5,800 m² quoted against 2,000
  // expected"*. The same square metres counted three times is the point being
  // made. Nothing else may reuse this figure. Decimals stay strings `[22 §2]`.
  const quotedSqm =
    live.length > 1
      ? fromScaled(
          live.reduce(
            (total, row) =>
              total + (row.totalSqm ? toScaled(row.totalSqm, SQM_SCALE) : ZERO),
            ZERO,
          ),
          SQM_SCALE,
        )
      : null;

  const inForceIds = new Set(split?.rows.map((row) => row.userId) ?? []);
  const candidates = people.map((person) => ({
    id: person.id,
    name: person.name,
    // Prefilled: whoever is on the split now, or the owner when there is none
    // — `07 D3`'s baseline is 100% to the owner.
    inForce: split
      ? inForceIds.has(person.id)
      : person.id === project.ownerUserId,
  }));
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Riyadh",
    dateStyle: "short",
  }).format(new Date());

  // The elapsed figure for the turn panel, from the timeline already fetched.
  const lastEventDay = timeline.events[0]?.day ?? null;
  const sinceLastEvent = lastEventDay
    ? daysSince(new Date(`${lastEventDay}T00:00:00Z`))
    : 0;

  // Nobody owes the next action on a project that has been won or lost. A
  // committed one is deliberately not settled — see the turn panel below.
  const settled = project.won || project.endState !== null;

  const dash = t("common.none");

  return (
    <div className="flex flex-col gap-6">
      <DetailHeader
        name={project.name}
        state={[project.ownerName, t(projectStateKey(project))]

          .filter(Boolean)

          .join(" · ")}
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

      {/* `22 §3`'s turn panel. A resolved project owes nobody the next action;
          an open one is its owner's, and the elapsed figure is the timeline
          this page already loaded. No threshold is derived here — `25 §4`'s
          "on hold until" is the one of `S29`'s five with no column behind it,
          so this says only what is known.

          **Won and lost end it; committed does not.** A won project has had a
          dispatch approved against it `S31` and a lost one is closed `S29`, so
          neither owes anybody the next action. A committed project is still
          moving — the customer has agreed and nothing has shipped — so the
          line stays its owner's and the commitment reads as a pill in the
          header instead. That is `D2` exactly: a status may sit beside the
          line that says whose move it is, and is never that line. */}
      <TurnPanel
        who={initials(project.ownerName)}
        tone={settled ? "calm" : "soon"}
        line={
          settled
            ? t(projectStateKey(project))
            : t("projects.detail.turnOwner", { name: project.ownerName })

        }

        detail={
          lastEventDay === null
            ? t("coverage.fields.neverLogged")
            : t("coverage.fields.coveredFor", { count: sinceLastEvent })
        }
      />

      {/* `22 §6.6`'s strip, where this project has ONE live quotation thread —
          no second turn panel, because the panel above already names the
          project's own turn, and no explanation, which belongs on the
          quotation itself. */}
      {only && onlyChain ? (
        <Card>
          <CardHeader className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="text-start text-sm">
              {t("projects.chain.title")}
              {only.smacReference ? (
                <span className="num text-faint ms-2 font-normal" dir="ltr">
                  {only.smacReference}
                </span>
              ) : null}
            </CardTitle>
            <Button asChild size="xs" variant="ghost">
              <Link href={`/quotations/${only.id}`}>{t("common.view")}</Link>
            </Button>
          </CardHeader>
          <CardContent>
            <ChainStrip chain={onlyChain} />
          </CardContent>
        </Card>
      ) : null}

      {/* `25 §22`'s flag. Not a strip: three live threads have three
          positions, and the thing worth saying is that they exist at all. */}
      {live.length > 1 ? (
        <Card data-slot="chain-many">
          <CardHeader>
            <CardTitle className="text-start text-sm">
              {t("projects.chain.title")}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-tone-amber-fg text-start text-[13.5px] font-semibold">
              {t("projects.chain.manyThreads", { count: live.length })}
            </p>
            <dl
              data-slot="chain-many-figures"
              className="flex flex-wrap gap-x-8 gap-y-2"
            >
              <div className="text-start">
                <dt className="text-faint text-[11px]">
                  {t("projects.chain.quoted")}
                </dt>
                <dd className="num mt-0.5 text-sm font-semibold" dir="ltr">
                  {formatSqm(quotedSqm ?? "0")} {t("common.sqm")}
                </dd>
              </div>
              <div className="text-start">
                <dt className="text-faint text-[11px]">
                  {t("projects.chain.expected")}
                </dt>
                <dd className="num mt-0.5 text-sm font-semibold" dir="ltr">
                  {project.sqmExpected ? (
                    `${formatSqm(project.sqmExpected)} ${t("common.sqm")}`
                  ) : (
                    <span className="text-muted-foreground">{dash}</span>
                  )}
                </dd>
              </div>
            </dl>
            <p className="text-muted-foreground text-start text-xs">
              {t("projects.chain.manyThreadsHint")}
            </p>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-start text-sm">
            {t("projects.detail.details")}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          <Facts>
            {/* One field `S26`, the shape `S12` gives a company.
                `dir="auto"` on the value, never on the row `D62`. */}
            <Fact label={t("common.name")}>
              <span dir="auto">{project.name}</span>
            </Fact>
            <Fact label={t("projects.fields.owner")}>
              {project.ownerName}
            </Fact>
            <Fact label={t("projects.fields.sqmExpected")}>
              <span dir="ltr">
                {project.sqmExpected ? formatSqm(project.sqmExpected) : dash}
              </span>
            </Fact>
            <Fact label={t("common.region")}>
              {project.region ? t(`enums.region.${project.region}`) : dash}
            </Fact>
            <Fact label={t("common.city")}>
              {pickName(locale, project.cityNameEn, project.cityNameAr) ?? dash}
            </Fact>
            {/* Won is derived from an approved dispatch against this project
                `S31` — `getProject` resolves it in SQL, and cancelling that
                dispatch will un-win it with nothing here to amend `S73`. */}
            <Fact label={t("projects.fields.state")}>
              <ProjectStateBadge row={project} />
            </Fact>
            {/* `S29`'s fifth item, shown as its own fact rather than only
                through the state above: once a project is won or lost the
                state says so, and the rep's own judgement is still worth
                reading beside it. */}
            <Fact label={t("projects.fields.committed")}>
              {project.committed ? t("common.yes") : t("common.no")}
            </Fact>

            {project.endState === "lost" ? (
              <Fact label={t("projects.fields.lossReason")}>
                {pickName(locale, project.lostReasonNameEn, project.lostReasonNameAr) ??
                  dash}
              </Fact>
            ) : null}
            {project.endState === "lost" && project.lossReason ? (
              <Fact label={t("projects.fields.lossReasonDetail")}>
                {project.lossReason}
              </Fact>
            ) : null}
            {/* `25 §4` — a plain label the rep set, nothing derived. */}
            <Fact label={t("projects.fields.inProduction")}>
              {project.inProduction ? t("common.yes") : t("common.no")}
            </Fact>
            <Fact label={t("common.createdBy")}>
              {project.createdByName ?? t("common.unknownUser")}
            </Fact>
            <Fact label={t("common.createdAt")}>
              {format.dateTime(project.createdAt, { dateStyle: "medium" })}
            </Fact>
          </Facts>
        </CardContent>
      </Card>

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

      {/* Credit split `[07 D3]`, `[18 §3]` — the rare exception. Read-only for
          any project viewer, because it is how a rep learns why they were
          credited half; the editor is `can_set_credit_split` only `[12 §1]`. */}
      <Card>
        <CardHeader>
          <CardTitle className="text-start text-sm">
            {t("credit.title")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <CreditSplit
            action={setCreditSplitAction.bind(null, project.id)}
            candidates={candidates}
            inForce={split?.rows ?? null}
            effectiveFrom={split?.effectiveFrom ?? null}
            today={today}
            mayEdit={can(session, "canSetCreditSplit")}
          />
        </CardContent>
      </Card>

      {/* Sharing `[07 B1]`, `[07 B2]`. A project share is the one that carries
          furthest: `11 §2` cascades it to the threads raised on the project and
          `18 §2` cascades that to their dispatches. It still does not reach the
          project's companies — company visibility is its own question `[04 Q7]`
          — which is why this panel is per record rather than per deal. */}
      <SharingPanel
        session={session}
        recordType="project"
        recordId={project.id}
      />

      {/* `25 §18` — the rep's own date. On a project it suppresses the
          stage-unchanged chase until it arrives, and then becomes the
          follow-up itself. The founder's own case: a project going overdue in
          two days, with the follow-up already set for next week.

          Not rendered for a reader who may not set one `S76`: the date is a
          rep's note to themself about work they hold, `setNextFollowUp` refuses
          anyone else, and a panel whose only control is refused is `D51`'s
          control that does nothing. The project is not on that reader's queue
          either — `projectStageUnchanged` takes `ownProjectsFilter`. */}
      {mayEdit ? (
        <NextFollowUpPanel
          session={session}
          recordType="project"
          recordId={project.id}
          value={project.nextFollowUpAt}
        />
      ) : null}

      {/* `20 §6` — the project's own history. A report naming this project
          appears here AND on its company's timeline; a direct dispatch has no
          project and appears only on the company's `[07 C6]`. There is no Log
          button here: an interaction is anchored to a COMPANY `[20 §2]`, and
          the company page is where one starts. */}
      <Timeline
        events={timeline.events}
        total={timeline.total}
        fullHistoryHref={`/projects/${project.id}/timeline`}
        // A comment is not an interaction, so it IS offered here `[25 §9]`:
        // what it needs is a record to hang on, not a company to have visited.
        // Offered to whoever may act on the project — `addComment` gates on
        // the same check, and `S76` gives its reader sight and no voice.
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
  );
}
