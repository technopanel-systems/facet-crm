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
 *   1. The seed: `S92`'s six notification types and **no seventh**, with
 *      `followup.digest` asserted ABSENT, and all five thresholds `[21 §2]`,
 *      `[07 D5]`, `S91`.
 *   2. Every gate refuses with its own key — and the negative claim that
 *      follow-ups and notifications refuse NOBODY `[21 §9]`.
 *   3. The dormancy CHECK holds **at the database** `[13 §1]`, `[21 §7]`.
 *   4. Working-day arithmetic, as a pure function with no database `[21 §8]`.
 *   5. *** A follow-up writes NO task row and NO notification row *** `[21 §1]`.
 *   6. Each kind fires at its threshold and not a day early, from `settings`.
 *   7. `on hold until` suppresses every kind, and a past date does not `[20 §5]`.
 *   8. Archived and re-included companies raise nothing, and a stale
 *      re-inclusion stops shielding `[07 E6]`, `[21 §7]`.
 *   9. *** `S91`'s machinery is GONE and cannot come back unseen *** — no
 *      digest type, no digest row, and no notification written by a read.
 *  10. The bell: every raise lands, and READING is what clears the badge
 *      `S91`, `S92`. This section used to assert the opposite of both.
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

import { and, eq, inArray, isNull, like, sql } from "drizzle-orm";

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
import { companyTurn } from "@/lib/coverage";
import { normalizeName } from "@/lib/normalize";
import {
  archiveCompany,
  dormancyReviews,
  requestRemoval,
  reassignCompany,
  reincludeCompany,
} from "@/lib/dormancy";
import {
  NOTIFICATION_TYPES,
  SAUDI_CODE,
  type FollowUpKind,
  type NotificationTypeKey,
} from "@/lib/enums";
import { followUps, followUpScope } from "@/lib/follow-ups";
import { listCountries } from "@/lib/lookups";
import {
  listNotifications,
  markRead,
  unreadCount,
} from "@/lib/notifications";
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

import { addQuotationLineRow } from "./quotation-fixture";

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

/**
 * The run's stamp. **Module scope, so the `finally` at the foot of the file can
 * reach it** — every account this script writes is `${stamp}-…@example.test`,
 * which is what `endRunAccounts` below matches on.
 */
const stamp = `verify10a-${Date.now()}`;

/**
 * Every account this run created, ended the way `S111` sanctions.
 *
 * `S111` forbids deleting a person — history must keep pointing at a real one —
 * and names deactivation as the end state instead. That is the whole of the
 * fix: `listActiveUsers` drops a deactivated account immediately, so the
 * mention picker on every comment box, the share recipient picker, the dispatch
 * rep picker and every achievement roster stop offering the accounts this run
 * invented. The rows stay; the people stop being offerable.
 *
 * **A direct `update`, not `deactivateUser`.** The data-layer writer would add
 * an audit row per account `S112` — thirty a pass, to fix a residue problem —
 * and this script already writes its users outside that path.
 */
async function endRunAccounts(): Promise<void> {
  const ended = await db
    .update(users)
    .set({ isActive: false, deactivatedAt: new Date() })
    .where(like(users.email, `${stamp}-%`))
    .returning({ id: users.id });
  console.log(
    `  --    ${ended.length} account(s) of this run deactivated [S111]`,
  );
}

async function main(): Promise<void> {
  if (process.env.NODE_ENV !== "development") {
    console.error(
      "verify-phase10a refuses to run outside development.\n" +
        `  NODE_ENV is ${process.env.NODE_ENV ?? "unset"}, and must be "development".`,
    );
    process.exit(1);
  }

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

  console.log("\n1. The seed: six notification types, and all five thresholds");

  const types = await db.select().from(notificationTypes);
  if (types.length === 0) {
    console.error(
      "The notification types are not seeded. Run: npm run db:seed",
    );
    process.exit(1);
  }
  const typeByKey = new Map(types.map((type) => [type.key, type]));

  /**
   * **The tier and persistence columns are gone** `S91`, `0033`, so what each
   * row is asserted to BE is now just that it exists. The claim those two
   * columns carried — *this one interrupts, that one can be dismissed by
   * reading* — is asserted where it can actually be observed: §10 below drives
   * `markRead` against `unreadCount` and watches the badge fall.
   *
   * `S92` names the six exactly: *a rep was handed to you*, *you have been
   * shared a record*, plus `record.assigned`, `mention.received`,
   * `decision.ended_work` `S128` and `credit.granted` `S129`.
   */
  const expected: NotificationTypeKey[] = [
    NOTIFICATION_TYPES.recordAssigned,
    NOTIFICATION_TYPES.recordHandedOver,
    NOTIFICATION_TYPES.shareGranted,
    NOTIFICATION_TYPES.mentionReceived,
    NOTIFICATION_TYPES.decisionEndedWork,
    NOTIFICATION_TYPES.creditGranted,
  ];

  for (const want of expected) {
    check(
      `${want} is seeded [21 §2], [S92]`,
      typeByKey.has(want),
      `got ${[...typeByKey.keys()].join(", ")}`,
    );
    // No channel check: `0027` dropped `default_channel` and
    // `notifications.channel` together. See `schema.ts` above
    // `notificationTypes` for why a column asserting the only possible value
    // was worth less than not having one.
  }

  /**
   * **The one that must NOT be there** `S91`. A count of six would go green on
   * six wrong rows, and a deletion nothing asserts is a deletion that comes
   * back the next time somebody re-seeds from an old branch. `followup.digest`
   * was the only type that ever carried WORK rather than news, and *the list is
   * the notification* is the sentence that removes it.
   */
  check(
    `followup.digest is GONE — saw ${types.length} types [S91]`,
    types.length > 0 && !typeByKey.has("followup.digest"),
    `got ${[...typeByKey.keys()].join(", ")}`,
  );
  /**
   * A type nothing produces is the shape of v1's dead approval gate `[20 §11]`.
   *
   * **This said five, then six, and is five again.** `21 §2` is headed *"Five
   * notification types are seeded, and no sixth"*, but the rule underneath that
   * heading is a **test**, not a cap: *"Each type below is named in a
   * user-truth document AND has a real event in the code that can raise it."*
   * `mention.received` passes both limbs — `25 §11` names it (*"Tagging a
   * person raises a notification"*) and `src/lib/comments.ts` raises it — so
   * feature slice 2 added it and moved this number to six.
   *
   * It is five again because the same test took one away. `S67` deleted the
   * expiry sweep and `quotation.expired` with it — the seed row went at
   * `cd02a78`, since nothing can raise a type whose producer no longer exists.
   * **This number was missed in that pass**, and went on passing only because
   * `0014` marked the existing row non-persistent rather than deleting it
   * (`12 §7` — FACET deletes nothing, and notifications already raised point at
   * it). A database seeded before `S67` therefore still held six rows; one
   * seeded after holds five, and `npm run db:reset` is what finally showed the
   * difference.
   *
   * What the number guards is unchanged, and it is why it must track the seed
   * exactly rather than be relaxed: a seeded type with no producer. Move it
   * only alongside one, in either direction.
   *
   * **It went to seven, and `S91` took it back to six.** The two additions
   * moved it alongside their producers in the same slice, which is the rule
   * above rather than an exception to it — `S92` names them: *the news also
   * carries credit granted to you (`S129`), and a decision that ended your work
   * (`S128`)*. `decision.ended_work` is raised by `cancelDispatch`,
   * `refuseDispatchRequest`, `rejectThread` and `cancelThread`;
   * `credit.granted` by `setCreditSplit`.
   *
   * **The subtraction is the same test read the other way**, and it is the
   * only one so far taken by a rule rather than by a missing producer: nothing
   * is wrong with `generateDigests`, and `S91` says the delivery should not
   * exist. Six is what `S92` enumerates.
   */
  check(
    "exactly six notification types — S92's own list, no seventh [21 §2], [S92]",
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
        nameNormalized: normalizeName(`${stamp} ${slug}`),
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
        name: `${stamp} ${slug}`,
        nameNormalized: normalizeName(`${stamp} ${slug}`),
        ownerUserId: ownerUser.id,
        createdBy: ownerUser.id,
        createdAt: instantDaysAgo(ageDays + 5),
      })
      .returning();
    await db
      .insert(projectCompanies)
      .values({ projectId: project.id, companyId });
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
        // `S118` — NOT NULL, so a direct insert has to name one too. This
        // script is about dormancy and follow-ups; the stock is scenery.
        stock: "riyadh",
        createdBy: ownerUser.id,
        createdAt: instantDaysAgo(ageDays),
      })
      .returning();
    // `S60` — see the same note in `verify-phase9`. Every version this helper
    // makes gets its one line, which is what stops the rule's only violating
    // rows being written by the scripts that verify everything else.
    await addQuotationLineRow(version.id);
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
  // `S107` since session 54 — the gate is `can_approve_delete`, with its own key.
  await refuses(
    "a rep may not archive a company [21 §6] [S107]",
    "dormancy.errors.cannotArchive",
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
  // `S105` — the second way in, asked of the DATA LAYER. `verify:routes` §45
  // drives the same refusal over HTTP, but the action refuses a blank reason
  // before this guard is reached, so an injection that removed the guard
  // here stayed green there (session 54): this is the check that reads it.
  await refuses(
    "a removal request needs a reason — the data layer's own guard [S105]",
    "dormancy.errors.reasonRequired",
    () => requestRemoval(owner, quietOver.id, "   "),
  );
  await refuses(
    "only somebody holding the company may ask to remove it — the manager sees it and does not hold it [S105]",
    "dormancy.errors.notYourCompany",
    () => requestRemoval(manager, quietOver.id, "no potential"),
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
  // `S9` — and active is not the whole of it. The manager fixture is a Sales
  // Manager, so `sees_all_reps` is true and they are above the book rather
  // than a place to put one. AUDIT 1 F8: the code used to accept anybody
  // active, so a company book could land on an executive.
  await refuses(
    "*** a company cannot be handed to a role that may not hold one *** [S9]",
    "dormancy.errors.recipientNotAHolder",
    () => reassignCompany(manager, quietOver.id, manager.user.id),
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
   * `companyTurn` is the SAME condition, asked about one company — it is what
   * the company page's turn panel says and what decides whether the dormancy
   * block renders at all.
   *
   * It gets its own assertions because it was not covered by the four above and
   * `isCompanyQuiet`, which it replaced, shipped broken: that wrote
   * `current_date - $2` with the threshold as a bound parameter, Postgres
   * cannot infer a type for `date - unknown`, and the company page answered
   * 500. A driven HTTP pass found it. This is what keeps it found.
   *
   * **It asserts the elapsed figure too**, which `isCompanyQuiet` had no
   * opinion about. The panel used to take that from the newest timeline event —
   * a comment or a dispatch would reset it — and printed "Nothing recorded for
   * 0 days" beside a Gone quiet badge. The figure is the interaction clock's
   * `[20 §2]`, and `silentDays` past `thresholdDays` is the whole of `isQuiet`.
   */
  const overTurn = await companyTurn(owner, quietOver.id);
  check(
    "companyTurn agrees with the queue on a quiet company [21 §7]",
    overTurn?.state === "quiet" && overTurn.isQuiet === true,
    `state ${overTurn?.state}`,
  );
  check(
    "…and its figure is the silence, not the newest event [20 §2]",
    overTurn !== null && overTurn.silentDays > overTurn.thresholdDays,
    `${overTurn?.silentDays} days against ${overTurn?.thresholdDays}`,
  );
  const underTurn = await companyTurn(owner, quietUnder.id);
  check(
    "…and on one inside its threshold [21 §7]",
    underTurn?.isQuiet === false && underTurn.state !== "quiet",
    `state ${underTurn?.state}`,
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

  /* --- 9. S91's machinery is gone [S91] ----------------------------- */

  console.log("\n9. *** The digest machinery is GONE, and stays gone ***");

  /**
   * **What this section asserted before session 24, and why none of it moved.**
   *
   * It was headed *the digest reads the day's settled state at end of day*
   * `[20 §9]` and made five claims, every one about `generateDigests` and the
   * `followup.digest` row it wrote:
   *
   *  - *the rep with open follow-ups got exactly one digest* `[07 E5]`
   *  - *it is dated YESTERDAY, never today* `[20 §9]` — a correction made
   *    minutes after a report could not produce a notification that should not
   *    have been sent
   *  - *the digest counts what the recipient's own scope holds* `[21 §2]`
   *  - *three sweeps write ONE digest* — `notifications_digest_key` `[21 §10]`
   *  - *a rep with nothing open gets no digest — silence is not news* `[07 D6]`
   *
   * `S91` deletes the delivery all five describe, so there is nothing left for
   * them to be true about. **None of them moved to another script**, and one of
   * them deserves a note: `20 §9`'s end-of-day rule was the reason the digest
   * was generated for yesterday, and it has not been overturned — it simply has
   * no outward-firing delivery left to govern. The list is read live, in the
   * present tense, and a correction changes what it says immediately.
   *
   * **What stands here instead is the negative**, because a removal nothing
   * asserts is a removal that comes back. §1 above already refuses the type;
   * this refuses the ROWS and the write. Both guard on a non-empty read.
   */
  const ownerScope = await scopeForUser(ownerUser.id);
  if (!ownerScope) throw new Error("scopeForUser returned null for the owner");
  const ownerRows = (await followUpScope(ownerScope)).rows;
  check(
    `the owner has open follow-ups to digest, if there were a digest — saw ${ownerRows.length}`,
    ownerRows.length > 0,
    `got ${ownerRows.length}`,
  );

  const [notificationTotal] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(notifications);
  check(
    `there are notifications to look through — saw ${notificationTotal?.n}`,
    (notificationTotal?.n ?? 0) > 0,
  );

  /**
   * **Every row's type still resolves, so no digest row can be hiding.** `0033`
   * deleted the nine `followup.digest` rows before deleting their type, and the
   * foreign key means a tenth cannot appear without one. This is the assertion
   * that fires if a later migration ever re-seeds the type.
   *
   * **The first version of this check was wrong and passed for the wrong
   * reason**, which is worth leaving written down. It read
   * `payload ? 'counts'` — but `record.handed_over` carries `counts` too
   * `[21 §5]`, so the claim was *no handover exists*, not *no digest exists*.
   * It went green on the first run only because §12 raises the handover AFTER
   * §9 reads, and red on the second when the previous run's rows were still
   * there. The digest's own signature is `total` beside `counts`; no other
   * payload has it.
   */
  const [orphanTypes] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(notifications)
    .where(
      sql`not exists (select 1 from notification_types nt
                       where nt.id = ${notifications.notificationTypeId})`,
    );
  check(
    `*** every notification's type still exists — saw 0 orphans of ${notificationTotal?.n} [S91] ***`,
    orphanTypes?.n === 0,
    `got ${orphanTypes?.n}`,
  );
  const [digestPayloads] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(notifications)
    .where(sql`${notifications.payload} ? 'total'`);
  check(
    `*** no notification carries a digest payload — saw 0 of ${notificationTotal?.n} [S91] ***`,
    digestPayloads?.n === 0,
    `got ${digestPayloads?.n}`,
  );

  const strangerScope = await scopeForUser(strangerUser.id);
  if (!strangerScope) throw new Error("scopeForUser returned null for the stranger");
  const beforeRead = notificationTotal?.n ?? 0;
  await followUpScope(ownerScope);
  await followUpScope(strangerScope);
  const [afterRead] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(notifications);
  check(
    `*** computing follow-ups for two people wrote nothing — ${beforeRead} then ${afterRead?.n} [21 §1], [S91] ***`,
    beforeRead > 0 && afterRead?.n === beforeRead,
    `${beforeRead} then ${afterRead?.n}`,
  );

  /* --- 10. The bell: every raise lands, reading clears it [S91] ---- */

  console.log("\n10. Every raise lands, and READING is what clears the badge");

  /**
   * **This section asserted the opposite of both of its claims, and the rule
   * changed under it.** It was headed *Persistence: raised once, and reading is
   * not resolving*, and it proved:
   *
   *  - *two assignments raise ONE notification* — `notifications_live_key`, the
   *    partial unique index over unresolved rows carrying a `record_id`
   *  - *marking read sets `read_at`* — still true and still asserted below
   *  - *and leaves `resolved_at` null: it cannot be dismissed* `[07 G1]`
   *  - *the badge does not fall when the entry is read* `[07 G1]`
   *
   * `S91` deletes the persistence flag, the resolution conditions and the sweep
   * that wrote `resolved_at`; `0033` drops the column and both partial unique
   * indexes. So the third claim has no column, and the first and fourth are now
   * FALSE — deliberately, and this is where that is proved rather than assumed.
   *
   * **The badge had to change or become undismissable.** With nothing writing
   * `resolved_at`, the old query's `resolved_at is null` term was true of every
   * row for ever: a count that could only rise. `07 G1` invented persistence to
   * stop reps ignoring the bell, and keeping half of it would have produced
   * exactly the badge it feared. `unreadCount` is the whole of it now, which is
   * `21 §4`'s own exception — *a type with no resolution condition can be
   * dismissed* — read as the rule, because since `S92` every type is news.
   *
   * `reassignCompany` raises unconditionally, so calling it twice makes two
   * raises for the same recipient and record. With `notifications_live_key`
   * gone, two is the right answer: two things happened.
   */
  const persistCompany = await makeCompany("persist", 1);
  await reassignCompany(manager, persistCompany.id, ownerUser.id);
  await reassignCompany(manager, persistCompany.id, ownerUser.id);

  const assignedRows = await db
    .select()
    .from(notifications)
    .innerJoin(
      notificationTypes,
      eq(notificationTypes.id, notifications.notificationTypeId),
    )
    .where(
      and(
        eq(notifications.recipientUserId, ownerUser.id),
        eq(notificationTypes.key, NOTIFICATION_TYPES.recordAssigned),
        eq(notifications.recordId, persistCompany.id),
      ),
    );
  check(
    "*** two assignments raise TWO — notifications_live_key is gone [S91] ***",
    assignedRows.length === 2,
    `got ${assignedRows.length}`,
  );

  const raisedId = assignedRows[0]?.notifications.id;
  if (raisedId) {
    const badgeBefore = await unreadCount(owner);
    check(
      `the badge has something to lose — saw ${badgeBefore} unread`,
      badgeBefore > 0,
      `got ${badgeBefore}`,
    );
    await markRead(owner, raisedId);
    const [wasRead] = await db
      .select()
      .from(notifications)
      .where(eq(notifications.id, raisedId));
    check("marking read sets read_at [07 G1]", wasRead?.readAt !== null);
    const badgeAfter = await unreadCount(owner);
    check(
      `*** and the badge FALLS by exactly one — ${badgeBefore} then ${badgeAfter} [S91] ***`,
      badgeBefore > 0 && badgeAfter === badgeBefore - 1,
      `${badgeBefore} then ${badgeAfter}`,
    );
  }

  /* --- 11. Resolution by condition — DELETED with S91 --------------- */

  /**
   * **This section is gone, and it is named here rather than left as a gap in
   * the numbering.** It was headed *every persistent type × every anchor it can
   * carry has a rule* `[21 §3]`, `[21 §4]`, and it asserted `RESOLUTION_RULES`
   * against a hand-written `anchorsByType` in BOTH directions — every persistent
   * type declared its anchors, every declared anchor had a stated rule, and
   * every rule named a real anchor on a genuinely persistent type. It then
   * proved each condition was REACHABLE: it planted a `record.assigned` and two
   * `share.granted` rows, logged one interaction against the company, swept,
   * and checked all three had resolved — with *a first VIEW is not a
   * resolution* beside it `[07 G1]`.
   *
   * `S91` deletes the per-anchor resolution conditions outright, and `0033`
   * drops `is_persistent` and `resolved_at`. **Nothing here moved**: there is no
   * table to iterate, no flag to filter on, and no column for a sweep to write.
   * The claim `21 §4` was protecting — that no rep is ever left holding a badge
   * with no way to clear it — is now structural rather than checked: reading
   * clears everything, and §10 above drives that.
   *
   * `verify-sharing` §9 lost the mirror of this against real shares, and says
   * the same there.
   */

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
        nameNormalized: normalizeName(`${stamp} ${slug}`),
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
      name: `${stamp} handover project`,
      nameNormalized: normalizeName(`${stamp} handover project`),
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
    "it carries no anchor — one summary, not one per record [21 §5]",
    handoverRows[0]?.notifications.recordId === null,
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

  // `notification.resolved` was here and is gone with its writer `S91`: the
  // sweep was the only thing that ever wrote one, and there is no sweep.
  const OWN_ACTIONS = [
    "company.reincluded",
    "company.reassigned",
    "company.archived",
    "company.dormancy_reviewed",
    "notification.raised",
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

  /**
   * **Two claims went with `S91`, and the second is the interesting one.**
   *
   *  - *`notification.resolved` is written to the audit log* `[07 E1]` — the
   *    sweep wrote it, and there is no sweep. Dropped, nowhere to move it.
   *  - *the sweep's own entries name no actor, deliberately* `[16 §3]` — the
   *    person who opened the screen did not resolve anything, so the sweep
   *    audited under a null actor. **That rule is not overturned; it has no
   *    remaining subject in this module.** Nothing in FACET now writes because
   *    somebody looked at a screen, which is a stronger version of the same
   *    idea, and `§9` above asserts it directly: two follow-up derivations
   *    wrote nothing at all.
   *
   * What replaces them here is the positive: every notification row this run
   * raised names the actor who caused it, because a raise happens inside the
   * caller's transaction and never out of band.
   */
  const raised = entries.filter((row) => row.action === "notification.raised");
  check(
    `every notification.raised names its actor — saw ${raised.length} [07 E1], [S91]`,
    raised.length > 0 && raised.every((row) => row.actorUserId !== null),
    `${raised.filter((row) => row.actorUserId === null).length} of ${raised.length} have no actor`,
  );
}

main()
  .then(() => {
    console.log(
      failures === 0 ? "\nAll checks passed." : `\n${failures} CHECK(S) FAILED.`,
    );
  })
  .catch((error) => {
    console.error(error);
    failures += 1;
  })
  .finally(async () => {
    // **In a `finally`, so a failing assertion still cleans up after
    // itself.** A script that died halfway is exactly how 196 live
    // accounts accumulated `[S111]`.
    await endRunAccounts();
    await closeDatabase();
    process.exit(failures === 0 ? 0 : 1);
  });
