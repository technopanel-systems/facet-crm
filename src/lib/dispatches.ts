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
 *  6. **Recording a dispatch NEVER sets a credit split** `[07 D3]`, `[12 §1]`.
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
  canViewRecord,
  dispatchCompanyLookupFilter,
  visibleDispatchesFilter,
  visibleQuotationThreadsFilter,
  type AuthSession,
} from "@/lib/authz";
import {
  creditForDispatches,
  type CreditableDispatch,
  type DispatchCredit,
} from "@/lib/credit-splits";
import { SQM_SCALE, ZERO, toScaled } from "@/lib/decimal";
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
};

export type DispatchListRow = {
  id: string;
  dispatchDate: string;
  sqm: string;
  companyId: string;
  companyName: string;
  /** May the viewer OPEN the company? `can_dispatch` sees the name only
   *  `[18 §2]`, so the screen renders plain text rather than a link. */
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
  projectNameEn: string;
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

  return withAudit(session.actor, async (tx, log) => {
    const [created] = await tx
      .insert(dispatches)
      .values({
        companyId: companyId as string,
        userId: userId as string,
        sqm: input.sqm,
        quotationThreadId: input.quotationThreadId,
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

  const companyIds = [...new Set(rows.map((row) => row.companyId))];
  const companyViewable = new Map<string, boolean>(
    await Promise.all(
      companyIds.map(
        async (id) =>
          [id, await canViewRecord(session, "company", id)] as const,
      ),
    ),
  );
  const threadViewable = new Map<string, boolean>(
    await Promise.all(
      threadIds.map(
        async (id) =>
          [id, await canViewRecord(session, "quotation_thread", id)] as const,
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
      projectId: projects.id,
      projectNameEn: projects.nameEn,
      projectNameAr: projects.nameAr,
    })
    .from(dispatches)
    .innerJoin(companies, eq(companies.id, dispatches.companyId))
    .innerJoin(users, eq(users.id, dispatches.userId))
    .innerJoin(recordedBy, eq(recordedBy.id, dispatches.recordedByUserId))
    .leftJoin(approvedBy, eq(approvedBy.id, dispatches.approvedByUserId))
    .leftJoin(
      quotationThreads,
      eq(quotationThreads.id, dispatches.quotationThreadId),
    )
    .leftJoin(projects, eq(projects.id, quotationThreads.projectId))
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
    projectViewable: row.projectId
      ? await canViewRecord(session, "project", row.projectId)
      : false,
    credit: credits.get(row.id) as DispatchCredit,
  };
}

/**
 * Threads a dispatch may be recorded against: visible to this identity, and
 * **payment confirmed** `[07 C3]`.
 *
 * The dropdown never offers what the action refuses — the same principle
 * `listQuotationProjectOptions` follows. An unpaid quotation is simply not in
 * the list, and the screen says why rather than letting someone pick it and be
 * told no.
 */
export async function listDispatchableThreads(
  session: AuthSession,
): Promise<DispatchableThread[]> {
  const rows = await db
    .select({
      id: quotationThreads.id,
      smacReference: quotationVersions.smacReference,
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
    .innerJoin(projects, eq(projects.id, quotationThreads.projectId))
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
      projectId: quotationThreads.projectId,
    })
    .from(dispatches)
    .innerJoin(users, eq(users.id, dispatches.userId))
    .leftJoin(
      quotationThreads,
      eq(quotationThreads.id, dispatches.quotationThreadId),
    )
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
