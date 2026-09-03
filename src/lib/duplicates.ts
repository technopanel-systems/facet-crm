/**
 * Duplicates — `S21`, `S22`, `S23`. **The writer `duplicate_flags` and
 * `non_duplicates` never had**, and the writer `companies.merged_into_id`'s
 * four readers waited for (`WORKFLOW §5`).
 *
 * **A rep is never blocked** `S21`. `flagDuplicatesFor` runs inside the
 * registering transaction after the row is written and adds flags; it never
 * throws on a match and never changes the company. It runs again on a phone
 * change, because the phone is the key `S23`.
 *
 * **The phone is the key** `S23`, folded to one shape before it is compared:
 * digits only, and the Saudi country code — `+966`, `00966`, `966` — folded
 * to the local `0`, so `+966 58 181 1199` and `0581811199` are one number.
 * Nothing else is folded; a typo is a different number, which is what a
 * detector should say. The fold is implementation, not schema (`normalize.ts`
 * makes the same point about names) — `SPEC §16` carries the question of
 * whether it should reach further.
 *
 * **Three outcomes** `S22`, decided by `can_resolve_duplicate` `S8`:
 *
 *  - **False flag** — remembered in `non_duplicates` as an ordered pair, so
 *    the detector never raises that pair again `[07 B5]`.
 *  - **Who continues** — the manager names the surviving record; the other
 *    **folds in**: its contacts, project links, quotation threads, dispatches
 *    and reports move to the survivor, its live memberships end, and the row
 *    stays as a tombstone (`merged_into_id`). Nothing is deleted `S107`. The
 *    folded record's rep does not gain the survivor — that is what *who
 *    continues* decides.
 *  - **Shared** — the older record survives, the newer folds in exactly the
 *    same way, and **every live holder of the folded record gains a
 *    membership on the survivor**; the survivor keeps its primary rep `S18`.
 *    Shared means access to the customer, never ownership of the deals: the
 *    moved projects keep their owner `S30`, the threads follow their project,
 *    and credit follows the dispatch `S78` — none of which this module
 *    touches, and all of which the visibility model already reads that way
 *    (`authz.ts`: company membership is never a term of
 *    `visibleProjectsFilter`).
 *
 * **What the merge deliberately leaves on the tombstone**: the loser's own
 * dormancy reviews and removal requests (history about that record), its
 * audit rows, and any open flag pairing it with a third company — the queue
 * reader excludes a flag whose side has merged, and `SPEC §16` records
 * whether such a flag should be re-pointed at the survivor instead.
 */

import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { db } from "@/db";
import {
  cities,
  companies,
  companyCategories,
  companyReps,
  contacts,
  dispatches,
  duplicateFlags,
  nonDuplicates,
  projectCompanies,
  quotationThreads,
  repReports,
  users,
} from "@/db/schema";
import { withAudit } from "@/lib/audit";
import { can, type AuthSession } from "@/lib/authz";
import { NOTIFICATION_TYPES } from "@/lib/enums";
import { raise } from "@/lib/notifications";
import { RuleError } from "@/lib/validation";

type TxArgs = Parameters<Parameters<typeof withAudit>[1]>;
type Tx = TxArgs[0];
type Log = TxArgs[1];

/* ------------------------------------------------------------------ *
 * The key `S23`
 * ------------------------------------------------------------------ */

/** The comparison form of a phone — see the module doc. */
export function phoneKey(phone: string): string {
  return phone.replace(/\D/g, "").replace(/^(00)?966/, "0");
}

/**
 * The same fold in SQL, over `companies.phone` **named outright** — this is
 * used inside a query on `companies` with no alias, and a bare column in a
 * correlated fragment resolves inside the wrong table (`CLAUDE.md`).
 */
const PHONE_KEY_OF_COMPANY = sql<string>`regexp_replace(regexp_replace(companies.phone, '\\D', '', 'g'), '^(00)?966', '0')`;

/* ------------------------------------------------------------------ *
 * The detector `S21` `S23`
 * ------------------------------------------------------------------ */

/**
 * Flag every live company whose phone folds to the same key — except a
 * pair already remembered as not duplicates, and a pair already carrying an
 * open flag. Inside the caller's transaction, after the row is written:
 * the company is saved whatever this finds `S21`.
 *
 * `record_a_id` is the company that triggered the check — the newer one at
 * registration — and `record_b_id` the one it matched. Returns the ids of
 * the flags it wrote, which is also how many it wrote.
 */
export async function flagDuplicatesFor(
  tx: Tx,
  log: Log,
  companyId: string,
  phone: string,
): Promise<string[]> {
  const key = phoneKey(phone);
  if (!key) return [];

  const matches = await tx
    .select({ id: companies.id })
    .from(companies)
    .where(
      and(
        sql`companies.id <> ${companyId}::uuid`,
        isNull(companies.mergedIntoId),
        eq(PHONE_KEY_OF_COMPANY, key),
        // Both tables named outright in each correlated fragment.
        sql`not exists (
          select 1 from non_duplicates n
          where n.record_type = 'company'
            and ((n.record_a_id = ${companyId}::uuid and n.record_b_id = companies.id)
              or (n.record_a_id = companies.id and n.record_b_id = ${companyId}::uuid))
        )`,
        sql`not exists (
          select 1 from duplicate_flags f
          where f.record_type = 'company' and f.status = 'open'
            and ((f.record_a_id = ${companyId}::uuid and f.record_b_id = companies.id)
              or (f.record_a_id = companies.id and f.record_b_id = ${companyId}::uuid))
        )`,
      ),
    )
    .orderBy(asc(companies.createdAt));

  const created: string[] = [];
  for (const match of matches) {
    const [flag] = await tx
      .insert(duplicateFlags)
      .values({
        recordType: "company",
        recordAId: companyId,
        recordBId: match.id,
        source: "entry_match",
      })
      .returning();
    log({
      action: "duplicate.flagged",
      entityType: "duplicate_flag",
      entityId: flag.id,
      after: { recordAId: companyId, recordBId: match.id, phoneKey: key },
    });
    created.push(flag.id);
  }
  return created;
}

/* ------------------------------------------------------------------ *
 * Reading — the queue and one flag
 * ------------------------------------------------------------------ */

export type DuplicateQueueRow = {
  id: string;
  createdAt: Date;
  a: { id: string; name: string };
  b: { id: string; name: string };
};

/**
 * The open flags, oldest first `S87` — `D41`'s duplicate half.
 *
 * Gated on `can_resolve_duplicate` `S8` and nothing narrower: its three
 * holders all see every company today, and a flag joins two companies
 * through aliases the shared visibility filter cannot be composed onto. If a
 * role ever holds this flag without `sees_all_reps`, this is the reader to
 * revisit (`revokeShare`'s note, one table over). A flag whose either side
 * has since merged is moot and is not listed.
 */
export async function listOpenDuplicateFlags(
  session: AuthSession,
): Promise<{ rows: DuplicateQueueRow[]; total: number }> {
  if (!can(session, "canResolveDuplicate")) return { rows: [], total: 0 };
  const a = alias(companies, "dup_a");
  const b = alias(companies, "dup_b");
  const rows = await db
    .select({
      id: duplicateFlags.id,
      createdAt: duplicateFlags.createdAt,
      aId: a.id,
      aName: a.name,
      bId: b.id,
      bName: b.name,
    })
    .from(duplicateFlags)
    .innerJoin(a, eq(a.id, duplicateFlags.recordAId))
    .innerJoin(b, eq(b.id, duplicateFlags.recordBId))
    .where(
      and(
        eq(duplicateFlags.recordType, "company"),
        eq(duplicateFlags.status, "open"),
        isNull(a.mergedIntoId),
        isNull(b.mergedIntoId),
      ),
    )
    .orderBy(asc(duplicateFlags.createdAt));
  return {
    rows: rows.map((row) => ({
      id: row.id,
      createdAt: row.createdAt,
      a: { id: row.aId, name: row.aName },
      b: { id: row.bId, name: row.bName },
    })),
    total: rows.length,
  };
}

export type DuplicateSide = {
  id: string;
  name: string;
  phone: string;
  categoryNameEn: string | null;
  categoryNameAr: string | null;
  cityNameEn: string | null;
  cityNameAr: string | null;
  createdAt: Date;
  createdByName: string | null;
  archived: boolean;
  mergedIntoId: string | null;
  holders: { id: string; name: string; isPrimary: boolean }[];
  /** What each record already has — the founder's *what each already has*. */
  counts: {
    projects: number;
    quotations: number;
    dispatches: number;
    reports: number;
    contacts: number;
  };
};

export type DuplicateFlagDetail = {
  id: string;
  status: "open" | "resolved";
  resolution: "who_continues" | "shared" | "false_flag" | null;
  createdAt: Date;
  decidedByName: string | null;
  decidedAt: Date | null;
  /** The record that triggered the flag — newer at registration. */
  a: DuplicateSide;
  /** The record it matched. */
  b: DuplicateSide;
  /** After a merge: the record that continues. */
  survivorId: string | null;
};

async function sideOf(companyId: string): Promise<DuplicateSide | null> {
  const [row] = await db
    .select({
      id: companies.id,
      name: companies.name,
      phone: companies.phone,
      categoryNameEn: companyCategories.nameEn,
      categoryNameAr: companyCategories.nameAr,
      cityNameEn: cities.nameEn,
      cityNameAr: cities.nameAr,
      createdAt: companies.createdAt,
      createdByName: users.name,
      archivedAt: companies.archivedAt,
      mergedIntoId: companies.mergedIntoId,
    })
    .from(companies)
    .leftJoin(companyCategories, eq(companies.categoryId, companyCategories.id))
    .leftJoin(cities, eq(companies.cityId, cities.id))
    .leftJoin(users, eq(companies.createdBy, users.id))
    .where(eq(companies.id, companyId))
    .limit(1);
  if (!row) return null;

  const [holders, counts] = await Promise.all([
    db
      .select({ id: users.id, name: users.name, isPrimary: companyReps.isPrimary })
      .from(companyReps)
      .innerJoin(users, eq(users.id, companyReps.userId))
      .where(and(eq(companyReps.companyId, companyId), isNull(companyReps.removedAt)))
      .orderBy(asc(companyReps.isPrimary), asc(users.name)),
    workCounts(db, companyId),
  ]);

  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    categoryNameEn: row.categoryNameEn,
    categoryNameAr: row.categoryNameAr,
    cityNameEn: row.cityNameEn,
    cityNameAr: row.cityNameAr,
    createdAt: row.createdAt,
    createdByName: row.createdByName,
    archived: row.archivedAt !== null,
    mergedIntoId: row.mergedIntoId,
    holders: holders.sort((x, y) => Number(y.isPrimary) - Number(x.isPrimary)),
    counts,
  };
}

/**
 * What a company already has — the five figures the side-by-side shows and
 * the merge accounts for. **Live project links only**, matching what the
 * company page's projects card counts.
 */
async function workCounts(
  runner: Pick<typeof db, "select">,
  companyId: string,
): Promise<DuplicateSide["counts"]> {
  const count = async (
    table: typeof projectCompanies | typeof quotationThreads | typeof dispatches | typeof repReports | typeof contacts,
    extra?: ReturnType<typeof isNull>,
  ) => {
    const [row] = await runner
      .select({ n: sql<number>`count(*)`.mapWith(Number) })
      .from(table)
      .where(and(eq(table.companyId, companyId), extra));
    return row?.n ?? 0;
  };
  const [projects, quotations, dispatchCount, reports, contactCount] =
    await Promise.all([
      count(projectCompanies, isNull(projectCompanies.removedAt)),
      count(quotationThreads),
      count(dispatches),
      count(repReports),
      count(contacts),
    ]);
  return {
    projects,
    quotations,
    dispatches: dispatchCount,
    reports,
    contacts: contactCount,
  };
}

/** One flag with both sides, or null when this identity may not resolve
 *  duplicates — the screen renders `notFound()` `D53`. */
export async function getDuplicateFlag(
  session: AuthSession,
  flagId: string,
): Promise<DuplicateFlagDetail | null> {
  if (!can(session, "canResolveDuplicate")) return null;
  const decidedBy = users;
  const [flag] = await db
    .select({
      id: duplicateFlags.id,
      status: duplicateFlags.status,
      resolution: duplicateFlags.resolution,
      createdAt: duplicateFlags.createdAt,
      recordType: duplicateFlags.recordType,
      recordAId: duplicateFlags.recordAId,
      recordBId: duplicateFlags.recordBId,
      decidedAt: duplicateFlags.decidedAt,
      decidedByName: decidedBy.name,
    })
    .from(duplicateFlags)
    .leftJoin(decidedBy, eq(decidedBy.id, duplicateFlags.decidedByUserId))
    .where(eq(duplicateFlags.id, flagId))
    .limit(1);
  if (!flag || flag.recordType !== "company") return null;

  const [a, b] = await Promise.all([sideOf(flag.recordAId), sideOf(flag.recordBId)]);
  if (!a || !b) return null;

  // After a merge one side carries the other's id as its tombstone.
  const survivorId =
    a.mergedIntoId === b.id ? b.id : b.mergedIntoId === a.id ? a.id : null;

  return {
    id: flag.id,
    status: flag.status,
    resolution: flag.resolution,
    createdAt: flag.createdAt,
    decidedByName: flag.decidedByName,
    decidedAt: flag.decidedAt,
    a,
    b,
    survivorId,
  };
}

/* ------------------------------------------------------------------ *
 * Resolving `S22`
 * ------------------------------------------------------------------ */

export type DuplicateDecision =
  | { resolution: "false_flag" }
  | { resolution: "who_continues"; survivorId: string }
  | { resolution: "shared" };

export const DUPLICATE_RESOLUTIONS = [
  "false_flag",
  "who_continues",
  "shared",
] as const;

/**
 * The manager's ruling on one flag, in one transaction: the outcome's own
 * writes, then the flag stamped resolved. The flag is checked **before**
 * visibility for `grantShare`'s reason; here there is no visibility beneath
 * the flag (see `listOpenDuplicateFlags`).
 */
export async function resolveDuplicate(
  session: AuthSession,
  flagId: string,
  decision: DuplicateDecision,
): Promise<void> {
  if (!can(session, "canResolveDuplicate")) {
    throw new RuleError("duplicates.errors.cannotResolve");
  }
  const [flag] = await db
    .select()
    .from(duplicateFlags)
    .where(eq(duplicateFlags.id, flagId))
    .limit(1);
  if (!flag || flag.recordType !== "company") {
    throw new RuleError("duplicates.errors.notFound");
  }
  if (flag.status !== "open") {
    throw new RuleError("duplicates.errors.alreadyResolved");
  }
  const sides = await db
    .select({
      id: companies.id,
      createdAt: companies.createdAt,
      mergedIntoId: companies.mergedIntoId,
    })
    .from(companies)
    .where(sql`${companies.id} in (${flag.recordAId}::uuid, ${flag.recordBId}::uuid)`);
  const a = sides.find((side) => side.id === flag.recordAId);
  const b = sides.find((side) => side.id === flag.recordBId);
  if (!a || !b || a.mergedIntoId || b.mergedIntoId) {
    throw new RuleError("duplicates.errors.sideMerged");
  }
  if (
    decision.resolution === "who_continues" &&
    decision.survivorId !== a.id &&
    decision.survivorId !== b.id
  ) {
    throw new RuleError("duplicates.errors.survivorNotInPair", "survivorId");
  }

  await withAudit(session.actor, async (tx, log) => {
    if (decision.resolution === "false_flag") {
      // An ordered pair, so the same two companies are one row whichever
      // way round a later flag names them; the unique key holds it.
      const [first, second] = [a.id, b.id].sort();
      const [remembered] = await tx
        .insert(nonDuplicates)
        .values({
          recordType: "company",
          recordAId: first,
          recordBId: second,
          decidedByUserId: session.user.id,
        })
        .onConflictDoNothing()
        .returning();
      if (remembered) {
        log({
          action: "duplicate.false_flag",
          entityType: "non_duplicate",
          entityId: remembered.id,
          after: { recordAId: first, recordBId: second },
        });
      }
    } else if (decision.resolution === "who_continues") {
      const survivorId = decision.survivorId;
      const loserId = survivorId === a.id ? b.id : a.id;
      await mergeCompany(tx, log, session, loserId, survivorId, false);
    } else {
      // The older record survives — it is the one with the history — and
      // the manager is not asked to choose, because *shared* is not a
      // choice between them.
      const older = a.createdAt <= b.createdAt ? a : b;
      const newer = older === a ? b : a;
      await mergeCompany(tx, log, session, newer.id, older.id, true);
    }

    const [resolved] = await tx
      .update(duplicateFlags)
      .set({
        status: "resolved",
        resolution: decision.resolution,
        decidedByUserId: session.user.id,
        decidedAt: new Date(),
      })
      .where(and(eq(duplicateFlags.id, flagId), eq(duplicateFlags.status, "open")))
      .returning();
    if (!resolved) throw new RuleError("duplicates.errors.alreadyResolved");
    log({
      action: "duplicate.resolved",
      entityType: "duplicate_flag",
      entityId: flagId,
      before: { status: "open", resolution: null },
      after: { status: "resolved", resolution: decision.resolution },
    });
  });
}

/**
 * Fold `loserId` into `survivorId`. **Nothing is deleted** `S107`: every
 * row that named the loser now names the survivor, the loser's live
 * memberships end, and the loser stays as a tombstone the four
 * `merged_into_id` readers already drop from every list.
 *
 * A project linked to BOTH keeps its survivor link and the loser's is
 * soft-removed rather than moved — `project_companies_key` is unique on the
 * live pair, and a moved duplicate would refuse the whole merge.
 *
 * `shareHolders` is `S22`'s third outcome: every live holder of the loser
 * gains a membership on the survivor — `assigned`, never primary — unless
 * they hold it already. It grants the customer and nothing else.
 */
async function mergeCompany(
  tx: Tx,
  log: Log,
  session: AuthSession,
  loserId: string,
  survivorId: string,
  shareHolders: boolean,
): Promise<void> {
  const before = {
    loser: await workCounts(tx, loserId),
    survivor: await workCounts(tx, survivorId),
  };
  // `S128` — read BEFORE the fold so the survivor's holders are the people
  // who held it going in, not the folded holders `shared` adds below.
  const survivorHoldersBefore = (
    await tx
      .select({ userId: companyReps.userId })
      .from(companyReps)
      .where(and(eq(companyReps.companyId, survivorId), isNull(companyReps.removedAt)))
  ).map((row) => row.userId);

  await tx
    .update(contacts)
    .set({ companyId: survivorId })
    .where(eq(contacts.companyId, loserId));

  const loserLinks = await tx
    .select({ id: projectCompanies.id, projectId: projectCompanies.projectId })
    .from(projectCompanies)
    .where(and(eq(projectCompanies.companyId, loserId), isNull(projectCompanies.removedAt)));
  const survivorLinks = await tx
    .select({ projectId: projectCompanies.projectId })
    .from(projectCompanies)
    .where(and(eq(projectCompanies.companyId, survivorId), isNull(projectCompanies.removedAt)));
  const linked = new Set(survivorLinks.map((row) => row.projectId));
  for (const link of loserLinks) {
    if (linked.has(link.projectId)) {
      await tx
        .update(projectCompanies)
        .set({ removedAt: new Date() })
        .where(eq(projectCompanies.id, link.id));
    } else {
      await tx
        .update(projectCompanies)
        .set({ companyId: survivorId })
        .where(eq(projectCompanies.id, link.id));
    }
  }

  await tx
    .update(quotationThreads)
    .set({ companyId: survivorId })
    .where(eq(quotationThreads.companyId, loserId));
  await tx
    .update(dispatches)
    .set({ companyId: survivorId })
    .where(eq(dispatches.companyId, loserId));
  await tx
    .update(repReports)
    .set({ companyId: survivorId })
    .where(eq(repReports.companyId, loserId));

  // The loser's live memberships end — a tombstone holds nobody. Soft, the
  // shape every membership change takes.
  const departed = await tx
    .update(companyReps)
    .set({ removedAt: new Date() })
    .where(and(eq(companyReps.companyId, loserId), isNull(companyReps.removedAt)))
    .returning();
  for (const row of departed) {
    log({
      action: "company_rep.removed",
      entityType: "company_rep",
      entityId: row.id,
      before: { userId: row.userId, removedAt: null },
      after: { userId: row.userId, removedAt: row.removedAt, mergedInto: survivorId },
    });
  }

  if (shareHolders) {
    const held = new Set(
      (
        await tx
          .select({ userId: companyReps.userId })
          .from(companyReps)
          .where(and(eq(companyReps.companyId, survivorId), isNull(companyReps.removedAt)))
      ).map((row) => row.userId),
    );
    for (const row of departed) {
      if (held.has(row.userId)) continue;
      const [added] = await tx
        .insert(companyReps)
        .values({
          companyId: survivorId,
          userId: row.userId,
          isPrimary: false,
          origin: "assigned",
          createdBy: session.user.id,
        })
        .returning();
      held.add(row.userId);
      log({
        action: "company_rep.added",
        entityType: "company_rep",
        entityId: added.id,
        after: {
          companyId: survivorId,
          userId: row.userId,
          isPrimary: false,
          origin: added.origin,
          sharedByMerge: loserId,
        },
      });
    }
  }

  // A rep's own plan on the folded record should not vanish with it —
  // carried across only where the survivor has none of its own.
  const [plans] = await tx
    .select({ loser: companies.nextFollowUpAt })
    .from(companies)
    .where(eq(companies.id, loserId));
  const [survivorPlan] = await tx
    .select({ survivor: companies.nextFollowUpAt })
    .from(companies)
    .where(eq(companies.id, survivorId));
  if (plans?.loser && !survivorPlan?.survivor) {
    await tx
      .update(companies)
      .set({ nextFollowUpAt: plans.loser })
      .where(eq(companies.id, survivorId));
  }

  const [tombstone] = await tx
    .update(companies)
    .set({ mergedIntoId: survivorId })
    .where(and(eq(companies.id, loserId), isNull(companies.mergedIntoId)))
    .returning({ id: companies.id });
  if (!tombstone) throw new RuleError("duplicates.errors.sideMerged");

  log({
    action: "company.merged",
    entityType: "company",
    entityId: loserId,
    before: { mergedIntoId: null, ...before },
    after: {
      mergedIntoId: survivorId,
      survivor: await workCounts(tx, survivorId),
      loser: await workCounts(tx, loserId),
      holdersShared: shareHolders,
    },
  });

  // `S128`, session 55 — **both sides are told, on the bell** `S92`. The
  // folded record's holders lost a customer (or, under *shared*, kept it
  // under another name); the survivor's holders gained one's history. The
  // item names both companies whether or not the reader may open either —
  // see `DecisionPayload.companyName`. Never the manager about their own act;
  // a holder on both sides is told once, as the folded side.
  const told = new Set<string>([session.user.id]);
  const tell = async (
    userId: string,
    decision: "company_merged_away" | "company_merged_in",
  ) => {
    if (told.has(userId)) return;
    told.add(userId);
    await raise(tx, log, {
      typeKey: NOTIFICATION_TYPES.decisionEndedWork,
      recipientUserId: userId,
      payload: {
        decision,
        reason: "",
        recordType: "company",
        recordId: survivorId,
        otherRecordId: loserId,
        decidedByUserId: session.user.id,
      },
    });
  };
  for (const row of departed) await tell(row.userId, "company_merged_away");
  for (const userId of survivorHoldersBefore) await tell(userId, "company_merged_in");
}
