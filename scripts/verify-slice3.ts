/**
 * Verification scaffolding for dispatch, credit splits and targets — NOT a
 * feature.
 *
 * `scripts/verify-slice2.ts` is the pattern this copies, for the reason
 * `CLAUDE.md` records: the throwaway script that verified the auth checklist
 * was deleted, so its results cannot be reproduced. This one is **kept**.
 *
 * It drives `src/lib/dispatches.ts`, `src/lib/credit-splits.ts` and
 * `src/lib/targets.ts` in process — no browser, no HTTP — and checks the things
 * that are otherwise only claimed:
 *
 *   1. The three flags are reachable, and held by the right roles.
 *   2. Every gate refuses, each with its own translation key.
 *   3. The payment gate `[07 C3]`, and company/rep derived from the thread.
 *   4. Direct dispatch: no payment gate, coordinator approval instead
 *      `[07 C6]`, and visible as such.
 *   5. Recording a dispatch NEVER sets a credit split `[07 D3]`, `[12 §1]`.
 *   6. No split in force credits the dispatch's own rep `[18 §1]`.
 *   7. The split in force on the dispatch's OWN date — and a later generation
 *      does not rewrite earlier credit `[07 D3]`. The central claim.
 *   8. The generation refusals `[18 §3]`, `[18 §4]`.
 *   9. Equal division loses nothing `[18 §5]` — pure, no database.
 *  10. Targets are rows, never edits `[07 D1]`, `[10 §6]`.
 *  11. Achievement never reads the quotation `[08 D4]`, `[12 §10]`, `[16 §5]`.
 *  12. Visibility `[18 §2]` — including the negative half: names yes, records
 *      no.
 *  13. Every write is audited `[07 E1]`.
 *
 * Usage: `npm run verify:slice3`
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
 * **Dates are in the future, deliberately.** `18 §4` forbids backdating a
 * split, so the only way to drive `setCreditSplit` for real — rather than
 * inserting its rows by hand and testing nothing — is to place the generations
 * ahead of today and date the dispatches to match. The claim in §7 is
 * unaffected: what matters is that a LATER generation does not change an
 * EARLIER dispatch's credit.
 */

process.loadEnvFile(".env");

import { and, eq, sql } from "drizzle-orm";

import { closeDatabase, db } from "@/db";
import {
  auditLog,
  companies,
  companyReps,
  dispatches as dispatchesTable,
  productClasses,
  productFireRatings,
  productSuppliers,
  productThicknesses,
  projectCompanies,
  projectCreditSplits,
  projects,
  recordShares,
  roles,
  serviceTypes,
  targets as targetsTable,
  users,
} from "@/db/schema";
import { canViewRecord, type AuthSession } from "@/lib/authz";
import {
  creditForDispatches,
  getCreditSplitInForce,
  setCreditSplit,
} from "@/lib/credit-splits";
import { PERCENT_SCALE, SQM_SCALE, divideEqually, fromScaled, toScaled } from "@/lib/decimal";
import {
  getDispatch,
  listDispatchableThreads,
  listDispatches,
  recordDispatch,
} from "@/lib/dispatches";
import {
  acceptThread,
  addServiceLine,
  confirmPayment,
  createQuotationThread,
  issueVersion,
} from "@/lib/quotations";
import { achievementForPeriod, listTargetHistory, setTarget } from "@/lib/targets";

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
 * Assert that `fn` refuses, and **why**. Checking only "it threw" would pass
 * on a typo in the function under test.
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

/** Sum a list of scale-4 sqm strings exactly, as a string. */
function sumSqm(values: string[]): string {
  return fromScaled(
    values.reduce((total, value) => total + toScaled(value, SQM_SCALE), BigInt(0)),
    SQM_SCALE,
  );
}

/** The credit shares for one dispatch, by user id. */
async function creditOf(dispatch: {
  id: string;
  userId: string;
  userName: string;
  sqm: string;
  dispatchDate: string;
  projectId: string | null;
}) {
  const credits = await creditForDispatches([dispatch]);
  return credits.get(dispatch.id)!;
}

async function main(): Promise<void> {
  if (process.env.NODE_ENV !== "development") {
    console.error(
      "verify-slice3 refuses to run outside development.\n" +
        `  NODE_ENV is ${process.env.NODE_ENV ?? "unset"}, and must be "development".`,
    );
    process.exit(1);
  }

  const manager = await sessionFor("manager@example.test");
  const coordinator = await sessionFor("coordinator@example.test");

  // Two reps created FOR THIS RUN, rather than the shared `dev:fixtures`
  // accounts.
  //
  // Achievement is a per-person, per-month total over every dispatch in the
  // database `[04 C1]`, and this script does not clean up after itself
  // `[12 §7]`. Reusing `rep-a@example.test` would mean the second run counted
  // the first run's square metres and every total assertion drifted. Reps
  // scoped to the run make the numbers reproducible, which is the whole point
  // of keeping the script.
  const stamp = `verify3-${Date.now()}`;
  const [repRole] = await db
    .select()
    .from(roles)
    .where(eq(roles.nameEn, "Sales Rep"))
    .limit(1);
  if (!repRole) {
    console.error("Roles are not seeded. Run: npm run db:seed");
    process.exit(1);
  }
  const [repAUser, repBUser, repCUser] = await db
    .insert(users)
    .values([
      // Names fix the order the credit split divides in — see `18 §5`.
      { name: `${stamp} Rep A`, email: `${stamp}-a@example.test`, roleId: repRole.id },
      { name: `${stamp} Rep B`, email: `${stamp}-b@example.test`, roleId: repRole.id },
      // The third member of the three-way split. A run-scoped rep rather than
      // the shared coordinator account, so October's total is this run's alone.
      { name: `${stamp} Rep C`, email: `${stamp}-c@example.test`, roleId: repRole.id },
    ])
    .returning();
  const asSession = (user: typeof repAUser): AuthSession => {
    const withRole = { ...user, role: repRole };
    return {
      user: withRole,
      realUser: withRole,
      isImpersonating: false,
      actor: { actorUserId: user.id, actingAsUserId: null },
    };
  };
  const repA = asSession(repAUser);
  const repB = asSession(repBUser);
  const repC = asSession(repCUser);

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
  const [service] = await db.select().from(serviceTypes).limit(1);
  if (!supplier || !productClass || !fireRating || !thickness || !service) {
    console.error("The lookups are not seeded. Run: npm run db:seed");
    process.exit(1);
  }

  /* --- Fixtures: a company and a project owned by rep A ----------- */

  const [company] = await db
    .insert(companies)
    .values({
      nameEn: `${stamp} Co`,
      nameNormalized: stamp,
      createdBy: repA.user.id,
    })
    .returning();
  await db.insert(companyReps).values({
    companyId: company.id,
    userId: repA.user.id,
    isPrimary: true,
    origin: "self_registered",
  });
  const [project] = await db
    .insert(projects)
    .values({
      nameEn: `${stamp} Project`,
      nameNormalized: stamp,
      ownerUserId: repA.user.id,
      createdBy: repA.user.id,
    })
    .returning();
  await db
    .insert(projectCompanies)
    .values({ projectId: project.id, companyId: company.id, isBuyer: true });

  const line = {
    supplierId: supplier.id,
    classId: productClass.id,
    fireRatingId: fireRating.id,
    colourId: null,
    customColour: "168",
    thicknessId: thickness.id,
    widthM: "1.2400",
    lengthM: "5.8000",
    quantityPcs: "12.0000", // 86.3040 m²
    unitPrice: "120.00",
    vatRate: "15.00",
  };
  const version = {
    validUntil: "2031-01-01",
    deliveryPeriod: "4 weeks",
    paymentMethod: "50% advance",
    shipmentTerms: "EX-F",
  };

  // Thread 1 — will be paid, and is what the linked dispatches go against.
  const paidThread = await createQuotationThread(
    repA,
    { projectId: project.id, companyId: company.id, contactId: null },
    version,
    [line],
    [],
  );
  // A service line, so §11 can prove service m² never reach a target.
  await addServiceLine(repA, paidThread.id, {
    serviceTypeId: service.id,
    quantity: "10.0000",
    unitPrice: "25.00",
    quotationLineId: null,
  });

  // Thread 2 — never paid. The payment gate's subject.
  const unpaidThread = await createQuotationThread(
    repA,
    { projectId: project.id, companyId: company.id, contactId: null },
    version,
    [line],
    [],
  );

  /* --- 1. The flags are reachable, on the right roles ------------- */

  console.log("\n1. The flags exist and the seed grants them correctly [12 §1, §3]");
  check("coordinator dispatches", coordinator.user.role.canDispatch === true);
  check(
    "coordinator does NOT see all reps — the 16 §8 / 18 §2 shape",
    coordinator.user.role.seesAllReps === false,
  );
  check(
    "coordinator may set a credit split [12 §1]",
    coordinator.user.role.canSetCreditSplit === true,
  );
  check(
    "coordinator may NOT set targets",
    coordinator.user.role.canSetTargets === false,
  );
  check("manager sets targets", manager.user.role.canSetTargets === true);
  check(
    "manager sets credit splits [12 §1]",
    manager.user.role.canSetCreditSplit === true,
  );
  check(
    "manager does NOT dispatch — that is operational [12 §3]",
    manager.user.role.canDispatch === false,
  );
  check(
    "a rep holds none of the three",
    !repA.user.role.canDispatch &&
      !repA.user.role.canSetCreditSplit &&
      !repA.user.role.canSetTargets,
  );

  /* --- 2. Every gate refuses, each for its own reason ------------- */

  console.log("\n2. Every gate refuses with its own key");
  const directInput = {
    sqm: "10.0000",
    dispatchDate: "2026-09-10",
    quotationThreadId: null,
    companyId: company.id,
    userId: repB.user.id,
  };
  await refuses(
    "a rep may not dispatch",
    "dispatches.errors.dispatchOnly",
    () => recordDispatch(repA, directInput),
  );
  await refuses(
    "the manager may not dispatch [12 §3]",
    "dispatches.errors.dispatchOnly",
    () => recordDispatch(manager, directInput),
  );
  await refuses(
    "a rep may never set his own split [12 §1]",
    "credit.errors.creditSplitOnly",
    () =>
      setCreditSplit(repA, project.id, {
        effectiveFrom: "2026-09-01",
        userIds: [repA.user.id],
      }),
  );
  await refuses(
    "a rep may not set targets",
    "targets.errors.setTargetsOnly",
    () => setTarget(repA, repA.user.id, "2026-09", "500.0000"),
  );
  await refuses(
    "the coordinator may not set targets",
    "targets.errors.setTargetsOnly",
    () => setTarget(coordinator, repA.user.id, "2026-09", "500.0000"),
  );

  /* --- 3. The payment gate [07 C3], [09 §6.1] -------------------- */

  console.log("\n3. Dispatch against a quotation is blocked until payment [07 C3]");
  await refuses(
    "an unpaid quotation refuses",
    "dispatches.errors.paymentNotConfirmed",
    () =>
      recordDispatch(coordinator, {
        sqm: "10.0000",
        dispatchDate: "2026-09-10",
        quotationThreadId: unpaidThread.id,
        companyId: null,
        userId: null,
      }),
  );
  check(
    "and it is not offered in the dispatchable list either",
    (await listDispatchableThreads(coordinator)).every(
      (thread) => thread.id !== unpaidThread.id,
    ),
  );

  await issueVersion(coordinator, paidThread.id, {
    smacReference: `${stamp}-9592`,
    verification: "unverified",
  });
  await acceptThread(coordinator, paidThread.id);
  await confirmPayment(repA, paidThread.id, "2026-08-01");

  check(
    "a paid quotation IS offered",
    (await listDispatchableThreads(coordinator)).some(
      (thread) => thread.id === paidThread.id,
    ),
  );

  const linked = await recordDispatch(coordinator, {
    sqm: "100.0000",
    dispatchDate: "2026-09-10",
    quotationThreadId: paidThread.id,
    companyId: null,
    userId: null,
  });
  check("the dispatch was recorded once payment was confirmed", !!linked.id);
  check(
    "company derived from the thread, not asked for [18 §7]",
    linked.companyId === company.id,
  );
  check(
    "rep derived from the thread's raiser [18 §7]",
    linked.userId === repA.user.id,
  );
  check(
    "a linked dispatch carries NO coordinator approval — the chain is the approval",
    linked.approvedByUserId === null && linked.approvedAt === null,
  );
  await refuses(
    "a company disagreeing with the thread is refused",
    "dispatches.errors.companyNotOnThread",
    () =>
      recordDispatch(coordinator, {
        sqm: "1.0000",
        dispatchDate: "2026-09-10",
        quotationThreadId: paidThread.id,
        companyId: project.id, // any id that is not the thread's company
        userId: null,
      }),
  );

  const secondPartial = await recordDispatch(coordinator, {
    sqm: "5000.0000", // far beyond the 86.3040 m² quoted
    dispatchDate: "2026-09-11",
    quotationThreadId: paidThread.id,
    companyId: null,
    userId: null,
  });
  check(
    "one quotation takes several partial dispatches, uncapped [04 quantities]",
    !!secondPartial.id,
  );

  /* --- 4. Direct dispatch [07 C6] -------------------------------- */

  console.log("\n4. Direct dispatch — approved by the coordinator, not by payment [07 C6]");
  const direct = await recordDispatch(coordinator, {
    sqm: "40.0000",
    dispatchDate: "2026-09-12",
    quotationThreadId: null,
    companyId: company.id,
    userId: repB.user.id,
  });
  check("no quotation, and it was allowed", direct.quotationThreadId === null);
  check(
    "the coordinator's approval is stamped [07 C6]",
    direct.approvedByUserId === coordinator.user.id && direct.approvedAt !== null,
  );
  const directDetail = await getDispatch(coordinator, direct.id);
  check("it reads back as direct", directDetail?.isDirect === true);
  const directOnly = await listDispatches(coordinator, { direct: true });
  check(
    "it is visible as such in reporting [07 C6]",
    directOnly.rows.some((row) => row.id === direct.id) &&
      !directOnly.rows.some((row) => row.id === linked.id),
  );
  await refuses(
    "a direct dispatch with no company is refused",
    "dispatches.errors.companyRequired",
    () =>
      recordDispatch(coordinator, {
        sqm: "1.0000",
        dispatchDate: "2026-09-12",
        quotationThreadId: null,
        companyId: null,
        userId: repB.user.id,
      }),
  );
  await refuses(
    "a direct dispatch with no rep is refused",
    "dispatches.errors.repRequired",
    () =>
      recordDispatch(coordinator, {
        sqm: "1.0000",
        dispatchDate: "2026-09-12",
        quotationThreadId: null,
        companyId: company.id,
        userId: null,
      }),
  );
  await refuses(
    "zero square metres is refused",
    "dispatches.errors.sqmPositive",
    () =>
      recordDispatch(coordinator, {
        sqm: "0.0000",
        dispatchDate: "2026-09-12",
        quotationThreadId: null,
        companyId: company.id,
        userId: repB.user.id,
      }),
  );

  /* --- 5. Recording a dispatch never sets a split ---------------- */

  console.log("\n5. Recording a dispatch NEVER sets a credit split [07 D3], [12 §1]");
  const [splitCount] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(projectCreditSplits)
    .where(eq(projectCreditSplits.projectId, project.id));
  check(
    "four dispatches recorded, zero split rows written",
    splitCount.n === 0,
    `got ${splitCount.n}`,
  );

  /* --- 6. No split in force → the dispatch's own rep [18 §1] ----- */

  console.log("\n6. With no split, credit goes to the rep on the dispatch [18 §1]");
  const linkedCredit = await creditOf({
    id: linked.id,
    userId: linked.userId,
    userName: "rep A",
    sqm: linked.sqm,
    dispatchDate: linked.dispatchDate,
    projectId: project.id,
  });
  check("basis is the dispatch's rep", linkedCredit.basis === "dispatch_rep");
  check(
    "repA takes all 100.0000",
    linkedCredit.shares.length === 1 &&
      linkedCredit.shares[0].userId === repA.user.id &&
      linkedCredit.shares[0].sqm === "100.0000",
  );
  const directCredit = await creditOf({
    id: direct.id,
    userId: direct.userId,
    userName: "rep B",
    sqm: direct.sqm,
    dispatchDate: direct.dispatchDate,
    projectId: null, // a direct dispatch has no project at all
  });
  check(
    "a direct dispatch credits its named rep in full",
    directCredit.basis === "dispatch_rep" &&
      directCredit.shares[0].userId === repB.user.id &&
      directCredit.shares[0].sqm === "40.0000",
  );

  /* --- 7. The split in force on the dispatch's OWN date ---------- */

  console.log("\n7. The split in force on each dispatch's own date [07 D3] — the central claim");
  await setCreditSplit(manager, project.id, {
    effectiveFrom: "2026-09-01",
    userIds: [repA.user.id, repB.user.id],
  });
  const g1 = await getCreditSplitInForce(manager, project.id, "2026-09-15");
  check(
    "G1 divides equally, two ways [18 §3]",
    g1?.rows.length === 2 && g1.rows.every((row) => row.percentage === "50.00"),
    `got ${g1?.rows.map((row) => row.percentage).join("/")}`,
  );

  const d1 = {
    id: linked.id,
    userId: linked.userId,
    userName: "rep A",
    sqm: linked.sqm,
    dispatchDate: linked.dispatchDate, // 2026-09-10
    projectId: project.id,
  };
  const d1Credit = await creditOf(d1);
  check("D1 now uses the split", d1Credit.basis === "split");
  check(
    "D1's generation is G1",
    d1Credit.generationEffectiveFrom === "2026-09-01",
  );
  check(
    "D1 credits 50.0000 each",
    d1Credit.shares.every((share) => share.sqm === "50.0000"),
    `got ${d1Credit.shares.map((s) => s.sqm).join("/")}`,
  );

  // A later generation — three ways this time, so the odd fraction shows.
  // **Set by the COORDINATOR**, which is the whole of `12 §1`: the flag was
  // granted to them because they perform the dispatch, and `16 §8` gives them
  // no project visibility, so a strict project check would have made a
  // founder-granted flag unusable. This script found that on its first run.
  await setCreditSplit(coordinator, project.id, {
    effectiveFrom: "2026-10-01",
    userIds: [repA.user.id, repB.user.id, repC.user.id],
  });
  const g2 = await getCreditSplitInForce(manager, project.id, "2026-10-15");
  check(
    "G2 divides three ways and still totals 100.00 [18 §5]",
    g2?.rows.map((row) => row.percentage).join("/") === "33.34/33.33/33.33",
    `got ${g2?.rows.map((row) => row.percentage).join("/")}`,
  );

  const d1Again = await creditOf(d1);
  check(
    "*** D1's credit is UNCHANGED by the later generation [07 D3] ***",
    d1Again.generationEffectiveFrom === "2026-09-01" &&
      d1Again.shares.every((share) => share.sqm === "50.0000"),
    `got ${d1Again.generationEffectiveFrom} ${d1Again.shares.map((s) => s.sqm).join("/")}`,
  );

  const d2Row = await recordDispatch(coordinator, {
    sqm: "100.0000",
    dispatchDate: "2026-10-05",
    quotationThreadId: paidThread.id,
    companyId: null,
    userId: null,
  });
  const d2Credit = await creditOf({
    id: d2Row.id,
    userId: d2Row.userId,
    userName: "rep A",
    sqm: d2Row.sqm,
    dispatchDate: d2Row.dispatchDate,
    projectId: project.id,
  });
  check(
    "D2 uses G2 — 33.3334 / 33.3333 / 33.3333",
    d2Credit.shares.map((share) => share.sqm).join("/") ===
      "33.3334/33.3333/33.3333",
    `got ${d2Credit.shares.map((s) => s.sqm).join("/")}`,
  );
  check(
    "and the shares add back to exactly 100.0000 [18 §5]",
    sumSqm(d2Credit.shares.map((share) => share.sqm)) === "100.0000",
    `got ${sumSqm(d2Credit.shares.map((share) => share.sqm))}`,
  );

  const [g1Survives] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(projectCreditSplits)
    .where(
      and(
        eq(projectCreditSplits.projectId, project.id),
        eq(projectCreditSplits.effectiveFrom, "2026-09-01"),
      ),
    );
  check(
    "G1's rows still exist — nothing edited, nothing deleted [07 D3]",
    g1Survives.n === 2,
    `got ${g1Survives.n}`,
  );

  /* --- 8. Generation refusals [18 §3], [18 §4] ------------------- */

  console.log("\n8. Setting a split refuses for its own reasons");
  await refuses(
    "an empty split is refused",
    "credit.errors.splitNeedsRow",
    () =>
      setCreditSplit(manager, project.id, {
        effectiveFrom: "2026-11-01",
        userIds: [],
      }),
  );
  await refuses(
    "the same person twice is refused",
    "credit.errors.splitDuplicateUser",
    () =>
      setCreditSplit(manager, project.id, {
        effectiveFrom: "2026-11-01",
        userIds: [repA.user.id, repA.user.id],
      }),
  );
  await refuses(
    "backdating is refused [18 §4]",
    "credit.errors.splitNotBackdated",
    () =>
      setCreditSplit(manager, project.id, {
        effectiveFrom: "2020-01-01",
        userIds: [repA.user.id, repB.user.id],
      }),
  );

  /* --- 9. Equal division loses nothing — pure [18 §5] ------------ */

  console.log("\n9. Equal division never loses a square metre [18 §5] — no database");
  const cases: [string, number, string][] = [
    ["100.0000", 3, "33.3334/33.3333/33.3333"],
    ["100.0000", 1, "100.0000"],
    ["100.0000", 2, "50.0000/50.0000"],
    ["1.0001", 3, "0.3334/0.3334/0.3333"],
    ["86.3040", 2, "43.1520/43.1520"],
  ];
  for (const [total, count, expected] of cases) {
    const shares = divideEqually(toScaled(total, SQM_SCALE), count).map((s) =>
      fromScaled(s, SQM_SCALE),
    );
    check(
      `${total} over ${count} = ${expected}`,
      shares.join("/") === expected,
      `got ${shares.join("/")}`,
    );
    check(`  …and sums back to ${total}`, sumSqm(shares) === total, `got ${sumSqm(shares)}`);
  }
  for (const count of [3, 6, 7, 9]) {
    const percents = divideEqually(toScaled("100.00", PERCENT_SCALE), count);
    const total = fromScaled(
      percents.reduce((sum, value) => sum + value, BigInt(0)),
      PERCENT_SCALE,
    );
    check(
      `a ${count}-way split still totals exactly 100.00`,
      total === "100.00",
      `got ${total}`,
    );
  }

  /* --- 10. Targets are rows, never edits [07 D1], [10 §6] -------- */

  console.log("\n10. Targets are superseding rows, never edits [07 D1], [10 §6]");
  await setTarget(manager, repA.user.id, "2026-09", "500.0000");
  await setTarget(manager, repA.user.id, "2026-09", "600.0000");
  const history = await listTargetHistory(manager, repA.user.id, "2026-09");
  check(
    "a same-month correction wrote a SECOND row, not an edit",
    history.length === 2,
    `got ${history.length}`,
  );
  check(
    "both rows record who set them",
    history.every((row) => row.setByName.length > 0),
  );

  const september = await achievementForPeriod(manager, "2026-09");
  const repARow = september.find((row) => row.userId === repA.user.id);
  check(
    "achievement reads the latest row, 600.0000",
    repARow?.targetSqm === "600.0000",
    `got ${repARow?.targetSqm}`,
  );
  const repBRow = september.find((row) => row.userId === repB.user.id);
  check(
    "a person with no target row is NOT measured — null, not zero [07 D1]",
    repBRow?.targetSqm === null,
    `got ${repBRow?.targetSqm}`,
  );

  /* --- 11. Achievement never reads the quotation ----------------- */

  console.log("\n11. Achievement comes from dispatches and nowhere else [04 C1]");
  // September holds: D1 (100, split 50/50), the 5000 partial (split 50/50),
  // and the direct 40 to repB.
  check(
    "repA is credited 50 + 2500 = 2550.0000 from the split dispatches",
    repARow?.achievedSqm === "2550.0000",
    `got ${repARow?.achievedSqm}`,
  );
  check(
    "repB is credited 2550 linked + 40 direct = 2590.0000",
    repBRow?.achievedSqm === "2590.0000",
    `got ${repBRow?.achievedSqm}`,
  );
  check(
    "the direct route is countable on its own [07 C6]",
    repBRow?.directSqm === "40.0000" && repBRow?.linkedSqm === "2550.0000",
    `got direct ${repBRow?.directSqm}, linked ${repBRow?.linkedSqm}`,
  );
  check(
    "the 10 m² service line contributed nothing [08 D4], [12 §10]",
    // The quotation carries 86.3040 product m² and 10 service m²; achievement
    // is 100 + 5000 dispatched. Neither figure appears.
    repARow?.achievedSqm === "2550.0000",
  );
  const august = await achievementForPeriod(manager, "2026-08");
  const augustRepA = august.find((row) => row.userId === repA.user.id);
  check(
    "an accepted, PAID, undispatched quotation credits nothing [16 §5]",
    augustRepA?.achievedSqm === "0.0000",
    `got ${augustRepA?.achievedSqm}`,
  );
  const october = await achievementForPeriod(manager, "2026-10");
  const octoberShares = [repA.user.id, repB.user.id, repC.user.id].map(
    (id) => october.find((row) => row.userId === id)?.achievedSqm ?? "0.0000",
  );
  check(
    "October is a separate month, unaffected by September",
    octoberShares.every((sqm) => sqm.startsWith("33.333")),
    `got ${octoberShares.join("/")}`,
  );
  check(
    "…and the month's credited total equals the month's dispatched total [18 §5]",
    sumSqm(octoberShares) === "100.0000",
    `got ${sumSqm(octoberShares)}`,
  );

  /* --- 12. Visibility [18 §2] ------------------------------------ */

  console.log("\n12. Visibility — and the negative half [16 §8], [18 §2]");
  /*
   * Scoped to THIS RUN's company, deliberately.
   *
   * The first version asked `listDispatches(coordinator, {})` and looked for
   * these two ids on page one. `listDispatches` pages at 25 and orders by
   * `dispatch_date desc`, and this script writes hard-coded September dates, so
   * once a dev database had accumulated enough runs the earliest of them fell
   * off page one and the check failed while `18 §2` was working perfectly.
   *
   * That is the same family as the two traps already recorded — the whole-log
   * audit scan in `verify:phase11` §16, and this script's own reuse of shared
   * fixture accounts. A page-one question is not the question `18 §2` asks; the
   * claim is that the coordinator can see them at all, and `companyId` narrows
   * to exactly this run without weakening it.
   */
  const coordinatorList = await listDispatches(coordinator, {
    companyId: company.id,
  });
  check(
    "the coordinator sees every dispatch [18 §2]",
    coordinatorList.rows.some((row) => row.id === direct.id) &&
      coordinatorList.rows.some((row) => row.id === linked.id),
    `saw ${coordinatorList.rows.length} of ${coordinatorList.total} for this run's company`,
  );
  check(
    "…while sees_all_reps is still false",
    coordinator.user.role.seesAllReps === false,
  );
  check(
    "the coordinator may NOT open the company record [16 §8], [18 §2]",
    (await canViewRecord(coordinator, "company", company.id)) === false,
  );
  const coordinatorRow = coordinatorList.rows.find((row) => row.id === direct.id);
  check(
    "…the screen knows not to link it",
    coordinatorRow?.companyViewable === false,
  );
  check(
    "…but the company NAME is present. Names yes, records no.",
    (coordinatorRow?.companyNameEn.length ?? 0) > 0,
  );

  check(
    "repA sees a dispatch that names repA",
    (await getDispatch(repA, linked.id)) !== null,
  );
  check(
    "repB DOES see the direct dispatch that names repB",
    (await getDispatch(repB, direct.id)) !== null,
  );

  // The thread-cascade term, isolated. `linked` names repA, so repC reaches it
  // through neither ownership nor name — only through the project.
  check(
    "repC cannot see a dispatch that names someone else on a project they cannot see",
    (await getDispatch(repC, linked.id)) === null,
  );
  await db.insert(recordShares).values({
    recordType: "project",
    recordId: project.id,
    sharedWithUserId: repC.user.id,
    sharedByUserId: manager.user.id,
  });
  check(
    "…and sharing the PROJECT reveals it — project → thread → dispatch [11 §2]",
    (await getDispatch(repC, linked.id)) !== null,
  );

  // Stated rather than papered over: repB is credited 50% of `linked` by G1 and
  // still cannot see it, because they hold neither the project nor the thread.
  // No document asks for a "dispatches that credit me" visibility term, and one
  // is not invented here. The rep's own total is on `/targets` either way.
  check(
    "a split-credited rep with no project or thread access still cannot open it",
    (await getDispatch(repB, linked.id)) === null,
  );
  const repBTargets = await achievementForPeriod(repB, "2026-09");
  check(
    "a rep's targets screen shows exactly one row — their own",
    repBTargets.length === 1 && repBTargets[0].userId === repB.user.id,
    `got ${repBTargets.length} rows`,
  );

  /* --- 13. Every write is audited [07 E1] ------------------------ */

  console.log("\n13. Every write is audited [07 E1]");
  const dispatchAudit = await db
    .select({ action: auditLog.action, actor: auditLog.actorUserId })
    .from(auditLog)
    .where(
      and(
        eq(auditLog.entityType, "dispatch"),
        eq(auditLog.entityId, linked.id),
      ),
    );
  check(
    "dispatch.recorded exists, under the coordinator",
    dispatchAudit.some(
      (row) =>
        row.action === "dispatch.recorded" &&
        row.actor === coordinator.user.id,
    ),
  );
  const projectAudit = await db
    .select({ action: auditLog.action, after: auditLog.after })
    .from(auditLog)
    .where(
      and(eq(auditLog.entityType, "project"), eq(auditLog.entityId, project.id)),
    );
  const splitEntry = projectAudit.find(
    (row) => row.action === "project_credit_split.set",
  );
  check("project_credit_split.set exists", splitEntry !== undefined);
  check(
    "…and it carries the whole generation, not one row",
    Array.isArray((splitEntry?.after as { rows?: unknown[] })?.rows) &&
      ((splitEntry?.after as { rows: unknown[] }).rows.length ?? 0) >= 2,
  );
  const targetAudit = await db
    .select({ action: auditLog.action })
    .from(auditLog)
    .where(
      and(eq(auditLog.entityType, "user"), eq(auditLog.entityId, repA.user.id)),
    );
  check(
    "target.set exists",
    targetAudit.some((row) => row.action === "target.set"),
  );

  const actions = await db
    .select({ action: auditLog.action })
    .from(auditLog)
    .where(
      sql`${auditLog.action} like 'dispatch%' or ${auditLog.action} like 'project_credit_split%' or ${auditLog.action} like 'target%'`,
    )
    .groupBy(auditLog.action);
  console.log(
    `        actions seen: ${actions.map((row) => row.action).sort().join(", ")}`,
  );

  // Nothing is cleaned up: FACET does not delete history `[12 §7]`, and this
  // script does not get an exception. Every row it writes is prefixed with the
  // run's timestamp so a development database stays readable.
  void dispatchesTable;
  void targetsTable;
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
