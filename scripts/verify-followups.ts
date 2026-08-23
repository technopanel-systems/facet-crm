/**
 * Feature slice 4 — the manual follow-up date `[25 §18]` and the fifth
 * follow-up kind `[22 §6.11]`, driven in process against `src/lib`.
 *
 * Sixteen sections. The two central claims, in the order the brief put them:
 *
 *  - **The override suppresses every kind, and stops suppressing the next
 *    day** — §6 and §7. A date on each of the three anchor types silences the
 *    kinds anchored there, and the boundary is `tomorrow` suppressing while
 *    `today` does not, because the day it arrives is the day it becomes the
 *    follow-up rather than the day it stops hiding one.
 *  - **The fifth kind fires and clears on resubmission** — §3 and §4. It
 *    clears on the rep touching the lines, driven through the real
 *    `updateQuotationLine`, and §5 adds the two status routes.
 *
 * And three that are easy to get wrong and impossible to see:
 *
 *  - **§8: an arrived date PRODUCES.** A record with a date and no threshold
 *    met still raises a row. This is the assertion that fails if the override
 *    is ever rebuilt as a suppressor that merely stops suppressing.
 *  - **§14: a deferred date says so, and names the right company.** The panel
 *    resolves a project's company through `firstCompanyByName`, the same way
 *    `gather` does; a second resolution would name one company while another
 *    did the suppressing, which is the trap `21 §7` names.
 *  - **§11: none of it stores anything.** No `notifications` row — `21 §1`,
 *    restated with six kinds. (`tasks` itself is gone since feature slice 6
 *    `[26 §6]`; there is no table left to prove writes nothing to.)
 *
 * Usage: `npm run verify:followups`.
 *
 * That needs `NODE_ENV=development` in `.env`. `--env-file` is not optional
 * and cannot be replaced by the `process.loadEnvFile` call below: this script
 * reaches `@/lib/authz`, and `src/auth/index.ts` reads `AUTH_SECRET` at module
 * scope — before any statement in this file runs.
 *
 * **It refuses to run outside development** `[15 §7]`: it writes real rows.
 *
 * It needs a seeded database — `npm run db:seed`, which since this slice also
 * writes the sixth threshold — and the fixture accounts:
 * `DEV_FIXTURE_PASSWORD=… npm run dev:fixtures`.
 *
 * **It creates its own reps.** Every assertion is made as a run-scoped rep who
 * holds exactly the records this run made, so the visibility filters do the
 * isolation and a second run cannot see the first one's rows — the trap
 * `verify:slice3` hit and `verify:phase9` inherited. The seeded coordinator and
 * manager are used only to ACT, never to assert.
 *
 * **The clock is never faked.** `today()` reads the real one and no function
 * under test takes a date, so every boundary is pinned by dating the ROWS
 * relative to `today()` — `verify:phase10a` §7's idiom.
 *
 * **Nothing is cleaned up** `[12 §7]`. Every row this writes carries the run
 * stamp so a development database stays readable.
 */

process.loadEnvFile(".env");

import { and, desc, eq, sql } from "drizzle-orm";

import { closeDatabase, db } from "@/db";
import {
  auditLog,
  companies,
  companyReps,
  notifications,
  projectCompanies,
  projects,
  quotationLines,
  quotationVersions,
  repReports,
  roles,
  settings,
  users,
  productClasses,
  productFireRatings,
  productSuppliers,
  productThicknesses,
} from "@/db/schema";
import {
  createUser,
  scopeForUser,
  type AuthSession,
  type Role,
  type User,
} from "@/lib/authz";
import { FOLLOW_UP_KINDS, SAUDI_CODE, type FollowUpKind } from "@/lib/enums";
import {
  followUps,
  followUpsForRecipient,
  nextFollowUpContext,
  setNextFollowUp,
} from "@/lib/follow-ups";
import { listCountries } from "@/lib/lookups";
import {
  createQuotationThread,
  createRevision,
  issueVersion,
  returnForEdit,
  updateQuotationLine,
} from "@/lib/quotations";
import { createReport, today } from "@/lib/reports";
import {
  QUOTATION_RETURNED_DEFAULT,
  QUOTATION_RETURNED_KEY,
  getFollowUpThresholds,
} from "@/lib/settings";
import { shiftDays, shiftWorkingDays } from "@/lib/working-days";

/* ------------------------------------------------------------------ *
 * Harness — `verify-phase10a.ts`'s, unchanged
 * ------------------------------------------------------------------ */

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

/** Assert that `fn` is ALLOWED — the negative claim matters as much. */
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

/** Which anchors are firing for this identity right now, for one kind. */
async function firing(
  session: AuthSession,
  kind: FollowUpKind,
): Promise<Set<string>> {
  const { rows } = await followUps(session, { kind });
  return new Set(rows.map((row) => row.anchorId));
}

/** Every kind currently firing on one anchor, for the supersession checks. */
async function kindsOn(
  session: AuthSession,
  anchorId: string,
): Promise<Set<FollowUpKind>> {
  const { rows } = await followUps(session);
  return new Set(
    rows.filter((row) => row.anchorId === anchorId).map((row) => row.kind),
  );
}

async function main(): Promise<void> {
  if (process.env.NODE_ENV !== "development") {
    console.error(
      "verify-followups refuses to run outside development.\n" +
        `  NODE_ENV is ${process.env.NODE_ENV ?? "unset"}, and must be "development".`,
    );
    process.exit(1);
  }

  const stamp = `verifyfu-${Date.now()}`;
  const manager = await sessionFor("manager@example.test");
  const coordinator = await sessionFor("coordinator@example.test");

  const seededRoles = await db.select().from(roles);
  const repRole = new Map(
    seededRoles.map((role) => [role.nameEn, role]),
  ).get("Sales Rep");
  if (!repRole || seededRoles.length < 7) {
    console.error("Roles are not seeded. Run: npm run db:seed");
    process.exit(1);
  }

  const [supplier] = await db
    .select()
    .from(productSuppliers)
    .where(eq(productSuppliers.code, "N"))
    .limit(1);
  const [productClass] = await db.select().from(productClasses).limit(1);
  const [fireRating] = await db.select().from(productFireRatings).limit(1);
  const [thickness] = await db
    .select()
    .from(productThicknesses)
    .where(eq(productThicknesses.isStandard, true))
    .limit(1);
  if (!supplier || !productClass || !fireRating || !thickness) {
    console.error("The lookups are not seeded. Run: npm run db:seed");
    process.exit(1);
  }

  const thresholds = await getFollowUpThresholds();

  /* --- 1. The seed and the enum [07 D5], [22 §6.11] ------------------ */

  console.log("\n1. Six thresholds, six kinds");

  const thresholdKeys = await db
    .select({ key: settings.key })
    .from(settings)
    .where(sql`${settings.key} like 'followup.%'`);

  check(
    "the returned-quotation threshold is seeded [22 §6.11]",
    thresholdKeys.some((row) => row.key === QUOTATION_RETURNED_KEY),
    `got ${thresholdKeys.map((row) => row.key).join(", ")}`,
  );
  check(
    `its default is ${QUOTATION_RETURNED_DEFAULT} working days, borrowed from 07 D5's quotation row`,
    thresholds.quotationReturned === QUOTATION_RETURNED_DEFAULT,
    `got ${thresholds.quotationReturned}`,
  );
  check(
    "FOLLOW_UP_KINDS carries both new kinds and nothing else changed",
    FOLLOW_UP_KINDS.length === 6 &&
      FOLLOW_UP_KINDS.includes("quotation_returned") &&
      FOLLOW_UP_KINDS.includes("date_due"),
    `got ${FOLLOW_UP_KINDS.join(", ")}`,
  );

  /* --- Fixtures ------------------------------------------------------ */

  console.log("\n   fixtures: run-scoped reps, companies, projects, threads");

  const password = `${stamp}-secret`;
  const ownerUser = await createUser(manager, {
    name: `${stamp} Owner`,
    email: `${stamp}-owner@example.test`,
    roleId: repRole.id,
    password,
  });
  const strangerUser = await createUser(manager, {
    name: `${stamp} Stranger`,
    email: `${stamp}-stranger@example.test`,
    roleId: repRole.id,
    password,
  });
  const asSession = (user: User, role: Role): AuthSession => {
    const withRole = { ...user, role };
    return {
      user: withRole,
      realUser: withRole,
      isImpersonating: false,
      actor: { actorUserId: user.id, actingAsUserId: null },
    };
  };
  const owner = asSession(ownerUser, repRole);
  const stranger = asSession(strangerUser, repRole);

  function instantDaysAgo(days: number): Date {
    return new Date(Date.now() - days * 86_400_000);
  }

  // `S13` makes the phone mandatory and `S23` matches companies on it, so every
  // fixture gets its own — from the run stamp plus a counter, because a shared
  // literal would make each run's companies duplicates of the last run's.
  // `S14` — all of them are Saudi, so `S15`'s city and region still apply.
  const saudiId = (await listCountries()).find(
    (row) => row.code === SAUDI_CODE,
  )!.id;
  let phoneSeq = 0;

  /** A company held by the owner, created `ageDays` ago. */
  async function makeCompany(slug: string, ageDays: number) {
    phoneSeq += 1;
    const [company] = await db
      .insert(companies)
      .values({
        name: `${stamp} ${slug}`,
        nameNormalized: `${stamp}-${slug}`,
        phone: `+9665${stamp.slice(-7)}${phoneSeq}`,
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

  /** A project owned by the owner, with one company linked as the buyer. */
  async function makeProject(slug: string, companyId: string, ageDays: number) {
    const [project] = await db
      .insert(projects)
      .values({
        nameEn: `${stamp} ${slug}`,
        nameNormalized: `${stamp}-${slug}`,
        ownerUserId: ownerUser.id,
        createdBy: ownerUser.id,
        createdAt: instantDaysAgo(ageDays),
      })
      .returning();
    await db
      .insert(projectCompanies)
      .values({ projectId: project.id, companyId });
    return project;
  }

  /** A real thread with one real line, raised by the owner. */
  async function makeThread(project: { id: string }, companyId: string) {
    return createQuotationThread(
      owner,
      { projectId: project.id, companyId, contactId: null },
      {
        stock: "riyadh",
      },
      [
        {
          supplierId: supplier.id,
          classId: productClass.id,
          fireRatingId: fireRating.id,
          customColour: "168",
          thicknessId: thickness.id,
          widthM: "1.2400",
          lengthM: "5.8000",
          quantityPcs: "12.0000",
          unitPrice: "120.00",
        },
      ],
      [],
    );
  }

  /**
   * Return a thread for edits **for real**, then move the clock back so the
   * return sits exactly `workingDays` working days ago.
   *
   * The act, the counter, the comment and the audit action are all the
   * production path's — only the moment is moved, because `today()` cannot be
   * faked and the threshold is expressed in working days from it.
   *
   * **The line rows have to move too, and that is not a convenience.** The
   * condition is *"no line edit since the return"*, and `createQuotationThread`
   * writes its `quotation_line.added` entries at the real `now()`. Backdating
   * only the return would leave every fixture looking like a rep who had
   * already resubmitted — which is exactly what the real sequence is not: the
   * lines are written, and *then* the coordinator sends them back. So they are
   * dated a day before it. (This is the fixture bug §2's "before" assertions
   * caught: without them, §4's and §6's clears passed against nothing.)
   */
  async function returnedWorkingDaysAgo(threadId: string, workingDays: number) {
    await returnForEdit(coordinator, threadId, `${stamp} fix the quantity`);
    const [version] = await db
      .select({ id: quotationVersions.id })
      .from(quotationVersions)
      .where(eq(quotationVersions.threadId, threadId))
      .orderBy(desc(quotationVersions.versionNumber))
      .limit(1);

    const day = shiftWorkingDays(today(), workingDays);

    // The lines first: written before the return, as they always are.
    await db
      .update(auditLog)
      .set({ createdAt: new Date(`${shiftDays(day, -1)}T09:00:00Z`) })
      .where(
        sql`(${auditLog.action} like 'quotation_line.%'
              or ${auditLog.action} like 'quotation_service_line.%')
            and coalesce(
              ${auditLog.after} ->> 'versionId',
              ${auditLog.before} ->> 'versionId'
            ) = ${version.id}::text`,
      );

    await db
      .update(auditLog)
      .set({ createdAt: new Date(`${day}T09:00:00Z`) })
      .where(
        and(
          eq(auditLog.action, "quotation_version.returned_for_edit"),
          eq(auditLog.entityId, version.id),
        ),
      );
    return version.id;
  }

  /** The company behind every returned-quotation fixture. */
  const returnCompany = await makeCompany("return-co", 5);
  const returnProject = await makeProject("return-pr", returnCompany.id, 5);

  const returnedOver = await makeThread(returnProject, returnCompany.id);
  const returnedUnder = await makeThread(returnProject, returnCompany.id);
  const returnedIssue = await makeThread(returnProject, returnCompany.id);
  const returnedRevise = await makeThread(returnProject, returnCompany.id);

  const overVersionId = await returnedWorkingDaysAgo(
    returnedOver.id,
    thresholds.quotationReturned,
  );
  await returnedWorkingDaysAgo(
    returnedUnder.id,
    thresholds.quotationReturned - 1,
  );
  await returnedWorkingDaysAgo(
    returnedIssue.id,
    thresholds.quotationReturned,
  );
  await returnedWorkingDaysAgo(
    returnedRevise.id,
    thresholds.quotationReturned,
  );

  /* --- 2. The fifth kind exists at all ------------------------------- */

  console.log("\n2. A returned quotation reaches the queue at all [22 §6.11]");

  const returned = await firing(owner, "quotation_returned");
  check(
    "*** a returned quotation is IN the queue — 22 §6.11's gap is closed ***",
    returned.has(returnedOver.id),
  );
  check(
    "and it is anchored to the thread, not the company or the project",
    (await followUps(owner, { kind: "quotation_returned" })).rows.every(
      (row) => row.anchorType === "quotation_thread",
    ),
  );

  /* --- 3. At its threshold, and not a day early [07 D5] -------------- */

  console.log("\n3. It fires at its threshold and not a working day early");

  check(
    `a return ${thresholds.quotationReturned} working days old fires`,
    returned.has(returnedOver.id),
  );
  check(
    `one ${thresholds.quotationReturned - 1} working days old does not`,
    !returned.has(returnedUnder.id),
  );

  // The boundary is data, not code: move the settings row and it moves.
  await db
    .update(settings)
    .set({ value: thresholds.quotationReturned - 1 })
    .where(eq(settings.key, QUOTATION_RETURNED_KEY));
  const loosened = await firing(owner, "quotation_returned");
  check(
    "lowering the settings row brings the younger one in [07 D5]",
    loosened.has(returnedUnder.id),
  );
  await db
    .update(settings)
    .set({ value: thresholds.quotationReturned })
    .where(eq(settings.key, QUOTATION_RETURNED_KEY));
  check(
    "and restoring it puts the boundary back",
    !(await firing(owner, "quotation_returned")).has(returnedUnder.id),
  );

  /* --- 4. It clears on resubmission ---------------------------------- */

  console.log("\n4. *** It clears when the rep edits a line ***");

  const [line] = await db
    .select({ id: quotationLines.id })
    .from(quotationLines)
    .where(eq(quotationLines.versionId, overVersionId))
    .limit(1);
  check("the fixture thread has a line to edit", Boolean(line));

  await updateQuotationLine(owner, returnedOver.id, line.id, {
    supplierId: supplier.id,
    classId: productClass.id,
    fireRatingId: fireRating.id,
    customColour: "168",
    thicknessId: thickness.id,
    widthM: "1.2400",
    lengthM: "5.8000",
    // The fix: the quantity the coordinator asked about.
    quantityPcs: "14.0000",
    unitPrice: "120.00",
  });

  check(
    "*** the rep edits a line and the follow-up is gone — 22 §4's whose-move-it-is ***",
    !(await firing(owner, "quotation_returned")).has(returnedOver.id),
  );
  check(
    "the version is still `requested` — the status did not move, the turn did",
    (
      await db
        .select({ status: quotationVersions.status })
        .from(quotationVersions)
        .where(eq(quotationVersions.id, overVersionId))
        .limit(1)
    )[0]?.status === "requested",
  );
  check(
    "and the round counter is untouched — nothing was decremented [12 §7]",
    (
      await db
        .select({ round: quotationVersions.returnForEditRound })
        .from(quotationVersions)
        .where(eq(quotationVersions.id, overVersionId))
        .limit(1)
    )[0]?.round === 1,
  );

  /* --- 5. The two status routes out --------------------------------- */

  console.log("\n5. It also clears when the version leaves `requested`");

  check(
    "the issue fixture is firing before the coordinator acts",
    (await firing(owner, "quotation_returned")).has(returnedIssue.id),
  );
  await issueVersion(coordinator, returnedIssue.id, {
    smacReference: `9${Date.now().toString().slice(-4)}`,
    verification: "unverified",
  });
  check(
    "issuing it clears the follow-up",
    !(await firing(owner, "quotation_returned")).has(returnedIssue.id),
  );

  check(
    "the revision fixture is firing before the rep acts",
    (await firing(owner, "quotation_returned")).has(returnedRevise.id),
  );
  await createRevision(owner, returnedRevise.id, "rep_change_request");
  check(
    "a revision supersedes the returned version and clears it",
    !(await firing(owner, "quotation_returned")).has(returnedRevise.id),
  );

  /* --- 6. The override suppresses every kind [25 §18] ---------------- */

  console.log("\n6. *** A next follow-up date suppresses every kind ***");

  const tomorrow = shiftDays(today(), 1);

  // One anchor per kind, each already firing before the date is set.
  const quietCompany = await makeCompany("quiet", thresholds.unqualified + 1);
  const catalogueCompany = await makeCompany("catalogue", 5);
  await db.insert(repReports).values({
    userId: ownerUser.id,
    entryType: "interaction",
    companyId: catalogueCompany.id,
    channel: "email",
    outcome: "catalogue_sent",
    narrative: `${stamp} catalogue`,
    reportDate: shiftWorkingDays(today(), thresholds.catalogueNoResponse),
  });

  // Deliberately quiet as well as holding a stale project: §6's last pair
  // needs a company with a kind of its own, to prove the record-level
  // suppression does NOT reach it.
  const stageCompany = await makeCompany("stage-co", thresholds.unqualified + 1);
  const stageProject = await makeProject(
    "stage",
    stageCompany.id,
    thresholds.projectStageUnchanged + 1,
  );

  const returnedHeldCompany = await makeCompany("returned-held-co", 5);
  const returnedHeldProject = await makeProject(
    "returned-held",
    returnedHeldCompany.id,
    5,
  );
  const returnedHeld = await makeThread(
    returnedHeldProject,
    returnedHeldCompany.id,
  );
  await returnedWorkingDaysAgo(returnedHeld.id, thresholds.quotationReturned);

  check(
    "before: the quiet company is firing",
    (await firing(owner, "company_quiet")).has(quietCompany.id),
  );
  check(
    "before: the catalogue company is firing",
    (await firing(owner, "catalogue_no_response")).has(catalogueCompany.id),
  );
  check(
    "before: the stale project is firing",
    (await firing(owner, "project_stage_unchanged")).has(stageProject.id),
  );
  check(
    "before: the returned thread is firing",
    (await firing(owner, "quotation_returned")).has(returnedHeld.id),
  );

  await setNextFollowUp(owner, "company", quietCompany.id, tomorrow);
  await setNextFollowUp(owner, "company", catalogueCompany.id, tomorrow);
  await setNextFollowUp(owner, "project", stageProject.id, tomorrow);
  await setNextFollowUp(owner, "quotation_thread", returnedHeld.id, tomorrow);

  check(
    "*** company_quiet is suppressed by a date on its company ***",
    !(await firing(owner, "company_quiet")).has(quietCompany.id),
  );
  check(
    "*** catalogue_no_response is suppressed by a date on its company ***",
    !(await firing(owner, "catalogue_no_response")).has(catalogueCompany.id),
  );
  check(
    "*** project_stage_unchanged is suppressed by a date on its project ***",
    !(await firing(owner, "project_stage_unchanged")).has(stageProject.id),
  );
  check(
    "*** quotation_returned is suppressed by a date on its thread ***",
    !(await firing(owner, "quotation_returned")).has(returnedHeld.id),
  );

  // The reach is the RECORD, not the customer. `stage-co` is quiet in its own
  // right AND holds the stale project; the date went on the project only, so
  // the project must be silent and the company must not be. Without this the
  // override could be cascading like `on hold` and every assertion above would
  // still pass.
  check(
    "*** a date on the project does NOT silence its company's own chase ***",
    (await firing(owner, "company_quiet")).has(stageCompany.id),
    "the record-level suppression has cascaded to the customer",
  );

  /* --- 7. It stops suppressing the day it arrives -------------------- */

  console.log("\n7. *** And it stops suppressing when the date arrives ***");

  check(
    "tomorrow suppresses",
    !(await firing(owner, "company_quiet")).has(quietCompany.id),
  );

  await setNextFollowUp(owner, "company", quietCompany.id, today());
  check(
    "*** today does NOT suppress — the day it arrives is the day it counts ***",
    (await firing(owner, "date_due")).has(quietCompany.id),
  );

  // A past date cannot be WRITTEN — §12 proves the refusal — but time makes
  // one: a date set for next week is in the past a fortnight later. So the
  // reader has to handle it, and this is the only way to put one there.
  await db
    .update(companies)
    .set({ nextFollowUpAt: shiftDays(today(), -1) })
    .where(eq(companies.id, quietCompany.id));
  check(
    "yesterday does not suppress either",
    (await firing(owner, "date_due")).has(quietCompany.id),
  );

  /* --- 8. An arrived date PRODUCES [25 §18] -------------------------- */

  console.log("\n8. *** An arrived date raises a row of its own ***");

  // Created today, never logged against, no quotation: not quiet, not stale,
  // nothing automatic to un-suppress. The only thing that can raise it is the
  // date itself.
  const silentCompany = await makeCompany("silent", 0);
  check(
    "before: it raises nothing at all",
    (await followUps(owner)).rows.every(
      (row) => row.anchorId !== silentCompany.id,
    ),
  );

  await setNextFollowUp(owner, "company", silentCompany.id, today());
  const produced = await kindsOn(owner, silentCompany.id);
  check(
    "*** it now raises date_due, with no automatic condition met ***",
    produced.has("date_due"),
    `got ${[...produced].join(", ") || "nothing"}`,
  );
  check(
    "and that is the ONLY thing it raises",
    produced.size === 1,
    `got ${[...produced].join(", ")}`,
  );

  const dueRow = (await followUps(owner, { kind: "date_due" })).rows.find(
    (row) => row.anchorId === silentCompany.id,
  );
  check(
    "its clock starts at the rep's date, so it is nought days old today",
    dueRow?.since === today() && dueRow?.ageDays === 0,
    `got since=${dueRow?.since} age=${dueRow?.ageDays}`,
  );
  check(
    "and it carries no threshold — the date IS the condition",
    dueRow?.thresholdDays === 0,
    `got ${dueRow?.thresholdDays}`,
  );

  /* --- 9. It supersedes the automatic kinds on its anchor ------------ */

  console.log("\n9. *** An arrived date becomes THE follow-up, not a second ***");

  const supersededCompany = await makeCompany(
    "superseded",
    thresholds.unqualified + 1,
  );
  check(
    "before: it is firing company_quiet",
    (await kindsOn(owner, supersededCompany.id)).has("company_quiet"),
  );

  await setNextFollowUp(owner, "company", supersededCompany.id, today());
  const afterDate = await kindsOn(owner, supersededCompany.id);
  check(
    "*** the automatic kind is gone and date_due stands in its place ***",
    afterDate.has("date_due") && !afterDate.has("company_quiet"),
    `got ${[...afterDate].join(", ")}`,
  );
  check(
    "exactly one row for the record — 25 §18's THE follow-up",
    afterDate.size === 1,
    `got ${afterDate.size}`,
  );

  /* --- 10. On hold still wins [20 §5] -------------------------------- */

  console.log("\n10. The customer's hold still beats the record's date");

  const heldCompany = await makeCompany("held", 5);
  await createReport(owner, {
    entryType: "interaction",
    companyId: heldCompany.id,
    contactId: null,
    projectId: null,
    channel: "call",
    outcome: "on_hold",
    category: null,
    cityId: null,
    narrative: `${stamp} come back after Ramadan`,
    onHoldUntil: shiftDays(today(), 30),
    reportDate: today(),
    signals: [],
  });
  await setNextFollowUp(owner, "company", heldCompany.id, today());

  check(
    "an arrived date on an on-hold company raises nothing [20 §5]",
    (await kindsOn(owner, heldCompany.id)).size === 0,
  );

  /* --- 11. None of it stores anything [21 §1] ------------------------ */

  console.log("\n11. *** Six kinds, and still nothing is stored ***");

  const notificationsBefore = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(notifications);
  await followUps(owner);
  await followUpsForRecipient(owner);
  const notificationsAfter = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(notifications);

  check(
    "*** computing follow-ups wrote no notification row [21 §1] ***",
    notificationsBefore[0]?.n === notificationsAfter[0]?.n,
    `${notificationsBefore[0]?.n} then ${notificationsAfter[0]?.n}`,
  );

  // `tasks` itself is gone — `25 §20` withdrawn, feature slice 6 `[26 §6]` —
  // so the claim this section once proved (FACET never writes a SYSTEM task)
  // is proved by the table's absence, asserted once in `verify:schema25`.

  /* --- 12. The writer's gates [25 §18] ------------------------------- */

  console.log("\n12. Who may set a date, and what may be set");

  await refuses(
    "a rep who cannot see the company may not set a date on it",
    "followUps.errors.notYours",
    () => setNextFollowUp(stranger, "company", silentCompany.id, tomorrow),
  );
  await refuses(
    "a rep who cannot see the thread may not set a date on it",
    "followUps.errors.notYours",
    () =>
      setNextFollowUp(stranger, "quotation_thread", returnedHeld.id, tomorrow),
  );
  await refuses(
    "a date in the past is refused",
    "followUps.errors.pastDate",
    () =>
      setNextFollowUp(
        owner,
        "company",
        silentCompany.id,
        shiftDays(today(), -1),
      ),
  );
  await allows("today is not the past", () =>
    setNextFollowUp(owner, "company", silentCompany.id, today()),
  );

  const clearTarget = await makeCompany("clearable", 5);
  await setNextFollowUp(owner, "company", clearTarget.id, tomorrow);
  await allows("clearing it is allowed", () =>
    setNextFollowUp(owner, "company", clearTarget.id, null),
  );
  check(
    "and the column really is null again, so 07 D5's thresholds apply",
    (
      await db
        .select({ at: companies.nextFollowUpAt })
        .from(companies)
        .where(eq(companies.id, clearTarget.id))
        .limit(1)
    )[0]?.at === null,
  );

  const writes = await db
    .select({ action: auditLog.action })
    .from(auditLog)
    .where(
      and(
        eq(auditLog.entityId, clearTarget.id),
        eq(auditLog.action, "company.next_follow_up_set"),
      ),
    );
  check(
    "both the set and the clear are audited [07 E1]",
    writes.length === 2,
    `got ${writes.length}`,
  );

  /* --- 13. The overwrite is visible ---------------------------------- */

  console.log("\n13. *** One column, two people, and the second one is named ***");

  const sharedDate = await makeCompany("shared-date", 5);
  await setNextFollowUp(owner, "company", sharedDate.id, tomorrow);
  const firstContext = await nextFollowUpContext(
    owner,
    "company",
    sharedDate.id,
    tomorrow,
  );
  check(
    "the rep who set it is named",
    firstContext.setByName === ownerUser.name,
    `got ${firstContext.setByName}`,
  );

  // A manager holds `sees_all_reps`, so `canViewRecord` admits them — the same
  // door the coordinator comes through on a thread.
  const moved = shiftDays(today(), 9);
  await setNextFollowUp(manager, "company", sharedDate.id, moved);
  const secondContext = await nextFollowUpContext(
    owner,
    "company",
    sharedDate.id,
    moved,
  );
  check(
    "*** after somebody else moves it, THEY are named — the overwrite is visible ***",
    secondContext.setByName === manager.user.name,
    `got ${secondContext.setByName}`,
  );
  check(
    "and the first writer's row is still in the audit log [12 §7]",
    (
      await db
        .select({ n: sql<number>`count(*)::int` })
        .from(auditLog)
        .where(
          and(
            eq(auditLog.entityId, sharedDate.id),
            eq(auditLog.action, "company.next_follow_up_set"),
          ),
        )
    )[0]?.n === 2,
  );
  check(
    "*** and a rep who cannot see the company learns nothing [20 §8.2] ***",
    (await nextFollowUpContext(stranger, "company", sharedDate.id, moved))
      .setByName === null,
  );

  /* --- 14. A date that cannot fire says so --------------------------- */

  console.log("\n14. *** A deferred date says so, and names the right company ***");

  const deferCompany = await makeCompany("defer", 5);
  await createReport(owner, {
    entryType: "interaction",
    companyId: deferCompany.id,
    contactId: null,
    projectId: null,
    channel: "call",
    outcome: "on_hold",
    category: null,
    cityId: null,
    narrative: `${stamp} hold past the date`,
    onHoldUntil: shiftDays(today(), 40),
    reportDate: today(),
    signals: [],
  });
  const deferProject = await makeProject("defer-pr", deferCompany.id, 5);
  const deferDate = shiftDays(today(), 7);
  await setNextFollowUp(owner, "project", deferProject.id, deferDate);

  const deferred = await nextFollowUpContext(
    owner,
    "project",
    deferProject.id,
    deferDate,
  );
  check(
    "*** a hold outlasting the date is reported ***",
    deferred.heldUntil === shiftDays(today(), 40),
    `got ${deferred.heldUntil}`,
  );
  check(
    "*** and the company it names is the one that will do the suppressing [21 §7] ***",
    deferred.heldCompanyName === `${stamp} defer`,
    `got ${deferred.heldCompanyName}`,
  );

  // The other half of the claim: the date really is deferred.
  await db
    .update(projects)
    .set({ nextFollowUpAt: today() })
    .where(eq(projects.id, deferProject.id));
  check(
    "the project raises nothing on the day, which is what makes it worth saying",
    (await kindsOn(owner, deferProject.id)).size === 0,
  );

  // A hold that lapses FIRST defers nothing, so it is not reported.
  const lapseCompany = await makeCompany("lapse", 5);
  await createReport(owner, {
    entryType: "interaction",
    companyId: lapseCompany.id,
    contactId: null,
    projectId: null,
    channel: "call",
    outcome: "on_hold",
    category: null,
    cityId: null,
    narrative: `${stamp} hold ends first`,
    onHoldUntil: shiftDays(today(), 3),
    reportDate: today(),
    signals: [],
  });
  const lapseDate = shiftDays(today(), 20);
  await setNextFollowUp(owner, "company", lapseCompany.id, lapseDate);
  check(
    "a hold that ends before the date is NOT reported — it defers nothing",
    (await nextFollowUpContext(owner, "company", lapseCompany.id, lapseDate))
      .heldUntil === null,
  );
  check(
    "and no date at all reports nothing",
    (await nextFollowUpContext(owner, "company", lapseCompany.id, null))
      .heldUntil === null,
  );

  /* --- 15. Visibility, both directions [21 §1] ----------------------- */

  console.log("\n15. The new kinds honour the filters that already exist");

  const strangerRows = (await followUps(stranger)).rows.filter((row) =>
    row.anchorNameEn.startsWith(stamp),
  );
  check(
    "a rep who holds none of these records sees none of them",
    strangerRows.length === 0,
    `got ${strangerRows.map((row) => `${row.kind}:${row.anchorNameEn}`).join(", ")}`,
  );

  // The positive half, so the negative one above cannot be passing because
  // the rows do not exist at all.
  const ownerRows = (await followUps(owner)).rows.filter((row) =>
    row.anchorNameEn.startsWith(stamp),
  );
  check(
    "while the owner sees them",
    ownerRows.length > 0,
    `got ${ownerRows.length}`,
  );
  check(
    "including date_due, which is this slice's own kind",
    ownerRows.some((row) => row.kind === "date_due"),
    `got ${[...new Set(ownerRows.map((row) => row.kind))].join(", ")}`,
  );

  /* --- 16. The digest reads the same six kinds [07 E5] --------------- */

  console.log("\n16. The digest reads them in the recipient's own scope");

  // §4 cleared the one returned fixture and §5 and §6 disposed of the rest, so
  // the digest needs a live one of its own rather than an assertion that
  // passes on whatever happens to be left.
  const digestCompany = await makeCompany("digest-co", 5);
  const digestProject = await makeProject("digest-pr", digestCompany.id, 5);
  const digestThread = await makeThread(digestProject, digestCompany.id);
  await returnedWorkingDaysAgo(digestThread.id, thresholds.quotationReturned);

  const scope = await scopeForUser(ownerUser.id);
  check("the owner has a scope to compute in", scope !== null);
  if (scope) {
    const digestRows = await followUpsForRecipient(scope);
    const kinds = new Set(digestRows.map((row) => row.kind));
    check(
      "date_due reaches the digest [07 E5]",
      kinds.has("date_due"),
      `got ${[...kinds].join(", ")}`,
    );
    check(
      "and so does quotation_returned [22 §6.11]",
      digestRows.some(
        (row) =>
          row.kind === "quotation_returned" && row.anchorId === digestThread.id,
      ),
      `got ${[...kinds].join(", ")}`,
    );
  }

  const strangerScope = await scopeForUser(strangerUser.id);
  check("a stranger's scope exists", strangerScope !== null);
  if (strangerScope) {
    const leaked = (await followUpsForRecipient(strangerScope)).filter((row) =>
      row.anchorNameEn.startsWith(stamp),
    );
    check(
      "and holds none of this run's follow-ups — 00 §1.13's bug stays fixed",
      leaked.length === 0,
      `got ${leaked.map((row) => row.kind).join(", ")}`,
    );
  }

  // Nothing is cleaned up: FACET does not delete history `[12 §7]`, and this
  // script does not get an exception. Every row it writes is prefixed with the
  // run's timestamp so a development database stays readable.
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
