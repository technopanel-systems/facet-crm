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
 */

import {
  and,
  count,
  desc,
  eq,
  ilike,
  inArray,
  isNull,
  type SQL,
} from "drizzle-orm";

import { db } from "@/db";
import {
  cities,
  companies,
  projectCompanies,
  projects,
  users,
} from "@/db/schema";
import { withAudit } from "@/lib/audit";
import {
  canViewRecord,
  visibleCompaniesFilter,
  visibleProjectsFilter,
  type AuthSession,
} from "@/lib/authz";
import {
  PROJECT_END_STATES,
  REGIONS,
  type ProjectEndState,
  type Region,
  type SameValues,
} from "@/lib/enums";
import { regionForCity } from "@/lib/lookups";
import { normalizedNameFor } from "@/lib/normalize";
import { RuleError } from "@/lib/validation";

export type Project = typeof projects.$inferSelect;

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
  region: Region | null;
  cityId: string | null;
  endState: ProjectEndState | null;
  lossReason: string | null;
};

/** One row of the project–company join `[12 §5, §6]`. */
export type ProjectCompanyLink = {
  companyId: string;
  /** Free text, never a vocabulary `[12 §5]`. */
  role: string | null;
  isBuyer: boolean;
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
    `%${normalizedNameFor({ nameEn: trimmed })}%`,
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
  companyNameEn: string;
  companyNameAr: string | null;
  role: string | null;
  isBuyer: boolean;
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
    })
    .from(projects)
    .innerJoin(users, eq(projects.ownerUserId, users.id))
    .leftJoin(cities, eq(projects.cityId, cities.id))
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
    createdByName: creator?.name ?? null,
    links,
  };
}

/**
 * The live company links on a project, each flagged with whether the viewer
 * may open that company.
 *
 * Removed links are hidden `[14 §4]` — kept in the table, absent from the
 * screen.
 */
export async function listProjectCompanies(
  session: AuthSession,
  projectId: string,
): Promise<ProjectCompanyRow[]> {
  const rows = await db
    .select({
      id: projectCompanies.id,
      companyId: projectCompanies.companyId,
      companyNameEn: companies.nameEn,
      companyNameAr: companies.nameAr,
      role: projectCompanies.role,
      isBuyer: projectCompanies.isBuyer,
    })
    .from(projectCompanies)
    .innerJoin(companies, eq(projectCompanies.companyId, companies.id))
    .where(
      and(
        eq(projectCompanies.projectId, projectId),
        isNull(projectCompanies.removedAt),
      ),
    )
    .orderBy(desc(projectCompanies.isBuyer), companies.nameEn);

  if (rows.length === 0) return [];

  // One extra query rather than one per row: which of these companies is this
  // identity allowed to open on its own?
  const viewableIds = new Set(
    (
      await db
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
    ).map((row) => row.id),
  );

  return rows.map((row) => ({ ...row, viewable: viewableIds.has(row.companyId) }));
}

/* ------------------------------------------------------------------ *
 * Business rules, checked in the application layer
 * ------------------------------------------------------------------ */

/** `07 C5`, `04 Q18` — a lost project has to say why. */
function assertLossReason(input: ProjectInput): void {
  if (input.endState === "lost" && !input.lossReason) {
    throw new RuleError("projects.errors.lossReasonRequired", "lossReason");
  }
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
  if (links.filter((link) => link.isBuyer).length > 1) {
    throw new RuleError("projects.errors.oneBuyerOnly");
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
  assertLinksValid(links);
  await assertCompaniesUsable(
    session,
    links.map((link) => link.companyId),
  );

  // The city decides the region when there is one `[15 §4]`. Read before the
  // transaction opens — it only reads, and a bad city id should not have
  // started one.
  const region = await regionForCity(input.cityId, input.region);

  return withAudit(session.actor, async (tx, log) => {
    const [project] = await tx
      .insert(projects)
      .values({
        ...input,
        region,
        nameNormalized: normalizedNameFor(input),
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

    for (const link of links) {
      const [row] = await tx
        .insert(projectCompanies)
        .values({ ...link, projectId: project.id })
        .returning();
      log({
        action: "project_company.linked",
        entityType: "project_company",
        entityId: row.id,
        after: row,
      });
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
  "lossReason",
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

  return withAudit(session.actor, async (tx, log) => {
    const [before] = await tx
      .select()
      .from(projects)
      .where(eq(projects.id, id))
      .limit(1);
    if (!before) throw new RuleError("projects.errors.notFound");

    // What will actually be written: the region follows the city `[15 §4]`.
    // The diff compares against this rather than the form, so a region that
    // changed because the city changed is recorded as the change it is.
    const values: ProjectInput = {
      ...input,
      region: await regionForCity(input.cityId, input.region),
    };

    const changed = EDITABLE.filter((key) => before[key] !== values[key]);
    if (changed.length === 0) return before;

    const [after] = await tx
      .update(projects)
      .set({ ...values, nameNormalized: normalizedNameFor(values) })
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

/** Shared gate for the three link operations. */
async function assertProjectEditable(
  session: AuthSession,
  projectId: string,
): Promise<void> {
  if (!(await canViewRecord(session, "project", projectId))) {
    throw new RuleError("projects.errors.notFound");
  }
}

/**
 * Clear the current buyer, if any, inside an open transaction.
 *
 * "At most one buyer" `[12 §6]` is enforced by a partial unique index, so
 * naming a new buyer without clearing the old one would raise a constraint
 * violation. Doing it here means the user sees a moved flag rather than a
 * Postgres error, and both changes land in the same audited transaction.
 */
async function clearBuyer(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  projectId: string,
  log: (entry: {
    action: string;
    entityType: string;
    entityId?: string;
    before?: unknown;
    after?: unknown;
  }) => void,
  exceptCompanyId?: string,
): Promise<void> {
  const current = await tx
    .select()
    .from(projectCompanies)
    .where(
      and(
        eq(projectCompanies.projectId, projectId),
        eq(projectCompanies.isBuyer, true),
        isNull(projectCompanies.removedAt),
      ),
    );

  for (const row of current) {
    if (row.companyId === exceptCompanyId) continue;
    await tx
      .update(projectCompanies)
      .set({ isBuyer: false })
      .where(eq(projectCompanies.id, row.id));
    log({
      action: "project_company.updated",
      entityType: "project_company",
      entityId: row.id,
      before: { isBuyer: true },
      after: { isBuyer: false },
    });
  }
}

export async function addProjectCompany(
  session: AuthSession,
  projectId: string,
  link: ProjectCompanyLink,
): Promise<void> {
  await assertProjectEditable(session, projectId);
  await assertCompaniesUsable(session, [link.companyId]);

  await withAudit(session.actor, async (tx, log) => {
    const [existing] = await tx
      .select()
      .from(projectCompanies)
      .where(
        and(
          eq(projectCompanies.projectId, projectId),
          eq(projectCompanies.companyId, link.companyId),
          isNull(projectCompanies.removedAt),
        ),
      )
      .limit(1);
    if (existing) throw new RuleError("projects.errors.duplicateCompany");

    if (link.isBuyer) await clearBuyer(tx, projectId, log);

    const [row] = await tx
      .insert(projectCompanies)
      .values({ ...link, projectId })
      .returning();
    log({
      action: "project_company.linked",
      entityType: "project_company",
      entityId: row.id,
      after: row,
    });
  });
}

export async function updateProjectCompany(
  session: AuthSession,
  projectId: string,
  linkId: string,
  patch: { role: string | null; isBuyer: boolean },
): Promise<void> {
  await assertProjectEditable(session, projectId);

  await withAudit(session.actor, async (tx, log) => {
    const [before] = await tx
      .select()
      .from(projectCompanies)
      .where(
        and(
          eq(projectCompanies.id, linkId),
          eq(projectCompanies.projectId, projectId),
          isNull(projectCompanies.removedAt),
        ),
      )
      .limit(1);
    if (!before) throw new RuleError("projects.errors.notFound");

    if (before.role === patch.role && before.isBuyer === patch.isBuyer) return;

    // Clear any other buyer first, or the partial unique index raises.
    if (patch.isBuyer) await clearBuyer(tx, projectId, log, before.companyId);

    const [after] = await tx
      .update(projectCompanies)
      .set({ role: patch.role, isBuyer: patch.isBuyer })
      .where(eq(projectCompanies.id, linkId))
      .returning();

    log({
      action: "project_company.updated",
      entityType: "project_company",
      entityId: linkId,
      before: { role: before.role, isBuyer: before.isBuyer },
      after: { role: after.role, isBuyer: after.isBuyer },
    });
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
