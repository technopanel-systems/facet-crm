/**
 * The calendar of non-working time — `S94`, built session 55.
 *
 * **Two kinds, one table.** A **public holiday** is a date range with no
 * person and affects everyone; **leave** is one person's range. Both are
 * skipped by the pace bar (`D32`, `D39`, `D79`) and by the working-day
 * reminders (`S87`'s two working-day thresholds), the founder's words: *"if a
 * rep is off for two weeks, his pace bar and his reminders should know it,
 * otherwise he comes back to a screen telling him he's behind and neglecting
 * customers he couldn't have called."*
 *
 * **This module is the one reader of `non_working_days`** (`CLAUDE.md`, one
 * definition). It hands `working-days.ts` — which stays pure — the set of
 * calendar days that are off for a person, and every pace figure and every
 * working-day cut-off in the product takes that set from here. The silence
 * thresholds (`S89`, calendar days) are untouched: staying in touch is a
 * different question from being at work, and `S94` names the pace bar and the
 * reminders, not the silence clock — recorded in `SPEC §16`.
 *
 * **Who may enter what.** `S94` says both kinds *must be enterable* and names
 * nobody. The smallest reading: a person enters their own leave; the holder
 * of `can_manage_users` — the person who already keeps the accounts — enters
 * public holidays and anyone's leave. A choice, recorded as a `SPEC §16`
 * question rather than presented as a rule.
 *
 * **Nothing is deleted** `S107`: a range typed on the wrong week is
 * soft-removed and stops counting; the row and its audit line stay.
 */

import { and, asc, desc, eq, gte, isNull, lte, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { db } from "@/db";
import { nonWorkingDays, users } from "@/db/schema";
import { withAudit } from "@/lib/audit";
import { can, type AuthSession } from "@/lib/authz";
import { RuleError } from "@/lib/validation";
import { shiftDays, type OffDays } from "@/lib/working-days";

export const NON_WORKING_KINDS = ["public_holiday", "leave"] as const;
export type NonWorkingKind = (typeof NON_WORKING_KINDS)[number];

const LABEL_MAX = 120;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * How far back a working-day cut-off may need to look. The longest
 * working-day threshold is ten days (`07 D5`), so a cut-off never walks more
 * than ten working days back — through however much leave and holiday sits
 * in between. A year covers any absence a rep comes back from.
 */
const LOOKBACK_DAYS = 366;

export type NonWorkingRow = {
  id: string;
  kind: NonWorkingKind;
  userId: string | null;
  userName: string | null;
  startsOn: string;
  endsOn: string;
  label: string;
  createdByName: string;
  createdAt: Date;
};

/** Ranges overlapping `[from, to]`, live, as rows. */
async function liveRanges(
  from: string,
  to: string,
  userId: string | null,
): Promise<{ startsOn: string; endsOn: string }[]> {
  return db
    .select({ startsOn: nonWorkingDays.startsOn, endsOn: nonWorkingDays.endsOn })
    .from(nonWorkingDays)
    .where(
      and(
        isNull(nonWorkingDays.removedAt),
        lte(nonWorkingDays.startsOn, to),
        gte(nonWorkingDays.endsOn, from),
        userId
          ? or(isNull(nonWorkingDays.userId), eq(nonWorkingDays.userId, userId))
          : isNull(nonWorkingDays.userId),
      ),
    );
}

function expand(
  ranges: { startsOn: string; endsOn: string }[],
  from: string,
  to: string,
): Set<string> {
  const off = new Set<string>();
  for (const range of ranges) {
    let day = range.startsOn < from ? from : range.startsOn;
    const end = range.endsOn > to ? to : range.endsOn;
    while (day <= end) {
      off.add(day);
      day = shiftDays(day, 1);
    }
  }
  return off;
}

/**
 * The days that are off for one person between two calendar days — every
 * public holiday, plus that person's own leave. `userId` null answers for
 * everyone at once: public holidays alone, which is the company-wide pace
 * `D77`'s band draws.
 */
export async function offDaysFor(
  userId: string | null,
  from: string,
  to: string,
): Promise<OffDays> {
  return expand(await liveRanges(from, to, userId), from, to);
}

/**
 * The same, for a working-day cut-off measured back from `today`: a wide
 * window behind the day, so a fortnight's leave is inside it. The reminders
 * read this once per request and pass it to `shiftWorkingDays`.
 */
export async function offDaysBehind(
  userId: string,
  today: string,
): Promise<OffDays> {
  return offDaysFor(userId, shiftDays(today, -LOOKBACK_DAYS), today);
}

/**
 * Off days for several people at once, over one range — the Team tab reads
 * one map rather than one query per row `D39` `D79`. Every set carries the
 * public holidays; each adds its own person's leave.
 */
export async function offDaysByUser(
  userIds: string[],
  from: string,
  to: string,
): Promise<Map<string, OffDays>> {
  const ranges = await db
    .select({
      userId: nonWorkingDays.userId,
      startsOn: nonWorkingDays.startsOn,
      endsOn: nonWorkingDays.endsOn,
    })
    .from(nonWorkingDays)
    .where(
      and(
        isNull(nonWorkingDays.removedAt),
        lte(nonWorkingDays.startsOn, to),
        gte(nonWorkingDays.endsOn, from),
        userIds.length > 0
          ? or(
              isNull(nonWorkingDays.userId),
              sql`${nonWorkingDays.userId} in (${sql.join(
                userIds.map((id) => sql`${id}::uuid`),
                sql`, `,
              )})`,
            )
          : isNull(nonWorkingDays.userId),
      ),
    );
  const shared = ranges.filter((row) => row.userId === null);
  const result = new Map<string, OffDays>();
  for (const userId of userIds) {
    result.set(
      userId,
      expand(
        [...shared, ...ranges.filter((row) => row.userId === userId)],
        from,
        to,
      ),
    );
  }
  return result;
}

/**
 * The calendar as a person may read it: every public holiday, their own
 * leave, and — for the holder of `can_manage_users` — everyone's leave.
 * Live rows only, from `from` onwards, soonest first.
 */
export async function listNonWorkingDays(
  session: AuthSession,
  from: string,
): Promise<NonWorkingRow[]> {
  const person = alias(users, "person");
  const author = alias(users, "author");
  const seesAll = can(session, "canManageUsers");
  const rows = await db
    .select({
      id: nonWorkingDays.id,
      kind: nonWorkingDays.kind,
      userId: nonWorkingDays.userId,
      userName: person.name,
      startsOn: nonWorkingDays.startsOn,
      endsOn: nonWorkingDays.endsOn,
      label: nonWorkingDays.label,
      createdByName: author.name,
      createdAt: nonWorkingDays.createdAt,
    })
    .from(nonWorkingDays)
    .leftJoin(person, eq(person.id, nonWorkingDays.userId))
    .innerJoin(author, eq(author.id, nonWorkingDays.createdByUserId))
    .where(
      and(
        isNull(nonWorkingDays.removedAt),
        gte(nonWorkingDays.endsOn, from),
        seesAll
          ? undefined
          : or(
              isNull(nonWorkingDays.userId),
              eq(nonWorkingDays.userId, session.user.id),
            ),
      ),
    )
    .orderBy(asc(nonWorkingDays.startsOn), asc(nonWorkingDays.kind), desc(nonWorkingDays.createdAt));
  return rows;
}

export type NonWorkingInput = {
  kind: NonWorkingKind;
  /** Required for leave, refused for a holiday. */
  userId?: string | null;
  startsOn: string;
  endsOn: string;
  label: string;
};

/**
 * May this person enter or remove this range? A holiday, or another
 * person's leave, is the account-keeper's; one's own leave is one's own.
 */
function assertMayEdit(
  session: AuthSession,
  kind: NonWorkingKind,
  userId: string | null,
): void {
  if (can(session, "canManageUsers")) return;
  if (kind === "leave" && userId === session.user.id) return;
  throw new RuleError(
    kind === "public_holiday"
      ? "calendar.errors.cannotEnterHoliday"
      : "calendar.errors.cannotEnterOthersLeave",
  );
}

/** Enter a range. One audit row; nothing else changes — the readers derive. */
export async function addNonWorkingDays(
  session: AuthSession,
  input: NonWorkingInput,
): Promise<string> {
  const kind = NON_WORKING_KINDS.find((k) => k === input.kind);
  if (!kind) throw new RuleError("calendar.errors.kindUnknown", "kind");
  const userId = kind === "leave" ? (input.userId ?? null) : null;
  if (kind === "leave" && !userId) {
    throw new RuleError("calendar.errors.personRequired", "userId");
  }
  assertMayEdit(session, kind, userId);

  if (!DAY.test(input.startsOn) || !DAY.test(input.endsOn)) {
    throw new RuleError("calendar.errors.dateRequired", "startsOn");
  }
  if (input.endsOn < input.startsOn) {
    throw new RuleError("calendar.errors.endsBeforeStart", "endsOn");
  }
  const label = input.label.trim();
  if (!label) throw new RuleError("calendar.errors.labelRequired", "label");
  if (label.length > LABEL_MAX) {
    throw new RuleError("calendar.errors.labelTooLong", "label");
  }
  if (userId) {
    const [person] = await db
      .select({ isActive: users.isActive })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    // Leave is a fact about somebody who works here `[07 B7]`.
    if (!person?.isActive) {
      throw new RuleError("calendar.errors.personInactive", "userId");
    }
  }

  return withAudit(session.actor, async (tx, log) => {
    const [row] = await tx
      .insert(nonWorkingDays)
      .values({
        kind,
        userId,
        startsOn: input.startsOn,
        endsOn: input.endsOn,
        label,
        createdByUserId: session.user.id,
      })
      .returning({ id: nonWorkingDays.id });
    log({
      action: "non_working_days.added",
      entityType: "non_working_days",
      entityId: row.id,
      after: { kind, userId, startsOn: input.startsOn, endsOn: input.endsOn, label },
    });
    return row.id;
  });
}

/** Soft-remove a range — it stops counting; the row and its history stay `S107`. */
export async function removeNonWorkingDays(
  session: AuthSession,
  id: string,
): Promise<void> {
  const [row] = await db
    .select({
      kind: nonWorkingDays.kind,
      userId: nonWorkingDays.userId,
      removedAt: nonWorkingDays.removedAt,
    })
    .from(nonWorkingDays)
    .where(eq(nonWorkingDays.id, id))
    .limit(1);
  if (!row || row.removedAt) throw new RuleError("calendar.errors.notFound");
  assertMayEdit(session, row.kind, row.userId);

  await withAudit(session.actor, async (tx, log) => {
    const [removed] = await tx
      .update(nonWorkingDays)
      .set({ removedAt: new Date(), removedByUserId: session.user.id })
      .where(and(eq(nonWorkingDays.id, id), isNull(nonWorkingDays.removedAt)))
      .returning({ id: nonWorkingDays.id, removedAt: nonWorkingDays.removedAt });
    if (!removed) throw new RuleError("calendar.errors.notFound");
    log({
      action: "non_working_days.removed",
      entityType: "non_working_days",
      entityId: id,
      before: { removedAt: null },
      after: { removedAt: removed.removedAt },
    });
  });
}
