/**
 * Project credit splits `[09 §4.2]` — the rare exception to the normal rule.
 *
 * **The normal rule is that there is no split** `[18 §1]`, `[18 §3]`. In almost
 * every case the rep named on the dispatch takes 100%, and a project with no
 * rows in this table is not a gap in the data — it is what the data usually
 * looks like. Everything here is the exception path, and it is sized like one.
 *
 * The rules, and where each comes from:
 *
 *  1. **Set by `can_set_credit_split`** — manager or coordinator `[12 §1]`,
 *     never a rep, and never as a side effect of recording a dispatch
 *     `[07 D3]`. `src/lib/dispatches.ts` does not import this module's writer.
 *  2. **Dated generations, never edits** `[07 D3]`. Each dispatch uses the
 *     split in force on ITS OWN date, so changing a split must not rewrite past
 *     credit. Nothing here updates or deletes a row.
 *  3. **Membership, not proportions** `[18 §3]`. The caller says WHO shares;
 *     this module computes the equal shares. There is no percentage input
 *     anywhere in FACET, and `04 D2` is closed by that answer.
 *  4. **No backdating** `[18 §4]`. `effective_from` is today or later, because
 *     a backdated generation re-credits dispatches already recorded.
 *  5. **Nothing is lost** `[18 §5]`. Percentages sum to exactly 100.00 and a
 *     dispatch's shares sum to exactly its own sqm — see `@/lib/decimal`.
 *  6. **No contributor** `[18 §6]`. `percentage` is always non-null.
 *
 * Every read composes a filter from `authz`; every write goes through
 * `withAudit`, which owns the transaction `[07 E1]`.
 */

import { and, asc, desc, eq, inArray, lte } from "drizzle-orm";
// `asc(users.name)` in `loadSplitRows` and the sort in `setCreditSplit` are one
// ordering expressed twice — change one, change the other.
import { alias } from "drizzle-orm/pg-core";

import { db } from "@/db";
import { projectCreditSplits, projects, users } from "@/db/schema";
import { withAudit } from "@/lib/audit";
import { can, canViewRecord, type AuthSession } from "@/lib/authz";
import {
  PERCENT_SCALE,
  SQM_SCALE,
  divideEqually,
  fromScaled,
  toScaled,
} from "@/lib/decimal";
import { RuleError } from "@/lib/validation";

/** A whole generation: 100.00 percent, divided among its rows. */
const FULL_PERCENT = toScaled("100.00", PERCENT_SCALE);

export type CreditSplitInput = {
  /** Today or later `[18 §4]`. `YYYY-MM-DD`. */
  effectiveFrom: string;
  /** WHO shares the credit. Never a number `[18 §3]`. */
  userIds: string[];
};

export type CreditSplitRow = {
  userId: string;
  userName: string;
  percentage: string;
};

export type CreditSplitInForce = {
  effectiveFrom: string;
  setByName: string;
  rows: CreditSplitRow[];
};

/**
 * Where a dispatch's credit came from. `"dispatch_rep"` is the normal answer
 * `[18 §1]`; `"split"` is the exception.
 */
export type DispatchCredit = {
  basis: "split" | "dispatch_rep";
  /** The generation's date, when one applied. */
  generationEffectiveFrom: string | null;
  /** Σ `sqm` is exactly the dispatch's own sqm `[18 §5]`. */
  shares: {
    userId: string;
    userName: string;
    percentage: string;
    sqm: string;
  }[];
};

/** What `creditForDispatches` needs to know about a dispatch. */
export type CreditableDispatch = {
  id: string;
  userId: string;
  userName: string;
  sqm: string;
  dispatchDate: string;
  /** Via the linked quotation thread. Null for a direct dispatch `[07 C6]`. */
  projectId: string | null;
};

/**
 * Today as `YYYY-MM-DD` in Riyadh. The app's timezone is fixed and an
 * effective-from date is a day there, not an instant — the same reasoning as
 * `quotations.ts`'s `today()`. `en-CA` yields `YYYY-MM-DD`, so lexicographic
 * comparison IS date comparison.
 */
function today(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Riyadh",
    dateStyle: "short",
  }).format(new Date());
}

/**
 * May this identity act on this project's split?
 *
 * A `can_set_credit_split` holder reaches any project that exists — see the
 * comment in `setCreditSplit` for why. Everybody else needs ordinary project
 * visibility, and a project they cannot see is indistinguishable from one that
 * does not exist.
 */
async function projectReachable(
  session: AuthSession,
  projectId: string,
): Promise<boolean> {
  if (can(session, "canSetCreditSplit")) {
    const [row] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);
    return row !== undefined;
  }
  return canViewRecord(session, "project", projectId);
}

/* ------------------------------------------------------------------ *
 * Writing a generation
 * ------------------------------------------------------------------ */

/**
 * Replace a project's credit split from `effectiveFrom` onward.
 *
 * **The whole generation is written in one transaction**, every row sharing one
 * `effective_from`. That is not tidiness: "the split in force on a date" is
 * only meaningful if the set in force is well defined. Written a row at a time,
 * some dates would carry a split summing to 40% and 60% of every dispatched
 * square metre would vanish from the numbers the business is measured on.
 *
 * Nothing is updated and nothing is deleted — a new generation supersedes the
 * previous one by being later `[07 D3]`.
 */
export async function setCreditSplit(
  session: AuthSession,
  projectId: string,
  input: CreditSplitInput,
): Promise<void> {
  // **The flag comes first here, and only here.** Every other module asks
  // visibility first, but `12 §1` grants `can_set_credit_split` to the sales
  // coordinator *because they perform the actual dispatch* — and `16 §8` gives
  // that same role no project visibility at all. A strict project check would
  // make a founder-granted flag unusable by one of the two roles it was
  // granted to, which is the dead-flag failure `16 §8` itself was written to
  // fix. So the flag carries the reach, exactly as `can_approve_quotation`
  // reaches every thread `[16 §8]` and `can_dispatch` reaches every dispatch
  // `[18 §2]`.
  if (!can(session, "canSetCreditSplit")) {
    throw new RuleError("credit.errors.creditSplitOnly");
  }
  if (!(await projectReachable(session, projectId))) {
    throw new RuleError("credit.errors.projectNotVisible");
  }

  const userIds = input.userIds.filter((id) => id.length > 0);
  if (userIds.length === 0) {
    throw new RuleError("credit.errors.splitNeedsRow", "userIds");
  }
  if (new Set(userIds).size !== userIds.length) {
    throw new RuleError("credit.errors.splitDuplicateUser", "userIds");
  }
  if (input.effectiveFrom < today()) {
    throw new RuleError("credit.errors.splitNotBackdated", "effectiveFrom");
  }

  // **Ordered by name before dividing, because the read orders by name too.**
  // `divideEqually` gives the leftover unit to the earliest rows, so if the two
  // orders disagreed the rep holding 33.34% would not be the rep credited
  // 33.3334 m² — the stored share and the credited square metres would name
  // different people. Sorting here is what keeps them the same person.
  const named = await db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(inArray(users.id, userIds));
  if (named.length !== userIds.length) {
    throw new RuleError("credit.errors.userUnknown", "userIds");
  }
  named.sort((left, right) => left.name.localeCompare(right.name));

  // `18 §3`: FACET divides, nobody types. `18 §5`: the shares sum to exactly
  // 100.00 — three reps are 33.34 / 33.33 / 33.33, not 33.33 three times.
  const shares = divideEqually(FULL_PERCENT, named.length);

  await withAudit(session.actor, async (tx, log) => {
    const inserted = await tx
      .insert(projectCreditSplits)
      .values(
        named.map((person, index) => ({
          projectId,
          userId: person.id,
          percentage: fromScaled(shares[index], PERCENT_SCALE),
          effectiveFrom: input.effectiveFrom,
          setBy: session.user.id,
        })),
      )
      .returning();

    log({
      action: "project_credit_split.set",
      entityType: "project",
      entityId: projectId,
      after: {
        effectiveFrom: input.effectiveFrom,
        rows: inserted.map((row) => ({
          userId: row.userId,
          percentage: row.percentage,
        })),
      },
    });
  });
}

/* ------------------------------------------------------------------ *
 * Reading
 * ------------------------------------------------------------------ */

type RawSplitRow = {
  userId: string;
  userName: string;
  percentage: string | null;
  effectiveFrom: string;
  createdAt: Date;
  setByName: string;
};

/**
 * The rows of the generation in force on a date: the greatest
 * `effective_from <= date`. Ordering is by that date alone `[18 §4]`; the
 * `created_at` tie-break exists only so a same-day second write wins rather
 * than merging with the first. `OPEN — not chosen`: whether a same-day
 * correction should be allowed at all.
 */
function generationInForce(rows: RawSplitRow[]): RawSplitRow[] {
  if (rows.length === 0) return [];
  // Callers hand these over already sorted newest first.
  const newest = rows[0];
  return rows.filter(
    (row) =>
      row.effectiveFrom === newest.effectiveFrom &&
      row.createdAt.getTime() === newest.createdAt.getTime(),
  );
}

async function loadSplitRows(
  projectIds: string[],
  onOrBefore?: string,
): Promise<Map<string, RawSplitRow[]>> {
  const byProject = new Map<string, RawSplitRow[]>();
  if (projectIds.length === 0) return byProject;

  // Two joins onto `users` — the credited rep and whoever set the generation
  // `[09 §4.2]` — so the second needs an alias.
  const setter = alias(users, "split_setter");

  const rows = await db
    .select({
      projectId: projectCreditSplits.projectId,
      userId: projectCreditSplits.userId,
      userName: users.name,
      percentage: projectCreditSplits.percentage,
      effectiveFrom: projectCreditSplits.effectiveFrom,
      createdAt: projectCreditSplits.createdAt,
      setByName: setter.name,
    })
    .from(projectCreditSplits)
    .innerJoin(users, eq(users.id, projectCreditSplits.userId))
    .innerJoin(setter, eq(setter.id, projectCreditSplits.setBy))
    .where(
      and(
        inArray(projectCreditSplits.projectId, projectIds),
        onOrBefore
          ? lte(projectCreditSplits.effectiveFrom, onOrBefore)
          : undefined,
      ),
    )
    .orderBy(
      desc(projectCreditSplits.effectiveFrom),
      desc(projectCreditSplits.createdAt),
      asc(users.name),
    );

  for (const row of rows) {
    const list = byProject.get(row.projectId) ?? [];
    list.push({
      userId: row.userId,
      userName: row.userName,
      percentage: row.percentage,
      effectiveFrom: row.effectiveFrom,
      createdAt: row.createdAt,
      setByName: row.setByName,
    });
    byProject.set(row.projectId, list);
  }
  return byProject;
}

/**
 * The split in force on a project today, or on a given date. Null when the
 * project has none — the normal case `[18 §1]`.
 */
export async function getCreditSplitInForce(
  session: AuthSession,
  projectId: string,
  onDate?: string,
): Promise<CreditSplitInForce | null> {
  if (!(await projectReachable(session, projectId))) return null;

  const byProject = await loadSplitRows([projectId], onDate ?? today());
  const generation = generationInForce(byProject.get(projectId) ?? []);
  if (generation.length === 0) return null;

  return {
    effectiveFrom: generation[0].effectiveFrom,
    setByName: generation[0].setByName,
    rows: generation.map((row) => ({
      userId: row.userId,
      userName: row.userName,
      // `18 §6`: null is unreachable through every write path.
      percentage: row.percentage ?? "0.00",
    })),
  };
}

/* ------------------------------------------------------------------ *
 * Crediting a dispatch `[07 D3]`, `[18 §1]`, `[18 §5]`
 * ------------------------------------------------------------------ */

/**
 * Who is credited for each dispatch, and how much.
 *
 * Batched: one query for every project seen, then pure arithmetic. Achievement
 * calls this once per period rather than once per dispatch.
 *
 * **Apportioned per dispatch, not per month.** Each dispatch is the atomic
 * event and the detail screen shows its own breakdown; apportioning a monthly
 * aggregate instead would make the on-screen rows fail to add up to the total.
 * Every dispatch being exact `[18 §5]` makes the monthly sum exact too.
 *
 * **Equality governs the square metres.** The stored percentage is the
 * two-decimal rendering of the same equality; where the two differ in the
 * fourth decimal — three reps sharing 100 m² — the square-metre rule wins,
 * because that is the number the business is measured on `[18 §5]`.
 */
export async function creditForDispatches(
  rows: CreditableDispatch[],
): Promise<Map<string, DispatchCredit>> {
  const projectIds = [
    ...new Set(
      rows.map((row) => row.projectId).filter((id): id is string => id !== null),
    ),
  ];
  const byProject = await loadSplitRows(projectIds);

  const credits = new Map<string, DispatchCredit>();

  for (const dispatch of rows) {
    // A dispatch with no project — a direct sale `[07 C6]` — can have no
    // split, so it always takes the `dispatch_rep` path.
    const candidates = dispatch.projectId
      ? (byProject.get(dispatch.projectId) ?? [])
      : [];
    const generation = generationInForce(
      candidates.filter((row) => row.effectiveFrom <= dispatch.dispatchDate),
    );

    if (generation.length === 0) {
      // `18 §1` — the normal path. 100% to the rep named on the dispatch.
      credits.set(dispatch.id, {
        basis: "dispatch_rep",
        generationEffectiveFrom: null,
        shares: [
          {
            userId: dispatch.userId,
            userName: dispatch.userName,
            percentage: "100.00",
            sqm: dispatch.sqm,
          },
        ],
      });
      continue;
    }

    const sqmShares = divideEqually(
      toScaled(dispatch.sqm, SQM_SCALE),
      generation.length,
    );
    credits.set(dispatch.id, {
      basis: "split",
      generationEffectiveFrom: generation[0].effectiveFrom,
      shares: generation.map((row, index) => ({
        userId: row.userId,
        userName: row.userName,
        percentage: row.percentage ?? "0.00",
        sqm: fromScaled(sqmShares[index], SQM_SCALE),
      })),
    });
  }

  return credits;
}
