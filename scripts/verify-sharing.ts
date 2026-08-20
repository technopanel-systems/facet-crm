/**
 * Verification scaffolding for the sharing write path — NOT a feature.
 *
 * `scripts/verify-comments.ts` is the pattern this copies, for the reason
 * `CLAUDE.md` records: the throwaway script that verified the auth checklist was
 * deleted, so its results cannot be reproduced. This one is **kept**.
 *
 * It drives `src/lib/sharing.ts` in process — no browser, no HTTP — and then
 * follows what it wrote through every filter that reads a share:
 *
 *   1. The flag, scoped to the SEEDED roles `[07 B1]`, `[12 §2]`.
 *   2. Every gate refuses, each with its own key — including the one no seeded
 *      role can reach today.
 *   3. A grant grants, in both `canViewRecord` and the list filter `[07 B1]`.
 *   4. It grants EDIT, not view `[14 §2]` — proved by editing.
 *   5. *** Every filter that reads `record_shares` honours a REAL share. ***
 *   6. Per record, never everything `[07 B2]`, `[04 Q7]` — the negative half.
 *   7. A revoke is a dated row, never a delete `[12 §7]`.
 *   8. *** Re-granting after a revoke is a NEW row, not an un-revoke. ***
 *   9. `share.granted` fires `[21 §3]`, and a revoke withdraws it `[21 §4]`.
 *  10. Only three record types, and the other three grant nothing `[21 §3]`.
 *  11. Every write is audited `[07 E1]`.
 *
 * **Why §5 exists, and why it is the centre of this script.** Until this slice
 * every share row in FACET was hand-written by a verify script —
 * `verify-slice3.ts` inserts one to prove the dispatch cascade,
 * `verify-comments.ts` one to prove comment visibility. Both keep their
 * fixtures: neither asserts anything *about* sharing, so converting them would
 * couple two green scripts to a new module for no assertion gained. What the
 * fixtures raise instead gets answered once, here, in the script that owns
 * sharing: a share the real path produced is followed through every filter, so
 * a filter that honours a hand row and not a real one fails in the place that
 * would have hidden it.
 *
 * Usage: `npm run verify:sharing`
 *
 * That needs `NODE_ENV=development` in `.env`. `--env-file` is not optional and
 * cannot be replaced by the `process.loadEnvFile` call below: this script
 * reaches `@/lib/authz`, and `src/auth/index.ts` reads `AUTH_SECRET` at module
 * scope — before any statement in this file runs.
 *
 * **It refuses to run outside development** `[15 §7]`: it writes real rows.
 *
 * It needs a seeded database — `npm run db:seed` — and the fixture accounts:
 * `DEV_FIXTURE_PASSWORD=… npm run dev:fixtures`.
 *
 * **Nothing is cleaned up.** FACET does not delete history `[12 §7]` and this
 * script gets no exception, so every row it writes carries a run stamp — and
 * §1 is scoped so that the leftovers of the last run cannot fail the next one.
 */

process.loadEnvFile(".env");

import { and, eq, inArray } from "drizzle-orm";

import { closeDatabase, db } from "@/db";
import {
  auditLog,
  cities,
  companies,
  companyReps,
  contacts,
  dispatches as dispatchesTable,
  notificationTypes,
  notifications,
  productClasses,
  productFireRatings,
  productSuppliers,
  productThicknesses,
  projectCompanies,
  projects,
  recordShares,
  roles,
  users,
} from "@/db/schema";
import {
  canViewRecord,
  type AuthSession,
  type Role,
  type User,
} from "@/lib/authz";
import { listComments } from "@/lib/comments";
import { getCompany, listCompanies, updateCompany } from "@/lib/companies";
import { listContacts } from "@/lib/contacts";
import { coverage } from "@/lib/coverage";
import { getDispatch, listDispatches } from "@/lib/dispatches";
import {
  NOTIFICATION_TYPES,
  SAUDI_CODE,
  SHARED_RECORD_TYPES,
} from "@/lib/enums";
import { listCountries } from "@/lib/lookups";
import { normalizeName } from "@/lib/normalize";
import { sweepNotifications, unresolvedCount } from "@/lib/notifications";
import { getProject, listProjects, updateProject } from "@/lib/projects";
import {
  createQuotationThread,
  getQuotationThread,
  listQuotationThreads,
} from "@/lib/quotations";
import { createReport, getReport, listReports, today } from "@/lib/reports";
import { addComment } from "@/lib/comments";
import { grantShare, listShares, revokeShare, shareableUsers } from "@/lib/sharing";

import { ROLE_SEED } from "./seed/roles";

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

/** A session for a fixture account, assembled the way `getSession` would. */
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

async function main(): Promise<void> {
  if (process.env.NODE_ENV !== "development") {
    console.error(
      "verify-sharing refuses to run outside development.\n" +
        `  NODE_ENV is ${process.env.NODE_ENV ?? "unset"}, and must be "development".`,
    );
    process.exit(1);
  }

  const stamp = `verifysh-${Date.now()}`;
  const manager = await sessionFor("manager@example.test");
  const coordinator = await sessionFor("coordinator@example.test");

  const seededRoles = await db.select().from(roles);
  const roleByName = new Map(seededRoles.map((role) => [role.nameEn, role]));
  const repRole = roleByName.get("Sales Rep");
  if (!repRole || seededRoles.length < 7) {
    console.error("Roles are not seeded. Run: npm run db:seed");
    process.exit(1);
  }

  const [shareType] = await db
    .select()
    .from(notificationTypes)
    .where(eq(notificationTypes.key, NOTIFICATION_TYPES.shareGranted))
    .limit(1);
  if (!shareType) {
    console.error(
      "The share.granted notification type is not seeded. Run: npm run db:seed",
    );
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

  const asSession = (user: User, role: Role): AuthSession => {
    const withRole = { ...user, role };
    return {
      user: withRole,
      realUser: withRole,
      isImpersonating: false,
      actor: { actorUserId: user.id, actingAsUserId: null },
    };
  };

  /* --- 1. The flag [07 B1], [12 §2] --------------------------------- */

  console.log("\n1. can_share is held by exactly two SEEDED roles");

  /**
   * **Scoped to the seed's own names, never "every row in `roles`".**
   *
   * §2 below creates a role holding `can_share`, and nothing here is cleaned up
   * `[12 §7]` — so a whole-table claim goes green on the first run and red on
   * every run after, reading as a seed regression it is not. Excluding this
   * run's stamp would not help either: the previous run's role is still there.
   *
   * This is the third outing of one recurring shape — an assertion about every
   * row in a table, inside a script that writes rows to that table.
   * `verify:phase11` §16 took three versions to shed it over `audit_log`
   * `[23]`. The fix is the same one: scope by WHOSE the rows are, never by when
   * or by what.
   */
  const seedNames = new Set(ROLE_SEED.map((row) => row.nameEn as string));
  const seeded = seededRoles.filter((role) => seedNames.has(role.nameEn));
  check(
    `all ${ROLE_SEED.length} seeded roles are present`,
    seeded.length === ROLE_SEED.length,
    `got ${seeded.length}`,
  );

  const holders = seeded
    .filter((role) => role.canShare)
    .map((role) => role.nameEn)
    .sort();
  check(
    "the seed grants can_share to exactly Super Admin and Sales Manager [07 B1]",
    holders.join(", ") === "Sales Manager, Super Admin",
    `got ${holders.join(", ") || "nobody"}`,
  );
  for (const name of [
    "Executive",
    "Sales Coordinator",
    "Marketing",
    // `12 §2`'s prose says the desk rep "assigns or shares the rest"; its flag
    // list grants only `can_assign`, and the explicit list is what was taken.
    "Desk Rep",
    "Sales Rep",
  ]) {
    check(
      `${name} does NOT hold can_share [12 §2]`,
      roleByName.get(name)?.canShare === false,
      `got ${roleByName.get(name)?.canShare}`,
    );
  }
  check(
    "the manager fixture holds it, so the rest of this script is reachable",
    manager.user.role.canShare === true,
  );

  /* --- Fixtures: a company, a project and a thread held by rep A ---- */

  const [repAUser, repBUser, outsiderUser, deadUser] = await db
    .insert(users)
    .values([
      { name: `${stamp} Rep A`, email: `${stamp}-a@example.test`, roleId: repRole.id },
      { name: `${stamp} Rep B`, email: `${stamp}-b@example.test`, roleId: repRole.id },
      // Shared nothing, ever: the negative half of §3, §5 and §6.
      { name: `${stamp} Outsider`, email: `${stamp}-out@example.test`, roleId: repRole.id },
      {
        name: `${stamp} Deactivated`,
        email: `${stamp}-dead@example.test`,
        roleId: repRole.id,
        isActive: false,
      },
    ])
    .returning();
  const repA = asSession(repAUser, repRole);
  const repB = asSession(repBUser, repRole);
  const outsider = asSession(outsiderUser, repRole);

  /**
   * A role holding `can_share` **without** `sees_all_reps` — the identity the
   * seed does not produce, which is exactly why the hole it opens is invisible.
   *
   * Every other flag is false on purpose. `sees_all_reps` false is the whole
   * point of §2's last gate. (`sees_all_records_readonly` no longer exists to
   * worry about here — dropped in feature slice 6 `[26 §2]`.)
   */
  const [narrowRole] = await db
    .insert(roles)
    .values({
      nameEn: `${stamp} Sharer Without Sight`,
      nameAr: `${stamp} مشارك بلا رؤية`,
      canShare: true,
    })
    .returning();
  const [narrowUser] = await db
    .insert(users)
    .values({
      name: `${stamp} Narrow Sharer`,
      email: `${stamp}-narrow@example.test`,
      roleId: narrowRole.id,
    })
    .returning();
  const narrow = asSession(narrowUser, narrowRole);

  /**
   * **`name_normalized` is stored NORMALIZED, not raw**, which is what
   * `createCompany` does and what the list search reads.
   *
   * The first draft stored the stamp verbatim. `normalizeName` folds every
   * non-alphanumeric to a space, so `?q=verifysh-123` searched for
   * `%verifysh 123%` and matched nothing — and §3 and §5 failed on the LIST
   * filters while `canViewRecord` and the detail reads passed. A share that
   * works one way and not the other is exactly the defect this script exists to
   * find, so the fixture is fixed rather than the assertion loosened.
   */
  // `S13` makes the phone mandatory and `S23` matches companies on it, so every
  // fixture gets its own — from the run stamp plus a counter, because a shared
  // literal would make each run's companies duplicates of the last run's.
  // `S14` — both of them are Saudi, so `S15`'s city and region still apply.
  // Since AUDIT 1 F3 the city is REQUIRED for a Saudi company, and these rows
  // are inserted directly rather than through `createCompany`, so they carry
  // their own place: a city, and the region that city implies. One without the
  // other would fail `verify:schema25` §10b, which counts every company in the
  // table rather than only the ones a writer made.
  const saudiId = (await listCountries()).find(
    (row) => row.code === SAUDI_CODE,
  )!.id;
  const [place] = await db
    .select({ id: cities.id, region: cities.region })
    .from(cities)
    .limit(1);
  let phoneSeq = 0;
  const nextPhone = () => `+9665${stamp.slice(-7)}${(phoneSeq += 1)}`;

  const [company] = await db
    .insert(companies)
    .values({
      name: `${stamp} Co`,
      nameNormalized: normalizeName(`${stamp} Co`),
      phone: nextPhone(),
      countryId: saudiId,
      cityId: place.id,
      region: place.region,
      createdBy: repA.user.id,
    })
    .returning();
  await db.insert(companyReps).values({
    companyId: company.id,
    userId: repA.user.id,
    isPrimary: true,
    origin: "self_registered",
  });

  const [contact] = await db
    .insert(contacts)
    .values({
      companyId: company.id,
      name: `${stamp} Contact`,
      nameNormalized: normalizeName(`${stamp} Contact`),
      createdBy: repA.user.id,
    })
    .returning();

  const [project] = await db
    .insert(projects)
    .values({
      nameEn: `${stamp} Project`,
      nameNormalized: normalizeName(`${stamp} Project`),
      ownerUserId: repA.user.id,
      createdBy: repA.user.id,
    })
    .returning();
  await db
    .insert(projectCompanies)
    .values({ projectId: project.id, companyId: company.id });

  const thread = await createQuotationThread(
    repA,
    { projectId: project.id, companyId: company.id, contactId: null },
    {
      stock: "riyadh",
      paymentMethod: "50% advance",
      shipmentTerms: "EX-F",
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

  // A dispatch against the thread, so §5 can follow a PROJECT share all the way
  // down the cascade `11 §2` → `18 §2` that `verify-slice3` proves from a hand
  // row. It credits rep A, so rep B reaches it only through the share.
  const [dispatch] = await db
    .insert(dispatchesTable)
    .values({
      companyId: company.id,
      userId: repA.user.id,
      sqm: "86.3040",
      quotationThreadId: thread.id,
      // `S74` — see the same note in `verify-phase9`: a hand-written dispatch
      // still carries its quotation's project.
      projectId: project.id,
      dispatchDate: today(),
      recordedByUserId: coordinator.user.id,
    })
    .returning();

  // A company-level report and a project-level one, for the two halves of
  // `visibleRepReportsFilter` `[20 §10]`.
  const companyReport = await createReport(repA, {
    entryType: "interaction",
    companyId: company.id,
    contactId: null,
    projectId: null,
    channel: "visit",
    outcome: "introduced",
    category: null,
    cityId: null,
    onHoldUntil: null,
    narrative: `${stamp} company-level`,
    reportDate: today(),
    signals: [],
  });
  const projectReport = await createReport(repA, {
    entryType: "interaction",
    companyId: company.id,
    contactId: null,
    projectId: project.id,
    channel: "visit",
    outcome: "introduced",
    category: null,
    cityId: null,
    onHoldUntil: null,
    narrative: `${stamp} project-level`,
    reportDate: today(),
    signals: [],
  });

  // One comment on each of the three shareable anchors `[25 §10]`.
  for (const anchor of [
    { type: "company" as const, id: company.id },
    { type: "project" as const, id: project.id },
    { type: "quotation_thread" as const, id: thread.id },
  ]) {
    await addComment(repA, {
      recordType: anchor.type,
      recordId: anchor.id,
      body: `${stamp} on a ${anchor.type}`,
      mentions: [],
    });
  }

  /* --- 2. Every gate refuses, each with its own key ------------------ */

  console.log("\n2. Every gate refuses, and says which one");

  await refuses(
    "a rep cannot share — the manager initiates [07 B1]",
    "sharing.errors.cannotShare",
    () => grantShare(repA, "company", company.id, repB.user.id),
  );
  await refuses(
    "the coordinator cannot share either [12 §2]",
    "sharing.errors.cannotShare",
    () => grantShare(coordinator, "company", company.id, repB.user.id),
  );
  await refuses(
    "a sharer cannot share a record they cannot see themselves",
    "sharing.errors.recordNotVisible",
    () => grantShare(narrow, "company", company.id, repB.user.id),
  );
  await refuses(
    "work is not handed to a deactivated account [04 C2]",
    "sharing.errors.recipientInactive",
    () => grantShare(manager, "company", company.id, deadUser.id),
  );
  await refuses(
    "revoking needs the flag too [07 B1]",
    "sharing.errors.cannotShare",
    () => revokeShare(repA, "00000000-0000-0000-0000-000000000000"),
  );
  await refuses(
    "a share that does not exist cannot be revoked",
    "sharing.errors.shareNotFound",
    () => revokeShare(manager, "00000000-0000-0000-0000-000000000000"),
  );

  /* --- 3. A grant grants [07 B1] ------------------------------------ */

  console.log("\n3. A grant grants, in canViewRecord and in the list filter");

  check(
    "before: repB cannot see the company",
    (await canViewRecord(repB, "company", company.id)) === false &&
      (await getCompany(repB, company.id)) === null,
  );

  await grantShare(manager, "company", company.id, repB.user.id);

  check(
    "after: canViewRecord says yes [04 Q7]",
    (await canViewRecord(repB, "company", company.id)) === true,
  );
  check(
    "…and so does the SQL twin — the list filter [04 Q7]",
    (await listCompanies(repB, { q: stamp })).rows.some(
      (row) => row.id === company.id,
    ),
  );
  check(
    "the panel lists it, naming the grantee and the granter",
    (await listShares("company", company.id)).some(
      (share) =>
        share.sharedWithUserId === repB.user.id &&
        share.sharedByUserId === manager.user.id &&
        share.sharedByName === manager.user.name,
    ),
  );
  check(
    "an outsider still sees nothing — a share is for one person",
    (await canViewRecord(outsider, "company", company.id)) === false,
  );

  await refuses(
    "the same record cannot be shared with the same person twice",
    "sharing.errors.alreadyShared",
    () => grantShare(manager, "company", company.id, repB.user.id),
  );
  check(
    "…and the picker stops offering them",
    (await shareableUsers(manager, "company", company.id)).every(
      (person) => person.id !== repB.user.id,
    ),
  );

  /* --- 4. A share grants EDIT, not view [14 §2] --------------------- */

  console.log("\n4. *** A share grants EDIT, not view only [14 §2] ***");

  const detail = await getCompany(repB, company.id);
  // Every field is round-tripped except the note, so the note is the only thing
  // that can have changed. `phone` and `countryId` are mandatory `S13` `S14`,
  // which is what makes this the check that an edit path cannot clear them:
  // the input type refuses `null` and the column refuses it again.
  await updateCompany(repB, company.id, {
    name: detail!.name,
    phone: detail!.phone,
    countryId: detail!.countryId,
    categoryId: detail!.categoryId,
    vatNumber: detail!.vatNumber,
    cityId: detail!.cityId,
    leadSourceId: detail!.leadSourceId,
    notes: `${stamp} edited by the shared rep`,
  });
  const edited = await getCompany(repA, company.id);
  check(
    "the shared rep EDITED the company, and it stuck [14 §2]",
    edited?.notes === `${stamp} edited by the shared rep`,
    `got ${edited?.notes}`,
  );
  check(
    "…and the mandatory phone survived the round trip [S13]",
    edited?.phone === detail!.phone,
    `got ${edited?.phone}`,
  );
  await refuses(
    "…while an outsider still cannot [04 Q7]",
    "companies.errors.notFound",
    () =>
      updateCompany(outsider, company.id, {
        name: detail!.name,
        phone: detail!.phone,
        countryId: detail!.countryId,
        categoryId: null,
        vatNumber: null,
        // Null, deliberately: `canViewRecord` refuses before `placeForCountry`
        // is reached, so this must come back as `notFound` and never as the
        // required-city error `S15` would raise if that order ever flipped.
        cityId: null,
        leadSourceId: null,
        notes: `${stamp} should never land`,
      }),
  );

  /* --- 5. Every filter that reads a share honours a REAL one -------- */

  console.log(
    "\n5. *** Every filter that reads record_shares honours a REAL share ***",
  );

  console.log("\n    a company share, through every filter that reads one");
  check(
    "visibleCompaniesFilter [authz:499]",
    (await listCompanies(repB, { q: stamp })).rows.some(
      (row) => row.id === company.id,
    ),
  );
  check(
    "visibleContactsFilter — a contact follows its company [14 §1]",
    (await listContacts(repB, { companyId: company.id })).rows.some(
      (row) => row.id === contact.id,
    ),
  );
  check(
    "visibleRepReportsFilter, company-level half [20 §10]",
    (await listReports(repB, { q: stamp })).rows.some(
      (row) => row.id === companyReport.id,
    ),
  );
  check(
    "*** …and the share stops at WHAT HAPPENED: no note [S38] ***",
    (await getReport(repB, companyReport.id))?.narrative === null,
    `got ${JSON.stringify((await getReport(repB, companyReport.id))?.narrative)}`,
  );
  check(
    "…while its author still reads their own words [S38]",
    typeof (await getReport(repA, companyReport.id))?.narrative === "string",
  );
  check(
    "visibleCommentsFilter, through the company branch [25 §10]",
    (await listComments(repB, "company", company.id)).length === 1,
  );
  check(
    "coverage — the shared company is the shared rep's to work [20 §7]",
    (await coverage(repB, { q: stamp })).rows.some(
      (row) => row.companyId === company.id,
    ),
  );
  check(
    "*** and NOT the project-level report, which needs the project too [04 Q7] ***",
    !(await listReports(repB, { q: stamp })).rows.some(
      (row) => row.id === projectReport.id,
    ),
  );

  console.log("\n    a project share, and the cascade it carries");
  check(
    "before: repB cannot see the project, its thread or its dispatch",
    (await getProject(repB, project.id)) === null &&
      (await getQuotationThread(repB, thread.id)) === null &&
      (await getDispatch(repB, dispatch.id)) === null,
  );

  await grantShare(manager, "project", project.id, repB.user.id);

  check(
    "visibleProjectsFilter [authz:535]",
    (await listProjects(repB, { q: stamp })).rows.some(
      (row) => row.id === project.id,
    ),
  );
  check(
    "visibleQuotationThreadsFilter, through the project term [11 §2]",
    (await listQuotationThreads(repB, { q: stamp })).rows.some(
      (row) => row.id === thread.id,
    ),
  );
  check(
    "*** visibleDispatchesFilter, project → thread → dispatch [18 §2] ***",
    (await getDispatch(repB, dispatch.id)) !== null &&
      (await listDispatches(repB, {})).rows.some(
        (row) => row.id === dispatch.id,
      ),
  );
  check(
    "visibleRepReportsFilter, project-level half — now BOTH terms pass [20 §10]",
    (await listReports(repB, { q: stamp })).rows.some(
      (row) => row.id === projectReport.id,
    ),
  );
  check(
    "visibleCommentsFilter, through the project branch [25 §10]",
    (await listComments(repB, "project", project.id)).length === 1,
  );
  check(
    "projectVisibleExists agrees with canViewRecord [authz:661]",
    (await canViewRecord(repB, "project", project.id)) === true,
  );

  // §4's claim again on the other record type, because `updateProject` asks
  // `canViewRecord` on a project rather than on a company — a different term of
  // a different filter reaching the same answer `[14 §2]`.
  const shared = await getProject(repB, project.id);
  await updateProject(repB, project.id, {
    nameEn: shared!.nameEn,
    nameAr: shared!.nameAr,
    sqmExpected: "1234.5000",
    cityId: shared!.cityId,
    endState: shared!.endState,
    lostReasonId: shared!.lostReasonId,
    lossReason: shared!.lossReason,
    inProduction: shared!.inProduction,
  });
  check(
    "the shared rep EDITED the project too [14 §2]",
    (await getProject(repA, project.id))?.sqmExpected === "1234.5000",
    `got ${(await getProject(repA, project.id))?.sqmExpected}`,
  );

  console.log("\n    a thread share, which is the narrowest of the three");
  const narrowThread = await createQuotationThread(
    repA,
    { projectId: project.id, companyId: company.id, contactId: null },
    {
      stock: "riyadh",
      paymentMethod: "50% advance",
      shipmentTerms: "EX-F",
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
        quantityPcs: "6.0000",
        unitPrice: "120.00",
      },
    ],
    [],
  );
  await addComment(repA, {
    recordType: "quotation_thread",
    recordId: narrowThread.id,
    body: `${stamp} on the narrow thread`,
    mentions: [],
  });

  // A third rep, holding nothing: the thread share has to be the ONLY way in,
  // or the project share above would be doing the work.
  const [repCUser] = await db
    .insert(users)
    .values({
      name: `${stamp} Rep C`,
      email: `${stamp}-c@example.test`,
      roleId: repRole.id,
    })
    .returning();
  const repC = asSession(repCUser, repRole);

  check(
    "before: repC sees no thread of this run",
    (await listQuotationThreads(repC, { q: stamp })).rows.length === 0,
  );
  await grantShare(manager, "quotation_thread", narrowThread.id, repC.user.id);
  check(
    "visibleQuotationThreadsFilter, through the share term [authz:577]",
    (await getQuotationThread(repC, narrowThread.id)) !== null,
  );
  check(
    "visibleCommentsFilter, through the thread branch [25 §10]",
    (await listComments(repC, "quotation_thread", narrowThread.id)).length === 1,
  );
  check(
    "*** and it reaches NO further: not the project it was raised on ***",
    (await getProject(repC, project.id)) === null,
  );
  check(
    "*** nor the company behind it [04 Q7] ***",
    (await getCompany(repC, company.id)) === null,
  );

  /* --- 6. Per record, never everything [07 B2] ---------------------- */

  console.log("\n6. Per record, never everything — the negative half [04 Q7]");

  const [lonely] = await db
    .insert(companies)
    .values({
      name: `${stamp} Lonely Co`,
      nameNormalized: normalizeName(`${stamp} Lonely Co`),
      phone: nextPhone(),
      countryId: saudiId,
      cityId: place.id,
      region: place.region,
      createdBy: repA.user.id,
    })
    .returning();
  await db.insert(companyReps).values({
    companyId: lonely.id,
    userId: repA.user.id,
    isPrimary: true,
    origin: "self_registered",
  });
  const [lonelyProject] = await db
    .insert(projects)
    .values({
      nameEn: `${stamp} Lonely Project`,
      nameNormalized: normalizeName(`${stamp} Lonely Project`),
      ownerUserId: repA.user.id,
      createdBy: repA.user.id,
    })
    .returning();
  await db
    .insert(projectCompanies)
    .values({ projectId: lonelyProject.id, companyId: lonely.id });

  await grantShare(manager, "company", lonely.id, repC.user.id);
  check(
    "sharing a company reveals the company",
    (await getCompany(repC, lonely.id)) !== null,
  );
  check(
    "*** and NOT its projects — company membership is never a project term ***",
    (await getProject(repC, lonelyProject.id)) === null &&
      !(await listProjects(repC, { companyId: lonely.id })).rows.some(
        (row) => row.id === lonelyProject.id,
      ),
  );

  /* --- 7. A revoke is a dated row, never a delete [12 §7] ----------- */

  console.log("\n7. A revoke is a dated row, never a delete [12 §7]");

  const rowsBefore = await db
    .select({ id: recordShares.id })
    .from(recordShares)
    .where(
      and(
        eq(recordShares.recordType, "company"),
        eq(recordShares.recordId, company.id),
      ),
    );
  const [live] = await listShares("company", company.id);
  await revokeShare(manager, live.id);

  const rowsAfter = await db
    .select()
    .from(recordShares)
    .where(
      and(
        eq(recordShares.recordType, "company"),
        eq(recordShares.recordId, company.id),
      ),
    );
  check(
    "the row is still there — nothing is deleted [12 §7]",
    rowsAfter.length === rowsBefore.length,
    `${rowsBefore.length} → ${rowsAfter.length}`,
  );
  const revokedRow = rowsAfter.find((row) => row.id === live.id);
  check(
    "it carries revoked_at and revoked_by_user_id",
    revokedRow?.revokedAt !== null &&
      revokedRow?.revokedByUserId === manager.user.id,
    `got ${revokedRow?.revokedAt} / ${revokedRow?.revokedByUserId}`,
  );
  check(
    "the panel stops listing it — live rows only",
    (await listShares("company", company.id)).every(
      (share) => share.id !== live.id,
    ),
  );
  check(
    "and the access is gone, in both directions",
    (await canViewRecord(repB, "company", company.id)) === false &&
      !(await listCompanies(repB, { q: stamp })).rows.some(
        (row) => row.id === company.id,
      ),
  );
  check(
    "the contact goes with it — it never had visibility of its own [14 §1]",
    !(await listContacts(repB, { companyId: company.id })).rows.some(
      (row) => row.id === contact.id,
    ),
  );
  await refuses(
    "a second revoke is refused, not silently restamped",
    "sharing.errors.alreadyRevoked",
    () => revokeShare(manager, live.id),
  );

  console.log(
    "\n    …and the gate no seeded role can reach today [07 B1]",
  );
  const [narrowTarget] = await listShares("project", project.id);
  await refuses(
    "*** a can_share holder cannot revoke a share on a record they cannot see ***",
    "sharing.errors.recordNotVisible",
    () => revokeShare(narrow, narrowTarget.id),
  );
  check(
    "…and the share is untouched by the attempt",
    (await listShares("project", project.id)).some(
      (share) => share.id === narrowTarget.id,
    ),
  );

  /* --- 8. Re-granting is a NEW row [12 §7] -------------------------- */

  console.log("\n8. *** Re-granting after a revoke is a NEW row, not an un-revoke ***");

  await grantShare(manager, "company", company.id, repB.user.id);
  const regranted = await db
    .select()
    .from(recordShares)
    .where(
      and(
        eq(recordShares.recordType, "company"),
        eq(recordShares.recordId, company.id),
        eq(recordShares.sharedWithUserId, repB.user.id),
      ),
    );
  check(
    "there are now TWO rows for this pair, not one edited row",
    regranted.length === 2,
    `got ${regranted.length}`,
  );
  check(
    "the first still carries its revoked_at — history is not rewritten",
    regranted.filter((row) => row.revokedAt !== null).length === 1,
  );
  check(
    "exactly one is live, so the revoke control is unambiguous",
    regranted.filter((row) => row.revokedAt === null).length === 1,
  );
  check(
    "and the access is back",
    (await canViewRecord(repB, "company", company.id)) === true,
  );

  /* --- 9. share.granted fires [21 §3], [21 §4] --------------------- */

  console.log("\n9. share.granted fires, and a revoke withdraws it [21 §3], [21 §4]");

  const sharesOf = async (userId: string) =>
    db
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.recipientUserId, userId),
          eq(notifications.notificationTypeId, shareType.id),
        ),
      );

  const repBNotifications = await sharesOf(repB.user.id);
  check(
    "the grantee was told — the producer 21 §11 was waiting for [25 §30]",
    repBNotifications.length > 0,
  );
  check(
    "it is act-now and persistent, as seeded [21 §2]",
    shareType.tier === "act_now" && shareType.isPersistent === true,
  );
  check(
    "one per grant, anchored to the record [21 §3]",
    repBNotifications.some(
      (row) => row.recordType === "company" && row.recordId === company.id,
    ) &&
      repBNotifications.some(
        (row) => row.recordType === "project" && row.recordId === project.id,
      ),
  );
  check(
    "the thread grant anchored to the thread [21 §3]",
    (await sharesOf(repC.user.id)).some(
      (row) =>
        row.recordType === "quotation_thread" && row.recordId === narrowThread.id,
    ),
  );
  check(
    "nobody else was told — a notification is addressed [00 §1.13]",
    (await sharesOf(outsider.user.id)).length === 0,
  );

  console.log("\n    resolution: the recipient works it [21 §3]");
  const waitingBefore = await unresolvedCount(repB);
  await createReport(repB, {
    entryType: "interaction",
    companyId: company.id,
    contactId: null,
    projectId: null,
    channel: "visit",
    outcome: "introduced",
    category: null,
    cityId: null,
    onHoldUntil: null,
    narrative: `${stamp} the shared rep worked it`,
    reportDate: today(),
    signals: [],
  });
  await sweepNotifications();
  const afterInteraction = await sharesOf(repB.user.id);
  check(
    "an interaction against the company resolves the company anchor [21 §3]",
    afterInteraction
      .filter((row) => row.recordType === "company" && row.recordId === company.id)
      .every((row) => row.resolvedAt !== null),
  );
  check(
    "…and the project anchor too — its live linked company is the same one",
    afterInteraction
      .filter((row) => row.recordType === "project")
      .every((row) => row.resolvedAt !== null),
  );
  check(
    "the badge fell",
    (await unresolvedCount(repB)) < waitingBefore,
    `${waitingBefore} → ${await unresolvedCount(repB)}`,
  );

  console.log("\n    *** withdrawal: a revoked share cannot leave a badge [21 §4] ***");
  const repCWaitingBefore = await unresolvedCount(repC);
  check(
    "repC is holding an unresolved share.granted to begin with",
    repCWaitingBefore > 0,
    `got ${repCWaitingBefore}`,
  );
  const [threadShare] = await listShares("quotation_thread", narrowThread.id);
  await revokeShare(manager, threadShare.id);
  await sweepNotifications();
  check(
    "revoking withdrew it — 21 §3's own condition is now unreachable [21 §4]",
    (await sharesOf(repC.user.id))
      .filter((row) => row.recordId === narrowThread.id)
      .every((row) => row.resolvedAt !== null),
  );
  check(
    "the badge fell with it",
    (await unresolvedCount(repC)) < repCWaitingBefore,
    `${repCWaitingBefore} → ${await unresolvedCount(repC)}`,
  );
  const settled = await unresolvedCount(repC);
  await sweepNotifications();
  check(
    "and a second sweep changes nothing — the resolver is idempotent [16 §3]",
    (await unresolvedCount(repC)) === settled,
    `${settled} → ${await unresolvedCount(repC)}`,
  );

  /**
   * The trap this resolver had to be narrowed around, asserted so it stays
   * narrow: `verify-phase10a.ts` §11 plants `share.granted` rows with no
   * `record_shares` row behind them, deliberately, to test `21 §3`'s rule
   * without a producer. A resolver keyed on "holds no live share" would clear
   * those on the first sweep and that script's *"an interaction resolves the
   * project anchor"* would pass whether or not `resolveOnInteraction` worked.
   */
  const [planted] = await db
    .insert(notifications)
    .values({
      recipientUserId: outsider.user.id,
      notificationTypeId: shareType.id,
      recordType: "company" as const,
      recordId: lonely.id,
    })
    .returning();
  await sweepNotifications();
  const [plantedAfter] = await db
    .select()
    .from(notifications)
    .where(eq(notifications.id, planted.id));
  check(
    "*** a share.granted with NO share row behind it is left alone [21 §3] ***",
    plantedAfter.resolvedAt === null,
    `got ${plantedAfter.resolvedAt}`,
  );

  /* --- 10. Three record types, and only three [21 §3] --------------- */

  console.log("\n10. Only the three kinds a share actually grants something on");

  check(
    "SHARED_RECORD_TYPES is company, project, quotation_thread — and no fourth",
    SHARED_RECORD_TYPES.join(",") === "company,project,quotation_thread",
    `got ${SHARED_RECORD_TYPES.join(",")}`,
  );

  /**
   * The evidence for not offering the other three: a row on one grants nothing,
   * so a screen offering it would report success and change nothing. These are
   * inserted BY HAND on purpose — `grantShare` cannot write one, and that is
   * the point being made.
   */
  await db.insert(recordShares).values([
    {
      recordType: "contact" as const,
      recordId: contact.id,
      sharedWithUserId: outsider.user.id,
      sharedByUserId: manager.user.id,
    },
    {
      recordType: "dispatch" as const,
      recordId: dispatch.id,
      sharedWithUserId: outsider.user.id,
      sharedByUserId: manager.user.id,
    },
  ]);
  check(
    "a contact share grants nothing — visibleContactsFilter has no share term",
    (await listContacts(outsider, { companyId: company.id })).rows.length === 0 &&
      (await canViewRecord(outsider, "contact", contact.id)) === false,
  );
  check(
    "a dispatch share grants nothing — visibleDispatchesFilter has none either",
    (await getDispatch(outsider, dispatch.id)) === null,
  );
  await refuses(
    "and one cannot be revoked through this module either",
    "sharing.errors.recordTypeNotShareable",
    async () => {
      const [hand] = await db
        .select({ id: recordShares.id })
        .from(recordShares)
        .where(
          and(
            eq(recordShares.recordType, "contact"),
            eq(recordShares.recordId, contact.id),
          ),
        )
        .limit(1);
      return revokeShare(manager, hand.id);
    },
  );

  /* --- 11. Every write is audited [07 E1] --------------------------- */

  console.log("\n11. Every write is audited");

  /**
   * Scoped to THIS RUN's own share rows by `entity_id`, never to a time window
   * or an action list — `verify:phase11` §16's third and final shape `[23]`. A
   * window says when a row was written and an action name says what it did;
   * neither says whose it is, and whose it is is the claim.
   */
  const ownShares = await db
    .select({ id: recordShares.id, recordType: recordShares.recordType })
    .from(recordShares)
    .where(
      inArray(recordShares.recordId, [
        company.id,
        project.id,
        thread.id,
        narrowThread.id,
        lonely.id,
        contact.id,
        dispatch.id,
      ]),
    );
  const ownShareIds = ownShares.map((row) => row.id);
  check("this run's own share rows were found", ownShareIds.length > 0);

  // §10's two rows were written by hand, so they correctly have no audit
  // entry: the data layer writes the log, and nothing in `src/` wrote them.
  const realGrants = ownShares.filter((row) =>
    (SHARED_RECORD_TYPES as readonly string[]).includes(row.recordType),
  ).length;

  const audited = await db
    .select({
      action: auditLog.action,
      entityId: auditLog.entityId,
      actorUserId: auditLog.actorUserId,
    })
    .from(auditLog)
    .where(inArray(auditLog.entityId, ownShareIds));

  check(
    "every grant and revoke wrote an audit row",
    audited.length > 0,
    `got ${audited.length}`,
  );
  check(
    "every one names the actor — a share is never a system act",
    audited.every((row) => row.actorUserId !== null),
  );
  const actions = [...new Set(audited.map((row) => row.action))].sort();
  check(
    "the actions are exactly share.granted and share.revoked",
    actions.join(", ") === "share.granted, share.revoked",
    `got ${actions.join(", ")}`,
  );
  console.log(`        actions seen: ${actions.join(", ")}`);

  const grantsAudited = audited.filter(
    (row) => row.action === "share.granted",
  ).length;
  check(
    "one share.granted per row the real path wrote, and none for the hand rows",
    grantsAudited === realGrants,
    `${grantsAudited} audited vs ${realGrants} real grants`,
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
