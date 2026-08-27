/**
 * Targets and achievement `[09 §2.3]`, `[07 D1]`, `[07 D2]`.
 *
 * Two halves that must be read together and never combined:
 *
 * **Targets are rows, never a mutable field** `[07 D1]`. Person, period, SQM,
 * who set it, when. A same-month correction is a superseding row, not an edit
 * `[10 §6]` — `effective_from` decides which one applies. Someone with no row
 * is simply not measured that month, which is why `targetSqm` is `null` and
 * never `"0"`. SQM only; there is no currency target anywhere in FACET
 * `[07 D1]`, `[04 A3]`.
 *
 * **Achievement is derived, never stored** `[04 C1]`. It is computed from
 * `dispatches` and nowhere else, applying the credit split in force on each
 * dispatch's own date `[07 D3]`, `[18 §1]`.
 *
 * Three rules this module honours BY CONSTRUCTION rather than by subtraction —
 * each one asserted in `scripts/verify-slice3.ts`:
 *
 *  1. **Service square metres never count** `[08 D4]`, `[12 §10]`. Targets
 *     measure cladding dispatched, not fabrication performed. This module
 *     never reads `quotation_lines` or `quotation_service_lines` at all.
 *  2. **`accepted` is not won** `[16 §5]`. It never reads `end_state`. An
 *     accepted, paid, undispatched thread contributes exactly zero.
 *  3. **No combined score** `[07 D2]`. Target progress and activity are shown
 *     side by side, never merged. Nothing here multiplies or weights them, and
 *     nothing here reads activity at all: since Phase 9 it lives on its own
 *     screen, `/activity`, derived from real events `[20 §6]`, `[20 §8]`. The
 *     targets screen links to it rather than folding a number in.
 */

import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { db } from "@/db";
import { targets, users } from "@/db/schema";
import { withAudit } from "@/lib/audit";
import {
  can,
  visibleMeasuredUsersFilter,
  type AuthSession,
} from "@/lib/authz";
import { creditForDispatches } from "@/lib/credit-splits";
import { SQM_SCALE, ZERO, fromScaled, toScaled } from "@/lib/decimal";
import { dispatchesInPeriod } from "@/lib/dispatches";
import { RuleError } from "@/lib/validation";

export type Target = typeof targets.$inferSelect;

export type TargetHistoryRow = {
  id: string;
  sqm: string;
  effectiveFrom: Date;
  setByName: string;
  createdAt: Date;
};

export type AchievementRow = {
  userId: string;
  userName: string;
  /** Null = not measured this month `[07 D1]`. NEVER `"0"`. */
  targetSqm: string | null;
  /** From dispatches and nowhere else `[04 C1]`. */
  achievedSqm: string;
  /** Through a quotation. */
  linkedSqm: string;
  /** Direct `[07 C6]` — the route that skips the chain, made countable. */
  directSqm: string;
  dispatchCount: number;
};

/** `"2026-08"` or `"2026-08-01"` → the first day of that month. */
export function periodStart(period: string): string {
  const [year, month] = period.split("-");
  return `${year}-${month}-01`;
}

/**
 * The first day of the following month — the exclusive upper bound.
 *
 * **Exported for `/users/[id]`**, which needs both bounds to hand to
 * `requestOriginForPeriod` `S123`. That function lives in `dispatches.ts` and
 * takes the pair as strings, exactly as `dispatchesInPeriod` beside it does, so
 * neither module imports the other and there is one definition of where a month
 * ends. It was `/performance`'s until `28b` moved that block onto one person's
 * own page.
 */
export function nextPeriodStart(period: string): string {
  const [year, month] = periodStart(period).split("-").map(Number);
  const rolls = month === 12;
  const nextYear = rolls ? year + 1 : year;
  const nextMonth = rolls ? 1 : month + 1;
  return `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;
}

/**
 * The first day of the **previous** month — the mirror of `nextPeriodStart`.
 *
 * `D32`'s *last month* side figure reads the same `achievementForPeriod` one
 * period back rather than growing a query of its own, so there is one
 * definition of where a month begins and ends and one of how achievement is
 * derived from dispatches `S85`.
 */
export function previousPeriodStart(period: string): string {
  const [year, month] = periodStart(period).split("-").map(Number);
  const rolls = month === 1;
  const previousYear = rolls ? year - 1 : year;
  const previousMonth = rolls ? 12 : month - 1;
  return `${previousYear}-${String(previousMonth).padStart(2, "0")}-01`;
}

/** The current month in Riyadh, as `YYYY-MM-01`. The app's timezone is fixed
 *  and a period is a month there, not an instant. */
export function currentPeriod(): string {
  const formatted = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Riyadh",
    dateStyle: "short",
  }).format(new Date());
  return periodStart(formatted);
}

/* ------------------------------------------------------------------ *
 * Setting a target `[07 D1]`, `[10 §6]`
 * ------------------------------------------------------------------ */

/**
 * Set a target. **Always an INSERT** — a correction to the same month is a
 * superseding row, so the history of who changed what stays visible `[10 §6]`.
 * Nothing here updates or deletes.
 */
export async function setTarget(
  session: AuthSession,
  userId: string,
  period: string,
  sqm: string,
): Promise<Target> {
  if (!can(session, "canSetTargets")) {
    throw new RuleError("targets.errors.setTargetsOnly");
  }

  const sqmScaled = toScaled(sqm, SQM_SCALE);
  if (sqmScaled <= ZERO) {
    throw new RuleError("targets.errors.sqmPositive", "sqm");
  }

  const [subject] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.id, userId), eq(users.isActive, true)))
    .limit(1);
  if (!subject) {
    throw new RuleError("targets.errors.userNotMeasurable", "userId");
  }

  return withAudit(session.actor, async (tx, log) => {
    const [created] = await tx
      .insert(targets)
      .values({
        userId,
        period: periodStart(period),
        sqm,
        setBy: session.user.id,
      })
      .returning();

    log({
      action: "target.set",
      entityType: "user",
      entityId: userId,
      after: { period: created.period, sqm: created.sqm },
    });
    return created;
  });
}

export async function listTargetHistory(
  session: AuthSession,
  userId: string,
  period: string,
): Promise<TargetHistoryRow[]> {
  const setter = alias(users, "target_setter");
  const [measurable] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.id, userId), visibleMeasuredUsersFilter(session)))
    .limit(1);
  if (!measurable) return [];

  return db
    .select({
      id: targets.id,
      sqm: targets.sqm,
      effectiveFrom: targets.effectiveFrom,
      setByName: setter.name,
      createdAt: targets.createdAt,
    })
    .from(targets)
    .innerJoin(setter, eq(setter.id, targets.setBy))
    .where(
      and(eq(targets.userId, userId), eq(targets.period, periodStart(period))),
    )
    .orderBy(desc(targets.effectiveFrom), desc(targets.createdAt));
}

/* ------------------------------------------------------------------ *
 * Achievement — derived, never stored `[04 C1]`
 * ------------------------------------------------------------------ */

/**
 * Target versus achieved for a month, for everyone this identity may read.
 *
 * Four small queries and then pure arithmetic. The apportionment is done in
 * TypeScript, on the exact-decimal helpers, rather than in SQL: it needs the
 * remainder rule `18 §5` demands, and expressing that as a window function over
 * a lateral join would produce something nobody can read and — decisively —
 * something `verify-slice3.ts` could not assert as a pure function.
 */
export async function achievementForPeriod(
  session: AuthSession,
  period: string,
): Promise<AchievementRow[]> {
  const start = periodStart(period);
  const end = nextPeriodStart(period);

  // 1. Whose numbers may this identity read? The predicate lives in `authz`.
  const measured = await db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(and(eq(users.isActive, true), visibleMeasuredUsersFilter(session)))
    .orderBy(asc(users.name));
  if (measured.length === 0) return [];

  const measuredIds = new Set(measured.map((row) => row.id));

  // 2. Every dispatch in the month — see the note on `dispatchesInPeriod`.
  const dispatched = await dispatchesInPeriod(start, end);

  // 3. Credit each one by the split in force on ITS OWN date `[07 D3]`.
  const credits = await creditForDispatches(dispatched);

  const achieved = new Map<
    string,
    { total: bigint; linked: bigint; direct: bigint; count: number }
  >();
  for (const dispatch of dispatched) {
    const credit = credits.get(dispatch.id);
    if (!credit) continue;
    for (const share of credit.shares) {
      if (!measuredIds.has(share.userId)) continue;
      const bucket = achieved.get(share.userId) ?? {
        total: ZERO,
        linked: ZERO,
        direct: ZERO,
        count: 0,
      };
      const scaled = toScaled(share.sqm, SQM_SCALE);
      bucket.total += scaled;
      if (dispatch.isDirect) bucket.direct += scaled;
      else bucket.linked += scaled;
      bucket.count += 1;
      achieved.set(share.userId, bucket);
    }
  }

  // 4. The target row in force per person: greatest `effective_from`, then
  //    `created_at` for a same-instant correction `[10 §6]`.
  const targetRows = await db
    .select({
      userId: targets.userId,
      sqm: targets.sqm,
      effectiveFrom: targets.effectiveFrom,
      createdAt: targets.createdAt,
    })
    .from(targets)
    .where(
      and(
        eq(targets.period, start),
        inArray(targets.userId, [...measuredIds]),
      ),
    )
    .orderBy(desc(targets.effectiveFrom), desc(targets.createdAt));

  const targetFor = new Map<string, string>();
  for (const row of targetRows) {
    if (!targetFor.has(row.userId)) targetFor.set(row.userId, row.sqm);
  }

  return measured.map((person) => {
    const bucket = achieved.get(person.id);
    return {
      userId: person.id,
      userName: person.name,
      // Null, not zero: not measured is not the same as measured at nothing.
      targetSqm: targetFor.get(person.id) ?? null,
      achievedSqm: fromScaled(bucket?.total ?? ZERO, SQM_SCALE),
      linkedSqm: fromScaled(bucket?.linked ?? ZERO, SQM_SCALE),
      directSqm: fromScaled(bucket?.direct ?? ZERO, SQM_SCALE),
      dispatchCount: bucket?.count ?? 0,
    };
  });
}
