/**
 * Projects — the data layer `09 §3.4`, and the project–company links `09 §3.5`.
 *
 * A project is first-class, not a child of a company `[04 Q2]`. It is created
 * by a rep and belongs to him `[07 A8]`, and it requires at least one linked
 * company `[07 A9]` — an application-layer rule, because SQL cannot express
 * "at least one row in another table".
 *
 * Visibility is owner or explicit share, never company membership: a shared
 * company does not expose its projects `[04 Q7]`. That rule lives in
 * `visibleProjectsFilter` and every read here composes it.
 *
 * Achieved SQM is never stored — it is derived from dispatches `[04 C1]`.
 * `sqm_expected` is the human forecast, and the only number a rep types.
 *
 * **Who bought is derived the same way** `S26`. There is no buyer flag;
 * `dispatchedSqmByCompany` below is the one place that knows how a dispatch
 * reaches a project, and since `S74` that is `dispatches.project_id`.
 *
 * **`ensureProjectParticipant` is the only writer of a participant row.** Both
 * ways in use it: a rep adding one by hand, and `S74`'s write-back when a
 * project-less quotation is dispatched. One path, so `S27`'s rules — soft
 * removal, re-linkable, the partial unique index — cannot hold for one caller
 * and not the other.
 */

import {
  and,
  count,
  desc,
  eq,
  ilike,
  inArray,
  isNull,
  sum,
  type SQL,
} from "drizzle-orm";

import { db } from "@/db";
import {
  cities,
  companies,
  dispatches,
  lossReasons,
  projectCompanies,
  projects,
  users,
} from "@/db/schema";
import { withAudit, type AuditEntry } from "@/lib/audit";
import {
  canViewRecord,
  visibleCompaniesFilter,
  visibleProjectsFilter,
  type AuthSession,
} from "@/lib/authz";
import {
  OTHER_LOSS_REASON_CODE,
  PROJECT_END_STATES,
  REGIONS,
  type ProjectEndState,
  type Region,
  type SameValues,
} from "@/lib/enums";
import { lossReasonCode, regionForCity } from "@/lib/lookups";
import { normalizeName } from "@/lib/normalize";
import { RuleError } from "@/lib/validation";

export type Project = typeof projects.$inferSelect;

/** The caller's transaction and pen, for the one exported writer below. */
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Log = (entry: AuditEntry) => void;

/** Compile-time proof that `enums.ts` still matches the database. */
export type EndStateMatchesSchema = SameValues<
  ProjectEndState,
  NonNullable<Project["endState"]>
>;

export { PROJECT_END_STATES, REGIONS };
export type { ProjectEndState };

export type ProjectInput = {
  nameEn: string;
  nameAr: string | null;
  sqmExpected: string | null;
  /** Optional, and deliberately not conditioned on anything: a project has no
   *  country, so `S15`'s "mandatory when Saudi" has nothing to hang on here.
   *  Whether it should be required at all is one of the three shapes open in
   *  `WORKFLOW §5`. What is settled is that this is the ONLY place a region can
   *  come from — there is no `region` field beside it, because `regionForCity`
   *  has no fallback and a caller supplying one would be supplying something
   *  the writer discards. */
  cityId: string | null;
  endState: ProjectEndState | null;
  /** Which of the nine `[25 §5]`; required when `endState` is `lost`. */
  lostReasonId: string | null;
  /** The `other` intake, and forbidden for every other code `[25 §5]`. */
  lossReason: string | null;
  /**
   * `[25 §4]` — a plain label the rep sets, deliberately unverified and
   * never to be derived from or checked against the production module:
   * production sometimes changes and stock sometimes covers an order.
   */
  inProduction: boolean;
};

/**
 * One row of the project–company join: a participant `S25`, and nothing else.
 *
 * It carries a single field because a participant *is* a single field since
 * `S25` dropped the role and `S26` dropped the buyer flag. It stays a named
 * type rather than collapsing to a bare `string` so that `createProject` and
 * `addProjectCompany` still say what they take.
 */
export type ProjectCompanyLink = {
  companyId: string;
};

export type ProjectListRow = {
  id: string;
  nameEn: string;
  nameAr: string | null;
  ownerName: string;
  sqmExpected: string | null;
  endState: ProjectEndState | null;
  region: Region | null;
  cityNameEn: string | null;
  cityNameAr: string | null;
  createdAt: Date;
};

const PAGE_SIZE = 25;

function searchFilter(query: string | undefined): SQL | undefined {
  const trimmed = query?.trim();
  if (!trimmed) return undefined;
  return ilike(
    projects.nameNormalized,
    `%${normalizeName(trimmed)}%`,
  );
}

/**
 * Projects this identity may see.
 *
 * `companyId` narrows to the projects linked to one company — used by the
 * company detail page. It narrows the visible set and never widens it: a rep
 * holding a company through a share sees the company and an empty projects
 * list, because `visibleProjectsFilter` is still the outer condition
 * `[04 Q7]`.
 */
export async function listProjects(
  session: AuthSession,
  options: { companyId?: string; q?: string; page?: number } = {},
): Promise<{ rows: ProjectListRow[]; total: number; page: number }> {
  const page = Math.max(1, options.page ?? 1);

  const linkedToCompany = options.companyId
    ? inArray(
        projects.id,
        db
          .select({ id: projectCompanies.projectId })
          .from(projectCompanies)
          .where(
            and(
              eq(projectCompanies.companyId, options.companyId),
              isNull(projectCompanies.removedAt),
            ),
          ),
      )
    : undefined;

  const where = and(
    visibleProjectsFilter(session),
    searchFilter(options.q),
    linkedToCompany,
  );

  const rows = await db
    .select({
      id: projects.id,
      nameEn: projects.nameEn,
      nameAr: projects.nameAr,
      ownerName: users.name,
      sqmExpected: projects.sqmExpected,
      endState: projects.endState,
      region: projects.region,
      cityNameEn: cities.nameEn,
      cityNameAr: cities.nameAr,
      createdAt: projects.createdAt,
    })
    .from(projects)
    .innerJoin(users, eq(projects.ownerUserId, users.id))
    .leftJoin(cities, eq(projects.cityId, cities.id))
    .where(where)
    .orderBy(desc(projects.createdAt))
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE);

  const [totals] = await db
    .select({ total: count() })
    .from(projects)
    .where(where);

  return { rows, total: totals?.total ?? 0, page };
}

export type ProjectCompanyRow = {
  id: string;
  companyId: string;
  companyName: string;
  /**
   * What this participant has dispatched against this project `S26`, summed —
   * a `numeric(14,4)` string, never a number.
   *
   * **`null` means no dispatch, and is not the same as `"0.0000"`.** A
   * participant with nothing dispatched shows nothing on the screen rather
   * than a zero, so the two must stay distinguishable all the way out.
   */
  dispatchedSqm: string | null;
  /**
   * Whether the viewer may open this company's own record.
   *
   * Seeing a project shows you which companies are on it — a project without
   * them is meaningless `[07 A9]` — but it does not grant access to those
   * company records `[14 §4 planning]`. False renders the name as plain text
   * rather than a link.
   */
  viewable: boolean;
};

export type ProjectDetail = Project & {
  ownerName: string;
  cityNameEn: string | null;
  cityNameAr: string | null;
  /** The picked reason's own name `[25 §5]` — null unless the project is lost. */
  lostReasonNameEn: string | null;
  lostReasonNameAr: string | null;
  createdByName: string | null;
  links: ProjectCompanyRow[];
};

export async function getProject(
  session: AuthSession,
  id: string,
): Promise<ProjectDetail | null> {
  const [row] = await db
    .select({
      project: projects,
      ownerName: users.name,
      cityNameEn: cities.nameEn,
      cityNameAr: cities.nameAr,
      lostReasonNameEn: lossReasons.nameEn,
      lostReasonNameAr: lossReasons.nameAr,
    })
    .from(projects)
    .innerJoin(users, eq(projects.ownerUserId, users.id))
    .leftJoin(cities, eq(projects.cityId, cities.id))
    .leftJoin(lossReasons, eq(projects.lostReasonId, lossReasons.id))
    .where(and(eq(projects.id, id), visibleProjectsFilter(session)))
    .limit(1);

  if (!row) return null;

  const [creator] = row.project.createdBy
    ? await db
        .select({ name: users.name })
        .from(users)
        .where(eq(users.id, row.project.createdBy))
        .limit(1)
    : [];

  const links = await listProjectCompanies(session, id);

  return {
    ...row.project,
    ownerName: row.ownerName,
    cityNameEn: row.cityNameEn,
    cityNameAr: row.cityNameAr,
    lostReasonNameEn: row.lostReasonNameEn,
    lostReasonNameAr: row.lostReasonNameAr,
    createdByName: creator?.name ?? null,
    links,
  };
}

/**
 * Dispatched square metres per company on one project `S26`.
 *
 * **A dispatch reaches a project by its own `project_id`** `S74`, and by
 * nothing else since this slice — the join through `quotation_threads` is
 * gone, which is what `S74` moving the project onto the dispatch is FOR. A
 * dispatch with no project reaches none, which today is exactly the direct
 * route `S75`.
 *
 * Migration 0013 backfilled the column from each dispatch's thread, so the
 * figures this returns are unchanged for every row that existed before it.
 * `verify:schema25` §11 asserts the two agree for every dispatch ever written
 * — that is the invariant `recordDispatch` enforces, and the backfill landing
 * correctly is a consequence of it rather than a separate claim.
 *
 * Grouped by **the dispatch's own company**, not the thread's: `S26` says a
 * dispatch names its company, and the two can differ.
 *
 * A company with no dispatch is **absent from the map, never zero**. "Nothing
 * has gone out" and "0.0000 m² went out" are the same fact said two ways, and
 * only one of them is worth a number on a screen.
 *
 * `sum()` rather than a `sql` template: a Drizzle column interpolated into a
 * `sql` template in the SELECT list **loses its table qualifier**. That is no
 * longer load-bearing here now the join is gone, and it stays because the next
 * join added to this query would make it load-bearing again. It returns
 * `string | null`, so the decimal stays a string end to end `[22 §2]`.
 *
 * No visibility term of its own: the caller has already proved the project
 * visible, and a project's figures follow it `[20 §13]` — the same terms
 * `listDispatchableThreads` totals on.
 */
async function dispatchedSqmByCompany(
  projectId: string,
): Promise<Map<string, string>> {
  const rows = await db
    .select({ companyId: dispatches.companyId, total: sum(dispatches.sqm) })
    .from(dispatches)
    .where(eq(dispatches.projectId, projectId))
    .groupBy(dispatches.companyId);

  return new Map(
    rows.flatMap((row) =>
      row.total === null ? [] : [[row.companyId, row.total] as const],
    ),
  );
}

/**
 * The live company links on a project: who is a participant `S25`, what each
 * has dispatched `S26`, and whether the viewer may open that company.
 *
 * Removed links are hidden `[14 §4]` — kept in the table, absent from the
 * screen. Ordered by name alone: there is no buyer to float to the top since
 * `S26`, and dispatched square metres are a fact about a participant rather
 * than a ranking of them.
 */
export async function listProjectCompanies(
  session: AuthSession,
  projectId: string,
): Promise<ProjectCompanyRow[]> {
  const rows = await db
    .select({
      id: projectCompanies.id,
      companyId: projectCompanies.companyId,
      companyName: companies.name,
    })
    .from(projectCompanies)
    .innerJoin(companies, eq(projectCompanies.companyId, companies.id))
    .where(
      and(
        eq(projectCompanies.projectId, projectId),
        isNull(projectCompanies.removedAt),
      ),
    )
    .orderBy(companies.name);

  if (rows.length === 0) return [];

  // One extra query rather than one per row: which of these companies is this
  // identity allowed to open on its own?
  const [viewableIds, dispatched] = await Promise.all([
    db
      .select({ id: companies.id })
      .from(companies)
      .where(
        and(
          inArray(
            companies.id,
            rows.map((row) => row.companyId),
          ),
          visibleCompaniesFilter(session),
        ),
      )
      .then((found) => new Set(found.map((row) => row.id))),
    dispatchedSqmByCompany(projectId),
  ]);

  return rows.map((row) => ({
    ...row,
    dispatchedSqm: dispatched.get(row.companyId) ?? null,
    viewable: viewableIds.has(row.companyId),
  }));
}

/* ------------------------------------------------------------------ *
 * Business rules, checked in the application layer
 * ------------------------------------------------------------------ */

/** `07 C5`, `04 Q18`, `25 §5` — a lost project has to say which of the nine. */
function assertLossReason(input: ProjectInput): void {
  if (input.endState === "lost" && !input.lostReasonId) {
    throw new RuleError("projects.errors.lossReasonRequired", "lostReasonId");
  }
}

/**
 * `25 §5`'s remaining half, owed since migration 0007 `[23]`: **`other`
 * requires the free-text detail; every other code forbids it.** A CHECK
 * cannot subquery `loss_reasons` to read the code behind a uuid, so it lives
 * here — `verify:schema25` §10 proves the writer and this rule agree.
 *
 * Gated on `endState === "lost"` first, same as `assertLossReason`: a stale
 * `lostReasonId` left in a hidden field by a rep who changed his mind about
 * being lost at all must be discarded, not validated, or the outer toggle on
 * the form would produce an error on a field the rep can no longer see.
 */
async function assertLossReasonDetail(input: ProjectInput): Promise<void> {
  if (input.endState !== "lost" || !input.lostReasonId) return;

  const code = await lossReasonCode(input.lostReasonId);
  if (!code) throw new RuleError("validation.invalid", "lostReasonId");

  const isOther = code === OTHER_LOSS_REASON_CODE;
  if (isOther && !input.lossReason) {
    throw new RuleError(
      "projects.errors.lossReasonDetailRequired",
      "lossReason",
    );
  }
  if (!isOther && input.lossReason) {
    throw new RuleError(
      "projects.errors.lossReasonDetailForbidden",
      "lossReason",
    );
  }
}

/** The three columns a loss writes, which move together `[25 §5]`. */
type ProjectLossFields = {
  lostReasonId: string | null;
  lostAt: Date | null;
  lossReason: string | null;
};

/**
 * What the loss columns become, given the form and the row as it stands.
 *
 * `25 §5` turns the loss reason from free text into **a reason plus its
 * detail**, and three database CHECKs hold the shape: the id and the date move
 * together, detail never appears without a reason, and a project that is not
 * lost carries none of them. So the three are decided in one place rather than
 * three, and both writers call it.
 *
 * **The reason is the rep's pick.** `lostReasonId` comes straight from the
 * form — `assertLossReason` already refused a loss with none, and
 * `assertLossReasonDetail` already refused a mismatched detail, so by the
 * time this runs the pair is known good.
 *
 * **Only becoming lost stamps the date.** Re-saving a project that is already
 * lost keeps the date it already had, so an unrelated edit — including
 * correcting the reason itself — does not rewrite when the loss happened.
 * Moving off `lost` clears all three, or `projects_loss_state` refuses the
 * row.
 */
async function lossFieldsFor(
  input: ProjectInput,
  before?: Pick<Project, "lostAt">,
): Promise<ProjectLossFields> {
  if (input.endState !== "lost") {
    return { lostReasonId: null, lostAt: null, lossReason: null };
  }
  return {
    lostReasonId: input.lostReasonId,
    lostAt: before?.lostAt ?? new Date(),
    lossReason: input.lossReason,
  };
}

/**
 * Every company id on the form must be one this identity may actually use.
 *
 * Checked in a single query rather than a loop, and composed with
 * `visibleCompaniesFilter` so it is the same rule the company list applies.
 * This is the guard that stops a tampered `<select>` from linking a project
 * to somebody else's company.
 */
async function assertCompaniesUsable(
  session: AuthSession,
  companyIds: string[],
): Promise<void> {
  if (companyIds.length === 0) return;
  const visible = await db
    .select({ id: companies.id })
    .from(companies)
    .where(
      and(inArray(companies.id, companyIds), visibleCompaniesFilter(session)),
    );
  if (visible.length !== new Set(companyIds).size) {
    throw new RuleError("projects.errors.companyNotVisible");
  }
}

/** `07 A9`, `12 §6`, and the unique index on (project, company). */
function assertLinksValid(links: ProjectCompanyLink[]): void {
  if (links.length === 0) {
    throw new RuleError("projects.errors.atLeastOneCompany");
  }
  const ids = links.map((link) => link.companyId);
  if (new Set(ids).size !== ids.length) {
    throw new RuleError("projects.errors.duplicateCompany");
  }
}

/* ------------------------------------------------------------------ *
 * Mutations
 * ------------------------------------------------------------------ */

export async function createProject(
  session: AuthSession,
  input: ProjectInput,
  links: ProjectCompanyLink[],
): Promise<Project> {
  assertLossReason(input);
  await assertLossReasonDetail(input);
  assertLinksValid(links);
  await assertCompaniesUsable(
    session,
    links.map((link) => link.companyId),
  );

  // The city decides the region, and with no city there is none `S15`. Read
  // before the transaction opens — it only reads, and a bad city id should not
  // have started one. The loss reason is the same: a lookup read, not a write.
  //
  // `regionForCity` no longer takes a fallback `[AUDIT 1 F3]`, so a posted
  // `input.region` is discarded here as it already was whenever a city was
  // chosen. Nothing has ever written one — 0 of 414 projects carry a region —
  // and the field's removal waits on the shape decision recorded in
  // `WORKFLOW §5`, because a project has no country to require a city against.
  const region = await regionForCity(input.cityId);
  const loss = await lossFieldsFor(input);

  return withAudit(session.actor, async (tx, log) => {
    const [project] = await tx
      .insert(projects)
      .values({
        ...input,
        ...loss,
        region,
        nameNormalized: normalizeName(input.nameEn),
        // Created by a rep and belongs to him `[07 A8]`.
        ownerUserId: session.user.id,
        createdBy: session.user.id,
      })
      .returning();

    log({
      action: "project.created",
      entityType: "project",
      entityId: project.id,
      after: project,
    });

    // Through the one writer, like every other participant row `S27`.
    // `assertLinksValid` already refused a duplicate, so each of these
    // inserts.
    for (const link of links) {
      await ensureProjectParticipant(tx, log, project.id, link.companyId);
    }

    return project;
  });
}

const EDITABLE = [
  "nameEn",
  "nameAr",
  "sqmExpected",
  "region",
  "cityId",
  "endState",
  // The three loss columns are diffed too `[25 §5]`, so the audit log carries
  // which reason was recorded and when — not only the text behind it.
  "lostReasonId",
  "lostAt",
  "lossReason",
  "inProduction",
] as const;

export async function updateProject(
  session: AuthSession,
  id: string,
  input: ProjectInput,
): Promise<Project> {
  if (!(await canViewRecord(session, "project", id))) {
    throw new RuleError("projects.errors.notFound");
  }
  assertLossReason(input);
  await assertLossReasonDetail(input);

  return withAudit(session.actor, async (tx, log) => {
    const [before] = await tx
      .select()
      .from(projects)
      .where(eq(projects.id, id))
      .limit(1);
    if (!before) throw new RuleError("projects.errors.notFound");

    // What will actually be written: the region follows the city `[15 §4]`,
    // and the three loss columns follow the end state `[25 §5]`. The diff
    // compares against this rather than the form, so a region that changed
    // because the city changed — or a loss date stamped because the project
    // just became lost — is recorded as the change it is.
    const values = {
      ...input,
      ...(await lossFieldsFor(input, before)),
      region: await regionForCity(input.cityId),
    };

    const changed = EDITABLE.filter((key) => before[key] !== values[key]);
    if (changed.length === 0) return before;

    const [after] = await tx
      .update(projects)
      .set({ ...values, nameNormalized: normalizeName(values.nameEn) })
      .where(eq(projects.id, id))
      .returning();

    log({
      action: "project.updated",
      entityType: "project",
      entityId: id,
      before: Object.fromEntries(changed.map((key) => [key, before[key]])),
      after: Object.fromEntries(changed.map((key) => [key, after[key]])),
    });
    return after;
  });
}

/** Shared gate for the two link operations: adding one and removing one. */
async function assertProjectEditable(
  session: AuthSession,
  projectId: string,
): Promise<void> {
  if (!(await canViewRecord(session, "project", projectId))) {
    throw new RuleError("projects.errors.notFound");
  }
}

/**
 * Link a company to a project unless it already is one `S27`, in the caller's
 * transaction. Returns false when a live link was already there.
 *
 * **This is the only place a participant row is written**, and it is exported
 * because `S74` has a second way in: dispatching a project-less quotation adds
 * the quotation's company to the project it gains. That write must obey the
 * same rules as a rep adding one by hand, and the only way to guarantee that
 * is for it to be the same statement.
 *
 * "Already one" means a LIVE link. A removed link is re-linked with a new row
 * rather than resurrected, which is what `project_companies_key` — partial on
 * `removed_at is null` — exists to allow `[14 §4]`.
 *
 * No visibility check of its own: each caller has its own, and they differ.
 * A rep must be able to use the company `[12 §6]`; the coordinator dispatching
 * has `can_dispatch`'s reach and no company visibility at all `[18 §2]`.
 */
export async function ensureProjectParticipant(
  tx: Tx,
  log: Log,
  projectId: string,
  companyId: string,
): Promise<boolean> {
  const [existing] = await tx
    .select({ id: projectCompanies.id })
    .from(projectCompanies)
    .where(
      and(
        eq(projectCompanies.projectId, projectId),
        eq(projectCompanies.companyId, companyId),
        isNull(projectCompanies.removedAt),
      ),
    )
    .limit(1);
  if (existing) return false;

  const [row] = await tx
    .insert(projectCompanies)
    .values({ projectId, companyId })
    .returning();
  log({
    action: "project_company.linked",
    entityType: "project_company",
    entityId: row.id,
    after: row,
  });
  return true;
}

export async function addProjectCompany(
  session: AuthSession,
  projectId: string,
  link: ProjectCompanyLink,
): Promise<void> {
  await assertProjectEditable(session, projectId);
  await assertCompaniesUsable(session, [link.companyId]);

  await withAudit(session.actor, async (tx, log) => {
    // A rep who picks a company that is already on the project is told so;
    // `S74`'s write-back, which cannot know either way, is not.
    const linked = await ensureProjectParticipant(
      tx,
      log,
      projectId,
      link.companyId,
    );
    if (!linked) throw new RuleError("projects.errors.duplicateCompany");
  });
}

/**
 * Take a company off a project `[14 §4]`.
 *
 * Soft: the row is kept and hidden, like every other state change in FACET
 * `[09 §1]`. The last live link cannot be removed — a project requires at
 * least one company `[07 A9]`, and that rule does not stop applying because
 * the removal is spelled differently.
 */
export async function removeProjectCompany(
  session: AuthSession,
  projectId: string,
  linkId: string,
): Promise<void> {
  await assertProjectEditable(session, projectId);

  await withAudit(session.actor, async (tx, log) => {
    const live = await tx
      .select()
      .from(projectCompanies)
      .where(
        and(
          eq(projectCompanies.projectId, projectId),
          isNull(projectCompanies.removedAt),
        ),
      );

    const target = live.find((row) => row.id === linkId);
    if (!target) throw new RuleError("projects.errors.notFound");
    if (live.length <= 1) throw new RuleError("projects.errors.lastCompany");

    const [after] = await tx
      .update(projectCompanies)
      .set({ removedAt: new Date() })
      .where(eq(projectCompanies.id, linkId))
      .returning();

    log({
      action: "project_company.removed",
      entityType: "project_company",
      entityId: linkId,
      before: target,
      after: { removedAt: after.removedAt },
    });
  });
}
