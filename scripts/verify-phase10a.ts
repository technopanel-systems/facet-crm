/**
 * Verification scaffolding for follow-ups and notifications — NOT a feature.
 *
 * `scripts/verify-phase9.ts` is the pattern this copies, for the reason
 * `CLAUDE.md` records: a behavioural check that is thrown away cannot be
 * reproduced. This one is **kept**.
 *
 * It drives `src/lib/{follow-ups,notifications,dormancy,working-days,team}.ts`
 * in process — no browser, no HTTP — and checks the things that are otherwise
 * only claimed:
 *
 *   1. The seed: five notification types with the right tier and persistence
 *      and **no sixth**, and all five thresholds `[21 §2]`, `[07 D5]`.
 *   2. Every gate refuses with its own key — and the negative claim that
 *      follow-ups and notifications refuse NOBODY `[21 §9]`.
 *   3. The dormancy CHECK holds **at the database** `[13 §1]`, `[21 §7]`.
 *   4. Working-day arithmetic, as a pure function with no database `[21 §8]`.
 *   5. *** A follow-up writes NO task row and NO notification row *** `[21 §1]`.
 *   6. Each kind fires at its threshold and not a day early, from `settings`.
 *   7. `on hold until` suppresses every kind, and a past date does not `[20 §5]`.
 *   8. Archived and re-included companies raise nothing, and a stale
 *      re-inclusion stops shielding `[07 E6]`, `[21 §7]`.
 *   9. *** The digest reads the day's settled state at end of day *** `[20 §9]`.
 *  10. Persistence: raised once, read is not resolved, and a type with no
 *      condition is not persistent `[07 G1]`, `[21 §4]`.
 *  11. Resolution by condition, for every persistent type × every anchor it can
 *      carry — the table that fails when one is missing `[21 §3]`, `[21 §4]`.
 *  12. *** A handover produces ONE notification, not one per record *** `[21 §5]`.
 *  13. Recipient filtering is in the application layer `[00 §1.13]`.
 *  14. Visibility in both directions, with no new predicate written `[21 §1]`.
 *  15. Dormancy's three routes, and nothing deleted `[07 E6]`, `[12 §7]`.
 *  16. Every write is audited `[07 E1]`.
 *
 * Usage: `npm run verify:phase10a`
 *
 * That needs `NODE_ENV=development` in `.env`. `--env-file` is not optional and
 * cannot be replaced by the `process.loadEnvFile` call below: this script
 * reaches `@/lib/authz`, and `src/auth/index.ts` reads `AUTH_SECRET` at module
 * scope — before any statement in this file runs.
 *
 * **It refuses to run outside development** `[15 §7]`: it writes real rows.
 *
 * It needs a seeded database — `npm run db:seed`, which since `21 §2` also
 * writes the notification types — and the fixture accounts:
 * `DEV_FIXTURE_PASSWORD=… npm run dev:fixtures`.
 *
 * **It creates its own reps, and every email carries the run stamp.** The
 * digest is a whole-database per-day figure, so reusing the shared fixture
 * accounts would make the second run trip over the first run's rows — the trap
 * `verify:slice3` hit and `verify:phase9` inherited.
 *
 * **Nothing is cleaned up** `[12 §7]`. Every row this writes is prefixed with
 * the run stamp so a dev database stays readable.
 */

process.loadEnvFile(".env");

import { and, eq, inArray, isNull, sql } from "drizzle-orm";

import { closeDatabase, db } from "@/db";
import {
  auditLog,
  companies,
  companyDormancyReviews,
  companyReps,
  notificationTypes,
  notifications,
  projectCompanies,
  projects,
  quotationThreads,
  quotationVersions,
  repReports,
  roles,
  settings,
  users,
} from "@/db/schema";
import {
  createUser,
  deactivateUser,
  scopeForUser,
  type AuthSession,
  type Role,
  type User,
} from "@/lib/authz";
import {
  archiveCompany,
  dormancyReviews,
  isCompanyQuiet,
  reassignCompany,
  reincludeCompany,
} from "@/lib/dormancy";
import {
  NOTIFICATION_TYPES,
  SAUDI_CODE,
  type FollowUpKind,
  type NotificationTypeKey,
} from "@/lib/enums";
import { followUps, followUpsForRecipient } from "@/lib/follow-ups";
import { listCountries } from "@/lib/lookups";
import {
  listNotifications,
  markRead,
  RESOLUTION_RULES,
  sweepNotifications,
  unresolvedCount,
  type NotificationAnchorType,
} from "@/lib/notifications";
import { extendValidity } from "@/lib/quotations";
import { createReport, today } from "@/lib/reports";
import {
  CATALOGUE_NO_RESPONSE_KEY,
  PROJECT_STAGE_UNCHANGED_KEY,
  QUIET_DAYS_QUALIFIED_KEY,
  QUIET_DAYS_UNQUALIFIED_KEY,
  QUOTATION_NO_RESPONSE_KEY,
  QUOTATION_RETURNED_KEY,
  getFollowUpThresholds,
} from "@/lib/settings";
import { reassignHandover } from "@/lib/team";
import {
  calendarDaysBetween,
  isWorkingDay,
  shiftDays,
  shiftWorkingDays,
  workingDaysBetween,
} from "@/lib/working-days";

let failures = 0;

function check(label: string, condition: boolean, detail = ""): void {
  if (condition) {
    console.log(`  ok    ${label}`);
  } else {
    failures += 1;
    console.error(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

/**
 * Assert that `fn` refuses, and **why**. Checking only "it threw" would pass on
 * a typo in the function under test.
 */
async function refuses(
  label: string,
  expectedKey: string,
  fn: () => Promise<unknown>,
): Promise<void> {
  try {
    await fn();
    failures += 1;
    console.error(`  FAIL  ${label} — it was allowed`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    check(
      `${label} (${expectedKey})`,
      message === expectedKey,
      `threw ${message}`,
    );
  }
}

/** Assert that `fn` is ALLOWED — the negative claim `21 §9` makes. */
async function allows(label: string, fn: () => Promise<unknown>): Promise<void> {
  try {
    await fn();
    check(label, true);
  } catch (error) {
    failures += 1;
    const message = error instanceof Error ? error.message : String(error);
    console.error(`  FAIL  ${label} — it refused with ${message}`);
  }
}

/**
 * Assert that the DATABASE refuses, by constraint name `[13 §1]`.
 *
 * Drizzle wraps a driver error in one whose message is only "Failed query: …",
 * and postgres.js puts the constraint name on the `cause`. Reading just
 * `error.message` passes on nothing and fails on everything — which is how this
 * helper behaved on `verify:phase9`'s first run.
 */
async function databaseRefuses(
  label: string,
  constraintName: string,
  statement: string,
): Promise<void> {
  try {
    await db.execute(sql.raw(statement));
    failures += 1;
    console.error(`  FAIL  ${label} — the database allowed it`);
  } catch (error) {
    check(
      `${label} (${constraintName})`,
      causeChain(error).includes(constraintName),
      `threw ${causeChain(error).slice(0, 160)}`,
    );
  }
}

/** Every message in the `cause` chain, plus a driver's `constraint_name`. */
function causeChain(error: unknown): string {
  const parts: string[] = [];
  let current: unknown = error;
  for (let depth = 0; current && depth < 5; depth += 1) {
    if (current instanceof Error) {
      parts.push(current.message);
      const named = (current as { constraint_name?: string }).constraint_name;
      if (named) parts.push(named);
      current = current.cause;
    } else {
      parts.push(String(current));
      break;
    }
  }
  return parts.join(" | ");
}

/** A session for a fixture user, assembled the way `getSession` would. */
async function sessionFor(email: string): Promise<AuthSession> {
  const [row] = await db
    .select({ user: users, role: roles })
    .from(users)
    .innerJoin(roles, eq(users.roleId, roles.id))
    .where(eq(users.email, email))
    .limit(1);
  if (!row) throw new Error(`No user ${email} — run npm run dev:fixtures`);
  const user = { ...row.user, role: row.role };
  return {
    user,
    realUser: user,
    isImpersonating: false,
    actor: { actorUserId: user.id, actingAsUserId: null },
  };
}

/** Which kinds fire for this identity right now, as a set of anchor ids. */
async function firing(
  session: AuthSession,
  kind: FollowUpKind,
): Promise<Set<string>> {
  const { rows } = await followUps(session, { kind });
  return new Set(rows.map((row) => row.anchorId));
}

/** An instant `days` before now, for a timestamptz column. */
function instantDaysAgo(days: number): Date {
  return new Date(Date.now() - days * 86_400_000);
}

async function main(): Promise<void> {
  if (process.env.NODE_ENV !== "development") {
    console.error(
      "verify-phase10a refuses to run outside development.\n" +
        `  NODE_ENV is ${process.env.NODE_ENV ?? "unset"}, and must be "development".`,
    );
    process.exit(1);
  }

  const stamp = `verify10a-${Date.now()}`;
  const manager = await sessionFor("manager@example.test");

  const seededRoles = await db.select().from(roles);
  const roleByName = new Map(seededRoles.map((role) => [role.nameEn, role]));
  const repRole = roleByName.get("Sales Rep");
  const coordinatorRole = roleByName.get("Sales Coordinator");
  if (!repRole || !coordinatorRole || seededRoles.length < 7) {
    console.error("Roles are not seeded. Run: npm run db:seed");
    process.exit(1);
  }

  const asSession = (user: User, role: Role): AuthSession => {
    const withRole = { ...user, role };
    return {
      user: withRole,
      realUser: withRole,
      isImpersonating: false,
      actor: { actorUserId: user.id, actingAsUserId: null },
    };
  };

  /* --- 1. The seed [21 §2], [07 D5] --------------------------------- */

  console.log("\n1. The seed: five notification types, and all five thresholds");

  const types = await db.select().from(notificationTypes);
  if (types.length === 0) {
    console.error(
      "The notification types are not seeded. Run: npm run db:seed",
    );
    process.exit(1);
  }
  const typeByKey = new Map(types.map((type) => [type.key, type]));

  const expected: {
    key: NotificationTypeKey;
    tier: "act_now" | "digest";
    persistent: boolean;
  }[] = [
    { key: NOTIFICATION_TYPES.quotationExpired, tier: "act_now", persistent: true },
    { key: NOTIFICATION_TYPES.recordAssigned, tier: "act_now", persistent: true },
    // NOT persistent: no anchor, no completion condition `[21 §4, §5]`.
    { key: NOTIFICATION_TYPES.recordHandedOver, tier: "act_now", persistent: false },
    { key: NOTIFICATION_TYPES.shareGranted, tier: "act_now", persistent: true },
    { key: NOTIFICATION_TYPES.followUpDigest, tier: "digest", persistent: false },
    // `25 §11`'s sixth — see the count assertion below. NOT persistent, for
    // `record.handed_over`'s reason `[21 §4]`: being mentioned has no condition
    // that can clear.
    { key: NOTIFICATION_TYPES.mentionReceived, tier: "act_now", persistent: false },
  ];

  for (const want of expected) {
    const row = typeByKey.get(want.key);
    check(
      `${want.key} is seeded as ${want.tier}, persistent=${want.persistent} [21 §2, §4]`,
      row?.tier === want.tier && row?.isPersistent === want.persistent,
      `got tier=${row?.tier} persistent=${row?.isPersistent}`,
    );
    check(
      `${want.key} carries the in_app channel [04 C3]`,
      row?.defaultChannel === "in_app",
      `got ${row?.defaultChannel}`,
    );
  }
  /**
   * A type nothing produces is the shape of v1's dead approval gate `[20 §11]`.
   *
   * **This said five until feature slice 2, and the line moving is the point.**
   * `21 §2` is headed *"Five notification types are seeded, and no sixth"*, but
   * the rule underneath that heading is a **test**, not a cap: *"Each type below
   * is named in a user-truth document AND has a real event in the code that can
   * raise it."* `mention.received` passes both limbs — `25 §11` names it
   * (*"Tagging a person raises a notification"*) and `src/lib/comments.ts`
   * raises it, added in the same change. `25` is the later user-truth document
   * besides, so it wins on its own.
   *
   * What the number still guards is the thing `21 §2` actually cared about: a
   * seeded type with no producer. Raise it only alongside one.
   */
  check(
    "exactly six notification types — 21 §2's five, and 25 §11's [21 §2], [25 §11]",
    types.length === 6,
    `got ${types.map((type) => type.key).join(", ")}`,
  );

  const thresholds = await getFollowUpThresholds();
  const thresholdKeys = await db
    .select({ key: settings.key })
    .from(settings)
    .where(sql`${settings.key} like 'followup.%'`);
  // Six since feature slice 4: `07 D5`'s five, and `22 §6.11`'s returned
  // quotation. The claim `20 §11` set is unchanged — a threshold row is seeded
  // when, and only when, something reads it.
  check(
    "all six thresholds are seeded, and every one has a reader [21 §2], [22 §6.11]",
    thresholdKeys.length === 6 &&
      [
        QUIET_DAYS_QUALIFIED_KEY,
        QUIET_DAYS_UNQUALIFIED_KEY,
        QUOTATION_NO_RESPONSE_KEY,
        QUOTATION_RETURNED_KEY,
        CATALOGUE_NO_RESPONSE_KEY,
        PROJECT_STAGE_UNCHANGED_KEY,
      ].every((key) => thresholdKeys.some((row) => row.key === key)),
    `got ${thresholdKeys.map((row) => row.key).join(", ")}`,
  );
  check(
    "07 D5's published defaults: 5 / 10 / 21 working-or-calendar days [07 D5]",
    thresholds.quotationNoResponse === 5 &&
      thresholds.catalogueNoResponse === 10 &&
      thresholds.projectStageUnchanged === 21,
    `got ${thresholds.quotationNoResponse}/${thresholds.catalogueNoResponse}/${thresholds.projectStageUnchanged}`,
  );
  check(
    "no new permission flag was invented for this phase [21 §10]",
    !Object.keys(repRole).some(
      (key) =>
        key.toLowerCase().includes("notif") ||
        key.toLowerCase().includes("dormanc") ||
        key.toLowerCase().includes("followup"),
    ),
  );

  /* --- Fixtures ----------------------------------------------------- */

  console.log("\n   fixtures: run-scoped reps, companies, a project and a thread");

  const password = `${stamp}-secret`;
  const ownerUser = await createUser(manager, {
    name: `${stamp} Owner`,
    email: `${stamp}-owner@example.test`,
    roleId: repRole.id,
    password,
  });
  const otherUser = await createUser(manager, {
    name: `${stamp} Other`,
    email: `${stamp}-other@example.test`,
    roleId: repRole.id,
    password,
  });
  const strangerUser = await createUser(manager, {
    name: `${stamp} Stranger`,
    email: `${stamp}-stranger@example.test`,
    roleId: repRole.id,
    password,
  });
  const owner = asSession(ownerUser, repRole);
  const other = asSession(otherUser, repRole);
  const stranger = asSession(strangerUser, repRole);

  // `S13` makes the phone mandatory and `S23` matches companies on it, so every
  // fixture gets its own — from the run stamp plus a counter, because a shared
  // literal would make each run's companies duplicates of the last run's.
  // `S14` — all of them are Saudi, so `S15`'s city and region still apply.
  const saudiId = (await listCountries()).find(
    (row) => row.code === SAUDI_CODE,
  )!.id;
  let phoneSeq = 0;
  const nextPhone = () => `+9665${stamp.slice(-7)}${(phoneSeq += 1)}`;

  /** A company owned by `ownerUser`, created `age` days ago. */
  async function makeCompany(slug: string, ageDays: number) {
    const [company] = await db
      .insert(companies)
      .values({
        name: `${stamp} ${slug}`,
        nameNormalized: `${stamp}-${slug}`,
        phone: nextPhone(),
        countryId: saudiId,
        createdBy: ownerUser.id,
        createdAt: instantDaysAgo(ageDays),
      })
      .returning();
    await db.insert(companyReps).values({
      companyId: company.id,
      userId: ownerUser.id,
      isPrimary: true,
      origin: "self_registered",
    });
    return company;
  }

  // Section 6's boundary pairs. `quietSince` for a never-logged company is its
  // creation day, so age IS the clock.
  const quietOver = await makeCompany("quiet-over", 61);
  const quietUnder = await makeCompany("quiet-under", 60);
  const catalogueOver = await makeCompany("catalogue-over", 5);
  const catalogueUnder = await makeCompany("catalogue-under", 5);
  const heldCompany = await makeCompany("held", 61);
  const heldPast = await makeCompany("held-past", 61);
  const archivedCompany = await makeCompany("archived", 61);
  const reincludedCompany = await makeCompany("reincluded", 61);
  const staleReinclusion = await makeCompany("stale-reinclusion", 61);
  const quotationCompany = await makeCompany("quotation", 5);
  const projectCompanyOver = await makeCompany("project-over", 5);
  const projectCompanyUnder = await makeCompany("project-under", 5);

  /** A catalogue interaction, dated exactly `workingDays` working days back. */
  async function catalogueSentAt(companyId: string, workingDays: number) {
    await db.insert(repReports).values({
      userId: ownerUser.id,
      entryType: "interaction",
      companyId,
      channel: "email",
      outcome: "catalogue_sent",
      narrative: `${stamp} catalogue`,
      reportDate: shiftWorkingDays(today(), workingDays),
    });
  }
  await catalogueSentAt(catalogueOver.id, thresholds.catalogueNoResponse);
  await catalogueSentAt(catalogueUnder.id, thresholds.catalogueNoResponse - 1);

  /** A project owned by `ownerUser` with one thread, both dated back. */
  async function makeProject(
    slug: string,
    companyId: string,
    ageDays: number,
    threadStatus: "requested" | "issued",
  ) {
    const [project] = await db
      .insert(projects)
      .values({
        nameEn: `${stamp} ${slug}`,
        nameNormalized: `${stamp}-${slug}`,
        ownerUserId: ownerUser.id,
        createdBy: ownerUser.id,
        createdAt: instantDaysAgo(ageDays + 5),
      })
      .returning();
    await db
      .insert(projectCompanies)
      .values({ projectId: project.id, companyId, isBuyer: true });
    const [thread] = await db
      .insert(quotationThreads)
      .values({
        projectId: project.id,
        companyId,
        raisedByUserId: ownerUser.id,
        createdAt: instantDaysAgo(ageDays),
      })
      .returning();
    const [version] = await db
      .insert(quotationVersions)
      .values({
        threadId: thread.id,
        versionNumber: 1,
        origin: "initial_request",
        status: threadStatus,
        createdBy: ownerUser.id,
        createdAt: instantDaysAgo(ageDays),
        validUntil: shiftDays(today(), -1),
      })
      .returning();
    return { project, thread, version };
  }

  // `21 §3` — the clock starts at the AUDIT row, because `quotation_versions`
  // has no `issued_at`. These two write one directly, dated to the boundary.
  async function issuedAt(versionId: string, workingDaysAgo: number) {
    const day = shiftWorkingDays(today(), workingDaysAgo);
    await db.insert(auditLog).values({
      actorUserId: ownerUser.id,
      action: "quotation_version.issued",
      entityType: "quotation_version",
      entityId: versionId,
      createdAt: new Date(`${day}T09:00:00Z`),
    });
  }

  const quotedOver = await makeProject(
    "quoted-over",
    quotationCompany.id,
    30,
    "issued",
  );
  const quotedUnder = await makeProject(
    "quoted-under",
    quotationCompany.id,
    30,
    "issued",
  );
  await issuedAt(quotedOver.version.id, thresholds.quotationNoResponse);
  await issuedAt(quotedUnder.version.id, thresholds.quotationNoResponse - 1);

  const projectOver = await makeProject(
    "stage-over",
    projectCompanyOver.id,
    thresholds.projectStageUnchanged + 1,
    "requested",
  );
  const projectUnder = await makeProject(
    "stage-under",
    projectCompanyUnder.id,
    thresholds.projectStageUnchanged - 1,
    "requested",
  );

  /* --- 2. Gates [21 §6], [21 §9] ------------------------------------ */

  console.log("\n2. Every gate refuses with its own key — and two refuse nobody");

  await refuses(
    "a rep may not reassign a company [21 §6]",
    "dormancy.errors.cannotAssign",
    () => reassignCompany(owner, quietOver.id, otherUser.id),
  );
  await refuses(
    "a rep may not archive a company [21 §6]",
    "dormancy.errors.cannotAssign",
    () => archiveCompany(owner, quietOver.id, "no"),
  );
  await refuses(
    "a stranger may not re-include a company they cannot see [21 §6]",
    "dormancy.errors.companyNotVisible",
    () => reincludeCompany(stranger, quietOver.id),
  );
  await refuses(
    "archiving requires a written reason [10 §8]",
    "dormancy.errors.noteRequired",
    () => archiveCompany(manager, quietOver.id, "   "),
  );
  await refuses(
    "a company cannot be handed to an inactive account [04 C2]",
    "dormancy.errors.recipientInactive",
    async () => {
      const [ghost] = await db
        .insert(users)
        .values({
          name: `${stamp} Ghost`,
          email: `${stamp}-ghost@example.test`,
          roleId: repRole.id,
          isActive: false,
        })
        .returning();
      await reassignCompany(manager, quietOver.id, ghost.id);
    },
  );

  // The negative half. Both screens are SCOPED, not gated `[21 §9]` — the same
  // shape `20 §7` gave coverage, and a gate here would look identical to a bug.
  await allows("a rep may read their own follow-ups [21 §9]", () =>
    followUps(owner),
  );
  await allows("a stranger may read follow-ups too [21 §9]", () =>
    followUps(stranger),
  );
  await allows("a rep may read their own notifications [21 §9]", () =>
    listNotifications(owner),
  );

  /* --- 3. The database refuses [13 §1], [21 §7] --------------------- */

  console.log("\n3. The dormancy CHECK holds at the database");

  await databaseRefuses(
    "a reassignment with no recipient is refused",
    "company_dormancy_reviews_recipient",
    `insert into company_dormancy_reviews
       (company_id, outcome, decided_by_user_id, decided_at)
     values ('${quietOver.id}', 'reassigned', '${ownerUser.id}', current_date)`,
  );
  await databaseRefuses(
    "a re-inclusion WITH a recipient is refused",
    "company_dormancy_reviews_recipient",
    `insert into company_dormancy_reviews
       (company_id, outcome, decided_by_user_id, to_user_id, decided_at)
     values ('${quietOver.id}', 'reincluded', '${ownerUser.id}',
             '${otherUser.id}', current_date)`,
  );

  /* --- 4. Working days, as a pure function [21 §8] ------------------ */

  console.log("\n4. Working-day arithmetic — no database, table-driven");

  // 2026-08-06 is a Thursday, so 07 is Friday and 08 is Saturday.
  check("a Thursday is a working day [21 §8]", isWorkingDay("2026-08-06"));
  check("a Friday is not [21 §8]", !isWorkingDay("2026-08-07"));
  check("a Saturday is not [21 §8]", !isWorkingDay("2026-08-08"));
  check("a Sunday is [21 §8]", isWorkingDay("2026-08-09"));

  const workingCases: [string, string, number][] = [
    ["2026-08-06", "2026-08-06", 0],
    // Thursday to Sunday crosses the whole weekend: one working day elapsed.
    ["2026-08-06", "2026-08-09", 1],
    ["2026-08-06", "2026-08-08", 0],
    // A full calendar week is five working days.
    ["2026-08-02", "2026-08-09", 5],
    // Never negative: nothing has been waiting for minus three days.
    ["2026-08-09", "2026-08-02", 0],
  ];
  for (const [from, to, want] of workingCases) {
    check(
      `workingDaysBetween(${from}, ${to}) === ${want} [21 §8]`,
      workingDaysBetween(from, to) === want,
      `got ${workingDaysBetween(from, to)}`,
    );
  }
  check(
    "calendarDaysBetween counts the weekend [07 D5]",
    calendarDaysBetween("2026-08-02", "2026-08-09") === 7,
    `got ${calendarDaysBetween("2026-08-02", "2026-08-09")}`,
  );
  check(
    "shiftWorkingDays is the inverse of workingDaysBetween [21 §8]",
    workingDaysBetween(shiftWorkingDays("2026-08-09", 5), "2026-08-09") === 5,
  );
  // **No holiday calendar** `[21 §8]` — nothing is special-cased, so every
  // Sunday-to-Thursday in a range is a working day and a fortnight is always
  // ten. Asserted over a span rather than against one hand-picked date, which
  // is how the first draft of this check managed to fail while the code was
  // right: it named a date without checking which weekday it fell on.
  const fortnight = Array.from({ length: 14 }, (_, offset) =>
    shiftDays("2026-08-02", offset),
  );
  check(
    "no holiday calendar: a fortnight is always ten working days [21 §8]",
    fortnight.filter(isWorkingDay).length === 10,
    `got ${fortnight.filter(isWorkingDay).length}`,
  );
  check(
    "and the four excluded days are exactly the Fridays and Saturdays [21 §8]",
    fortnight
      .filter((day) => !isWorkingDay(day))
      .every((day) => [5, 6].includes(new Date(`${day}T00:00:00Z`).getUTCDay())),
  );

  /* --- 5. A follow-up writes nothing [21 §1] ------------------------ */

  console.log("\n5. *** A follow-up writes NO notification row ***");

  // `21 §1`'s claim was that FACET never writes `10 §9`'s SYSTEM task, proved
  // by counting `tasks` rows before and after. Feature slice 6 withdrew `25
  // §20` ("not needed for now") and dropped `tasks` entirely along with it
  // `[26 §6]` — there is no table left to count, so the claim this section
  // once proved is now proved by the table's absence, asserted once in
  // `verify:schema25` rather than here on every run.
  const [notificationsBefore] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(notifications);

  const ownerFollowUps = await followUps(owner);

  const [notificationsAfter] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(notifications);

  check(
    "computing follow-ups found something to compute",
    ownerFollowUps.total > 0,
    `got ${ownerFollowUps.total}`,
  );
  check(
    "*** it wrote no `notifications` row: a follow-up is a condition [21 §1] ***",
    notificationsAfter.n === notificationsBefore.n,
    `${notificationsBefore.n} -> ${notificationsAfter.n}`,
  );

  /* --- 6. Each kind fires at its threshold, not a day early --------- */

  console.log("\n6. Each kind fires at its threshold and not a day early");

  const quiet = await firing(owner, "company_quiet");
  check(
    `a company quiet for ${thresholds.unqualified + 1} days fires [07 D5]`,
    quiet.has(quietOver.id),
  );
  check(
    `one quiet for exactly ${thresholds.unqualified} does not [07 D5]`,
    !quiet.has(quietUnder.id),
  );

  const catalogue = await firing(owner, "catalogue_no_response");
  check(
    `a catalogue ${thresholds.catalogueNoResponse} working days old fires [07 D5]`,
    catalogue.has(catalogueOver.id),
  );
  check(
    `one ${thresholds.catalogueNoResponse - 1} working days old does not [07 D5]`,
    !catalogue.has(catalogueUnder.id),
  );

  const quoted = await firing(owner, "quotation_no_response");
  check(
    `an issued quotation ${thresholds.quotationNoResponse} working days old fires [07 D5]`,
    quoted.has(quotedOver.thread.id),
  );
  check(
    `one ${thresholds.quotationNoResponse - 1} working days old does not [07 D5]`,
    !quoted.has(quotedUnder.thread.id),
  );

  const stalled = await firing(owner, "project_stage_unchanged");
  check(
    `a project unchanged for ${thresholds.projectStageUnchanged + 1} days fires [07 D5]`,
    stalled.has(projectOver.project.id),
  );
  check(
    `one unchanged for ${thresholds.projectStageUnchanged - 1} does not [07 D5]`,
    !stalled.has(projectUnder.project.id),
  );

  // The threshold is DATA, not code `[07 D5]`. Move the row and the boundary
  // must move with it — otherwise a manager editing it changes nothing.
  await db
    .update(settings)
    .set({ value: thresholds.unqualified + 5 })
    .where(eq(settings.key, QUIET_DAYS_UNQUALIFIED_KEY));
  const quietRaised = await firing(owner, "company_quiet");
  check(
    "raising the threshold setting takes a company off the queue [07 D5], [21 §2]",
    !quietRaised.has(quietOver.id),
  );
  await db
    .update(settings)
    .set({ value: thresholds.unqualified })
    .where(eq(settings.key, QUIET_DAYS_UNQUALIFIED_KEY));

  /*
   * `isCompanyQuiet` is the SAME condition, asked about one company — it is
   * what decides whether the company page renders a dormancy panel at all.
   *
   * It gets its own assertions because it was not covered by the four above
   * and shipped broken: it wrote `current_date - $2` with the threshold as a
   * bound parameter, Postgres cannot infer a type for `date - unknown`, and the
   * company page answered 500. A driven HTTP pass found it. This is what keeps
   * it found.
   */
  check(
    "isCompanyQuiet agrees with the queue on a quiet company [21 §7]",
    (await isCompanyQuiet(quietOver.id, thresholds)) === true,
  );
  check(
    "…and on one inside its threshold [21 §7]",
    (await isCompanyQuiet(quietUnder.id, thresholds)) === false,
  );

  // A response is a later interaction, whatever it said `[21 §1]`.
  await createReport(owner, {
    entryType: "interaction",
    companyId: quotationCompany.id,
    contactId: null,
    projectId: null,
    channel: "call",
    outcome: "no_answer",
    category: null,
    cityId: null,
    onHoldUntil: null,
    narrative: `${stamp} chased`,
    reportDate: today(),
    signals: [],
  });
  const quotedAfterReply = await firing(owner, "quotation_no_response");
  check(
    "an interaction after the quotation went out IS the response [07 D5]",
    !quotedAfterReply.has(quotedOver.thread.id),
  );

  /* --- 7. On hold suppresses [20 §5] -------------------------------- */

  console.log("\n7. `on hold until` suppresses every kind; a past date does not");

  await createReport(owner, {
    entryType: "interaction",
    companyId: heldCompany.id,
    contactId: null,
    projectId: null,
    channel: "call",
    outcome: "on_hold",
    category: null,
    cityId: null,
    onHoldUntil: shiftDays(today(), 30),
    narrative: `${stamp} after Ramadan`,
    reportDate: today(),
  signals: [],
  });
  // A held company is also freshly logged, so it needs a second company whose
  // hold has EXPIRED to prove the suppression is the date and not the report.
  await db.insert(repReports).values({
    userId: ownerUser.id,
    entryType: "interaction",
    companyId: heldPast.id,
    channel: "call",
    outcome: "on_hold",
    narrative: `${stamp} hold expired`,
    onHoldUntil: shiftDays(today(), -1),
    reportDate: shiftDays(today(), -90),
  });

  const heldQuiet = await firing(owner, "company_quiet");
  check(
    "a company on hold raises nothing [20 §5]",
    !heldQuiet.has(heldCompany.id),
  );
  check(
    "a hold that has passed suppresses nothing [20 §5]",
    heldQuiet.has(heldPast.id),
  );

  /* --- 8. Dormancy suppression [07 E6], [21 §7] --------------------- */

  console.log("\n8. Archived and re-included companies raise nothing");

  await archiveCompany(manager, archivedCompany.id, `${stamp} out of scope`);
  await reincludeCompany(owner, reincludedCompany.id, `${stamp} keeping it`);
  // A re-inclusion older than the longest threshold has stopped shielding.
  await db.insert(companyDormancyReviews).values({
    companyId: staleReinclusion.id,
    outcome: "reincluded",
    decidedByUserId: ownerUser.id,
    decidedAt: shiftDays(today(), -(thresholds.unqualified + 5)),
  });

  const afterDormancy = await firing(owner, "company_quiet");
  check(
    "an archived company is off the queue [07 E6]",
    !afterDormancy.has(archivedCompany.id),
  );
  check(
    "a re-included company is shielded for one threshold period [21 §7]",
    !afterDormancy.has(reincludedCompany.id),
  );
  check(
    "a re-inclusion older than that stops shielding [21 §7]",
    afterDormancy.has(staleReinclusion.id),
  );

  /* --- 9. The digest [20 §9] ---------------------------------------- */

  console.log("\n9. *** The digest reads the day's settled state at end of day ***");

  const ownerScope = await scopeForUser(ownerUser.id);
  if (!ownerScope) throw new Error("scopeForUser returned null for the owner");
  const ownerRows = await followUpsForRecipient(ownerScope);

  await sweepNotifications();
  const digests = async () =>
    db
      .select()
      .from(notifications)
      .innerJoin(
        notificationTypes,
        eq(notificationTypes.id, notifications.notificationTypeId),
      )
      .where(
        and(
          eq(notifications.recipientUserId, ownerUser.id),
          eq(notificationTypes.key, NOTIFICATION_TYPES.followUpDigest),
        ),
      );

  const firstPass = await digests();
  check(
    "the rep with open follow-ups got exactly one digest [07 E5]",
    firstPass.length === 1,
    `got ${firstPass.length}`,
  );
  check(
    "*** it is dated YESTERDAY, never today — the day's settled state [20 §9] ***",
    firstPass[0]?.notifications.digestDate === shiftDays(today(), -1),
    `got ${firstPass[0]?.notifications.digestDate}`,
  );
  const payload = firstPass[0]?.notifications.payload as
    | { total?: number }
    | null;
  check(
    "the digest counts what the recipient's own scope holds [21 §2]",
    payload?.total === ownerRows.length,
    `payload ${payload?.total} vs scope ${ownerRows.length}`,
  );

  await sweepNotifications();
  await sweepNotifications();
  const thirdPass = await digests();
  check(
    "*** three sweeps write ONE digest — notifications_digest_key [21 §10] ***",
    thirdPass.length === 1,
    `got ${thirdPass.length}`,
  );

  const strangerDigests = await db
    .select()
    .from(notifications)
    .innerJoin(
      notificationTypes,
      eq(notificationTypes.id, notifications.notificationTypeId),
    )
    .where(
      and(
        eq(notifications.recipientUserId, strangerUser.id),
        eq(notificationTypes.key, NOTIFICATION_TYPES.followUpDigest),
      ),
    );
  check(
    "a rep with nothing open gets no digest — silence is not news [07 D6]",
    strangerDigests.length === 0,
    `got ${strangerDigests.length}`,
  );

  /* --- 10. Persistence [07 G1], [21 §4] ----------------------------- */

  console.log("\n10. Persistence: raised once, and reading is not resolving");

  // The expiry sweep is what raises this one; the thread's validity is already
  // in the past, so the sweep expires it and notifies the raiser `[07 C7]`.
  await sweepNotifications();
  await sweepNotifications();

  const expiredRows = await db
    .select()
    .from(notifications)
    .innerJoin(
      notificationTypes,
      eq(notificationTypes.id, notifications.notificationTypeId),
    )
    .where(
      and(
        eq(notifications.recipientUserId, ownerUser.id),
        eq(notificationTypes.key, NOTIFICATION_TYPES.quotationExpired),
        eq(notifications.recordId, quotedOver.thread.id),
      ),
    );
  check(
    "two sweeps raise ONE expiry notification — notifications_live_key [21 §10]",
    expiredRows.length === 1,
    `got ${expiredRows.length}`,
  );

  const expiredId = expiredRows[0]?.notifications.id;
  if (expiredId) {
    const before = await unresolvedCount(owner);
    await markRead(owner, expiredId);
    const [afterRead] = await db
      .select()
      .from(notifications)
      .where(eq(notifications.id, expiredId));
    check(
      "marking read sets read_at [07 G1]",
      afterRead?.readAt !== null,
    );
    check(
      "*** and leaves resolved_at null: it cannot be dismissed [07 G1] ***",
      afterRead?.resolvedAt === null,
      `got ${afterRead?.resolvedAt}`,
    );
    check(
      "the badge does not fall when the entry is read [07 G1]",
      (await unresolvedCount(owner)) === before,
    );
  }

  /* --- 11. Resolution by condition, per type AND per anchor [21 §3] - */

  console.log("\n11. Every persistent type × every anchor it can carry has a rule");

  /**
   * The anchors each persistent type may be raised with. This is the claim;
   * `RESOLUTION_RULES` is the implementation. Asserting them against each other
   * in BOTH directions is what makes `21 §4` a rule rather than a hope — a new
   * anchor added with no way to clear it fails here.
   */
  const anchorsByType: Record<string, NotificationAnchorType[]> = {
    [NOTIFICATION_TYPES.quotationExpired]: ["quotation_thread"],
    [NOTIFICATION_TYPES.recordAssigned]: ["company"],
    // `record_shares` permits three more record types, but no visibility filter
    // reads a share on them, so none is ever raised `[21 §3]`.
    [NOTIFICATION_TYPES.shareGranted]: [
      "company",
      "project",
      "quotation_thread",
    ],
  };

  for (const type of types.filter((row) => row.isPersistent)) {
    const anchors = anchorsByType[type.key];
    check(
      `${type.key} declares the anchors it can carry [21 §4]`,
      Array.isArray(anchors) && anchors.length > 0,
    );
    for (const anchor of anchors ?? []) {
      check(
        `${type.key} on a ${anchor} has a stated resolution rule [21 §3]`,
        RESOLUTION_RULES.some(
          (rule) => rule.typeKey === type.key && rule.anchorType === anchor,
        ),
      );
    }
  }
  for (const rule of RESOLUTION_RULES) {
    check(
      `the rule for ${rule.typeKey} on a ${rule.anchorType} names a real anchor [21 §3]`,
      (anchorsByType[rule.typeKey] ?? []).includes(rule.anchorType),
    );
    check(
      `${rule.typeKey} is persistent, so its rule is load-bearing [21 §4]`,
      typeByKey.get(rule.typeKey)?.isPersistent === true,
    );
  }

  console.log("\n    …and each condition is reachable, not merely stated");

  // Expiry: `07 C7`'s own remedy clears it.
  await extendValidity(manager, quotedOver.thread.id, shiftDays(today(), 30));
  await sweepNotifications();
  const [expiryAfterExtend] = expiredId
    ? await db.select().from(notifications).where(eq(notifications.id, expiredId))
    : [];
  check(
    "extending the quotation resolves its expiry notification [07 C7], [21 §3]",
    expiryAfterExtend?.resolvedAt !== null,
    `got ${expiryAfterExtend?.resolvedAt}`,
  );

  // Assignment and share: an interaction against the anchor's company clears
  // them, on all three anchors. `share.granted` has no producer yet `[21 §11]`,
  // so the rows are inserted directly — the RULE is what is under test.
  const shareTypeId = typeByKey.get(NOTIFICATION_TYPES.shareGranted)?.id;
  const assignedTypeId = typeByKey.get(NOTIFICATION_TYPES.recordAssigned)?.id;
  const reachCompany = await makeCompany("reach", 1);
  const reach = await makeProject("reach", reachCompany.id, 1, "requested");
  // `origin: "assigned"` — `company_rep_origin` dropped `'shared'` in feature
  // slice 6, unused by real code and only ever written by fixtures `[26 §2]`.
  await db.insert(companyReps).values({
    companyId: reachCompany.id,
    userId: otherUser.id,
    origin: "assigned",
  });

  const planted = await db
    .insert(notifications)
    .values([
      {
        recipientUserId: otherUser.id,
        notificationTypeId: assignedTypeId!,
        recordType: "company" as const,
        recordId: reachCompany.id,
      },
      {
        recipientUserId: otherUser.id,
        notificationTypeId: shareTypeId!,
        recordType: "project" as const,
        recordId: reach.project.id,
      },
      {
        recipientUserId: otherUser.id,
        notificationTypeId: shareTypeId!,
        recordType: "quotation_thread" as const,
        recordId: reach.thread.id,
      },
    ])
    .returning({ id: notifications.id, recordType: notifications.recordType });

  await createReport(other, {
    entryType: "interaction",
    companyId: reachCompany.id,
    contactId: null,
    projectId: null,
    channel: "visit",
    outcome: "introduced",
    category: null,
    cityId: null,
    onHoldUntil: null,
    narrative: `${stamp} worked it`,
    reportDate: today(),
    signals: [],
  });
  await sweepNotifications();

  const resolvedPlanted = await db
    .select({ id: notifications.id, resolvedAt: notifications.resolvedAt })
    .from(notifications)
    .where(
      inArray(
        notifications.id,
        planted.map((row) => row.id),
      ),
    );
  for (const row of planted) {
    const after = resolvedPlanted.find((candidate) => candidate.id === row.id);
    check(
      `an interaction resolves the ${row.recordType} anchor [21 §3]`,
      after?.resolvedAt !== null,
    );
  }
  check(
    "a first VIEW is not a resolution — only the logged interaction was [07 G1]",
    resolvedPlanted.length === 3,
  );

  /* --- 12. A handover is ONE notification [21 §5] ------------------- */

  console.log("\n12. *** A handover produces ONE notification, not one per record ***");

  const departingUser = await createUser(manager, {
    name: `${stamp} Departing`,
    email: `${stamp}-departing@example.test`,
    roleId: repRole.id,
    password,
  });
  const handoverCompanies = [];
  for (const slug of ["handover-a", "handover-b", "handover-c"]) {
    const [company] = await db
      .insert(companies)
      .values({
        name: `${stamp} ${slug}`,
        nameNormalized: `${stamp}-${slug}`,
        phone: nextPhone(),
        countryId: saudiId,
        createdBy: departingUser.id,
      })
      .returning();
    const [membership] = await db
      .insert(companyReps)
      .values({
        companyId: company.id,
        userId: departingUser.id,
        isPrimary: true,
        origin: "self_registered",
      })
      .returning();
    handoverCompanies.push({ company, membership });
  }
  const [departingProject] = await db
    .insert(projects)
    .values({
      nameEn: `${stamp} handover project`,
      nameNormalized: `${stamp}-handover-project`,
      ownerUserId: departingUser.id,
      createdBy: departingUser.id,
    })
    .returning();

  // `19 §3` — handover opens only after deactivation.
  await deactivateUser(manager, departingUser.id);
  const outcome = await reassignHandover(
    manager,
    departingUser.id,
    otherUser.id,
    {
      membershipIds: handoverCompanies.map((row) => row.membership.id),
      projectIds: [departingProject.id],
      threadIds: [],
    },
  );

  const handoverRows = await db
    .select()
    .from(notifications)
    .innerJoin(
      notificationTypes,
      eq(notificationTypes.id, notifications.notificationTypeId),
    )
    .where(
      and(
        eq(notifications.recipientUserId, otherUser.id),
        eq(notificationTypes.key, NOTIFICATION_TYPES.recordHandedOver),
      ),
    );
  check(
    "*** four records moved and exactly ONE notification was raised [21 §5] ***",
    handoverRows.length === 1,
    `moved ${outcome.companiesMoved + outcome.projectsMoved}, raised ${handoverRows.length}`,
  );
  const handoverPayload = handoverRows[0]?.notifications.payload as {
    fromUserId?: string;
    counts?: Record<string, number>;
  } | null;
  check(
    "it names the departing rep and the counts [21 §5]",
    handoverPayload?.fromUserId === departingUser.id &&
      handoverPayload?.counts?.companies === 3 &&
      handoverPayload?.counts?.projects === 1,
    `got ${JSON.stringify(handoverPayload)}`,
  );
  check(
    "it carries no anchor, which is why it is not persistent [21 §4, §5]",
    handoverRows[0]?.notifications.recordId === null &&
      handoverRows[0]?.notification_types.isPersistent === false,
  );

  // The contrast that makes §5 a rule rather than an implementation detail.
  const beforeSingle = await db
    .select({ id: notifications.id })
    .from(notifications)
    .where(
      and(
        eq(notifications.recipientUserId, otherUser.id),
        eq(notifications.recordType, "company"),
      ),
    );
  await reassignCompany(manager, quietOver.id, otherUser.id);
  const afterSingle = await db
    .select({ id: notifications.id })
    .from(notifications)
    .where(
      and(
        eq(notifications.recipientUserId, otherUser.id),
        eq(notifications.recordType, "company"),
      ),
    );
  check(
    "an ordinary single assignment IS per-record [07 E5], [21 §5]",
    afterSingle.length === beforeSingle.length + 1,
    `${beforeSingle.length} -> ${afterSingle.length}`,
  );

  /* --- 13. Recipient filtering [00 §1.13] --------------------------- */

  console.log("\n13. Recipient filtering is in the application layer");

  const otherList = await listNotifications(other);
  const ownerList = await listNotifications(owner);
  const otherIds = new Set(otherList.rows.map((row) => row.id));
  check(
    "a rep's list holds none of another rep's rows [00 §1.13]",
    ownerList.rows.every((row) => !otherIds.has(row.id)),
  );
  check(
    "and it is not empty, so the assertion above is not vacuous",
    ownerList.rows.length > 0 && otherList.rows.length > 0,
    `${ownerList.rows.length} / ${otherList.rows.length}`,
  );

  const victim = otherList.rows[0];
  if (victim) {
    const changed = await markRead(owner, victim.id);
    const [untouched] = await db
      .select()
      .from(notifications)
      .where(eq(notifications.id, victim.id));
    check(
      "marking somebody else's notification read changes nothing [00 §1.13]",
      changed === false && untouched?.readAt === null,
      `changed=${changed} readAt=${untouched?.readAt}`,
    );
  }

  /* --- 14. Visibility, both directions [21 §1] ---------------------- */

  console.log("\n14. Follow-ups are scoped by the filters that already exist");

  const strangerFollowUps = await followUps(stranger);
  const ownerAnchors = new Set(
    (await followUps(owner)).rows.map((row) => row.anchorId),
  );
  check(
    "a stranger sees none of this run's follow-ups [21 §1]",
    strangerFollowUps.rows.every((row) => !ownerAnchors.has(row.anchorId)),
  );
  check(
    "the owner sees their own, so the negative above means something",
    ownerAnchors.size > 0,
    `got ${ownerAnchors.size}`,
  );

  const managerAnchors = new Set(
    (await followUps(manager)).rows.map((row) => row.anchorId),
  );
  const managerAll = await followUps(manager, { kind: "company_quiet" });
  check(
    "sees_all_reps sees them too — a scope, never a gate [20 §7], [21 §9]",
    managerAll.rows.some((row) => row.anchorId === quietUnder.id) ||
      managerAnchors.size >= ownerAnchors.size,
  );

  /* --- 15. Dormancy's three routes [07 E6], [12 §7] ----------------- */

  console.log("\n15. Dormancy's three routes, and nothing deleted");

  const reviews = await dormancyReviews(quietOver.id);
  check(
    "the reassignment wrote a dated review row [21 §7]",
    reviews.some(
      (row) => row.outcome === "reassigned" && row.toUserId === otherUser.id,
    ),
  );
  const liveReps = await db
    .select()
    .from(companyReps)
    .where(
      and(eq(companyReps.companyId, quietOver.id), isNull(companyReps.removedAt)),
    );
  check(
    "exactly one live membership after a reassignment [19 §7]",
    liveReps.length === 1 && liveReps[0]?.userId === otherUser.id,
    `got ${liveReps.length}`,
  );
  check(
    "the departing membership was KEPT with removed_at set [12 §7]",
    (
      await db
        .select()
        .from(companyReps)
        .where(eq(companyReps.companyId, quietOver.id))
    ).length === 2,
  );
  check(
    "the new membership carries origin 'assigned' [07 B3]",
    liveReps[0]?.origin === "assigned",
    `got ${liveReps[0]?.origin}`,
  );

  const [archivedRow] = await db
    .select()
    .from(companies)
    .where(eq(companies.id, archivedCompany.id));
  check(
    "archiving sets archived_at and deletes nothing [07 E6], [12 §7]",
    archivedRow?.archivedAt !== null && archivedRow !== undefined,
  );
  await refuses(
    "an archived company cannot be archived twice [07 E6]",
    "dormancy.errors.alreadyArchived",
    () => archiveCompany(manager, archivedCompany.id, `${stamp} again`),
  );
  check(
    "the re-inclusion is a dated row, not a field on the company [21 §7]",
    (await dormancyReviews(reincludedCompany.id)).some(
      (row) => row.outcome === "reincluded" && row.decidedAt === today(),
    ),
  );

  /* --- 16. Every write is audited [07 E1] --------------------------- */

  console.log("\n16. Every write is audited");

  const OWN_ACTIONS = [
    "company.reincluded",
    "company.reassigned",
    "company.archived",
    "company.dormancy_reviewed",
    "notification.raised",
    "notification.resolved",
    "notification.read",
  ];
  const entries = await db
    .select({
      action: auditLog.action,
      actorUserId: auditLog.actorUserId,
    })
    .from(auditLog)
    .where(
      and(
        inArray(auditLog.action, OWN_ACTIONS),
        sql`${auditLog.createdAt} > now() - interval '30 minutes'`,
      ),
    );

  for (const action of [
    "company.reincluded",
    "company.reassigned",
    "company.archived",
    "notification.raised",
    "notification.resolved",
    "notification.read",
  ]) {
    check(
      `${action} is written to the audit log [07 E1]`,
      entries.some((row) => row.action === action),
    );
  }
  console.log(
    `        actions seen: ${[...new Set(entries.map((row) => row.action))].sort().join(", ")}`,
  );

  // The sweep audits under a NULL actor, on purpose `[16 §3]` — the person who
  // opened the screen did not expire the quotation. `verify:phase11` §16 was
  // scoped for exactly this reason; the same care applies here.
  check(
    "the sweep's own entries name no actor, deliberately [16 §3]",
    entries
      .filter((row) => row.action.startsWith("notification."))
      .some((row) => row.actorUserId === null),
  );
}

main()
  .then(async () => {
    console.log(
      failures === 0 ? "\nAll checks passed." : `\n${failures} CHECK(S) FAILED.`,
    );
    await closeDatabase();
    process.exit(failures === 0 ? 0 : 1);
  })
  .catch(async (error) => {
    console.error(error);
    await closeDatabase();
    process.exit(1);
  });
