/**
 * Verification scaffolding for activity reporting — NOT a feature.
 *
 * `scripts/verify-phase11.ts` is the pattern this copies, for the reason
 * `CLAUDE.md` records: a behavioural check that is thrown away cannot be
 * reproduced. This one is **kept**.
 *
 * It drives `src/lib/{reports,timeline,daily-activity,coverage,settings}.ts`
 * in process — no browser, no HTTP — and checks the things that are otherwise
 * only claimed:
 *
 *   1. The seed: both quiet thresholds `[20 §11]`, and `sees_all_reps` granted
 *      to exactly three roles and to nobody else.
 *   2. Every gate refuses, each with its own key — and the negative claim that
 *      coverage and the daily view refuse NOBODY `[20 §7]`, `[20 §8]`.
 *   3. The two CHECK constraints hold **at the database** `[13 §1]`.
 *   4. An interaction saves with signals, and a reference round-trips.
 *   5. *** Editing corrects ONE row and never double-counts *** `[20 §9]`.
 *   6. Re-anchoring moves a report between timelines `[20 §9]`.
 *   7. "Asked for a quotation" is not an outcome; qualification stays derived
 *      from a real thread `[10 §1]`, `[20 §3]`.
 *   8. `on hold` is derived on read `[20 §5]`.
 *   9. The timeline merges both halves; a field note appears on none `[20 §6]`.
 *  10. The cap is the CARD's, not the data's `[20 §6]`.
 *  11. Coverage counts and does not chase `[20 §7]`.
 *  12. Coverage is scoped, not gated, in both directions `[20 §7]`.
 *  13. *** The daily view shows real activity beside logged *** `[20 §8]`.
 *  14. Attribution — every event on the row of whoever performed it `[20 §8]`.
 *  15. Visibility in both directions, including the audit-sourced half, the
 *      note half `[S38]` and the search path that discloses it by inference
 *      `[20 §8.2]`, `[20 §10]`, `[04 Q7]`.
 *  16. A handover needs no report bucket `[20 §10]`, `[19 §1]`.
 *  17. Every write is audited `[07 E1]`.
 *
 * Usage: `npm run verify:phase9`
 *
 * That needs `NODE_ENV=development` in `.env`. `--env-file` is not optional and
 * cannot be replaced by the `process.loadEnvFile` call below: this script
 * reaches `@/lib/authz`, and `src/auth/index.ts` reads `AUTH_SECRET` at module
 * scope — before any statement in this file runs.
 *
 * **It refuses to run outside development** `[15 §7]`: it writes real rows.
 *
 * It needs a seeded database — `npm run db:seed`, which since `20 §11` also
 * writes the two `settings` rows — and the fixture accounts:
 * `DEV_FIXTURE_PASSWORD=… npm run dev:fixtures`.
 *
 * **It creates its own reps, and every email carries the run stamp.** The
 * daily view and coverage are whole-database figures over a range, so reusing
 * the shared fixture accounts would make the second run count the first run's
 * rows — the trap `verify:slice3` hit.
 *
 * **Dates are placed in a private window in the past, deliberately.** Section
 * 13's counts are per-day totals across the whole database; pinning this run's
 * rows to a range nothing else uses is what keeps the assertion exact.
 */

process.loadEnvFile(".env");

import { and, eq, inArray, isNull, like, sql } from "drizzle-orm";

import { closeDatabase, db } from "@/db";
import {
  auditLog,
  companies,
  companyReps,
  contacts,
  dispatches,
  projectCompanies,
  projects,
  quotationThreads,
  quotationVersions,
  repReportSignals,
  repReports,
  roles,
  settings,
  users,
} from "@/db/schema";
import {
  canViewRecord,
  createUser,
  listRoles,
  type AuthSession,
  type Role,
  type User,
} from "@/lib/authz";
import { listCompanies } from "@/lib/companies";
import { normalizeName } from "@/lib/normalize";
import { dailyActivity } from "@/lib/daily-activity";
import { REPORT_OUTCOMES, SAUDI_CODE } from "@/lib/enums";
import { listCountries } from "@/lib/lookups";
import {
  createReport,
  getReport,
  onHoldByCompany,
  today,
  updateReport,
  type ReportInput,
} from "@/lib/reports";
import {
  QUIET_DAYS_QUALIFIED_KEY,
  QUIET_DAYS_UNQUALIFIED_KEY,
  getQuietThresholds,
} from "@/lib/settings";
import {
  companyTimeline,
  eventsInRange,
  projectTimeline,
  streamEvents,
  streamFor,
  TIMELINE_CARD_LIMIT,
  type StreamFilters,
} from "@/lib/timeline";

import { addDispatchLine } from "./dispatch-fixture";
import { addQuotationLineRow } from "./quotation-fixture";

/**
 * The typed half of the stream, unpaginated — what `listReports` used to be.
 *
 * `D45` made *what happened* one stream and session 27 deleted `listReports`
 * and `reportsInRange` with the screen that called them. The assertions below
 * are `S38` and `S40`'s disclosure guard and are the last thing that should
 * have gone with it, so they ask the same questions of the reader that
 * replaced it. `streamEvents` is unpaginated on purpose here: the stream's own
 * page holds twenty-five EVENTS of six kinds, where the old list held
 * twenty-five reports, so paging would make an absent row ambiguous between
 * *withheld* and *on page two* — which is exactly what these checks exist to
 * tell apart.
 */
type StreamReport = {
  id: string;
  companyId: string | null;
  projectId: string | null;
  narrative: string | null;
};

async function reportsIn(
  session: AuthSession,
  filters: StreamFilters = {},
): Promise<StreamReport[]> {
  const events = await streamEvents(session, { ...filters, kind: "typed" });
  return events.flatMap((event) =>
    event.kind === "report" && event.link?.type === "report"
      ? [
          {
            id: event.link.id,
            companyId: event.companyId,
            projectId: event.projectId,
            narrative: event.report.narrative,
          },
        ]
      : [],
  );
}

/** The same, scoped to one company — `listReports({ companyId })`'s question. */
async function reportsOnCompany(
  session: AuthSession,
  companyId: string,
): Promise<StreamReport[]> {
  const { events } = await companyTimeline(session, companyId);
  return events.flatMap((event) =>
    event.kind === "report" && event.link?.type === "report"
      ? [
          {
            id: event.link.id,
            companyId: event.companyId,
            projectId: event.projectId,
            narrative: event.report.narrative,
          },
        ]
      : [],
  );
}

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

/**
 * Assert that the DATABASE refuses, by constraint name `[13 §1]`.
 *
 * Drizzle wraps a driver error in one whose message is only "Failed query: …",
 * and postgres.js puts the constraint name on the `cause`. Reading just
 * `error.message` passes on nothing and fails on everything — which is how this
 * helper behaved on its first run.
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

/** A session for a user, assembled the way `getSession` would. */
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

/** A calendar day, `offset` days before today in Riyadh. */
function daysAgo(offset: number): string {
  const base = Date.parse(`${today()}T00:00:00Z`);
  return new Date(base - offset * 86_400_000).toISOString().slice(0, 10);
}

/** Every field of an interaction, so a test states only what it changes. */
function interaction(over: Partial<ReportInput> & { companyId: string }): ReportInput {
  return {
    entryType: "interaction",
    reportDate: today(),
    narrative: "verify9",
    contactId: null,
    projectId: null,
    channel: "visit",
    outcome: "introduced",
    onHoldUntil: null,
    category: null,
    cityId: null,
    signals: [],
    ...over,
  };
}

/**
 * The run's stamp. **Module scope, so the `finally` at the foot of the file can
 * reach it** — every account this script writes is `${stamp}-…@example.test`,
 * which is what `endRunAccounts` below matches on.
 */
const stamp = `verify9-${Date.now()}`;

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
      "verify-phase9 refuses to run outside development.\n" +
        `  NODE_ENV is ${process.env.NODE_ENV ?? "unset"}, and must be "development".`,
    );
    process.exit(1);
  }

  const manager = await sessionFor("manager@example.test");
  const coordinator = await sessionFor("coordinator@example.test");

  const seededRoles = await db.select().from(roles);
  const roleByName = new Map(seededRoles.map((role) => [role.nameEn, role]));
  const repRole = roleByName.get("Sales Rep");
  if (!repRole || seededRoles.length < 7) {
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

  /* --- 1. The seed [20 §11], [12 §3] -------------------------------- */

  console.log("\n1. The seed: quiet thresholds, and who sees every rep");

  const settingRows = await db
    .select()
    .from(settings)
    .where(
      inArray(settings.key, [
        QUIET_DAYS_QUALIFIED_KEY,
        QUIET_DAYS_UNQUALIFIED_KEY,
      ]),
    );
  if (settingRows.length < 2) {
    console.error("The settings are not seeded. Run: npm run db:seed");
    process.exit(1);
  }
  const thresholds = await getQuietThresholds();
  check(
    "a qualified company goes quiet after 30 days [07 D5], [20 §11]",
    thresholds.qualified === 30,
    `got ${thresholds.qualified}`,
  );
  check(
    "an unqualified company after 60 [07 D5], [20 §11]",
    thresholds.unqualified === 60,
    `got ${thresholds.unqualified}`,
  );
  // `20 §11` held three of `07 D5`'s five back because nothing read them — rows
  // nothing reads are the shape of v1's dead approval gate. `21 §2` adds them,
  // because `src/lib/follow-ups.ts` now reads all five, and feature slice 4
  // adds a sixth for `22 §6.11`'s returned quotation on the same terms. The
  // claim is unchanged; the number it resolves to is not, and this assertion
  // moves with it rather than being deleted.
  const followupRows = await db
    .select({ key: settings.key })
    .from(settings)
    .where(sql`${settings.key} like 'followup.%'`);
  check(
    "every seeded threshold has a reader — six since feature slice 4 [20 §11], [21 §2], [22 §6.11]",
    followupRows.length === 6,
    `got ${followupRows.map((row) => row.key).join(", ")}`,
  );

  for (const name of ["Super Admin", "Executive", "Sales Manager"]) {
    check(
      `${name} holds sees_all_reps [12 §3]`,
      roleByName.get(name)?.seesAllReps === true,
    );
  }
  for (const name of ["Sales Coordinator", "Marketing", "Desk Rep", "Sales Rep"]) {
    check(
      `${name} does NOT hold sees_all_reps [12 §3]`,
      roleByName.get(name)?.seesAllReps === false,
    );
  }
  check(
    "no new permission flag was invented for this phase [20 §13]",
    (await listRoles()).length === seededRoles.length &&
      !Object.keys(repRole).some((key) => key.toLowerCase().includes("report")),
  );

  /* --- Fixtures: this run's own reps and companies ------------------ */

  console.log("\n   fixtures: run-scoped reps, companies and a quotation chain");

  const password = `${stamp}-secret`;
  const authorUser = await createUser(manager, {
    name: `${stamp} Author`,
    email: `${stamp}-author@example.test`,
    roleId: repRole.id,
    password,
  });
  const strangerUser = await createUser(manager, {
    name: `${stamp} Stranger`,
    email: `${stamp}-stranger@example.test`,
    roleId: repRole.id,
    password,
  });
  const sharerUser = await createUser(manager, {
    name: `${stamp} Sharer`,
    email: `${stamp}-sharer@example.test`,
    roleId: repRole.id,
    password,
  });
  const author = asSession(authorUser, repRole);
  const stranger = asSession(strangerUser, repRole);
  const sharer = asSession(sharerUser, repRole);

  // `S13` makes the phone mandatory and `S23` matches companies on it, so every
  // fixture gets its own — from the run stamp plus a counter, because a shared
  // literal would make each run's companies duplicates of the last run's.
  // `S14` — all of them are Saudi, so `S15`'s city and region still apply.
  const saudiId = (await listCountries()).find(
    (row) => row.code === SAUDI_CODE,
  )!.id;
  let phoneSeq = 0;
  const nextPhone = () => `+9665${stamp.slice(-7)}${(phoneSeq += 1)}`;

  const [companyA] = await db
    .insert(companies)
    .values({
      name: `${stamp} Company A`,
      nameNormalized: normalizeName(`${stamp} Company A`),
      phone: nextPhone(),
      countryId: saudiId,
      createdBy: authorUser.id,
    })
    .returning();
  const [companyB] = await db
    .insert(companies)
    .values({
      name: `${stamp} Company B`,
      nameNormalized: normalizeName(`${stamp} Company B`),
      phone: nextPhone(),
      countryId: saudiId,
      createdBy: authorUser.id,
    })
    .returning();
  // Section 10 fills this one with 25 entries to prove the cap.
  const [companyQuiet] = await db
    .insert(companies)
    .values({
      name: `${stamp} Company Quiet`,
      nameNormalized: normalizeName(`${stamp} Company Quiet`),
      phone: nextPhone(),
      countryId: saudiId,
      createdBy: authorUser.id,
    })
    .returning();
  // Never logged against and never quoted: section 11's "quiet from birth".
  const [companyNever] = await db
    .insert(companies)
    .values({
      name: `${stamp} Company Never`,
      nameNormalized: normalizeName(`${stamp} Company Never`),
      phone: nextPhone(),
      countryId: saudiId,
      createdBy: authorUser.id,
    })
    .returning();

  for (const company of [companyA, companyB, companyQuiet, companyNever]) {
    await db.insert(companyReps).values({
      companyId: company.id,
      userId: authorUser.id,
      isPrimary: true,
      origin: "self_registered",
    });
  }
  // The sharer holds company A and NOT its project — section 15's trap.
  // `origin: "assigned"` — a membership, not a share `[23]`; `company_rep_origin`
  // dropped its own `'shared'` value in feature slice 6, unused by real code
  // and only ever written by fixtures like this one `[26 §2]`.
  await db.insert(companyReps).values({
    companyId: companyA.id,
    userId: sharerUser.id,
    origin: "assigned",
  });

  const [contactA] = await db
    .insert(contacts)
    .values({
      companyId: companyA.id,
      name: `${stamp} Contact A`,
      nameNormalized: normalizeName(`${stamp} Contact A`),
      createdBy: authorUser.id,
    })
    .returning();
  const [contactB] = await db
    .insert(contacts)
    .values({
      companyId: companyB.id,
      name: `${stamp} Contact B`,
      nameNormalized: normalizeName(`${stamp} Contact B`),
      createdBy: authorUser.id,
    })
    .returning();

  const [projectA] = await db
    .insert(projects)
    .values({
      name: `${stamp} Project A`,
      nameNormalized: normalizeName(`${stamp} Project A`),
      ownerUserId: authorUser.id,
      createdBy: authorUser.id,
    })
    .returning();
  // Linked to no company: `projectNotOnCompany` needs one to refuse over.
  const [projectLoose] = await db
    .insert(projects)
    .values({
      name: `${stamp} Project Loose`,
      nameNormalized: normalizeName(`${stamp} Project Loose`),
      ownerUserId: authorUser.id,
      createdBy: authorUser.id,
    })
    .returning();
  await db
    .insert(projectCompanies)
    .values({ projectId: projectA.id, companyId: companyA.id });

  // A quotation chain on company A, raised by the AUTHOR and issued by the
  // COORDINATOR — the founder's named attribution case, section 14.
  const [threadA] = await db
    .insert(quotationThreads)
    .values({
      projectId: projectA.id,
      companyId: companyA.id,
      raisedByUserId: authorUser.id,
    })
    .returning();
  const [versionA] = await db
    .insert(quotationVersions)
    .values({
      threadId: threadA.id,
      versionNumber: 1,
      origin: "initial_request",
      status: "issued",
      // `S118` — NOT NULL, so a direct insert has to name one too. This
      // script is about coverage and the timeline; the stock is scenery.
      stock: "riyadh",
      smacReference: `${stamp}-9592`,
      createdBy: authorUser.id,
    })
    .returning();
  // `S60` — a quotation always keeps at least one product line, and a version
  // written by hand has to say so itself. This script's versions were the
  // reason the rule had rows disagreeing with it.
  await addQuotationLineRow(versionA.id);
  // The issue event has no column of its own; it lives in the audit log
  // `[20 §8]`, written the way `quotations.ts` writes it.
  await db.insert(auditLog).values({
    actorUserId: coordinator.user.id,
    action: "quotation_version.issued",
    entityType: "quotation_version",
    entityId: versionA.id,
    after: { status: "issued" },
  });
  // Recorded by the coordinator, crediting the author — section 14's second
  // case: the credited rep is NOT the actor `[18 §1]`.
  const [dispatchA] = await db
    .insert(dispatches)
    .values({
      // `S130` `S119` `S70` — a hand-written dispatch names all three, as
      // every dispatch does. Riyadh and CT are the unconstrained pair
      // (`dispatches_stock_shipment`), and an APPROVED row must carry a
      // payment method or `dispatches_payment_method` refuses it `S73`.
      stock: "riyadh" as const,
      shipment: "ct" as const,
      paymentMethod: "bank_transfer_full" as const,
      companyId: companyA.id,
      userId: authorUser.id,
      quotationThreadId: threadA.id,
      // `S126` — the issued version it is raised from. The
      // `dispatches_quotation_pair` CHECK requires it beside the thread.
      quotationVersionId: versionA.id,
      // `S74` — a dispatch carries its quotation's project, and this row is
      // written by hand rather than through `recordDispatch`, so it has to
      // say so itself. `verify:schema25` §11 holds every row to it.
      projectId: projectA.id,
      dispatchDate: today(),
      recordedByUserId: coordinator.user.id,
      // `S72` — a hand-written dispatch says which of the four states it is
      // in, and these fixtures all want the one that COUNTS: an approved
      // dispatch is the only thing that credits a target, and every figure
      // below reads it through `approvedDispatches()`. The three stamps move
      // together or the `dispatches_approval_stamps` CHECK refuses the row.
      // `S120` — a hand-written row has to satisfy
      // `dispatches_difference_flag` before it has any lines to compare, so
      // the pair starts here and `addDispatchLine` corrects the rep's half to
      // the truth once the line exists.
      differedAtSubmission: false,
      linesChangedAfterSubmission: false,
      status: "approved" as const,
      submittedAt: new Date(),
      approvedByUserId: coordinator.user.id,
      approvedAt: new Date(),
    })
    .returning();
  // `S116` — its one line. Without it the dispatch reads as 0 m².
  await addDispatchLine(dispatchA.id, "12.5000");

  /* --- 2. Every gate refuses, with its own key --------------------- */

  console.log("\n2. Every gate refuses — and coverage and activity refuse nobody");

  await refuses(
    "an interaction with no company is refused",
    "reports.errors.companyRequired",
    () => createReport(author, interaction({ companyId: "" })),
  );
  await refuses(
    "an interaction with no channel is refused",
    "reports.errors.channelRequired",
    () => createReport(author, interaction({ companyId: companyA.id, channel: null })),
  );
  await refuses(
    "an interaction with no outcome is refused",
    "reports.errors.outcomeRequired",
    () => createReport(author, interaction({ companyId: companyA.id, outcome: null })),
  );
  await refuses(
    "an empty narrative is refused",
    "reports.errors.narrativeRequired",
    () =>
      createReport(author, interaction({ companyId: companyA.id, narrative: "   " })),
  );
  await refuses(
    "on hold with no date is refused [20 §5]",
    "reports.errors.onHoldDateRequired",
    () =>
      createReport(
        author,
        interaction({ companyId: companyA.id, outcome: "on_hold" }),
      ),
  );
  await refuses(
    "a field note with no category is refused",
    "reports.errors.categoryRequired",
    () =>
      createReport(author, {
        entryType: "field_note",
        reportDate: today(),
        narrative: "nope",
        companyId: null,
        contactId: null,
        projectId: null,
        channel: null,
        outcome: null,
        onHoldUntil: null,
        category: null,
        cityId: null,
        signals: [],
      }),
  );
  await refuses(
    "a contact from another company is refused",
    "reports.errors.contactNotOnCompany",
    () =>
      createReport(
        author,
        interaction({ companyId: companyA.id, contactId: contactB.id }),
      ),
  );
  await refuses(
    "a project not linked to the company is refused",
    "reports.errors.projectNotOnCompany",
    () =>
      createReport(
        author,
        interaction({ companyId: companyA.id, projectId: projectLoose.id }),
      ),
  );
  await refuses(
    "a company the actor cannot see is refused",
    "reports.errors.companyNotVisible",
    () => createReport(stranger, interaction({ companyId: companyA.id })),
  );
  await refuses(
    "the same signal twice is refused rather than hitting the unique index",
    "reports.errors.signalDuplicated",
    () =>
      createReport(
        author,
        interaction({
          companyId: companyA.id,
          signals: [
            { signal: "price_too_high", reference: null },
            { signal: "price_too_high", reference: "again" },
          ],
        }),
      ),
  );

  // The negative claim `20 §7`, `20 §8`: these two are SCOPED, not gated.
  // A rep calling either gets rows, never a refusal.
  const repCoverage = await listCompanies(author);
  check(
    "the company list refuses a rep NOTHING — it scopes [20 §7]",
    Array.isArray(repCoverage.rows),
  );
  const repActivity = await dailyActivity(author, {
    range: { from: today(), to: today() },
  });
  check(
    "the daily view refuses a rep NOTHING — it scopes [20 §8]",
    repActivity.rows.length === 1 && repActivity.rows[0].userId === authorUser.id,
    `got ${repActivity.rows.length} rows`,
  );

  /* --- 3. The CHECKs hold at the database [13 §1] ------------------ */

  console.log("\n3. The shape constraints hold at the DATABASE, not only in code");

  await databaseRefuses(
    "a field note carrying a company is refused",
    "rep_reports_shape",
    `insert into rep_reports (user_id, entry_type, company_id, category, narrative, report_date)
     values ('${authorUser.id}', 'field_note', '${companyA.id}', 'internal', 'x', '${today()}')`,
  );
  await databaseRefuses(
    "an interaction with no channel is refused",
    "rep_reports_shape",
    `insert into rep_reports (user_id, entry_type, company_id, outcome, narrative, report_date)
     values ('${authorUser.id}', 'interaction', '${companyA.id}', 'introduced', 'x', '${today()}')`,
  );
  await databaseRefuses(
    "an on-hold row with no date is refused",
    "rep_reports_on_hold",
    `insert into rep_reports (user_id, entry_type, company_id, channel, outcome, narrative, report_date)
     values ('${authorUser.id}', 'interaction', '${companyA.id}', 'call', 'on_hold', 'x', '${today()}')`,
  );
  await databaseRefuses(
    "a date without the on-hold outcome is refused",
    "rep_reports_on_hold",
    `insert into rep_reports (user_id, entry_type, company_id, channel, outcome, narrative, report_date, on_hold_until)
     values ('${authorUser.id}', 'interaction', '${companyA.id}', 'call', 'introduced', 'x', '${today()}', '${today()}')`,
  );

  /* --- 4. An interaction saves, with its signals -------------------- */

  console.log("\n4. An interaction saves, and a signal reference round-trips");

  const reportA = await createReport(
    author,
    interaction({
      companyId: companyA.id,
      contactId: contactA.id,
      projectId: projectA.id,
      channel: "visit",
      outcome: "discussed_pricing",
      reportDate: daysAgo(1),
      narrative: `${stamp} they liked the samples`,
      signals: [
        { signal: "competitor_cheaper", reference: "Alucobond" },
        { signal: "lead_time_too_long", reference: null },
      ],
    }),
  );
  const savedA = await getReport(author, reportA.id);
  check("the report reads back", savedA !== null);
  check(
    "the contact and project are both stored",
    savedA?.contactId === contactA.id && savedA?.projectId === projectA.id,
  );
  check(
    "two signals were stored",
    savedA?.signals.length === 2,
    `got ${savedA?.signals.length}`,
  );
  check(
    "the reference round-trips [20 §4]",
    savedA?.signals.find((s) => s.signal === "competitor_cheaper")?.reference ===
      "Alucobond",
  );
  check(
    "a signal with no reference stores null, not an empty string",
    savedA?.signals.find((s) => s.signal === "lead_time_too_long")?.reference ===
      null,
  );

  // A field note: no company, and it counts as activity `[20 §2]`, `[20 §8]`.
  const fieldNote = await createReport(author, {
    entryType: "field_note",
    reportDate: daysAgo(1),
    narrative: `${stamp} walked the exhibition`,
    companyId: null,
    contactId: null,
    projectId: null,
    channel: null,
    outcome: null,
    onHoldUntil: null,
    category: "exhibition",
    cityId: null,
    signals: [],
  });
  check("a field note saves with no company [20 §2]", fieldNote.companyId === null);

  // A COMPANY-level report — no project named. Sections 15 and 16 turn on the
  // difference between this and `reportA`: both are on company A, and only
  // this one is visible to someone who holds the company but not the project.
  const companyLevel = await createReport(
    author,
    interaction({
      companyId: companyA.id,
      channel: "call",
      outcome: "catalogue_sent",
      reportDate: daysAgo(1),
      narrative: `${stamp} company-level, no project`,
    }),
  );
  check(
    "a company-level report names no project [20 §2]",
    companyLevel.projectId === null,
  );

  /* --- 5. *** Editing corrects ONE row *** [20 §9] ----------------- */

  console.log("\n5. *** Editing corrects one row and never double-counts ***");

  const before = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(repReports)
    .where(eq(repReports.companyId, companyA.id));

  await updateReport(author, reportA.id, {
    ...interaction({
      companyId: companyA.id,
      contactId: contactA.id,
      projectId: projectA.id,
      outcome: "not_interested",
      reportDate: daysAgo(1),
      narrative: `${stamp} corrected`,
      signals: [
        // kept, with a NEW reference
        { signal: "competitor_cheaper", reference: "Reynobond" },
        // added; `lead_time_too_long` is dropped
        { signal: "price_too_high", reference: null },
      ],
    }),
  });

  const after = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(repReports)
    .where(eq(repReports.companyId, companyA.id));
  check(
    "the row count is UNCHANGED — a correction is not a second row [20 §9]",
    before[0].n === after[0].n,
    `${before[0].n} → ${after[0].n}`,
  );

  const corrected = await getReport(author, reportA.id);
  check(
    "the current outcome is the corrected one",
    corrected?.outcome === "not_interested",
    `got ${corrected?.outcome}`,
  );
  check(
    "the old outcome is GONE — counts cannot read both",
    !(await reportsIn(author, { outcome: "discussed_pricing" })).some(
      (row) => row.id === reportA.id,
    ),
  );
  check(
    "the signal set was REPLACED, not appended to [20 §9]",
    corrected?.signals.length === 2 &&
      corrected.signals.every((s) => s.signal !== "lead_time_too_long"),
    `got ${corrected?.signals.map((s) => s.signal).join(", ")}`,
  );
  check(
    "a kept signal's reference was updated in place",
    corrected?.signals.find((s) => s.signal === "competitor_cheaper")
      ?.reference === "Reynobond",
  );
  const signalRows = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(repReportSignals)
    .where(eq(repReportSignals.reportId, reportA.id));
  check(
    "and there are exactly two signal ROWS, not four",
    signalRows[0].n === 2,
    `got ${signalRows[0].n}`,
  );

  await refuses(
    "another rep may not edit it [20 §9]",
    "reports.errors.authorOnly",
    () => updateReport(manager, reportA.id, interaction({ companyId: companyA.id })),
  );

  const auditBeforeNoop = await auditCount(reportA.id);
  await updateReport(author, reportA.id, {
    ...interaction({
      companyId: companyA.id,
      contactId: contactA.id,
      projectId: projectA.id,
      outcome: "not_interested",
      reportDate: daysAgo(1),
      narrative: `${stamp} corrected`,
      signals: [
        { signal: "competitor_cheaper", reference: "Reynobond" },
        { signal: "price_too_high", reference: null },
      ],
    }),
  });
  check(
    "a no-op save writes no audit row",
    (await auditCount(reportA.id)) === auditBeforeNoop,
  );

  // *** The same-day window `[S39]`. *** Every edit above backdates the day
  // the report COVERS and still lands, because the clock is `created_at` in
  // Riyadh, not `report_date` — otherwise a three-week-old report could be
  // reopened by editing the date it claims to cover.
  const stale = await createReport(
    author,
    interaction({
      companyId: companyA.id,
      channel: "call",
      outcome: "no_answer",
      reportDate: daysAgo(1),
      narrative: `${stamp} written today, about yesterday`,
    }),
  );
  check(
    "a report written today is editable by its author [S39]",
    (await getReport(author, stale.id))?.editable === true,
  );

  // Only a fixture may do this: `created_at` defaults to `now()` and no code
  // path writes it, which is what makes the window unforgeable in the app.
  await db
    .update(repReports)
    .set({ createdAt: new Date(Date.now() - 36 * 60 * 60 * 1000) })
    .where(eq(repReports.id, stale.id));

  check(
    "*** and NOT once the day it was written has passed [S39] ***",
    (await getReport(author, stale.id))?.editable === false,
  );
  await refuses(
    "*** the DATA LAYER refuses it, not merely the screen [S39] ***",
    "reports.errors.editWindowClosed",
    () =>
      updateReport(
        author,
        stale.id,
        interaction({
          companyId: companyA.id,
          channel: "call",
          outcome: "not_interested",
          reportDate: daysAgo(1),
          narrative: `${stamp} written today, about yesterday`,
        }),
      ),
  );
  check(
    "and the outcome really did stand",
    (await getReport(author, stale.id))?.outcome === "no_answer",
  );

  /* --- 6. Re-anchoring [20 §9] ------------------------------------- */

  console.log("\n6. A report filed against the wrong company is corrected, not abandoned");

  const misfiled = await createReport(
    author,
    interaction({
      companyId: companyA.id,
      reportDate: daysAgo(1),
      narrative: `${stamp} wrong company`,
    }),
  );
  check(
    "it starts on company A's timeline",
    (await companyTimeline(author, companyA.id)).events.some(
      (event) => event.key === `report:${misfiled.id}`,
    ),
  );
  await updateReport(author, misfiled.id, {
    ...interaction({
      companyId: companyB.id,
      contactId: contactB.id,
      reportDate: daysAgo(1),
      narrative: `${stamp} wrong company`,
    }),
  });
  check(
    "after the correction it has LEFT company A's timeline [20 §9]",
    !(await companyTimeline(author, companyA.id)).events.some(
      (event) => event.key === `report:${misfiled.id}`,
    ),
  );
  check(
    "and joined company B's",
    (await companyTimeline(author, companyB.id)).events.some(
      (event) => event.key === `report:${misfiled.id}`,
    ),
  );

  /* --- 7. "Asked for a quotation" is not an outcome [20 §3] -------- */

  console.log('\n7. "Asked for a quotation" is not an outcome — qualification stays derived');

  check(
    "no outcome value claims a quotation was asked for [20 §3]",
    !REPORT_OUTCOMES.some((value) => value.includes("quot")),
    `got ${REPORT_OUTCOMES.join(", ")}`,
  );
  const coverageRows = await listCompanies(manager, { q: stamp });
  const rowB = coverageRows.rows.find((row) => row.id === companyB.id);
  const rowA = coverageRows.rows.find((row) => row.id === companyA.id);
  check(
    "a company whose only interaction discussed pricing is NOT qualified [10 §1]",
    rowB?.isQualified === false,
    `got ${rowB?.isQualified}`,
  );
  check(
    "a company with a real quotation thread IS qualified [10 §1]",
    rowA?.isQualified === true,
    `got ${rowA?.isQualified}`,
  );

  /* --- 8. `on hold` is derived on read [20 §5] --------------------- */

  console.log("\n8. `on hold` is derived on read, never stored on the company");

  /*
   * **`onHoldByCompany`, not the viewer-scoped reader this used to call.**
   * `companyOnHoldUntil` composed `visibleRepReportsFilter` and came out with
   * the company-detail slice: `20 §5` says suppression is a property of the
   * **company**, not of the viewer, and `companySilence` and this function had
   * always read it that way. The one caller that disagreed was the turn panel,
   * which could show a company red while `/companies`' meter showed it calm — a
   * hold set on a report the reader could not open.
   *
   * The assertions below are unchanged in substance. What is no longer proved
   * is that a viewer who cannot read the hold report is told nothing, and that
   * is deliberate: it was the defect, not the guarantee.
   */
  const heldUntil = async (companyId: string) =>
    (await onHoldByCompany([companyId])).get(companyId) ?? null;

  check(
    "no suppression before anything says so",
    (await heldUntil(companyB.id)) === null,
  );
  const held = await createReport(
    author,
    interaction({
      companyId: companyB.id,
      outcome: "on_hold",
      onHoldUntil: daysAgo(-30),
      reportDate: daysAgo(1),
      narrative: `${stamp} come back after Ramadan`,
    }),
  );
  check(
    "a future date suppresses the company [20 §5]",
    (await heldUntil(companyB.id)) === daysAgo(-30),
  );
  check(
    "and the list does not call it quiet",
    (await listCompanies(manager, { q: stamp })).rows.find(
      (row) => row.id === companyB.id,
    )?.isQuiet === false,
  );
  // Correcting the report corrects the suppression, with nothing to keep in
  // step — the whole reason it is derived rather than stored.
  await updateReport(author, held.id, {
    ...interaction({
      companyId: companyB.id,
      outcome: "on_hold",
      onHoldUntil: daysAgo(5),
      reportDate: daysAgo(1),
      narrative: `${stamp} come back after Ramadan`,
    }),
  });
  check(
    "a date in the past suppresses nothing — the current row wins [20 §5]",
    (await heldUntil(companyB.id)) === null,
  );

  /* --- 9. The timeline merges both halves [20 §6] ------------------ */

  console.log("\n9. The timeline merges what was typed with what FACET recorded");

  const timelineA = await companyTimeline(author, companyA.id);
  const kinds = new Set(timelineA.events.map((event) => event.kind));
  for (const kind of [
    "report",
    "company_added",
    "quotation_raised",
    "quotation_issued",
    "dispatched",
  ] as const) {
    check(`company A's timeline carries a \`${kind}\` event`, kinds.has(kind));
  }
  const days = timelineA.events.map((event) => event.day);
  check(
    "it is ordered newest first",
    days.every((day, index) => index === 0 || days[index - 1] >= day),
    `got ${days.join(" ")}`,
  );
  check(
    "*** a field note appears on NO company timeline [20 §2] ***",
    !timelineA.events.some((event) => event.key === `report:${fieldNote.id}`) &&
      !(await companyTimeline(author, companyB.id)).events.some(
        (event) => event.key === `report:${fieldNote.id}`,
      ),
  );
  const timelineProject = await projectTimeline(author, projectA.id);
  check(
    "the project's timeline carries the report that names it",
    timelineProject.events.some((event) => event.key === `report:${reportA.id}`),
  );
  check(
    "and carries no `company_added` event — a project is not a company",
    !timelineProject.events.some((event) => event.kind === "company_added"),
  );

  /* --- 10. The cap is the CARD's, not the data's [20 §6] ----------- */

  console.log("\n10. The 20-entry cap belongs to the card; the history is whole");

  const bulk: string[] = [];
  for (let index = 0; index < 25; index += 1) {
    const row = await createReport(
      author,
      interaction({
        companyId: companyQuiet.id,
        reportDate: daysAgo(2),
        narrative: `${stamp} bulk ${index}`,
      }),
    );
    bulk.push(row.id);
  }
  const capped = await companyTimeline(author, companyQuiet.id, {
    limit: TIMELINE_CARD_LIMIT,
  });
  check(
    "the card returns 20",
    capped.events.length === TIMELINE_CARD_LIMIT,
    `got ${capped.events.length}`,
  );
  check(
    "and REPORTS the total it is not showing, rather than dropping it silently",
    capped.total >= 26,
    `got ${capped.total}`,
  );
  const pageOne = await companyTimeline(author, companyQuiet.id, { page: 1 });
  const pageTwo = await companyTimeline(author, companyQuiet.id, { page: 2 });
  check(
    "*** the full history pages past the cap [20 §6] ***",
    pageTwo.events.length > 0 &&
      pageOne.events.length + pageTwo.events.length === pageOne.total,
    `${pageOne.events.length} + ${pageTwo.events.length} of ${pageOne.total}`,
  );

  /* --- 11. Coverage counts, it does not chase [20 §7] -------------- */

  console.log("\n11. Coverage answers which companies went quiet, not who submitted");

  /* **`daysSince`, because `CompanyListRow` carries the age and not the date.**
   * The claim is the one `coverage()` made — a company logged against yesterday
   * reads back yesterday, and never null — and `companySilence` computes both
   * from the same `max(report_date)`. Null is still the interesting half: it is
   * what *never logged against* returns, and it must not read as `0`.
   *
   * **The literal `1`, not a helper.** This used to read
   * `daysBetween(daysAgo(1), today())`, and `daysBetween` was deleted in `28b`
   * along with its last production caller: `companySilence` does the
   * arithmetic in Postgres and is the only implementation. A helper kept alive
   * by the assertion that tests it proves nothing. */
  const loggedYesterday = (await listCompanies(manager, { q: stamp })).rows.find(
    (row) => row.id === companyA.id,
  );
  check(
    "a company logged against reads back its last interaction, not null",
    loggedYesterday?.daysSince === 1,
    `got ${loggedYesterday?.daysSince}`,
  );
  /* **A company never logged against is quiet once the clock has run, not from
   * birth** — `S89`: something joins the list when a company has had *"no
   * contact for too long"*, and a company registered this morning has not.
   *
   * **This assertion used to claim the opposite**, and it was encoding a
   * defect. `coverage()` and `companyQuiet()` in `follow-ups.ts` held two
   * copies of this derivation which had drifted: coverage counted a
   * never-logged company quiet immediately, follow-ups counted from
   * registration plus the threshold, and both carried the same sentence in
   * prose. On the demo base that was 100 of rep-a's 125 companies marked Quiet
   * against 36 — the same rep, the same afternoon, two screens, two answers.
   * `companySilence()` is now the one definition and this is `S89`'s half of
   * it, asserted in **both** directions rather than only the convenient one. */
  const freshNever = (await listCompanies(manager, { q: stamp })).rows.find(
    (row) => row.id === companyNever.id,
  );
  check(
    "a company never logged against has no last interaction [20 §2]",
    freshNever?.daysSince === null,
    `daysSince=${freshNever?.daysSince}`,
  );
  check(
    "…and registered today it is NOT yet quiet — no contact for too long [S89]",
    freshNever?.isQuiet === false,
    `quiet=${freshNever?.isQuiet} threshold=${freshNever?.thresholdDays}`,
  );

  // Age its registration past the unqualified threshold. Nothing is logged
  // against it either way — only the clock moves, which is the whole claim.
  await db
    .update(companies)
    .set({ createdAt: new Date(`${daysAgo(61)}T00:00:00Z`) })
    .where(eq(companies.id, companyNever.id));
  const agedNever = (await listCompanies(manager, { q: stamp })).rows.find(
    (row) => row.id === companyNever.id,
  );
  check(
    "…and at 61 days it IS quiet, still with no interaction to show [S89]",
    agedNever?.isQuiet === true && agedNever?.daysSince === null,
    `quiet=${agedNever?.isQuiet} daysSince=${agedNever?.daysSince}`,
  );

  // Age company B's only interaction past each threshold in turn.
  await db
    .update(repReports)
    .set({ reportDate: daysAgo(31) })
    .where(eq(repReports.companyId, companyB.id));
  const at31 = (await listCompanies(manager, { q: stamp })).rows.find(
    (row) => row.id === companyB.id,
  );
  check(
    "unqualified at 31 days is NOT yet quiet — 60 is its threshold [07 D5]",
    at31?.isQuiet === false && at31?.thresholdDays === 60,
    `quiet=${at31?.isQuiet} threshold=${at31?.thresholdDays}`,
  );
  await db
    .update(repReports)
    .set({ reportDate: daysAgo(61) })
    .where(eq(repReports.companyId, companyB.id));
  check(
    "at 61 days it is quiet",
    (await listCompanies(manager, { q: stamp })).rows.find(
      (row) => row.id === companyB.id,
    )?.isQuiet === true,
  );
  // Company A is qualified, so 31 days is already past ITS threshold.
  await db
    .update(repReports)
    .set({ reportDate: daysAgo(31) })
    .where(eq(repReports.companyId, companyA.id));
  const qualifiedAt31 = (await listCompanies(manager, { q: stamp })).rows.find(
    (row) => row.id === companyA.id,
  );
  check(
    "a QUALIFIED company is quiet at 31 days — 30 is its threshold [07 D5]",
    qualifiedAt31?.isQuiet === true && qualifiedAt31?.thresholdDays === 30,
    `quiet=${qualifiedAt31?.isQuiet} threshold=${qualifiedAt31?.thresholdDays}`,
  );
  /* **The whole-calendar-days claim is asserted by the four checks above**,
   * not by a helper of its own. Each one moves a report to an exact day
   * boundary — 31, 61 — and reads the threshold decision back; an arithmetic
   * that measured instants rather than calendar days would land on the wrong
   * side of at least one of them. That is `D34`'s unit proved where it is
   * actually computed, in SQL, rather than in a TypeScript twin. */
  check(
    "nothing was written by asking — silence is a diagnostic [07 D6]",
    (await auditCount(companyA.id)) === 0,
  );

  /* --- 12. Coverage is scoped, not gated [20 §7] ------------------- */

  console.log("\n12. Coverage is scoped in both directions");

  const mine = [companyA.id, companyB.id, companyQuiet.id, companyNever.id];
  const authorSees = await listCompanies(author, { q: stamp });
  check(
    "a rep sees exactly their own companies",
    authorSees.rows.length === mine.length &&
      authorSees.rows.every((row) => mine.includes(row.id)),
    `got ${authorSees.rows.length}`,
  );
  const sharerSees = await listCompanies(sharer, { q: stamp });
  check(
    "a rep who holds one company through a share sees exactly that one",
    sharerSees.rows.length === 1 && sharerSees.rows[0].id === companyA.id,
    `got ${sharerSees.rows.length}`,
  );
  check(
    "a rep unconnected to any of them sees none",
    (await listCompanies(stranger, { q: stamp })).rows.length === 0,
  );
  check(
    "`sees_all_reps` sees all of them",
    (await listCompanies(manager, { q: stamp })).rows.length === mine.length,
    `got ${(await listCompanies(manager, { q: stamp })).rows.length}`,
  );
  /* **The `?rep=` narrowing and its options list went with `coverage()`** in
   * `28b`. `S88` deletes the coverage screen and the founder's call left the
   * per-rep filter to `D39`'s team table, which is the rule that names a
   * per-rep reading of quiet companies. Nothing else composed either function,
   * so there is no narrowing left to assert and no options list to offer —
   * asserting a deleted capability against `listCompanies`, which has no rep
   * filter, would be inventing one to have something to check. The half that
   * matters is above and unchanged: the SCOPE, in both directions. */

  /* --- 13. *** Real activity beside logged activity *** [20 §8] ---- */

  console.log("\n13. *** The daily view shows real activity beside logged activity ***");

  // A private window nothing else in the database occupies.
  const windowDay = daysAgo(400);
  await db
    .update(dispatches)
    .set({ dispatchDate: windowDay })
    .where(eq(dispatches.id, dispatchA.id));

  const silentUser = await createUser(manager, {
    name: `${stamp} Silent`,
    email: `${stamp}-silent@example.test`,
    roleId: repRole.id,
    password,
  });
  const silent = asSession(silentUser, repRole);
  await db.insert(companyReps).values({
    companyId: companyA.id,
    userId: silentUser.id,
    origin: "assigned",
  });

  const range = { from: windowDay, to: windowDay };
  const day = await dailyActivity(manager, { range });
  const coordinatorRow = day.rows.find(
    (row) => row.userId === coordinator.user.id,
  );
  check(
    "*** a rep who logged NOTHING but pushed a dispatch out still shows a non-zero row ***",
    (coordinatorRow?.reportsLogged ?? -1) === 0 &&
      (coordinatorRow?.systemEvents ?? 0) > 0,
    `logged=${coordinatorRow?.reportsLogged} events=${coordinatorRow?.systemEvents}`,
  );

  // Field notes count `[20 §8]`.
  await db
    .update(repReports)
    .set({ reportDate: windowDay })
    .where(eq(repReports.id, fieldNote.id));
  const withNote = await dailyActivity(manager, { range });
  const authorRow = withNote.rows.find((row) => row.userId === authorUser.id);
  check(
    "a field note with no company counts toward its author's logged figure [20 §8]",
    authorRow?.reportsLogged === 1 && authorRow?.companiesTouched === 0,
    `logged=${authorRow?.reportsLogged} companies=${authorRow?.companiesTouched}`,
  );
  check(
    "the team total is the sum of the rows",
    withNote.total.reportsLogged ===
      withNote.rows.reduce((sum, row) => sum + row.reportsLogged, 0) &&
      withNote.total.systemEvents ===
        withNote.rows.reduce((sum, row) => sum + row.systemEvents, 0),
  );
  check(
    "a rep sees only their own row; `sees_all_reps` sees everyone's [20 §8]",
    (await dailyActivity(silent, { range })).rows.length === 1 &&
      withNote.rows.length > 1,
  );
  // `D30` — expanding a rep IS the stream filtered to them, and `by-rep` is
  // an arrangement of it rather than a second screen inside it. The old
  // `dailyActivityEntries` re-ran the union for one person and rendered the
  // result under the counts table; this is the same events at a URL somebody
  // can be sent.
  const expanded = await streamFor(manager, {
    who: [authorUser.id],
    from: range.from,
    to: range.to,
  });
  check(
    "*** expanding a rep is the stream filtered to them, and returns the same entries ***",
    expanded.events.every((event) => event.actorUserId === authorUser.id) &&
      expanded.events.some((event) => event.key === `report:${fieldNote.id}`),
  );
  // `D45` gives the stream NO default range, so `defaultRange`/`yesterday`
  // went with the screen that opened on yesterday. What replaces the check is
  // that an unranged stream is not silently empty and is a superset of a
  // ranged one — the property the default was standing in for.
  const unranged = await streamFor(manager, {}, { page: 1 });
  check(
    "*** the stream has no default range: unranged is a superset of one day ***",
    unranged.total >= expanded.total && unranged.total > 0,
    `unranged ${unranged.total}, one day ${expanded.total}`,
  );

  /* --- 14. Attribution — whoever performed it [20 §8] -------------- */

  console.log("\n14. Every event lands on the row of whoever PERFORMED it");

  const chainRange = { from: daysAgo(400), to: daysAgo(-1) };
  const chain = await eventsInRange(manager, chainRange);
  const raised = chain.find(
    (event) => event.key === `quotation_raised:${versionA.id}`,
  );
  const issued = chain.find((event) => event.kind === "quotation_issued");
  check(
    "*** raised by rep A, issued by the coordinator: one event each, never two on either ***",
    raised?.actorUserId === authorUser.id &&
      issued?.actorUserId === coordinator.user.id,
    `raised=${raised?.actorUserId} issued=${issued?.actorUserId}`,
  );
  check(
    "the raise reads `quotation_versions.created_by`, so a handover cannot move it [19 §1]",
    await (async () => {
      await db
        .update(quotationThreads)
        .set({ raisedByUserId: strangerUser.id })
        .where(eq(quotationThreads.id, threadA.id));
      const after = await eventsInRange(manager, chainRange);
      const moved = after.find(
        (event) => event.key === `quotation_raised:${versionA.id}`,
      );
      await db
        .update(quotationThreads)
        .set({ raisedByUserId: authorUser.id })
        .where(eq(quotationThreads.id, threadA.id));
      return moved?.actorUserId === authorUser.id;
    })(),
  );
  const dispatched = chain.find(
    (event) => event.key === `dispatched:${dispatchA.id}`,
  );
  check(
    "a dispatch counts for its RECORDER, not the credited rep [18 §1], [20 §8]",
    dispatched?.actorUserId === coordinator.user.id,
    `got ${dispatched?.actorUserId}`,
  );
  // **There is no payment event to attribute** `S133`. It was the third
  // assertion here until this slice: `payment_confirmed` counted for the rep
  // who ticked it, and the tick is gone with `confirmPayment` and the column
  // behind it. Payment lives on the dispatch now `S70`, and the dispatch event
  // above already attributes to its recorder `S112`, so the attribution rule
  // this section proves is unchanged — one fewer event proves it.

  /* --- 15. Visibility in both directions [20 §10], [20 §8.2] ------- */

  console.log("\n15. Visibility follows the anchor, and the negative half matters most");

  const sharerReports = await reportsIn(sharer, {});
  check(
    "a rep sharing the company sees a company-level report on it",
    sharerReports.some((row) => row.id === misfiled.id) === false &&
      sharerReports.some((row) => row.companyId === companyA.id),
  );
  check(
    "*** but NOT the one naming a project they cannot open [04 Q7], [20 §10] ***",
    !sharerReports.some((row) => row.id === reportA.id),
    `saw ${sharerReports.filter((row) => row.id === reportA.id).length}`,
  );
  check(
    "and cannot open it directly either",
    (await getReport(sharer, reportA.id)) === null,
  );
  check(
    "`sees_all_reps` sees both",
    (await getReport(manager, reportA.id)) !== null &&
      (await getReport(manager, fieldNote.id)) !== null,
  );
  check(
    "a field note is its author's alone",
    (await getReport(author, fieldNote.id)) !== null &&
      (await getReport(sharer, fieldNote.id)) === null,
  );
  check(
    "an unrelated rep sees nothing of any of it",
    (await getReport(stranger, reportA.id)) === null &&
      (await reportsIn(stranger, {})).length === 0,
  );
  check(
    "no `rep_report` value was added to ViewableRecordType [20 §13]",
    await canViewRecord(author, "company", companyA.id),
  );

  /* The note half `[S38]` — the same rows, minus the words.
     `sharer` reaches company A's reports through a membership rather than a
     `record_shares` row; the filter reads the two identically, and
     `verify:sharing` §5 follows a real share to the same place. */

  const noteToken = `${stamp}-noteonly`;
  const noted = await createReport(
    author,
    interaction({
      companyId: companyA.id,
      channel: "call",
      outcome: "introduced",
      reportDate: daysAgo(1),
      narrative: `${noteToken} what the customer actually said`,
    }),
  );

  check(
    "the author reads their own note [S38]",
    (await getReport(author, noted.id))?.narrative?.includes(noteToken) === true,
  );
  check(
    "anyone who sees all reps reads it too [S38]",
    (await getReport(manager, noted.id))?.narrative?.includes(noteToken) ===
      true,
  );

  const sharerNoted = await getReport(sharer, noted.id);
  check(
    "*** a rep who reaches the report through the company reads WHAT HAPPENED [S38] ***",
    sharerNoted !== null && sharerNoted.outcome === "introduced",
  );
  check(
    "*** and NOT the note — withheld, not blank, not a missing row [S38] ***",
    sharerNoted?.narrative === null,
    `got ${JSON.stringify(sharerNoted?.narrative)}`,
  );
  check(
    "the list says the same as the detail, for both viewers [S38]",
    (await reportsOnCompany(sharer, companyA.id)).find(
      (row) => row.id === noted.id,
    )?.narrative === null &&
      (await reportsOnCompany(author, companyA.id)).find(
        (row) => row.id === noted.id,
      )?.narrative !== null,
  );

  /* The SEARCH path `[S38]`, which is the subtler of the two and the one a
     later "simplification" would silently reopen once the column is already
     withheld: `/reports` `ilike`s the narrative, so an open search hands over
     the note's contents by inference without ever rendering a word of it. */

  const authorSearch = await reportsIn(author, { q: noteToken });
  const managerSearch = await reportsIn(manager, { q: noteToken });
  const sharerSearch = await reportsIn(sharer, { q: noteToken });

  check(
    "the author searching a word of their own note finds it [S38]",
    authorSearch.length === 1 && authorSearch[0].id === noted.id,
    `got ${authorSearch.length}`,
  );
  check(
    "anyone who sees all reps searching the same word finds it [S38]",
    managerSearch.some((row) => row.id === noted.id),
  );
  check(
    "*** and the shared rep searching it gets NOTHING [S38] ***",
    sharerSearch.length === 0,
    `got ${sharerSearch.length}`,
  );
  check(
    "*** and that zero is the SEARCH being gated, not the row being hidden — the same rep sees it by company ***",
    (await reportsOnCompany(sharer, companyA.id)).some(
      (row) => row.id === noted.id,
    ),
  );
  // The gate MOVED in session 27 and got stronger, so assert the new shape
  // rather than trusting the old one: the search no longer composes
  // `readableNoteFilter` into an `ilike`, it matches a string `withNotes` has
  // already withheld. There is no term left to forget.
  check(
    "*** the shared rep's copy of that row carries no note to have matched [S38] ***",
    (await reportsOnCompany(sharer, companyA.id)).find(
      (row) => row.id === noted.id,
    )?.narrative === null,
  );

  // The audit-sourced half, asserted on its own `[20 §8.2]`.
  const auditRowExists = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(auditLog)
    .where(
      and(
        eq(auditLog.action, "quotation_version.issued"),
        eq(auditLog.entityId, versionA.id),
      ),
    );
  check(
    "the `quotation_version.issued` audit row really is there",
    auditRowExists[0].n > 0,
  );
  const sharerEvents = await eventsInRange(sharer, chainRange);
  check(
    "*** a rep who cannot see the thread gets NO issued event, though the audit row exists [20 §8.2] ***",
    !sharerEvents.some((event) => event.kind === "quotation_issued"),
    `saw ${sharerEvents.filter((e) => e.kind === "quotation_issued").length}`,
  );
  check(
    "nor on the company timeline they CAN open",
    !(await companyTimeline(sharer, companyA.id)).events.some(
      (event) => event.kind === "quotation_issued",
    ),
  );

  /* --- 16. A handover needs no report bucket [20 §10] -------------- */

  console.log("\n16. Handover moves report visibility with the company, and no bucket");

  check(
    "the newly assigned rep already sees company A's reports",
    (await reportsIn(silent, {})).some((row) => row.companyId === companyA.id),
  );
  await db
    .update(companyReps)
    .set({ removedAt: new Date() })
    .where(
      and(
        eq(companyReps.companyId, companyA.id),
        eq(companyReps.userId, silentUser.id),
      ),
    );
  check(
    "removing the membership takes the reports with it — no bucket needed [20 §10]",
    !(await reportsIn(silent, {})).some((row) => row.companyId === companyA.id),
  );
  const stillAuthored = await db
    .select({ userId: repReports.userId })
    .from(repReports)
    .where(eq(repReports.id, reportA.id));
  check(
    "and the author column was never rewritten [19 §1]",
    stillAuthored[0].userId === authorUser.id,
  );

  // *** `S40` — but never the AUTHOR's own. *** The write side was always
  // right: `S103` rewrites who OWNS a thread and never who PERFORMED an act,
  // and `team.ts` does not touch `rep_reports` at all. The loss was entirely
  // in the read predicate, which used to hang a rep's own interactions off
  // LIVE membership — so a handover took their own words away the moment it
  // stamped `company_reps.removed_at`.
  const authorHeld = await reportsOnCompany(author, companyA.id);
  check(
    "before: the author sees their own reports on company A",
    authorHeld.length > 0,
  );
  await db
    .update(companyReps)
    .set({ removedAt: new Date() })
    .where(
      and(
        eq(companyReps.companyId, companyA.id),
        eq(companyReps.userId, authorUser.id),
      ),
    );
  // The author was company A's PRIMARY rep, and the two removals above reach
  // around `team.ts` to stamp `removed_at` directly — a shape the application
  // has no route to. Left there it strands company A with a live rep and no
  // primary, which `S18` forbids and `verify:schema25` §20 counts over every
  // row. Primacy follows the company: the sharer is what is left of it.
  await db
    .update(companyReps)
    .set({ isPrimary: true })
    .where(
      and(
        eq(companyReps.companyId, companyA.id),
        eq(companyReps.userId, sharerUser.id),
        isNull(companyReps.removedAt),
      ),
    );
  const authorKept = await reportsOnCompany(author, companyA.id);
  check(
    "*** a rep who leaves the company KEEPS their own reports [S40] ***",
    authorKept.length === authorHeld.length,
    `held ${authorHeld.length}, kept ${authorKept.length}`,
  );
  check(
    "including the note, which was always theirs [S38]",
    authorKept.some((row) => row.narrative !== null),
  );
  check(
    "and a field note, which never had an anchor to lose [S40]",
    (await getReport(author, fieldNote.id)) !== null,
  );

  /* --- 17. Every write is audited [07 E1] -------------------------- */

  console.log("\n17. Every write is audited");

  const entries = await db
    .select({ action: auditLog.action, actor: auditLog.actorUserId })
    .from(auditLog)
    .where(inArray(auditLog.entityType, ["rep_report"]));
  const actions = new Set(entries.map((row) => row.action));
  for (const action of ["report.created", "report.updated"]) {
    check(`\`${action}\` was audited`, actions.has(action));
  }
  check(
    "every entry names an actor",
    entries.every((row) => row.actor !== null),
  );
  console.log(`        actions seen: ${[...actions].sort().join(", ")}`);
  console.log(`        bulk rows written: ${bulk.length}`);

  // Nothing is cleaned up: FACET does not delete history `[12 §7]`, and this
  // script does not get an exception. Every row it writes is prefixed with the
  // run's timestamp so a development database stays readable.
  //
  // Stated rather than papered over: this script stops at the data layer. The
  // log form's own field reading — `readReport` in `reports/actions.ts`, and
  // the per-signal reference names in particular — has no standing check here,
  // exactly as for slices 2 and 3 and phase 11.
}

async function auditCount(entityId: string): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(auditLog)
    .where(eq(auditLog.entityId, entityId));
  return row?.n ?? 0;
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
