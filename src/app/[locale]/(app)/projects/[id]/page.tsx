import { notFound } from "next/navigation";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";

import {
  DetailHeader,
  Fact,
  Facts,
} from "@/components/page-header";
import { Timeline } from "@/components/timeline";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { can, listActiveUsers, requireSession } from "@/lib/authz";
import { chainState } from "@/lib/chain";
import { listCompanyOptions } from "@/lib/companies";
import { getCreditSplitInForce } from "@/lib/credit-splits";
import { fromScaled, SQM_SCALE, toScaled, ZERO } from "@/lib/decimal";
import { listDispatches } from "@/lib/dispatches";
import { bilingualName, pickName } from "@/lib/lookups";
import { getProject } from "@/lib/projects";
import { listQuotationThreads } from "@/lib/quotations";
import { projectTimeline, TIMELINE_CARD_LIMIT } from "@/lib/timeline";

import { setCreditSplitAction } from "../actions";
import { ChainStrip } from "../../_components/chain-strip";
import { CommentBox } from "../../_components/comment-box";
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
  const live = threads.rows.filter(
    (row) => chainState(row).position !== "closed",
  );

  // `25 §22` — one thread per project is the encouraged path, and a second is
  // usually the coordinator not knowing the first exists. One gets the strip;
  // several get the flag, because a strip implies ONE position and a project
  // with three live threads does not have one.
  const only = live.length === 1 ? live[0] : null;
  const onlyChain = only
    ? chainState({
        versionStatus: only.versionStatus,
        endState: only.endState,
        paymentConfirmedAt: only.paymentConfirmedAt,
        // The sixth node, made real. `listDispatches` already filters by
        // thread, and anyone who can see the thread can see its dispatches.
        hasDispatch:
          (await listDispatches(session, { threadId: only.id })).total > 0,
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

  const dash = t("common.none");

  return (
    <div className="flex flex-col gap-6">
      <DetailHeader
        name={bilingualName(project, locale)}
        state={[
          project.ownerName,
          project.endState
            ? t(`enums.projectEndState.${project.endState}`)
            : t("projects.fields.endStateOpen"),
        ]
          .filter(Boolean)
          .join(" · ")}
        action={
          <Button asChild size="sm" variant="outline">
            <Link href={`/projects/${project.id}/edit`}>{t("common.edit")}</Link>
          </Button>
        }
      />

      {/* `22 §3`'s turn panel. A resolved project owes nobody the next action;
          an open one is its owner's, and the elapsed figure is the timeline
          this page already loaded. No threshold is derived here — `25 §4`'s
          "in production", "on hold until" and "lost" are the rep's own inputs
          and none of them is built yet, so this says only what is known. */}
      <TurnPanel
        who={initials(project.ownerName)}
        tone={project.endState ? "calm" : "soon"}
        line={
          project.endState
            ? t(`enums.projectEndState.${project.endState}`)
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
                  {quotedSqm} {t("common.sqm")}
                </dd>
              </div>
              <div className="text-start">
                <dt className="text-faint text-[11px]">
                  {t("projects.chain.expected")}
                </dt>
                <dd className="num mt-0.5 text-sm font-semibold" dir="ltr">
                  {project.sqmExpected ? (
                    `${project.sqmExpected} ${t("common.sqm")}`
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
            <Fact label={t("common.nameEn")}>{project.nameEn}</Fact>
            <Fact label={t("common.nameAr")}>
              {project.nameAr ?? dash}
            </Fact>
            <Fact label={t("projects.fields.owner")}>
              {project.ownerName}
            </Fact>
            <Fact label={t("projects.fields.sqmExpected")}>
              <span dir="ltr">{project.sqmExpected ?? dash}</span>
            </Fact>
            <Fact label={t("common.region")}>
              {project.region ? t(`enums.region.${project.region}`) : dash}
            </Fact>
            <Fact label={t("common.city")}>
              {pickName(locale, project.cityNameEn, project.cityNameAr) ?? dash}
            </Fact>
            <Fact label={t("projects.fields.endState")}>
              {project.endState ? (
                <Badge
                  variant={
                    project.endState === "lost" ? "destructive" : "secondary"
                  }
                >
                  {t(`enums.projectEndState.${project.endState}`)}
                </Badge>
              ) : (
                t("projects.fields.endStateOpen")
              )}
            </Fact>
            {project.endState === "lost" ? (
              <Fact label={t("projects.fields.lossReason")}>
                {project.lossReason ?? dash}
              </Fact>
            ) : null}
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
            locale={locale}
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
        composer={
          <CommentBox
            session={session}
            recordType="project"
            recordId={project.id}
          />
        }
      />
    </div>
  );
}
