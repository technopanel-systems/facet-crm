/**
 * Dispatch `[09 §6.1]` — what the coordinator records as actually having gone
 * out, and the one event that credits a target `[04 flow 16]`, `[04 C1]`.
 *
 * The rules, and where each comes from:
 *
 *  1. **Gated on `can_dispatch`** `[07 A5]`. The coordinator records it; a rep
 *     never does, and neither does the manager `[12 §3]`.
 *  2. **Always a company, a rep and SQM. The quotation link is OPTIONAL**
 *     `[07 C6]` — customers sometimes buy directly from internal sales or from
 *     a rep.
 *  3. **Against a quotation: blocked until payment is confirmed** `[07 C3]`.
 *     `09 §6.1` states the scope explicitly — *"dispatch **against a
 *     quotation** is blocked until that quotation's payment is confirmed"*. A
 *     direct dispatch has no quotation, so the rule has no object; `07 C6`'s
 *     **coordinator approval** is the control that stands in its place, and
 *     `approved_by_user_id IS NOT NULL` is therefore exactly the marker that
 *     makes the direct route *visible as such in reporting* `[18 §7]`.
 *  4. **One quotation, several partial dispatches** `[04 quantities]`.
 *     Quotation quantity ≠ paid quantity ≠ dispatched quantity, so nothing
 *     here caps a dispatch against what was quoted or paid.
 *  5. **Company and rep are DERIVED from the thread when there is one**
 *     `[18 §7]`. CLAUDE.md's first design principle, and it closes `07 D3`'s
 *     stated worry: if the coordinator picks the rep, the credited person
 *     becomes a dropdown choice rather than a fact of the quotation chain.
 *  6. **The project is recorded on the dispatch** `S74`, and derived the same
 *     way whenever the thread has one: shown, never chosen. When the thread
 *     has none `S50`, the coordinator chooses, and that choice is written back
 *     onto the quotation and adds its company to the project as a participant
 *     `S27`. All three writes are one transaction with the dispatch — a
 *     project written back onto a quotation whose dispatch then failed would
 *     be a decision nobody made.
 *
 *     **A dispatch's project is never different from its thread's** `S74`.
 *     The pair spans two rows, so no CHECK can hold it; it is enforced here,
 *     exactly as the company is, and asserted for every row ever written by
 *     `verify:schema25` §11.
 *  7. **Recording a dispatch NEVER sets a credit split** `[07 D3]`, `[12 §1]`.
 *     This module does not import `setCreditSplit`, and `verify-slice3`
 *     counts rows to prove it.
 *
 * **`sqm` is typed, and that is not a violation.** CLAUDE.md's "square metres
 * are always generated, never hand-entered" is scoped to quotation lines —
 * `quantity_pcs × width_m × length_m` `[13 §2]`. `dispatches` has no dimension
 * columns, and `04 quantities` makes dispatched sqm independent of quoted sqm.
 * There is nothing to generate it from.
 *
 * Every read composes a filter from `authz`; every write goes through
 * `withAudit`, which owns the transaction `[07 E1]`.
 */

import {
  and,
  count,
  desc,
  eq,
  gte,
  inArray,
  isNotNull,
  isNull,
  lt,
  lte,
  ne,
  or,
  sql,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { db } from "@/db";
import {
  companies,
  dispatches,
  projects,
  quotationThreads,
  quotationVersions,
  users,
} from "@/db/schema";
import { withAudit } from "@/lib/audit";
import {
  can,
  canOpenRecord,
  canViewRecord,
  dispatchCompanyLookupFilter,
  visibleDispatchesFilter,
  visibleProjectsFilter,
  visibleQuotationThreadsFilter,
  type AuthSession,
} from "@/lib/authz";
import {
  creditForDispatches,
  type CreditableDispatch,
  type DispatchCredit,
} from "@/lib/credit-splits";
import { SQM_SCALE, ZERO, toScaled } from "@/lib/decimal";
import { ensureProjectParticipant } from "@/lib/projects";
import { RuleError } from "@/lib/validation";

export type Dispatch = typeof dispatches.$inferSelect;

const PAGE_SIZE = 25;

export type DispatchInput = {
  /** `numeric(14,4)`, typed — see the module note above. */
  sqm: string;
  /** `YYYY-MM-DD`. */
  dispatchDate: string;
  /** Optional `[07 C6]`. When set, company and rep are derived from it. */
  quotationThreadId: string | null;
  /** Direct dispatches only. Ignored — and refused if it disagrees — when a
   *  thread is given `[18 §7]`. */
  companyId: string | null;
  /** Direct dispatches only. */
  userId: string | null;
  /**
   * `S74`. Required when the thread has no project of its own `S50`; ignored,
   * and refused if it disagrees, when the thread has one. Null on the direct
   * route, which names no project this slice `S75`.
   */
  projectId: string | null;
};

export type DispatchListRow = {
  id: string;
  dispatchDate: string;
  sqm: string;
  companyId: string;
  companyName: string;
  /** May the viewer OPEN the company? `can_dispatch` sees the name only
   *  `[18 §2]` — which `S76` did not change for companies — so the screen
   *  renders plain text rather than a link. */
  companyViewable: boolean;
  userId: string;
  userName: string;
  recordedByName: string;
  quotationThreadId: string | null;
  smacReference: string | null;
  threadViewable: boolean;
  /** Derived from the null thread, never stored `[07 C6]`. */
  isDirect: boolean;
  approvedByName: string | null;
  approvedAt: Date | null;
  createdAt: Date;
};

export type DispatchDetail = DispatchListRow & {
  projectId: string | null;
  projectNameEn: string | null;
  projectNameAr: string | null;
  projectViewable: boolean;
  credit: DispatchCredit;
};

/** A thread a dispatch may actually be recorded against: visible, and paid. */
export type DispatchableThread = {
  id: string;
  smacReference: string | null;
  /** Null when the quotation has no project `S50` — the coordinator picks one
   *  as part of dispatching it `S74`. */
  projectId: string | null;
  projectNameEn: string | null;
  projectNameAr: string | null;
  companyId: string;
  companyName: string;
  raisedByUserId: string;
  raisedByName: string;
  /** The live version's total, for information. Never a cap `[04 quantities]`. */
  quotedSqm: string | null;
  /** Running total already dispatched against this thread. Also not a cap. */
  dispatchedSqm: string;
};

/* ------------------------------------------------------------------ *
 * Writing
 * ------------------------------------------------------------------ */

/**
 * Record what went out. The one event that credits a target `[04 C1]`.
 *
 * Two modes, and the difference between them is the whole of `07 C6`:
 *
 * | | gate | approval columns |
 * |---|---|---|
 * | against a quotation | payment confirmed `[07 C3]` | stay null — the chain is the approval |
 * | direct | `can_dispatch` | stamped with the coordinator `[07 C6]` |
 *
 * And two ways the project arrives `S74`, which is the whole of that rule:
 * taken from the thread, or chosen and written back onto it.
 */
export async function recordDispatch(
  session: AuthSession,
  input: DispatchInput,
): Promise<Dispatch> {
  if (!can(session, "canDispatch")) {
    throw new RuleError("dispatches.errors.dispatchOnly");
  }

  const sqmScaled = toScaled(input.sqm, SQM_SCALE);
  if (sqmScaled <= ZERO) {
    throw new RuleError("dispatches.errors.sqmPositive", "sqm");
  }

  let companyId = input.companyId;
  let userId = input.userId;
  let projectId = input.projectId;
  /** `S74`'s second branch: the project is new to the quotation. */
  let writeBackProject = false;

  if (input.quotationThreadId) {
    // Visibility first — a thread the actor cannot see does not exist to them.
    if (
      !(await canViewRecord(
        session,
        "quotation_thread",
        input.quotationThreadId,
      ))
    ) {
      throw new RuleError("dispatches.errors.threadNotVisible", "threadId");
    }

    const [thread] = await db
      .select({
        companyId: quotationThreads.companyId,
        raisedByUserId: quotationThreads.raisedByUserId,
        paymentConfirmedAt: quotationThreads.paymentConfirmedAt,
        projectId: quotationThreads.projectId,
      })
      .from(quotationThreads)
      .where(eq(quotationThreads.id, input.quotationThreadId))
      .limit(1);
    if (!thread) {
      throw new RuleError("dispatches.errors.threadNotVisible", "threadId");
    }

    // `07 C3` — the gate this whole slice exists to enforce.
    if (!thread.paymentConfirmedAt) {
      throw new RuleError("dispatches.errors.paymentNotConfirmed", "threadId");
    }

    // `18 §7` — derived, not asked for. A caller that supplies a different
    // company is refused rather than silently corrected: a dispatch that
    // disagrees with the quotation it is against is a mistake worth naming.
    if (companyId && companyId !== thread.companyId) {
      throw new RuleError("dispatches.errors.companyNotOnThread", "companyId");
    }
    companyId = thread.companyId;
    userId = thread.raisedByUserId;

    if (thread.projectId) {
      // `S74` — the dispatch takes the thread's project, shown and not chosen.
      // A disagreeing input is refused rather than silently corrected: the
      // same trade the company check above makes, for the same reason.
      if (projectId && projectId !== thread.projectId) {
        throw new RuleError("dispatches.errors.projectNotOnThread", "projectId");
      }
      projectId = thread.projectId;
    } else {
      // `S74` — the quotation has none `S50`, so the coordinator chooses, and
      // the choice is written back below. Checked against the same filter the
      // picker is built from, so the form never offers what this refuses.
      //
      // Ordinary project visibility since `S76`: the name-only lookup this
      // used to compose was the stopgap that made `S74` performable before the
      // coordinator could see a project, and it came out with the rule.
      if (!projectId) {
        throw new RuleError("dispatches.errors.projectRequired", "projectId");
      }
      const [pickable] = await db
        .select({ id: projects.id })
        .from(projects)
        .where(and(eq(projects.id, projectId), visibleProjectsFilter(session)))
        .limit(1);
      if (!pickable) {
        throw new RuleError("dispatches.errors.projectNotVisible", "projectId");
      }
      writeBackProject = true;
    }
  } else {
    if (!companyId) {
      throw new RuleError("dispatches.errors.companyRequired", "companyId");
    }
    if (!userId) {
      throw new RuleError("dispatches.errors.repRequired", "userId");
    }
    // The company must be one this identity may name `[18 §2]` — for a
    // coordinator that is any company, by name; for anyone else it is the
    // ordinary visibility rule.
    const [namable] = await db
      .select({ id: companies.id })
      .from(companies)
      .where(and(eq(companies.id, companyId), dispatchCompanyLookupFilter(session)))
      .limit(1);
    if (!namable) {
      throw new RuleError("dispatches.errors.companyNotVisible", "companyId");
    }
  }

  const isDirect = input.quotationThreadId === null;
  // The direct route names no project this slice `S75`: its stated-purpose
  // half is not built, and nothing may reach a project without a thread to
  // have derived it from.
  if (isDirect) projectId = null;

  return withAudit(session.actor, async (tx, log) => {
    // `S74` — the write-back comes FIRST, so the dispatch is inserted against
    // a quotation that already carries the project. Guarded on the column
    // still being null: two coordinators dispatching the same project-less
    // quotation must not both write, and the row count is what says so.
    if (writeBackProject) {
      const written = await tx
        .update(quotationThreads)
        .set({ projectId })
        .where(
          and(
            eq(quotationThreads.id, input.quotationThreadId as string),
            isNull(quotationThreads.projectId),
          ),
        )
        .returning({ id: quotationThreads.id });
      if (written.length !== 1) {
        throw new RuleError("dispatches.errors.projectAlreadySet", "projectId");
      }
      log({
        action: "quotation_thread.project_set",
        entityType: "quotation_thread",
        entityId: input.quotationThreadId as string,
        before: { projectId: null },
        after: { projectId },
      });

      // `S74` — and the quotation's company joins that project if it is not
      // already a participant. Through `projects.ts`'s one writer, so `S27`
      // holds for this route exactly as for a rep adding one by hand.
      await ensureProjectParticipant(
        tx,
        log,
        projectId as string,
        companyId as string,
      );
    }

    const [created] = await tx
      .insert(dispatches)
      .values({
        companyId: companyId as string,
        userId: userId as string,
        sqm: input.sqm,
        quotationThreadId: input.quotationThreadId,
        projectId,
        dispatchDate: input.dispatchDate,
        recordedByUserId: session.user.id,
        // `07 C6` — the coordinator's approval IS the direct route's control,
        // standing in for the payment gate that has no object here.
        approvedByUserId: isDirect ? session.user.id : null,
        approvedAt: isDirect ? new Date() : null,
      })
      .returning();

    log({
      action: "dispatch.recorded",
      entityType: "dispatch",
      entityId: created.id,
      after: created,
    });
    return created;
  });
}

/* ------------------------------------------------------------------ *
 * Reading
 * ------------------------------------------------------------------ */

function searchFilter(query: string | undefined) {
  const trimmed = query?.trim();
  if (!trimmed) return undefined;
  const pattern = `%${trimmed}%`;
  return or(
    sql`${companies.name} ilike ${pattern}`,
    sql`${users.name} ilike ${pattern}`,
  );
}

export async function listDispatches(
  session: AuthSession,
  options: {
    q?: string;
    userId?: string;
    companyId?: string;
    threadId?: string;
    /** `07 C6` — the direct route, made countable. */
    direct?: boolean;
    from?: string;
    to?: string;
    page?: number;
  } = {},
): Promise<{ rows: DispatchListRow[]; total: number; page: number }> {
  const page = Math.max(1, options.page ?? 1);
  const recordedBy = alias(users, "recorded_by");
  const approvedBy = alias(users, "approved_by");

  const where = and(
    visibleDispatchesFilter(session),
    searchFilter(options.q),
    options.userId ? eq(dispatches.userId, options.userId) : undefined,
    options.companyId ? eq(dispatches.companyId, options.companyId) : undefined,
    options.threadId
      ? eq(dispatches.quotationThreadId, options.threadId)
      : undefined,
    options.direct === true ? isNull(dispatches.quotationThreadId) : undefined,
    options.direct === false
      ? isNotNull(dispatches.quotationThreadId)
      : undefined,
    options.from ? gte(dispatches.dispatchDate, options.from) : undefined,
    options.to ? lte(dispatches.dispatchDate, options.to) : undefined,
  );

  const rows = await db
    .select({
      id: dispatches.id,
      dispatchDate: dispatches.dispatchDate,
      sqm: dispatches.sqm,
      companyId: dispatches.companyId,
      companyName: companies.name,
      userId: dispatches.userId,
      userName: users.name,
      recordedByName: recordedBy.name,
      quotationThreadId: dispatches.quotationThreadId,
      approvedByName: approvedBy.name,
      approvedAt: dispatches.approvedAt,
      createdAt: dispatches.createdAt,
    })
    .from(dispatches)
    .innerJoin(companies, eq(companies.id, dispatches.companyId))
    .innerJoin(users, eq(users.id, dispatches.userId))
    .innerJoin(recordedBy, eq(recordedBy.id, dispatches.recordedByUserId))
    .leftJoin(approvedBy, eq(approvedBy.id, dispatches.approvedByUserId))
    .where(where)
    .orderBy(desc(dispatches.dispatchDate), desc(dispatches.createdAt))
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE);

  const [totals] = await db
    .select({ total: count() })
    .from(dispatches)
    .innerJoin(companies, eq(companies.id, dispatches.companyId))
    .innerJoin(users, eq(users.id, dispatches.userId))
    .where(where);

  const decorated = await decorate(session, rows);
  return { rows: decorated, total: totals?.total ?? 0, page };
}

type BareRow = {
  id: string;
  dispatchDate: string;
  sqm: string;
  companyId: string;
  companyName: string;
  userId: string;
  userName: string;
  recordedByName: string;
  quotationThreadId: string | null;
  approvedByName: string | null;
  approvedAt: Date | null;
  createdAt: Date;
};

/**
 * Add the SMAC reference and the two "may I open this?" flags.
 *
 * `16 §10` / `18 §2`: a coordinator sees the company NAME but may not open the
 * record, so the screen needs to know which to render. The name is already in
 * the row; only the link is in question.
 */
async function decorate(
  session: AuthSession,
  rows: BareRow[],
): Promise<DispatchListRow[]> {
  const threadIds = [
    ...new Set(
      rows
        .map((row) => row.quotationThreadId)
        .filter((id): id is string => id !== null),
    ),
  ];

  const references = new Map<string, string | null>();
  if (threadIds.length > 0) {
    const versions = await db
      .select({
        threadId: quotationVersions.threadId,
        smacReference: quotationVersions.smacReference,
        versionNumber: quotationVersions.versionNumber,
      })
      .from(quotationVersions)
      .where(inArray(quotationVersions.threadId, threadIds))
      .orderBy(desc(quotationVersions.versionNumber));
    for (const version of versions) {
      if (!references.has(version.threadId)) {
        references.set(version.threadId, version.smacReference);
      }
    }
  }

  // `canOpenRecord`, not `canViewRecord`: both of these decide whether the
  // screen draws a link, which since `S76` is a different question from
  // whether the viewer may act `[authz:370]`.
  const companyIds = [...new Set(rows.map((row) => row.companyId))];
  const companyViewable = new Map<string, boolean>(
    await Promise.all(
      companyIds.map(
        async (id) => [id, await canOpenRecord(session, "company", id)] as const,
      ),
    ),
  );
  const threadViewable = new Map<string, boolean>(
    await Promise.all(
      threadIds.map(
        async (id) =>
          [id, await canOpenRecord(session, "quotation_thread", id)] as const,
      ),
    ),
  );

  return rows.map((row) => ({
    ...row,
    companyViewable: companyViewable.get(row.companyId) ?? false,
    smacReference: row.quotationThreadId
      ? (references.get(row.quotationThreadId) ?? null)
      : null,
    threadViewable: row.quotationThreadId
      ? (threadViewable.get(row.quotationThreadId) ?? false)
      : false,
    isDirect: row.quotationThreadId === null,
  }));
}

export async function getDispatch(
  session: AuthSession,
  id: string,
): Promise<DispatchDetail | null> {
  const recordedBy = alias(users, "recorded_by");
  const approvedBy = alias(users, "approved_by");

  const [row] = await db
    .select({
      id: dispatches.id,
      dispatchDate: dispatches.dispatchDate,
      sqm: dispatches.sqm,
      companyId: dispatches.companyId,
      companyName: companies.name,
      userId: dispatches.userId,
      userName: users.name,
      recordedByName: recordedBy.name,
      quotationThreadId: dispatches.quotationThreadId,
      approvedByName: approvedBy.name,
      approvedAt: dispatches.approvedAt,
      createdAt: dispatches.createdAt,
      projectId: dispatches.projectId,
      projectNameEn: projects.nameEn,
      projectNameAr: projects.nameAr,
    })
    .from(dispatches)
    .innerJoin(companies, eq(companies.id, dispatches.companyId))
    .innerJoin(users, eq(users.id, dispatches.userId))
    .innerJoin(recordedBy, eq(recordedBy.id, dispatches.recordedByUserId))
    .leftJoin(approvedBy, eq(approvedBy.id, dispatches.approvedByUserId))
    // `S74` — the dispatch's OWN project, not its thread's. The two agree
    // whenever there is a thread, and this is the column that says so.
    .leftJoin(projects, eq(projects.id, dispatches.projectId))
    // The same rule the list asks of every row, asked of this one.
    .where(and(eq(dispatches.id, id), visibleDispatchesFilter(session)))
    .limit(1);

  if (!row) return null;

  const [decorated] = await decorate(session, [row]);
  const credits = await creditForDispatches([
    {
      id: row.id,
      userId: row.userId,
      userName: row.userName,
      sqm: row.sqm,
      dispatchDate: row.dispatchDate,
      projectId: row.projectId,
    },
  ]);

  return {
    ...decorated,
    projectId: row.projectId,
    projectNameEn: row.projectNameEn,
    projectNameAr: row.projectNameAr,
    // `S76`'s own reason, on the screen it was written for: the coordinator
    // records this dispatch, so the project it carries is theirs to open.
    projectViewable: row.projectId
      ? await canOpenRecord(session, "project", row.projectId)
      : false,
    credit: credits.get(row.id) as DispatchCredit,
  };
}

/**
 * Threads a dispatch may be recorded against: visible to this identity, and
 * **payment confirmed** `[07 C3]`.
 *
 * The dropdown never offers what the action refuses — the same principle
 * `listQuotationFormOptions` follows. An unpaid quotation is simply not in
 * the list, and the screen says why rather than letting someone pick it and be
 * told no.
 *
 * **The project join is LEFT** `S50`: a quotation with no project is precisely
 * the one `S74`'s second branch exists for, and an inner join would hide it
 * from the only screen that can resolve it.
 */
export async function listDispatchableThreads(
  session: AuthSession,
): Promise<DispatchableThread[]> {
  const rows = await db
    .select({
      id: quotationThreads.id,
      smacReference: quotationVersions.smacReference,
      projectId: quotationThreads.projectId,
      projectNameEn: projects.nameEn,
      projectNameAr: projects.nameAr,
      companyId: quotationThreads.companyId,
      companyName: companies.name,
      raisedByUserId: quotationThreads.raisedByUserId,
      raisedByName: users.name,
      quotedSqm: quotationVersions.totalSqm,
    })
    .from(quotationThreads)
    .innerJoin(
      quotationVersions,
      and(
        eq(quotationVersions.threadId, quotationThreads.id),
        // The live version — the one that is not superseded.
        ne(quotationVersions.status, "superseded"),
      ),
    )
    .leftJoin(projects, eq(projects.id, quotationThreads.projectId))
    .innerJoin(companies, eq(companies.id, quotationThreads.companyId))
    .innerJoin(users, eq(users.id, quotationThreads.raisedByUserId))
    .where(
      and(
        visibleQuotationThreadsFilter(session),
        isNotNull(quotationThreads.paymentConfirmedAt),
      ),
    )
    .orderBy(desc(quotationThreads.paymentConfirmedAt));

  if (rows.length === 0) return [];

  const dispatched = await db
    .select({
      threadId: dispatches.quotationThreadId,
      total: sql<string>`coalesce(sum(${dispatches.sqm}), 0)`,
    })
    .from(dispatches)
    .where(
      inArray(
        dispatches.quotationThreadId,
        rows.map((row) => row.id),
      ),
    )
    .groupBy(dispatches.quotationThreadId);

  const totals = new Map(
    dispatched.map((row) => [row.threadId as string, row.total]),
  );

  return rows.map((row) => ({
    ...row,
    dispatchedSqm: totals.get(row.id) ?? "0",
  }));
}

/**
 * Companies a `can_dispatch` holder may NAME on the direct-dispatch form
 * `[18 §2]`. Search, not browse: a typed query of at least two characters, a
 * small limit, and names only — no address, no contacts, no link.
 */
export async function searchDispatchCompanies(
  session: AuthSession,
  query: string,
  limit = 20,
): Promise<{ id: string; name: string }[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];
  const pattern = `%${trimmed}%`;

  return db
    .select({
      id: companies.id,
      name: companies.name,
    })
    .from(companies)
    .where(
      and(
        dispatchCompanyLookupFilter(session),
        isNull(companies.archivedAt),
        isNull(companies.mergedIntoId),
        // One name field `S12`, so one column to match — this was the only
        // place the Arabic name was ever searched.
        sql`${companies.name} ilike ${pattern}`,
      ),
    )
    .orderBy(companies.name)
    .limit(limit);
}

/**
 * Projects a `can_dispatch` holder may name on a dispatch `S74`.
 *
 * Ordered by name. **Only a LOST project is left out** `[07 C5]`: it is
 * finished, and offering one is offering a mistake. Everything else stays —
 * and `won` in particular, because `S31` makes a project won when the payment
 * arrives, which is the moment before the dispatch this picker exists for.
 * Filtering to `end_state is null` would have hidden exactly the projects most
 * likely to be dispatched against. `is distinct from` rather than `<>`, or
 * the null end state — the ordinary case — fails the comparison and every
 * live project disappears.
 *
 * **Ordinary project visibility since `S76`.** It used to compose a name-only
 * lookup filter of its own, because the only role holding `can_dispatch` could
 * not see a project at all while `S74` obliges that role to choose one; `S76`
 * made the coordinator's sight real and the stopgap came out with it. What is
 * left in the `where` is the picker's own rule, above, and no visibility rule
 * of its own.
 *
 * **It cannot be narrowed to the company's own projects.** `S74`'s second half
 * is that the company is ADDED to the project it did not belong to, so a
 * picker that only offered projects it already belonged to would make the rule
 * unusable.
 */
export async function listDispatchProjectOptions(
  session: AuthSession,
): Promise<{ id: string; nameEn: string; nameAr: string | null }[]> {
  return db
    .select({
      id: projects.id,
      nameEn: projects.nameEn,
      nameAr: projects.nameAr,
    })
    .from(projects)
    .where(
      and(
        visibleProjectsFilter(session),
        sql`${projects.endState} is distinct from 'lost'`,
      ),
    )
    .orderBy(projects.nameEn);
}

/**
 * Every dispatch in a period, for achievement `[04 C1]`.
 *
 * **Deliberately unfiltered by `visibleDispatchesFilter`.** The visibility
 * question on the targets screen is *whose totals may you read*, answered by
 * `visibleMeasuredUsersFilter` over PEOPLE. Filtering the underlying rows as
 * well would understate a person's total, and a silently wrong number is worse
 * than a refused screen. A `user_id IN (…)` filter would be wrong for the same
 * reason in reverse: a dispatch naming rep Y can credit rep X through a split.
 */
export async function dispatchesInPeriod(
  periodStart: string,
  nextPeriodStart: string,
): Promise<(CreditableDispatch & { isDirect: boolean })[]> {
  const rows = await db
    .select({
      id: dispatches.id,
      userId: dispatches.userId,
      userName: users.name,
      sqm: dispatches.sqm,
      dispatchDate: dispatches.dispatchDate,
      quotationThreadId: dispatches.quotationThreadId,
      // `S74` — the dispatch's own project. A credit split is a fact about a
      // project on a date, so it reads what the dispatch records, not what
      // its thread happens to say today.
      projectId: dispatches.projectId,
    })
    .from(dispatches)
    .innerJoin(users, eq(users.id, dispatches.userId))
    .where(
      and(
        gte(dispatches.dispatchDate, periodStart),
        lt(dispatches.dispatchDate, nextPeriodStart),
      ),
    );

  return rows.map((row) => ({
    id: row.id,
    userId: row.userId,
    userName: row.userName,
    sqm: row.sqm,
    dispatchDate: row.dispatchDate,
    projectId: row.projectId,
    isDirect: row.quotationThreadId === null,
  }));
}
