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

import { and, eq, inArray, sql } from "drizzle-orm";

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
import { coverage, coverageRepOptions, daysBetween } from "@/lib/coverage";
import {
  dailyActivity,
  dailyActivityEntries,
  yesterday,
} from "@/lib/daily-activity";
import { REPORT_OUTCOMES, SAUDI_CODE } from "@/lib/enums";
import { listCountries } from "@/lib/lookups";
import {
  companyOnHoldUntil,
  createReport,
  getReport,
  listReports,
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
  TIMELINE_CARD_LIMIT,
} from "@/lib/timeline";

import { addDispatchLine } from "./dispatch-fixture";
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

async function main(): Promise<void> {
  if (process.env.NODE_ENV !== "development") {
    console.error(
      "verify-phase9 refuses to run outside development.\n" +
        `  NODE_ENV is ${process.env.NODE_ENV ?? "unset"}, and must be "development".`,
    );
    process.exit(1);
  }

  const stamp = `verify9-${Date.now()}`;
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
      nameNormalized: `${stamp}-a`,
      phone: nextPhone(),
      countryId: saudiId,
      createdBy: authorUser.id,
    })
    .returning();
  const [companyB] = await db
    .insert(companies)
    .values({
      name: `${stamp} Company B`,
      nameNormalized: `${stamp}-b`,
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
      nameNormalized: `${stamp}-quiet`,
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
      nameNormalized: `${stamp}-never`,
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
      nameNormalized: `${stamp}-contact-a`,
      createdBy: authorUser.id,
    })
    .returning();
  const [contactB] = await db
    .insert(contacts)
    .values({
      companyId: companyB.id,
      name: `${stamp} Contact B`,
      nameNormalized: `${stamp}-contact-b`,
      createdBy: authorUser.id,
    })
    .returning();

  const [projectA] = await db
    .insert(projects)
    .values({
      nameEn: `${stamp} Project A`,
      nameNormalized: `${stamp}-project-a`,
      ownerUserId: authorUser.id,
      createdBy: authorUser.id,
    })
    .returning();
  // Linked to no company: `projectNotOnCompany` needs one to refuse over.
  const [projectLoose] = await db
    .insert(projects)
    .values({
      nameEn: `${stamp} Project Loose`,
      nameNormalized: `${stamp}-project-loose`,
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
      paymentConfirmedByUserId: authorUser.id,
      paymentConfirmedAt: new Date(),
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
  const repCoverage = await coverage(author);
  check(
    "coverage refuses a rep NOTHING — it scopes [20 §7]",
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
    !(await listReports(author, { outcome: "discussed_pricing" })).rows.some(
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
  const coverageRows = await coverage(manager, { q: stamp });
  const rowB = coverageRows.rows.find((row) => row.companyId === companyB.id);
  const rowA = coverageRows.rows.find((row) => row.companyId === companyA.id);
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

  check(
    "no suppression before anything says so",
    (await companyOnHoldUntil(author, companyB.id)) === null,
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
    (await companyOnHoldUntil(author, companyB.id)) === daysAgo(-30),
  );
  check(
    "and coverage does not call it quiet",
    (await coverage(manager, { q: stamp })).rows.find(
      (row) => row.companyId === companyB.id,
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
    (await companyOnHoldUntil(author, companyB.id)) === null,
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
    "payment_confirmed",
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

  // A company nobody has ever logged against is quiet from birth: it is
  // exactly the one that needs the conversation.
  const quietRow = (await coverage(manager, { q: stamp })).rows.find(
    (row) => row.companyId === companyNever.id,
  );
  check(
    "a company logged against reads back its last interaction, not null",
    (await coverage(manager, { q: stamp })).rows.find(
      (row) => row.companyId === companyA.id,
    )?.lastInteractionOn === daysAgo(1),
    `got ${
      (await coverage(manager, { q: stamp })).rows.find(
        (row) => row.companyId === companyA.id,
      )?.lastInteractionOn
    }`,
  );
  check(
    "a company never logged against has no last interaction, and is quiet",
    quietRow?.lastInteractionOn === null && quietRow?.isQuiet === true,
    `last=${quietRow?.lastInteractionOn} quiet=${quietRow?.isQuiet}`,
  );

  // Age company B's only interaction past each threshold in turn.
  await db
    .update(repReports)
    .set({ reportDate: daysAgo(31) })
    .where(eq(repReports.companyId, companyB.id));
  const at31 = (await coverage(manager, { q: stamp })).rows.find(
    (row) => row.companyId === companyB.id,
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
    (await coverage(manager, { q: stamp })).rows.find(
      (row) => row.companyId === companyB.id,
    )?.isQuiet === true,
  );
  // Company A is qualified, so 31 days is already past ITS threshold.
  await db
    .update(repReports)
    .set({ reportDate: daysAgo(31) })
    .where(eq(repReports.companyId, companyA.id));
  const qualifiedAt31 = (await coverage(manager, { q: stamp })).rows.find(
    (row) => row.companyId === companyA.id,
  );
  check(
    "a QUALIFIED company is quiet at 31 days — 30 is its threshold [07 D5]",
    qualifiedAt31?.isQuiet === true && qualifiedAt31?.thresholdDays === 30,
    `quiet=${qualifiedAt31?.isQuiet} threshold=${qualifiedAt31?.thresholdDays}`,
  );
  check(
    "days since is whole calendar days, not an instant",
    daysBetween(daysAgo(31), today()) === 31,
    `got ${daysBetween(daysAgo(31), today())}`,
  );
  check(
    "nothing was written by asking — coverage is a diagnostic [07 D6]",
    (await auditCount(companyA.id)) === 0,
  );

  /* --- 12. Coverage is scoped, not gated [20 §7] ------------------- */

  console.log("\n12. Coverage is scoped in both directions");

  const mine = [companyA.id, companyB.id, companyQuiet.id, companyNever.id];
  const authorSees = await coverage(author, { q: stamp });
  check(
    "a rep sees exactly their own companies",
    authorSees.rows.length === mine.length &&
      authorSees.rows.every((row) => mine.includes(row.companyId)),
    `got ${authorSees.rows.length}`,
  );
  const sharerSees = await coverage(sharer, { q: stamp });
  check(
    "a rep who holds one company through a share sees exactly that one",
    sharerSees.rows.length === 1 &&
      sharerSees.rows[0].companyId === companyA.id,
    `got ${sharerSees.rows.length}`,
  );
  check(
    "a rep unconnected to any of them sees none",
    (await coverage(stranger, { q: stamp })).rows.length === 0,
  );
  check(
    "`sees_all_reps` sees all of them",
    (await coverage(manager, { q: stamp })).rows.length === mine.length,
    `got ${(await coverage(manager, { q: stamp })).rows.length}`,
  );
  check(
    "and can narrow to one rep with ?rep=",
    (await coverage(manager, { q: stamp, userId: sharerUser.id })).rows
      .length === 1,
  );
  check(
    "the rep filter offers a manager everyone and a rep only themselves",
    (await coverageRepOptions(manager)).length > 1 &&
      (await coverageRepOptions(author)).length === 1,
  );

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
  const expanded = await dailyActivityEntries(manager, authorUser.id, range);
  check(
    "expanding a rep returns the same entries the timeline would",
    expanded.every((event) => event.actorUserId === authorUser.id) &&
      expanded.some((event) => event.key === `report:${fieldNote.id}`),
  );
  check(
    "yesterday is the default range and is a calendar day",
    /^\d{4}-\d{2}-\d{2}$/.test(yesterday()) &&
      daysBetween(yesterday(), today()) === 1,
    `got ${yesterday()}`,
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
  const paid = chain.find((event) => event.kind === "payment_confirmed");
  check(
    "payment counts for the rep who ticked it [07 C3]",
    paid?.actorUserId === authorUser.id,
    `got ${paid?.actorUserId}`,
  );

  /* --- 15. Visibility in both directions [20 §10], [20 §8.2] ------- */

  console.log("\n15. Visibility follows the anchor, and the negative half matters most");

  const sharerReports = await listReports(sharer, {});
  check(
    "a rep sharing the company sees a company-level report on it",
    sharerReports.rows.some((row) => row.id === misfiled.id) === false &&
      sharerReports.rows.some((row) => row.companyId === companyA.id),
  );
  check(
    "*** but NOT the one naming a project they cannot open [04 Q7], [20 §10] ***",
    !sharerReports.rows.some((row) => row.id === reportA.id),
    `saw ${sharerReports.rows.filter((row) => row.id === reportA.id).length}`,
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
      (await listReports(stranger, {})).rows.length === 0,
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
    (await listReports(sharer, { companyId: companyA.id })).rows.find(
      (row) => row.id === noted.id,
    )?.narrative === null &&
      (await listReports(author, { companyId: companyA.id })).rows.find(
        (row) => row.id === noted.id,
      )?.narrative !== null,
  );

  /* The SEARCH path `[S38]`, which is the subtler of the two and the one a
     later "simplification" would silently reopen once the column is already
     withheld: `/reports` `ilike`s the narrative, so an open search hands over
     the note's contents by inference without ever rendering a word of it. */

  const authorSearch = await listReports(author, { q: noteToken });
  const managerSearch = await listReports(manager, { q: noteToken });
  const sharerSearch = await listReports(sharer, { q: noteToken });

  check(
    "the author searching a word of their own note finds it [S38]",
    authorSearch.rows.length === 1 && authorSearch.rows[0].id === noted.id,
    `got ${authorSearch.rows.length}`,
  );
  check(
    "anyone who sees all reps searching the same word finds it [S38]",
    managerSearch.rows.some((row) => row.id === noted.id),
  );
  check(
    "*** and the shared rep searching it gets NOTHING [S38] ***",
    sharerSearch.rows.length === 0,
    `got ${sharerSearch.rows.length}`,
  );
  check(
    "*** and that zero is the SEARCH being gated, not the row being hidden — the same rep sees it by company ***",
    (await listReports(sharer, { companyId: companyA.id })).rows.some(
      (row) => row.id === noted.id,
    ),
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
    (await listReports(silent, {})).rows.some(
      (row) => row.companyId === companyA.id,
    ),
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
    !(await listReports(silent, {})).rows.some(
      (row) => row.companyId === companyA.id,
    ),
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
  const authorHeld = await listReports(author, { companyId: companyA.id });
  check(
    "before: the author sees their own reports on company A",
    authorHeld.rows.length > 0,
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
  const authorKept = await listReports(author, { companyId: companyA.id });
  check(
    "*** a rep who leaves the company KEEPS their own reports [S40] ***",
    authorKept.rows.length === authorHeld.rows.length,
    `held ${authorHeld.rows.length}, kept ${authorKept.rows.length}`,
  );
  check(
    "including the note, which was always theirs [S38]",
    authorKept.rows.some((row) => row.narrative !== null),
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
