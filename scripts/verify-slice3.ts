/**
 * Verification scaffolding for dispatch, credit splits and targets — NOT a
 * feature.
 *
 * `scripts/verify-slice2.ts` is the pattern this copies, for the reason
 * `CLAUDE.md` records: the throwaway script that verified the auth checklist
 * was deleted, so its results cannot be reproduced. This one is **kept**.
 *
 * It drives `src/lib/dispatches.ts`, `src/lib/credit-splits.ts`,
 * `src/lib/targets.ts` and — since `S26` — the buyer derivation in
 * `src/lib/projects.ts` in process: no browser, no HTTP. It checks the things
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
 *  14. Who bought is DERIVED from dispatches, never flagged `S26` — two
 *      participants may both have bought, a direct dispatch reaches no project
 *      `S75`, and a participant with nothing dispatched is `null` and not
 *      `"0.0000"`. That last one is asserted by identity: a truthiness test
 *      passes on the zero it exists to distinguish.
 *
 *  15. **The project is recorded on the dispatch** `S74`. Both branches: a
 *      quotation that has one hands it over, and a quotation that has none
 *      `S50` gains the coordinator's choice — written back onto the quotation,
 *      with its company added to that project as a participant `S27`. Plus
 *      the two refusals, and the derived figure `S26` reaching a project it
 *      could not have reached before this slice.
 *
 *  17. **Only from an ISSUED quotation** `S126`. A paid but unissued thread is
 *      refused and not offered, and issuing it makes the same call go through
 *      — the pair, because a refusal on its own could be the payment gate.
 *
 *  18. **A dispatch carries its own lines, raised three ways** `S116` `S75`.
 *      Exactly as a quotation, from a quotation with edits, and free entry;
 *      the quotation is untouched by the edit `S77`; a line with no price and
 *      a dispatch with no line are both refused. Then the invariant, over
 *      every dispatch in the database rather than the ones this run wrote:
 *      **no reader's figure disagrees with the lines**, because the figure is
 *      derived from them and there is no column left to hold a second answer.
 *
 *  16. **The coordinator sees projects and contacts** `S76`, in three
 *      directions rather than one. They reach both records and the dispatch
 *      screen may link the project; every write on either is still refused,
 *      each with its own key, because `S76` grants sight and `S62` names what
 *      a coordinator may do; and a rep who could not see the project still
 *      cannot `S30`. Two of its checks are a **pair**: the owner's waiting
 *      list holds a stale project and the coordinator's does not, which is what
 *      proves the read filter did not leak into the queue.
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
  dispatchLines,
  dispatches as dispatchesTable,
  productClasses,
  productFireRatings,
  productSuppliers,
  productThicknesses,
  projectCompanies,
  projectCreditSplits,
  projects,
  quotationThreads,
  recordShares,
  roles,
  serviceTypes,
  targets as targetsTable,
  users,
} from "@/db/schema";
import { canOpenRecord, canViewRecord, type AuthSession } from "@/lib/authz";
import { addComment } from "@/lib/comments";
import {
  createContact,
  getContact,
  listContacts,
  updateContact,
} from "@/lib/contacts";
import {
  creditForDispatches,
  getCreditSplitInForce,
  setCreditSplit,
} from "@/lib/credit-splits";
import {
  PERCENT_SCALE,
  SQM_SCALE,
  divideEqually,
  fromScaled,
  toScaled,
} from "@/lib/decimal";
import {
  approveDispatchRequest,
  dispatchesInPeriod,
  getDispatch,
  listDispatchProjectOptions,
  listDispatchableThreads,
  listDispatches,
  refuseDispatchRequest,
  requestDispatch,
  reviveDispatchRequest,
  submitDispatchRequest,
  updateDispatchRequest,
  type Dispatch,
  type DispatchInput,
} from "@/lib/dispatches";
import { SAUDI_CODE } from "@/lib/enums";
import { followUpsForRecipient, setNextFollowUp } from "@/lib/follow-ups";
import { listCountries, listLossReasons } from "@/lib/lookups";
import {
  addProjectCompany,
  createProject,
  getProject,
  listProjectCompanies,
  listProjects,
  updateProject,
} from "@/lib/projects";
import {
  acceptThread,
  addServiceLine,
  confirmPayment,
  createQuotationThread,
  getQuotationThread,
  issueVersion,
  listQuotationFormOptions,
  type QuotationVersionInput,
} from "@/lib/quotations";
import {
  achievementForPeriod,
  listTargetHistory,
  setTarget,
} from "@/lib/targets";
import { projectTimeline } from "@/lib/timeline";

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

/**
 * One dispatch line adding up to exactly `sqm` `S116`.
 *
 * **Width and length are 1**, so `quantity_pcs × 1 × 1` is the figure asked
 * for. Every square-metre assertion in this script predates the lines and is
 * about credit, targets and `S26` rather than about panels, so shaping the
 * line to the number keeps those claims exactly as they were rather than
 * rewriting thirty expected values. §17 drives real dimensions.
 *
 * Set by `main` once the lookups are read, because a line needs four seeded
 * ids and this file's helpers are declared above them.
 */
let lookups: {
  supplierId: string;
  classId: string;
  fireRatingId: string;
  thicknessId: string;
};

function linesOf(sqm: string, unitPrice = "95.00") {
  return [
    {
      ...lookups,
      customColour: "168",
      widthM: "1.0000",
      lengthM: "1.0000",
      quantityPcs: sqm,
      unitPrice,
    },
  ];
}

/**
 * Request, submit and approve in one call `S72` — a dispatch that **counts**.
 *
 * Every section below that asserts a figure needs an approved dispatch, and
 * `S72` makes that three acts rather than one. The helper is deliberately
 * *not* a re-created `recordDispatch`: it is named for what it produces, so a
 * section that wants a request sitting with the coordinator has to spell out
 * the two acts it does want and cannot reach approval by accident.
 *
 * Run as **one identity throughout**, which is `S127` — the coordinator may
 * raise a request against her own company and approve it herself, and nothing
 * blocks the same person from both acts. §21 asserts that on its own rather
 * than leaning on this helper's convenience.
 */
async function approvedDispatch(
  session: AuthSession,
  input: DispatchInput,
): Promise<Dispatch> {
  const request = await requestDispatch(session, input);
  await submitDispatchRequest(session, request.id);
  await approveDispatchRequest(session, request.id);
  const [row] = await db
    .select()
    .from(dispatchesTable)
    .where(eq(dispatchesTable.id, request.id))
    .limit(1);
  return row;
}

/** Sum a list of scale-4 sqm strings exactly, as a string. */
function sumSqm(values: string[]): string {
  return fromScaled(
    values.reduce(
      (total, value) => total + toScaled(value, SQM_SCALE),
      BigInt(0),
    ),
    SQM_SCALE,
  );
}

/**
 * A dispatch's square metres, derived `S116` — `sum(dispatch_lines.sqm)`.
 *
 * The write functions return the `dispatches` row, which no longer carries the
 * figure, so every caller that needs it asks the lines. That is the point:
 * there is no second place it could have come from.
 */
async function sqmOf(dispatchId: string): Promise<string> {
  const [row] = await db
    .select({
      total: sql<string>`coalesce(sum(dispatch_lines.sqm), 0)::numeric(14, 4)`,
    })
    .from(dispatchLines)
    .where(eq(dispatchLines.dispatchId, dispatchId));
  return row?.total ?? "0.0000";
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
      {
        name: `${stamp} Rep A`,
        email: `${stamp}-a@example.test`,
        roleId: repRole.id,
      },
      {
        name: `${stamp} Rep B`,
        email: `${stamp}-b@example.test`,
        roleId: repRole.id,
      },
      // The third member of the three-way split. A run-scoped rep rather than
      // the shared coordinator account, so October's total is this run's alone.
      {
        name: `${stamp} Rep C`,
        email: `${stamp}-c@example.test`,
        roleId: repRole.id,
      },
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
  lookups = {
    supplierId: supplier.id,
    classId: productClass.id,
    fireRatingId: fireRating.id,
    thicknessId: thickness.id,
  };

  /* --- Fixtures: a company and a project owned by rep A ----------- */

  // `S13` makes the phone mandatory and `S23` matches companies on it, so the
  // fixture gets its own — from the run stamp, because a shared literal would
  // make each run's company a duplicate of the last run's. `S14` — it is Saudi,
  // so `S15`'s city and region still apply.
  const saudiId = (await listCountries()).find(
    (row) => row.code === SAUDI_CODE,
  )!.id;

  const [company] = await db
    .insert(companies)
    .values({
      name: `${stamp} Co`,
      nameNormalized: stamp,
      phone: `+9665${stamp.slice(-7)}1`,
      countryId: saudiId,
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
    .values({ projectId: project.id, companyId: company.id });

  const line = {
    supplierId: supplier.id,
    classId: productClass.id,
    fireRatingId: fireRating.id,
    customColour: "168",
    thicknessId: thickness.id,
    widthM: "1.2400",
    lengthM: "5.8000",
    quantityPcs: "12.0000", // 86.3040 m²
    unitPrice: "120.00",
  };
  // Annotated, not inferred: `stock` in a bare object literal widens to
  // `string` and would never satisfy `Stock` `S118`.
  const version: QuotationVersionInput = {
    stock: "south",
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

  // Thread 2 — issued, never paid. The payment gate's subject, and since
  // `S72` it has to be ISSUED to be one: the gate now fires at the approval,
  // and a thread that was never issued is refused earlier, by `S126`. An
  // unissued thread would prove the wrong refusal.
  const unpaidThread = await createQuotationThread(
    repA,
    { projectId: project.id, companyId: company.id, contactId: null },
    version,
    [line],
    [],
  );
  await issueVersion(coordinator, unpaidThread.id, {
    smacReference: `${stamp}-unpaid`,
    verification: "unverified",
  });

  /* --- 1. The flags are reachable, on the right roles ------------- */

  console.log(
    "\n1. The flags exist and the seed grants them correctly [12 §1, §3]",
  );
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
    lines: linesOf("10.0000"),
    dispatchDate: "2026-09-10",
    quotationThreadId: null,
    companyId: company.id,
    userId: repB.user.id,
    projectId: null,
  };

  // **`S72` inverted the first two of these.** They used to assert that a rep
  // and a manager could not dispatch at all, with
  // `dispatches.errors.dispatchOnly` — the key, and the gate behind it, are
  // both gone. What replaced them is a positive and a negative: a rep may
  // RAISE one with no flag, and may not APPROVE it. §19 walks the whole of a
  // rep's path; this is the gate half, beside the other gates it belongs with.
  const repRequest = await requestDispatch(repA, {
    lines: linesOf("10.0000"),
    dispatchDate: "2026-09-10",
    quotationThreadId: null,
    companyId: company.id,
    userId: null,
    projectId: null,
  });
  check(
    "*** a rep raises a dispatch request with NO flag *** [S72]",
    repRequest.status === "draft" && repRequest.userId === repA.user.id,
    `got status ${repRequest.status}`,
  );
  await submitDispatchRequest(repA, repRequest.id);
  await refuses(
    "*** but a rep may NOT approve one *** [S72]",
    "dispatches.errors.approveOnly",
    () => approveDispatchRequest(repA, repRequest.id),
  );
  await refuses(
    "and neither may the manager — approving is operational [12 §3]",
    "dispatches.errors.approveOnly",
    () => approveDispatchRequest(manager, repRequest.id),
  );
  await refuses(
    "a rep may not refuse one either [S124]",
    "dispatches.errors.refuseOnly",
    () => refuseDispatchRequest(repA, repRequest.id, "no"),
  );
  await refuses(
    "a rep may not name another rep on a free entry [S108]",
    "dispatches.errors.repNotSelf",
    () => requestDispatch(repA, directInput),
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

  console.log(
    "\n3. The payment gate fires on the APPROVAL, not the request [S72], [07 C3]",
  );

  // **The gate moved, and this section is where that is visible.** It used to
  // refuse at `recordDispatch`; a rep could not even ASK until finance had
  // confirmed, which sits absurdly beside `S71`, whose *on delivery* method is
  // by definition not confirmed before the goods move. `S72` puts the half
  // that deals with finance on the coordinator, so the request goes through
  // and the approval is what refuses. `S73` replaces the condition itself in
  // the payment slice; this moved only where it fires.
  //
  // An unissued quotation is a different matter and still refuses at the
  // request: `S126` is about what may be dispatched against at all.
  const unpaidRequest = await requestDispatch(coordinator, {
    lines: linesOf("10.0000"),
    dispatchDate: "2026-09-10",
    quotationThreadId: unpaidThread.id,
    companyId: null,
    userId: null,
    projectId: null,
  });
  check(
    "*** an unpaid quotation may be REQUESTED against *** [S72]",
    unpaidRequest.status === "draft",
  );
  await submitDispatchRequest(coordinator, unpaidRequest.id);
  await refuses(
    "*** and refuses at the approval instead *** [S72], [07 C3]",
    "dispatches.errors.paymentNotConfirmed",
    () => approveDispatchRequest(coordinator, unpaidRequest.id),
  );
  check(
    "an unpaid quotation IS offered now — the list matches the write [S72]",
    (await listDispatchableThreads(coordinator)).some(
      (thread) => thread.id === unpaidThread.id,
    ),
  );
  check(
    "and the refused approval left the request submitted, not half-approved",
    (await getDispatch(coordinator, unpaidRequest.id))?.status === "submitted",
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

  const linked = await approvedDispatch(coordinator, {
    lines: linesOf("100.0000"),
    dispatchDate: "2026-09-10",
    quotationThreadId: paidThread.id,
    companyId: null,
    userId: null,
    projectId: null,
  });
  check("the dispatch was approved once payment was confirmed", !!linked.id);
  check(
    "company derived from the thread, not asked for [18 §7]",
    linked.companyId === company.id,
  );
  check(
    "rep derived from the thread's raiser [18 §7]",
    linked.userId === repA.user.id,
  );
  check(
    "*** and BOTH routes now carry the same approval *** [S72]",
    linked.approvedByUserId === coordinator.user.id &&
      linked.approvedAt !== null &&
      linked.status === "approved",
  );
  await refuses(
    "a company disagreeing with the thread is refused",
    "dispatches.errors.companyNotOnThread",
    () =>
      approvedDispatch(coordinator, {
        lines: linesOf("1.0000"),
        dispatchDate: "2026-09-10",
        quotationThreadId: paidThread.id,
        companyId: project.id, // any id that is not the thread's company
        userId: null,
        projectId: null,
      }),
  );

  const secondPartial = await approvedDispatch(coordinator, {
    lines: linesOf("5000.0000"), // far beyond the 86.3040 m² quoted
    dispatchDate: "2026-09-11",
    quotationThreadId: paidThread.id,
    companyId: null,
    userId: null,
    projectId: null,
  });
  check(
    "one quotation takes several partial dispatches, uncapped [04 quantities]",
    !!secondPartial.id,
  );

  /* --- 4. Direct dispatch [07 C6] -------------------------------- */

  console.log(
    "\n4. Free entry — no quotation, and the same approval as any other [07 C6]",
  );
  const direct = await approvedDispatch(coordinator, {
    lines: linesOf("40.0000"),
    dispatchDate: "2026-09-12",
    quotationThreadId: null,
    companyId: company.id,
    userId: repB.user.id,
    projectId: null,
  });
  check("no quotation, and it was allowed", direct.quotationThreadId === null);
  // `07 C6` used to stamp the approval on this route ALONE, standing in for a
  // payment gate that had no object here. `S72` gives every route a real
  // approval act, so the special case is gone and the stamp means one thing.
  check(
    "the approval is stamped, as it is on every route now [S72]",
    direct.approvedByUserId === coordinator.user.id &&
      direct.approvedAt !== null,
  );
  const directDetail = await getDispatch(coordinator, direct.id);
  check("it reads back as direct", directDetail?.isDirect === true);
  // **Scoped to this run's company, because the list is paginated.** Asked
  // unscoped, both halves decay as the database grows: the row falls off page
  // one and the positive half fails, while the negative half starts passing
  // for the wrong reason. This run's company carries exactly these dispatches.
  const directOnly = await listDispatches(coordinator, {
    direct: true,
    companyId: company.id,
  });
  check(
    "it is visible as such in reporting [07 C6]",
    directOnly.rows.some((row) => row.id === direct.id) &&
      !directOnly.rows.some((row) => row.id === linked.id),
    `${directOnly.total} direct dispatch(es) against this run's company`,
  );
  await refuses(
    "a free entry with no company is refused",
    "dispatches.errors.companyRequired",
    () =>
      approvedDispatch(coordinator, {
        lines: linesOf("1.0000"),
        dispatchDate: "2026-09-12",
        quotationThreadId: null,
        companyId: null,
        userId: repB.user.id,
        projectId: null,
      }),
  );
  // **`repRequired` is gone** `S108`: a free entry with no rep named is not a
  // defect any more, it is the ordinary case — the raiser. Only a
  // `can_dispatch` holder may name somebody else, which §2 asserts from the
  // other side.
  const forSelf = await approvedDispatch(coordinator, {
    lines: linesOf("1.0000"),
    dispatchDate: "2026-09-12",
    quotationThreadId: null,
    companyId: company.id,
    userId: null,
    projectId: null,
  });
  check(
    "a free entry naming no rep credits the raiser [S108]",
    forSelf.userId === coordinator.user.id,
    `got ${forSelf.userId}`,
  );
  await refuses(
    "zero square metres is refused",
    "dispatches.errors.sqmPositive",
    () =>
      approvedDispatch(coordinator, {
        lines: linesOf("0.0000"),
        dispatchDate: "2026-09-12",
        quotationThreadId: null,
        companyId: company.id,
        userId: repB.user.id,
        projectId: null,
      }),
  );

  /* --- 5. Recording a dispatch never sets a split ---------------- */

  console.log(
    "\n5. Recording a dispatch NEVER sets a credit split [07 D3], [12 §1]",
  );
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

  console.log(
    "\n6. With no split, credit goes to the rep on the dispatch [18 §1]",
  );
  const linkedCredit = await creditOf({
    id: linked.id,
    userId: linked.userId,
    userName: "rep A",
    sqm: await sqmOf(linked.id),
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
    sqm: await sqmOf(direct.id),
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

  console.log(
    "\n7. The split in force on each dispatch's own date [07 D3] — the central claim",
  );
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
    sqm: await sqmOf(linked.id),
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

  const d2Row = await approvedDispatch(coordinator, {
    lines: linesOf("100.0000"),
    dispatchDate: "2026-10-05",
    quotationThreadId: paidThread.id,
    companyId: null,
    userId: null,
    projectId: null,
  });
  const d2Credit = await creditOf({
    id: d2Row.id,
    userId: d2Row.userId,
    userName: "rep A",
    sqm: await sqmOf(d2Row.id),
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

  console.log(
    "\n9. Equal division never loses a square metre [18 §5] — no database",
  );
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
    check(
      `  …and sums back to ${total}`,
      sumSqm(shares) === total,
      `got ${sumSqm(shares)}`,
    );
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

  console.log(
    "\n10. Targets are superseding rows, never edits [07 D1], [10 §6]",
  );
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

  console.log(
    "\n11. Achievement comes from dispatches and nowhere else [04 C1]",
  );
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
  const coordinatorRow = coordinatorList.rows.find(
    (row) => row.id === direct.id,
  );
  check(
    "…the screen knows not to link it",
    coordinatorRow?.companyViewable === false,
  );
  check(
    "…but the company NAME is present. Names yes, records no.",
    (coordinatorRow?.companyName.length ?? 0) > 0,
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
  // **Still a hand-written row, deliberately.** `grantShare` in
  // `src/lib/sharing.ts` is the real path as of feature slice 3, and this
  // fixture is not converted to it: this script asserts nothing about sharing,
  // so the coupling would buy no assertion and would make a slice-3 run fail
  // when sharing changed. What the two paths agree is asserted once, in
  // `verify-sharing.ts` §5, which follows a REAL project share down this exact
  // cascade — project → thread → dispatch — for that reason.
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
  // `S72` — one act became three, so one audit action became three. There is
  // no `dispatch.recorded` any more: nothing records a dispatch, somebody
  // requests one and somebody approves it, and the log has to say which.
  for (const action of [
    "dispatch.requested",
    "dispatch.submitted",
    "dispatch.approved",
  ]) {
    check(
      `${action} exists, under the coordinator [S72]`,
      dispatchAudit.some(
        (row) => row.action === action && row.actor === coordinator.user.id,
      ),
      dispatchAudit.map((row) => row.action).join(", "),
    );
  }
  const projectAudit = await db
    .select({ action: auditLog.action, after: auditLog.after })
    .from(auditLog)
    .where(
      and(
        eq(auditLog.entityType, "project"),
        eq(auditLog.entityId, project.id),
      ),
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
    `        actions seen: ${actions
      .map((row) => row.action)
      .sort()
      .join(", ")}`,
  );

  /* --- 14. Who bought is derived from dispatches `S26` ------------- */

  console.log(
    "\n14. Who bought is derived from dispatches, never flagged [S26]",
  );

  // A SECOND participant that also buys, and a THIRD that never does. The
  // fixture project already has `company`, which dispatched 100 + 5000 m²
  // against `paidThread` and — separately — 40 m² with no thread at all.
  const [buyerTwo] = await db
    .insert(companies)
    .values({
      name: `${stamp} Buyer Two`,
      nameNormalized: `${stamp}-buyer-two`,
      phone: `+9665${stamp.slice(-7)}2`,
      countryId: saudiId,
      createdBy: repA.user.id,
    })
    .returning();
  await db.insert(companyReps).values({
    companyId: buyerTwo.id,
    userId: repA.user.id,
    isPrimary: true,
    origin: "self_registered",
  });
  const [bystander] = await db
    .insert(companies)
    .values({
      name: `${stamp} Bystander`,
      nameNormalized: `${stamp}-bystander`,
      phone: `+9665${stamp.slice(-7)}3`,
      countryId: saudiId,
      createdBy: repA.user.id,
    })
    .returning();
  await db.insert(projectCompanies).values([
    { projectId: project.id, companyId: buyerTwo.id },
    { projectId: project.id, companyId: bystander.id },
  ]);

  /** This project's figure for one company, or null. */
  async function figureFor(companyId: string): Promise<string | null> {
    const rows = await listProjectCompanies(repA, project.id);
    return (
      rows.find((row) => row.companyId === companyId)?.dispatchedSqm ?? null
    );
  }

  const beforeSecondBuyer = await listProjectCompanies(repA, project.id);
  const firstBuyerBefore = beforeSecondBuyer.find(
    (row) => row.companyId === company.id,
  );
  check(
    "a participant that has dispatched carries a figure",
    firstBuyerBefore?.dispatchedSqm != null,
    `got ${JSON.stringify(firstBuyerBefore?.dispatchedSqm)}`,
  );

  // **Deltas, not totals.** Sections 3 and 7 both dispatch against `paidThread`
  // and either could gain a row; a hardcoded total would then fail for a reason
  // that has nothing to do with S26. What must hold is how the figure MOVES.
  const baseline = toScaled(firstBuyerBefore?.dispatchedSqm ?? "0", SQM_SCALE);

  // A direct dispatch has no thread, so it reaches no project `S75` — this is
  // the assertion that fails the day someone routes a dispatch to a project by
  // its company instead of by its quotation thread.
  await approvedDispatch(coordinator, {
    lines: linesOf("40.0000"),
    dispatchDate: "2026-09-13",
    quotationThreadId: null,
    companyId: company.id,
    userId: repB.user.id,
    projectId: null,
  });
  check(
    "*** a DIRECT dispatch moves the project figure not at all *** [S26], [S75]",
    toScaled((await figureFor(company.id)) ?? "0", SQM_SCALE) === baseline,
    `${firstBuyerBefore?.dispatchedSqm} → ${await figureFor(company.id)}`,
  );

  // And a linked one moves it by exactly its own square metres.
  await approvedDispatch(coordinator, {
    lines: linesOf("7.0000"),
    dispatchDate: "2026-09-13",
    quotationThreadId: paidThread.id,
    companyId: null,
    userId: null,
    projectId: null,
  });
  check(
    "a LINKED dispatch moves it by exactly its own square metres [S26]",
    toScaled((await figureFor(company.id)) ?? "0", SQM_SCALE) ===
      baseline + toScaled("7.0000", SQM_SCALE),
    `expected ${fromScaled(baseline + toScaled("7.0000", SQM_SCALE), SQM_SCALE)}, got ${await figureFor(company.id)}`,
  );

  // *** `=== null`, never `!x`. *** "Absent" and "zero" is the distinction the
  // derivation exists to make, and a truthiness test passes on `"0.0000"` and
  // `""` alike — it would pass against exactly the bug it is here to catch.
  const bystanderBefore = beforeSecondBuyer.find(
    (row) => row.companyId === bystander.id,
  );
  check(
    "a participant with no dispatch is present on the project",
    bystanderBefore !== undefined,
  );
  check(
    "*** and its figure is null, NOT '0.0000' *** [S26]",
    bystanderBefore?.dispatchedSqm === null,
    `got ${JSON.stringify(bystanderBefore?.dispatchedSqm)}`,
  );

  const buyerTwoBefore = beforeSecondBuyer.find(
    (row) => row.companyId === buyerTwo.id,
  );
  check(
    "a participant that has not dispatched YET is null too",
    buyerTwoBefore?.dispatchedSqm === null,
    `got ${JSON.stringify(buyerTwoBefore?.dispatchedSqm)}`,
  );

  // Now the second participant buys, through its own thread on the same
  // project. `S26`: two participants may both have bought.
  const secondThread = await createQuotationThread(
    repA,
    { projectId: project.id, companyId: buyerTwo.id, contactId: null },
    version,
    [line],
    [],
  );
  await issueVersion(coordinator, secondThread.id, {
    smacReference: `${stamp}-9593`,
    verification: "unverified",
  });
  await acceptThread(coordinator, secondThread.id);
  await confirmPayment(repA, secondThread.id, "2026-08-02");
  await approvedDispatch(coordinator, {
    lines: linesOf("250.0000"),
    dispatchDate: "2026-09-13",
    quotationThreadId: secondThread.id,
    companyId: null,
    userId: null,
    projectId: null,
  });

  const afterSecondBuyer = await listProjectCompanies(repA, project.id);
  const byCompany = new Map(
    afterSecondBuyer.map((row) => [row.companyId, row.dispatchedSqm]),
  );
  // **Both, at once.** Under the old flag this state was unreachable: a partial
  // unique index refused a second buyer on a project, and naming one cleared
  // the other. Nothing was ticked here and nothing was cleared.
  check(
    "*** two participants may BOTH have bought — no flag moved *** [S26]",
    byCompany.get(company.id) ===
      fromScaled(baseline + toScaled("7.0000", SQM_SCALE), SQM_SCALE) &&
      byCompany.get(buyerTwo.id) === "250.0000",
    `got ${byCompany.get(company.id)} and ${byCompany.get(buyerTwo.id)}`,
  );
  check(
    "the third participant is STILL null, by identity — not zeroed by the sum",
    byCompany.get(bystander.id) === null,
    `got ${JSON.stringify(byCompany.get(bystander.id))}`,
  );
  // Ordering was `desc(is_buyer), name` and is now name alone. Nothing floats
  // to the top: not a flag, which is gone, and not the biggest figure either —
  // `company` has 5100 m² against Buyer Two's 250 and still sorts third.
  check(
    "participants come back in NAME order, with nothing floated to the top [S26]",
    afterSecondBuyer.map((row) => row.companyName).join(" | ") ===
      [`${stamp} Buyer Two`, `${stamp} Bystander`, `${stamp} Co`].join(" | "),
    afterSecondBuyer.map((row) => row.companyName).join(" | "),
  );

  /* --- 15. The project is recorded on the dispatch [S74] ---------------- */

  console.log("\n15. *** The project is on the dispatch *** [S74], [S50]");

  // Branch one: the quotation HAS a project, so the dispatch takes it. Every
  // dispatch above already exercised this; what none of them proved is that
  // the column was written, rather than the figure still arriving through the
  // thread. `paidThread` belongs to `project`.
  const takenFrom = await approvedDispatch(coordinator, {
    lines: linesOf("3.0000"),
    dispatchDate: "2026-09-14",
    quotationThreadId: paidThread.id,
    companyId: null,
    userId: null,
    projectId: null,
  });
  check(
    "*** a dispatch takes its quotation's project — shown, not chosen *** [S74]",
    takenFrom.projectId === project.id,
    `got ${takenFrom.projectId}, expected ${project.id}`,
  );

  // …and a project that disagrees is refused, not silently corrected — the
  // twin of `companyNotOnThread`, which section 3 proves for the company.
  const otherProject = await createProject(
    repA,
    {
      nameEn: `${stamp} Other Project`,
      nameAr: null,
      sqmExpected: null,
      cityId: null,
      endState: null,
      lostReasonId: null,
      lossReason: null,
      inProduction: false,
    },
    [{ companyId: company.id }],
  );
  await refuses(
    "a dispatch whose project differs from its quotation's is refused [S74]",
    "dispatches.errors.projectNotOnThread",
    () =>
      approvedDispatch(coordinator, {
        lines: linesOf("1.0000"),
        dispatchDate: "2026-09-14",
        quotationThreadId: paidThread.id,
        companyId: null,
        userId: null,
        projectId: otherProject.id,
      }),
  );

  // Branch two: a quotation with NO project `S50`, taken to paid. Its company
  // is deliberately one that is NOT a participant of `otherProject`, so the
  // participant this dispatch adds is one that was not there before.
  const [outsider] = await db
    .insert(companies)
    .values({
      name: `${stamp} Outsider`,
      nameNormalized: `${stamp}-outsider`,
      phone: `+9665${stamp.slice(-7)}4`,
      countryId: saudiId,
      createdBy: repA.user.id,
    })
    .returning();
  await db.insert(companyReps).values({
    companyId: outsider.id,
    userId: repA.user.id,
    isPrimary: true,
    origin: "self_registered",
  });

  const looseThread = await createQuotationThread(
    repA,
    { projectId: null, companyId: outsider.id, contactId: null },
    version,
    [line],
    [],
  );
  check(
    "*** a quotation can be raised with NO project *** [S50]",
    looseThread.projectId === null,
    `got ${looseThread.projectId}`,
  );

  await issueVersion(coordinator, looseThread.id, {
    smacReference: `${stamp}-9594`,
    verification: "unverified",
  });
  await acceptThread(coordinator, looseThread.id);
  await confirmPayment(repA, looseThread.id, "2026-08-03");

  await refuses(
    "dispatching it with no project chosen is refused [S74]",
    "dispatches.errors.projectRequired",
    () =>
      approvedDispatch(coordinator, {
        lines: linesOf("12.0000"),
        dispatchDate: "2026-09-14",
        quotationThreadId: looseThread.id,
        companyId: null,
        userId: null,
        projectId: null,
      }),
  );

  const written = await approvedDispatch(coordinator, {
    lines: linesOf("12.0000"),
    dispatchDate: "2026-09-14",
    quotationThreadId: looseThread.id,
    companyId: null,
    userId: null,
    projectId: otherProject.id,
  });
  check(
    "the dispatch carries the chosen project [S74]",
    written.projectId === otherProject.id,
    `got ${written.projectId}`,
  );

  const [rewritten] = await db
    .select({ projectId: quotationThreads.projectId })
    .from(quotationThreads)
    .where(eq(quotationThreads.id, looseThread.id))
    .limit(1);
  check(
    "*** and it is written back onto the QUOTATION *** [S74]",
    rewritten?.projectId === otherProject.id,
    `got ${rewritten?.projectId}`,
  );

  const participants = await listProjectCompanies(repA, otherProject.id);
  const added = participants.find((row) => row.companyId === outsider.id);
  check(
    "*** the quotation's company joined that project as a participant *** [S74], [S27]",
    added !== undefined,
    participants.map((row) => row.companyName).join(" | "),
  );
  check(
    "…and the derived figure reaches it, through the dispatch's own project [S26]",
    added?.dispatchedSqm === "12.0000",
    `got ${JSON.stringify(added?.dispatchedSqm)}`,
  );

  // **The participant is added ONCE.** A second dispatch on the same
  // quotation finds the company already there and must not write a second
  // link — `S27` keeps one live row per company, and the partial unique index
  // would refuse it anyway. Nothing to write back either: the quotation now
  // has a project, so this is branch one from here on.
  const again = await approvedDispatch(coordinator, {
    lines: linesOf("8.0000"),
    dispatchDate: "2026-09-15",
    quotationThreadId: looseThread.id,
    companyId: null,
    userId: null,
    projectId: null,
  });
  check(
    "a second dispatch on the same quotation now takes the project it gained [S74]",
    again.projectId === otherProject.id,
    `got ${again.projectId}`,
  );
  const afterSecond = await listProjectCompanies(repA, otherProject.id);
  check(
    "…and the company is still ONE participant, not two [S27]",
    afterSecond.filter((row) => row.companyId === outsider.id).length === 1,
    `got ${afterSecond.filter((row) => row.companyId === outsider.id).length}`,
  );
  check(
    "…with both dispatches summed into its figure [S26]",
    afterSecond.find((row) => row.companyId === outsider.id)?.dispatchedSqm ===
      "20.0000",
    `got ${JSON.stringify(afterSecond.find((row) => row.companyId === outsider.id)?.dispatchedSqm)}`,
  );

  // **What the coordinator may pick from** `S74`. Two ways to get this wrong,
  // and both were nearly shipped: filtering on `end_state is null` hides every
  // WON project — and `S31` makes a project won when the payment arrives,
  // which is the moment before the dispatch — while `<> 'lost'` on a nullable
  // column is null for every ordinary project and hides all of them.
  const wonProject = await updateProject(repA, otherProject.id, {
    nameEn: otherProject.nameEn,
    nameAr: null,
    sqmExpected: null,
    cityId: null,
    endState: "won",
    lostReasonId: null,
    lossReason: null,
    inProduction: false,
  });
  const lostProject = await createProject(
    repA,
    {
      nameEn: `${stamp} Lost Project`,
      nameAr: null,
      sqmExpected: null,
      cityId: null,
      endState: "lost",
      lostReasonId: (await listLossReasons())[0].id,
      lossReason: null,
      inProduction: false,
    },
    [{ companyId: company.id }],
  );
  const pickable = await listDispatchProjectOptions(coordinator);
  const offered = new Set(pickable.map((row) => row.id));
  check(
    "*** the picker offers a WON project — that is when dispatch happens *** [S31], [S74]",
    offered.has(wonProject.id),
    `${pickable.length} offered`,
  );
  check(
    "…and an ordinary open project, which a plain <> comparison would drop",
    offered.has(project.id),
  );
  check("…and never a lost one [07 C5]", !offered.has(lostProject.id));

  /* --- 16. S76 — the coordinator sees projects and contacts ------ */

  console.log(
    "\n16. *** The coordinator sees projects and contacts *** [S76], [S30]",
  );

  const contact = await createContact(repA, {
    companyId: company.id,
    name: `${stamp} Contact`,
    phone: "0500000000",
    email: null,
    position: null,
    notes: null,
  });

  // repA's own project, through the real path — so its normalised name matches
  // a search for the stamp, which the hand-inserted `project` above does not:
  // that one stores the stamp raw and `normalizeName` folds the hyphen to a
  // space. It carries the list assertions here and the queue pair below, and
  // has no thread and no dispatch, which is what the queue half needs.
  const stale = await createProject(
    repA,
    {
      nameEn: `${stamp} Stale Project`,
      nameAr: null,
      sqmExpected: null,
      cityId: null,
      endState: null,
      lostReasonId: null,
      lossReason: null,
      inProduction: false,
    },
    [{ companyId: company.id }],
  );

  // The reaching half. The list matters as much as the detail: the filter is
  // resolved in SQL before pagination, so a screen that pages correctly and a
  // detail that opens are two different claims.
  check(
    "*** the coordinator opens a project they neither own nor were shared *** [S76]",
    (await getProject(coordinator, project.id)) !== null,
  );
  const coordinatorProjects = await listProjects(coordinator, { q: stamp });
  check(
    "…and one is IN their list, not merely reachable by id [S76]",
    coordinatorProjects.rows.some((row) => row.id === stale.id),
    `saw ${coordinatorProjects.rows.length} of ${coordinatorProjects.total}`,
  );
  check(
    "the coordinator opens a contact [S76]",
    (await getContact(coordinator, contact.id)) !== null,
  );
  const coordinatorContacts = await listContacts(coordinator, { q: stamp });
  check(
    "…and it is in their list too [S76]",
    coordinatorContacts.rows.some((row) => row.id === contact.id),
    `saw ${coordinatorContacts.rows.length} of ${coordinatorContacts.total}`,
  );
  check(
    "…while sees_all_reps is STILL false — a role exception, not a tier",
    coordinator.user.role.seesAllReps === false,
  );

  // `S76`'s own reason: both are part of the dispatch. The screen half of it —
  // the dispatch detail draws its project as a link rather than as plain text.
  const linkedForCoordinator = await getDispatch(coordinator, linked.id);
  check(
    "*** the dispatch screen may now LINK its project, not print it *** [S76], [S74]",
    linkedForCoordinator?.projectViewable === true,
  );
  check(
    "the picker is ordinary project visibility now — the stopgap is gone [S76]",
    (await listDispatchProjectOptions(coordinator)).some(
      (row) => row.id === project.id,
    ),
  );

  // The negative half, and the point of the slice: sight, not a hand.
  check(
    "the ACT gate still refuses the coordinator on a project [S76], [S62]",
    (await canViewRecord(coordinator, "project", project.id)) === false,
  );
  check(
    "…and on a contact [S76], [S62]",
    (await canViewRecord(coordinator, "contact", contact.id)) === false,
  );
  check(
    "…while the READ gate passes for both — the two questions have parted [S76]",
    (await canOpenRecord(coordinator, "project", project.id)) &&
      (await canOpenRecord(coordinator, "contact", contact.id)),
  );
  check(
    "the company behind that contact stays shut — S76 names two records [18 §2]",
    (await canOpenRecord(coordinator, "company", company.id)) === false,
  );
  const coordinatorContact = coordinatorContacts.rows.find(
    (row) => row.id === contact.id,
  );
  check(
    "…so the contact row tells its screen not to link it",
    coordinatorContact?.companyViewable === false,
  );
  check(
    "…and the company NAME is still there. Names yes, records no.",
    (coordinatorContact?.companyName.length ?? 0) > 0,
  );

  await refuses(
    "the coordinator may not edit a project [S76], [S62]",
    "projects.errors.notFound",
    () =>
      updateProject(coordinator, project.id, {
        nameEn: `${stamp} Renamed By Coordinator`,
        nameAr: null,
        sqmExpected: null,
        cityId: null,
        endState: null,
        lostReasonId: null,
        lossReason: null,
        inProduction: false,
      }),
  );
  await refuses(
    "…nor add a participant to one",
    "projects.errors.notFound",
    () => addProjectCompany(coordinator, project.id, { companyId: company.id }),
  );
  await refuses("…nor edit a contact", "contacts.errors.notFound", () =>
    updateContact(coordinator, contact.id, {
      companyId: company.id,
      name: `${stamp} Renamed By Coordinator`,
      phone: "0500000000",
      email: null,
      position: null,
      notes: null,
    }),
  );
  await refuses(
    "…nor comment on a project they may read",
    "comments.errors.recordNotFound",
    () =>
      addComment(coordinator, {
        recordType: "project",
        recordId: project.id,
        body: `${stamp} coordinator comment`,
        mentions: [],
      }),
  );
  await refuses(
    "…nor set a follow-up date on one",
    "followUps.errors.notYours",
    () => setNextFollowUp(coordinator, "project", project.id, "2026-12-01"),
  );

  // `S38` is not revisited here: the coordinator holds no `sees_all_reps` and
  // no company, so they fail `visibleRepReportsFilter`'s company term and read
  // no report at all — neither half. A timeline that showed one would mean this
  // slice had widened `S38` sideways.
  const coordinatorTimeline = await projectTimeline(coordinator, project.id, {
    limit: 50,
  });
  check(
    "a project timeline carries no rep report for the coordinator [S38]",
    coordinatorTimeline.events.every((event) => event.kind !== "report"),
    `${coordinatorTimeline.events.length} events`,
  );

  /*
   * **The queue, asserted as a PAIR.** `S76` widened what may be read; it must
   * not widen what is waiting on anybody, which is why
   * `projectStageUnchanged` and `manualDateDue` compose `ownProjectsFilter`
   * and not the read filter.
   *
   * One direction proves nothing: "the coordinator's queue holds no row for
   * this project" passes just as well on a queue that is empty for an
   * unrelated reason. The pair is the assertion — repA has exactly the row the
   * coordinator does not — and it is the check that fails when someone later
   * folds `ownProjectsFilter` back into `visibleProjectsFilter`, which will
   * look like removing duplication.
   *
   * A project of its own, with no thread and no dispatch, so the fallback
   * branch is what fires; `created_at` is backdated by hand, the shape §12
   * already uses for its share row. `followUpsForRecipient` rather than
   * `followUps`: the latter pages, and a page-one question is not the question
   * being asked — §12's own trap.
   */
  await db
    .update(projects)
    .set({ createdAt: sql`now() - interval '400 days'` })
    .where(eq(projects.id, stale.id));

  const staleRows = (rows: { anchorType: string; anchorId: string }[]) =>
    rows.filter(
      (row) => row.anchorType === "project" && row.anchorId === stale.id,
    ).length;
  const repAQueue = staleRows(await followUpsForRecipient(repA));
  const coordinatorQueue = staleRows(await followUpsForRecipient(coordinator));
  check(
    "*** the owner's queue holds the stale project *** [07 D5]",
    repAQueue === 1,
    `got ${repAQueue} rows`,
  );
  check(
    "*** and the coordinator's does not — S76 widened sight, not work *** [S76]",
    coordinatorQueue === 0,
    `got ${coordinatorQueue} rows`,
  );

  // The same reasoning, for the other predicate narrowed with it: the
  // new-quotation form offers exactly what `createQuotationThread` accepts.
  const repAOptions = await listQuotationFormOptions(repA);
  const coordinatorOptions = await listQuotationFormOptions(coordinator);
  check(
    "the quotation form offers the owner their project",
    repAOptions.projects.some((row) => row.id === project.id),
  );
  check(
    "…and offers the coordinator none of it — the write path would refuse [S76]",
    !coordinatorOptions.projects.some((row) => row.id === project.id),
    `${coordinatorOptions.projects.length} offered`,
  );

  // The mirror. repB owns nothing here and was shared nothing — §12 gave the
  // project share to repC — so `S30` still reads exactly as it did.
  check(
    "*** a rep who could not see this project still cannot *** [S30]",
    (await getProject(repB, project.id)) === null,
  );
  const repBProjects = await listProjects(repB, { q: stamp });
  check(
    "…nor find this run's projects in their list, where the coordinator does",
    repBProjects.rows.length === 0 &&
      coordinatorProjects.rows.some((row) => row.id === stale.id),
    `saw ${repBProjects.rows.length}`,
  );
  check("…nor open the contact", (await getContact(repB, contact.id)) === null);

  /* --- 17. Only from an ISSUED quotation [S126] ------------------- */

  console.log(
    "\n17. *** A dispatch may only be raised from an ISSUED quotation *** [S126]",
  );

  // **Paid, deliberately not issued.** That combination was dispatchable until
  // this slice: `confirmPayment` never reads a version's status, so a rep could
  // confirm payment on a version still being edited `S61` and the coordinator
  // could dispatch against it. The pairing is the assertion — the payment gate
  // passes and the new one refuses — so a refusal cannot be `07 C3`'s.
  const paidNotIssued = await createQuotationThread(
    repA,
    { projectId: project.id, companyId: company.id, contactId: null },
    version,
    [line],
    [],
  );
  await confirmPayment(repA, paidNotIssued.id, "2026-08-05");
  await refuses(
    "*** a paid but UNISSUED quotation refuses *** [S126]",
    "dispatches.errors.quotationNotIssued",
    () =>
      approvedDispatch(coordinator, {
        lines: linesOf("1.0000"),
        dispatchDate: "2026-09-20",
        quotationThreadId: paidNotIssued.id,
        companyId: null,
        userId: null,
        projectId: null,
      }),
  );
  check(
    "…and it is not offered in the dispatchable list either [S126]",
    (await listDispatchableThreads(coordinator)).every(
      (thread) => thread.id !== paidNotIssued.id,
    ),
    "the form would offer what the action refuses",
  );

  // The other half of the same rule, which is what makes it a rule rather than
  // a gate: issue it and the same call goes through.
  await issueVersion(coordinator, paidNotIssued.id, {
    smacReference: `${stamp}-126`,
    verification: "unverified",
  });
  const nowIssued = (await listDispatchableThreads(coordinator)).find(
    (thread) => thread.id === paidNotIssued.id,
  );
  check(
    "*** issuing it makes it dispatchable, and nothing else changed *** [S126]",
    Boolean(nowIssued),
    "still not offered after issue",
  );
  check(
    "…and the offered thread names the version its lines come from [S126]",
    Boolean(nowIssued?.versionId) &&
      nowIssued?.smacReference === `${stamp}-126`,
    `got ${nowIssued?.smacReference}`,
  );

  /* --- 18. The three routes, and the lines [S75], [S116] ---------- */

  console.log(
    "\n18. *** A dispatch carries its own lines, raised three ways *** [S116], [S75]",
  );

  // The prefill IS the route. `listDispatchableThreads` is what the form reads,
  // so taking its lines untouched is *exactly as a quotation* and editing them
  // is *from a quotation, with edits* — the same two calls the screen makes.
  const prefilled = (await listDispatchableThreads(coordinator)).find(
    (thread) => thread.id === paidNotIssued.id,
  )!;
  check(
    "the issued version arrives pre-filled with its lines [S116]",
    prefilled.lines.length === 1 &&
      prefilled.lines[0].quantityPcs === "12.0000" &&
      prefilled.lines[0].unitPrice === "120.00",
    `got ${JSON.stringify(prefilled.lines)}`,
  );

  /* Route one — exactly as a quotation. */
  const asQuoted = await approvedDispatch(coordinator, {
    lines: prefilled.lines,
    dispatchDate: "2026-09-21",
    quotationThreadId: paidNotIssued.id,
    companyId: null,
    userId: null,
    projectId: null,
  });
  const asQuotedDetail = (await getDispatch(coordinator, asQuoted.id))!;
  check(
    "*** route one: the dispatch's lines are the quotation's *** [S75]",
    asQuotedDetail.lines.length === 1 &&
      asQuotedDetail.lines[0].quantityPcs === "12.0000" &&
      asQuotedDetail.lines[0].unitPrice === "120.00",
    JSON.stringify(asQuotedDetail.lines.map((row) => row.quantityPcs)),
  );
  // 12 × 1.24 × 5.8 — the same generated expression a quotation line uses, so
  // an untouched dispatch and its quotation agree without either copying a sum.
  check(
    "…and its square metres are the lines', generated [S116], [S55]",
    asQuotedDetail.sqm === "86.3040",
    `got ${asQuotedDetail.sqm}`,
  );

  /* Route two — from a quotation, with edits. The one that did not exist. */
  const edited = await approvedDispatch(coordinator, {
    lines: [
      // Half the quantity went out, at a renegotiated price…
      { ...prefilled.lines[0], quantityPcs: "6.0000", unitPrice: "110.00" },
      // …plus a product the quotation never had `S116`.
      ...linesOf("10.0000", "80.00"),
    ],
    dispatchDate: "2026-09-22",
    quotationThreadId: paidNotIssued.id,
    companyId: null,
    userId: null,
    projectId: null,
  });
  const editedDetail = (await getDispatch(coordinator, edited.id))!;
  check(
    "*** route two: a dispatch may differ from its quotation, and add to it *** [S75], [S116]",
    editedDetail.lines.length === 2 &&
      editedDetail.lines[0].unitPrice === "110.00",
    JSON.stringify(editedDetail.lines.map((row) => row.unitPrice)),
  );
  // 6 × 1.24 × 5.8 = 43.1520, plus 10 × 1 × 1.
  check(
    "…and the figure follows the edit, not the quotation [04 quantities]",
    editedDetail.sqm === "53.1520",
    `got ${editedDetail.sqm}`,
  );
  // `S77` — the gap is the point. Editing a dispatch rewrites nothing upstream.
  const quotedAfter = await getQuotationThread(coordinator, paidNotIssued.id);
  check(
    "*** …and the QUOTATION is untouched — the gap is measured, not prevented *** [S77]",
    quotedAfter?.live.lines.length === 1 &&
      quotedAfter.live.lines[0].quantityPcs === "12.0000" &&
      quotedAfter.live.lines[0].unitPrice === "120.00",
    JSON.stringify(
      quotedAfter?.live.lines.map(
        (row: { quantityPcs: string }) => row.quantityPcs,
      ),
    ),
  );

  /* Route three — free entry, no quotation at all. */
  const freeEntry = await approvedDispatch(coordinator, {
    lines: linesOf("9.0000", "70.00"),
    dispatchDate: "2026-09-23",
    quotationThreadId: null,
    companyId: company.id,
    userId: repB.user.id,
    projectId: null,
  });
  const freeDetail = (await getDispatch(coordinator, freeEntry.id))!;
  check(
    "*** route three: a free entry carries typed lines and no version *** [S75], [S126]",
    freeDetail.lines.length === 1 &&
      freeDetail.sqm === "9.0000" &&
      freeEntry.quotationVersionId === null,
    `got ${freeDetail.sqm}, version ${freeEntry.quotationVersionId}`,
  );

  /* The two refusals `S116` puts on a line. */
  await refuses(
    "*** a line with no price is refused — nothing is dispatched free *** [S116]",
    "dispatches.errors.linePriceRequired",
    () =>
      approvedDispatch(coordinator, {
        lines: linesOf("4.0000", ""),
        dispatchDate: "2026-09-24",
        quotationThreadId: null,
        companyId: company.id,
        userId: repB.user.id,
        projectId: null,
      }),
  );
  await refuses(
    "a dispatch with no lines at all is refused [S116]",
    "dispatches.errors.atLeastOneLine",
    () =>
      approvedDispatch(coordinator, {
        lines: [],
        dispatchDate: "2026-09-24",
        quotationThreadId: null,
        companyId: company.id,
        userId: repB.user.id,
        projectId: null,
      }),
  );

  /* --- 19. A rep's whole path [S72], [S125] ---------------------- */

  console.log(
    "\n19. *** A rep raises, edits and submits; after that it is not theirs *** [S72], [S125]",
  );

  const repPath = await requestDispatch(repA, {
    lines: linesOf("30.0000", "80.00"),
    dispatchDate: "2026-09-25",
    quotationThreadId: paidThread.id,
    companyId: null,
    userId: null,
    projectId: null,
  });
  check(
    "a rep raises one against their own issued quotation, with no flag [S72]",
    repPath.status === "draft" && repPath.recordedByUserId === repA.user.id,
    `got ${repPath.status}`,
  );

  // `S125` — *a rep edits their own request until they submit it.*
  await updateDispatchRequest(repA, repPath.id, {
    lines: linesOf("31.0000", "80.00"),
    dispatchDate: "2026-09-26",
    projectId: null,
  });
  const editedByRep = (await getDispatch(repA, repPath.id))!;
  check(
    "…and edits it while it is a draft [S125]",
    editedByRep.sqm === "31.0000" && editedByRep.dispatchDate === "2026-09-26",
    `got ${editedByRep.sqm} on ${editedByRep.dispatchDate}`,
  );
  check(
    "…the lines were REPLACED, not added to — one line, not two [S125]",
    editedByRep.lines.length === 1,
    `got ${editedByRep.lines.length}`,
  );
  // **Visibility answers first, and the key says so.** Another rep cannot
  // see this request at all, so they are told it cannot be found rather than
  // that it is not theirs — telling them the second would confirm it exists.
  await refuses(
    "another rep cannot even see it, so that is what they are told [S125]",
    "dispatches.errors.requestNotVisible",
    () =>
      updateDispatchRequest(repB, repPath.id, {
        lines: linesOf("1.0000", "80.00"),
        dispatchDate: "2026-09-26",
        projectId: null,
      }),
  );
  await refuses(
    "and cannot submit somebody else's either [S125]",
    "dispatches.errors.requestNotVisible",
    () => submitDispatchRequest(repB, repPath.id),
  );
  // **The coordinator is who reaches `notYourRequest`.** She sees every
  // dispatch `S76`, so visibility does not stop her — and `S125` still does:
  // a DRAFT is the rep's, and she gets it only once he submits it. This is
  // the half of the rule a screen would be tempted to skip.
  await refuses(
    "*** and the coordinator may not edit a DRAFT — it is not hers yet *** [S125]",
    "dispatches.errors.notYourRequest",
    () =>
      updateDispatchRequest(coordinator, repPath.id, {
        lines: linesOf("1.0000", "80.00"),
        dispatchDate: "2026-09-26",
        projectId: null,
      }),
  );
  await refuses(
    "…nor approve one that has not been submitted [S72]",
    "dispatches.errors.notSubmitted",
    () => approveDispatchRequest(coordinator, repPath.id),
  );

  await submitDispatchRequest(repA, repPath.id);
  const submitted = (await getDispatch(repA, repPath.id))!;
  check(
    "*** submitting sets submitted_at, which is not created_at *** [S72], [S89]",
    submitted.status === "submitted" && submitted.submittedAt !== null,
  );

  // **The hinge of `S125`.** After submitting, the rep loses the request and
  // the coordinator gains it — *usually after phoning the rep, because that is
  // faster than refusing and re-raising.*
  await refuses(
    "*** after submitting, the rep may no longer edit it *** [S125]",
    "dispatches.errors.coordinatorEditsSubmitted",
    () =>
      updateDispatchRequest(repA, repPath.id, {
        lines: linesOf("99.0000", "80.00"),
        dispatchDate: "2026-09-26",
        projectId: null,
      }),
  );
  await refuses(
    "…and may not submit it twice",
    "dispatches.errors.notDraft",
    () => submitDispatchRequest(repA, repPath.id),
  );
  await updateDispatchRequest(coordinator, repPath.id, {
    lines: linesOf("32.0000", "85.00"),
    dispatchDate: "2026-09-26",
    projectId: null,
  });
  const editedByCoordinator = (await getDispatch(coordinator, repPath.id))!;
  check(
    "*** …but the coordinator may *** [S125], [S62]",
    editedByCoordinator.sqm === "32.0000",
    `got ${editedByCoordinator.sqm}`,
  );
  // `S123` will count this: *a request the coordinator had to edit before
  // approving* is one of its two figures, and the audit row is where it reads
  // it from. No column is landed for it here — `S123` is its own session.
  const editAudit = await db
    .select({ action: auditLog.action, actor: auditLog.actorUserId })
    .from(auditLog)
    .where(
      and(
        eq(auditLog.entityType, "dispatch"),
        eq(auditLog.entityId, repPath.id),
      ),
    );
  check(
    "dispatch.edited names WHO edited it, which is what S123 will count [S123]",
    editAudit.some(
      (row) =>
        row.action === "dispatch.edited" && row.actor === coordinator.user.id,
    ) &&
      editAudit.some(
        (row) => row.action === "dispatch.edited" && row.actor === repA.user.id,
      ),
    editAudit.map((row) => row.action).join(", "),
  );

  await approveDispatchRequest(coordinator, repPath.id);
  await refuses(
    "an approved dispatch is not editable by anyone — approval is final [S73]",
    "dispatches.errors.requestNotEditable",
    () =>
      updateDispatchRequest(coordinator, repPath.id, {
        lines: linesOf("1.0000", "80.00"),
        dispatchDate: "2026-09-26",
        projectId: null,
      }),
  );
  await refuses(
    "…and cannot be approved a second time",
    "dispatches.errors.notSubmitted",
    () => approveDispatchRequest(coordinator, repPath.id),
  );

  /* --- 20. Refusal and revival [S124], [S122] -------------------- */

  console.log(
    "\n20. *** A refusal carries a reason and archives the request *** [S124], [S122]",
  );

  const doomed = await requestDispatch(repA, {
    lines: linesOf("7.0000", "60.00"),
    dispatchDate: "2026-09-27",
    quotationThreadId: paidThread.id,
    companyId: null,
    userId: null,
    projectId: null,
  });
  await refuses(
    "a draft cannot be refused — there is no decision to make yet",
    "dispatches.errors.notSubmitted",
    () => refuseDispatchRequest(coordinator, doomed.id, "too early"),
  );
  await submitDispatchRequest(repA, doomed.id);
  await refuses(
    "*** a refusal with no reason is refused *** [S124]",
    "dispatches.errors.refusalReasonRequired",
    () => refuseDispatchRequest(coordinator, doomed.id, "   "),
  );

  const REASON = `${stamp} the colour is not in stock`;
  await refuseDispatchRequest(coordinator, doomed.id, REASON);
  const refused = (await getDispatch(coordinator, doomed.id))!;
  check(
    "*** the reason is STORED on the request *** [S124]",
    refused.status === "refused" && refused.refusalReason === REASON,
    `got ${refused.status} / ${refused.refusalReason}`,
  );
  check(
    "…and submitted_at survives it — a refused request WAS submitted",
    refused.submittedAt !== null,
  );

  // `S122` — *kept out of the working lists*, and reachable by asking for the
  // archive. Resolved in SQL by `listDispatches`, never filtered after the
  // fetch (`CLAUDE.md`), which is why the claim is made against `total` too.
  // **Scoped to the thread, because the list is paginated.** Absence from
  // page one of a database with a hundred dispatches in it proves nothing —
  // it is exactly the shape of assertion that passes for the wrong reason.
  // Both scopes are asked of the same small set, so both halves are real.
  const scope = { threadId: paidThread.id };
  const working = await listDispatches(coordinator, scope);
  check(
    "*** a refused request is OUT of the working list *** [S122]",
    working.total > 0 && !working.rows.some((row) => row.id === doomed.id),
    `${working.total} row(s) in scope`,
  );
  const archive = await listDispatches(coordinator, {
    ...scope,
    status: "refused",
  });
  check(
    "…and in the archive, which is the same list asked a question [S122]",
    archive.rows.some((row) => row.id === doomed.id),
    `${archive.total} archived in scope`,
  );
  check(
    "*** a rep sees their own refused request *** [S122]",
    (await getDispatch(repA, doomed.id)) !== null,
  );
  check(
    "…and the manager sees it too — coordinators and managers see all [S122]",
    (await getDispatch(manager, doomed.id)) !== null,
  );

  await refuses(
    "*** only the coordinator may revive one *** [S122]",
    "dispatches.errors.reviveOnly",
    () => reviveDispatchRequest(repA, doomed.id),
  );
  await reviveDispatchRequest(coordinator, doomed.id);
  const revived = (await getDispatch(repA, doomed.id))!;
  check(
    "*** a revived request returns to the rep, UNSUBMITTED *** [S122], [S125]",
    revived.status === "draft" &&
      revived.submittedAt === null &&
      revived.refusalReason === null,
    `got ${revived.status}, submittedAt ${revived.submittedAt}`,
  );
  check(
    "…and is back in the working list, treated as new [S122]",
    (await listDispatches(coordinator, scope)).rows.some(
      (row) => row.id === doomed.id,
    ),
  );
  // Nothing is lost `S107`: the audit row keeps the reason permanently, which
  // is what `S128` will read to tell the rep.
  const refusalAudit = await db
    .select({ action: auditLog.action, after: auditLog.after })
    .from(auditLog)
    .where(
      and(
        eq(auditLog.entityType, "dispatch"),
        eq(auditLog.entityId, doomed.id),
      ),
    );
  check(
    "*** the reason survives the revival, in the audit log *** [S107], [S112]",
    refusalAudit.some(
      (row) =>
        row.action === "dispatch.refused" &&
        (row.after as { refusalReason?: string })?.refusalReason === REASON,
    ),
  );
  // The rep edits and submits it as they would a new one `S122`, `S125`.
  await updateDispatchRequest(repA, doomed.id, {
    lines: linesOf("8.0000", "60.00"),
    dispatchDate: "2026-09-28",
    projectId: null,
  });
  await submitDispatchRequest(repA, doomed.id);
  check(
    "…and the rep edits and submits it again, as a new one [S122]",
    (await getDispatch(repA, doomed.id))?.status === "submitted",
  );

  /* --- 21. S127, as a walk rather than an absence ---------------- */

  console.log(
    "\n21. *** The coordinator raises against her own company and approves it *** [S127]",
  );

  // **A run-scoped coordinator, not the shared fixture account.** `S127` is
  // about the ROLE — *she holds companies like any rep* `S9` — and giving the
  // shared `coordinator@example.test` a company would be a lasting change to
  // a fixture other scripts read: `verify:routes` §2 asserts that identity
  // holds none, which is what makes `/projects/new` a `D53` 404 for her. This
  // script keeps its rows `[12 §7]`, so that change would never wash out.
  const [coordRole] = await db
    .select()
    .from(roles)
    .where(eq(roles.nameEn, "Sales Coordinator"))
    .limit(1);
  if (!coordRole) {
    console.error("Roles are not seeded. Run: npm run db:seed");
    process.exit(1);
  }
  const [herUser] = await db
    .insert(users)
    .values({
      name: `${stamp} Coordinator`,
      email: `${stamp}-coord@example.test`,
      roleId: coordRole.id,
    })
    .returning();
  const herself: AuthSession = {
    user: { ...herUser, role: coordRole },
    realUser: { ...herUser, role: coordRole },
    isImpersonating: false,
    actor: { actorUserId: herUser.id, actingAsUserId: null },
  };
  check(
    "she holds can_dispatch, which is what S127 is about [S7]",
    herself.user.role.canDispatch === true,
  );

  // **"Her own" means a real membership**, not a company she merely reaches
  // through `dispatchCompanyLookupFilter` — that filter lets her name any
  // company at all `[18 §2]`, so naming one would prove nothing about holding
  // one. `S9` is what puts a company on a coordinator's desk.
  const [herCompany] = await db
    .insert(companies)
    .values({
      name: `${stamp} Coordinator Co`,
      nameNormalized: `${stamp}-coord`,
      phone: `+9665${stamp.slice(-7)}4`,
      countryId: saudiId,
      createdBy: herUser.id,
    })
    .returning();
  await db.insert(companyReps).values({
    companyId: herCompany.id,
    userId: herUser.id,
    isPrimary: true,
    origin: "self_registered",
  });
  check(
    "…and holds a company like any rep [S9], [S127]",
    (await canViewRecord(herself, "company", herCompany.id)) === true,
  );

  // **Four acts, one identity throughout.** Nothing in the code checks that
  // the approver is not the raiser, and that absence is the rule — so it is
  // walked rather than assumed. A four-eyes check added to approval later
  // fails HERE, instead of quietly repealing `S127`.
  const hers = await requestDispatch(herself, {
    lines: linesOf("55.0000", "90.00"),
    dispatchDate: "2026-09-29",
    quotationThreadId: null,
    companyId: herCompany.id,
    userId: null,
    projectId: null,
  });
  check(
    "1. she raises it, against her own company [S127]",
    hers.status === "draft" &&
      hers.companyId === herCompany.id &&
      hers.recordedByUserId === herUser.id,
  );
  check(
    "2. it credits her, because she did not name anyone else [S108]",
    hers.userId === herUser.id,
  );
  await submitDispatchRequest(herself, hers.id);
  check(
    "3. she submits it — the same person, the same request",
    (await getDispatch(herself, hers.id))?.status === "submitted",
  );
  await approveDispatchRequest(herself, hers.id);
  const herApproved = (await getDispatch(herself, hers.id))!;
  check(
    "*** 4. and she approves it herself — nothing blocks both acts *** [S127]",
    herApproved.status === "approved" &&
      herApproved.approvedByName === herUser.name,
    `got ${herApproved.status}, approved by ${herApproved.approvedByName}`,
  );
  check(
    "…and it credits her, like any other approved dispatch [S72], [S78]",
    (await dispatchesInPeriod("2026-09-01", "2026-10-01")).some(
      (row) => row.id === hers.id && row.userId === herUser.id,
    ),
  );

  /* --- 22. Nothing unapproved counts, at the three readers §18's
       loop cannot reach [S72] ------------------------------------- */

  console.log(
    "\n22. *** An unapproved request counts for NOTHING *** [S72], [S26], [S31]",
  );

  // §18's loop covers the list, the detail and `dispatchesInPeriod`. Three
  // readers it cannot reach are asserted here, each by taking a figure, adding
  // an unapproved request to the same subject, and taking it again. **The
  // before-and-after is the assertion** — a fixed expected number would pass
  // on a reader that was broken in both directions.
  // `figureFor` is §14's own reader of `S26` — the same function, so the two
  // sections cannot disagree about what the figure is.
  const beforeCompany = await figureFor(company.id);
  const beforeThread = (await listDispatchableThreads(coordinator)).find(
    (row) => row.id === paidThread.id,
  );
  const beforeChain = (
    await listDispatches(coordinator, {
      threadId: paidThread.id,
      status: "approved",
    })
  ).total;

  const pending = await requestDispatch(repA, {
    lines: linesOf("500.0000", "100.00"),
    dispatchDate: "2026-09-30",
    quotationThreadId: paidThread.id,
    companyId: null,
    userId: null,
    projectId: null,
  });
  await submitDispatchRequest(repA, pending.id);

  const afterCompany = await figureFor(company.id);
  check(
    "*** S26's per-participant square metres do not move *** [S26], [S72]",
    afterCompany === beforeCompany,
    `${beforeCompany} then ${afterCompany}`,
  );

  const afterThread = (await listDispatchableThreads(coordinator)).find(
    (row) => row.id === paidThread.id,
  );
  check(
    "*** dispatched-so-far on the quotation does not move *** [S72], [S77]",
    afterThread?.dispatchedSqm === beforeThread?.dispatchedSqm,
    `${beforeThread?.dispatchedSqm} then ${afterThread?.dispatchedSqm}`,
  );

  check(
    "*** and the chain's sixth node does not move *** [S72], [D27]",
    (
      await listDispatches(coordinator, {
        threadId: paidThread.id,
        status: "approved",
      })
    ).total === beforeChain,
  );

  // The other half of the same claim: approving it DOES move all three. A
  // figure that never moves is not proof that this one is right.
  await approveDispatchRequest(coordinator, pending.id);
  check(
    "…and approving it moves every one of them [S72]",
    (await figureFor(company.id)) !== beforeCompany &&
      (await listDispatchableThreads(coordinator)).find(
        (row) => row.id === paidThread.id,
      )?.dispatchedSqm !== beforeThread?.dispatchedSqm &&
      (
        await listDispatches(coordinator, {
          threadId: paidThread.id,
          status: "approved",
        })
      ).total ===
        beforeChain + 1,
  );

  /* --- 23. S74's write-back fires at the APPROVAL ---------------- */

  console.log(
    "\n23. *** The project is written back when she approves, not when he asks *** [S74], [S72]",
  );

  // `S74`'s second branch, timed. The quotation has no project of its own
  // `S50`, the rep names one on the request, and the quotation must NOT gain
  // it until the request is approved — a project written onto a quotation by a
  // request nobody approved would be a decision nobody made.
  const [loneCompany] = await db
    .insert(companies)
    .values({
      name: `${stamp} Writeback Co`,
      nameNormalized: `${stamp}-wb`,
      phone: `+9665${stamp.slice(-7)}5`,
      countryId: saudiId,
      createdBy: repA.user.id,
    })
    .returning();
  await db.insert(companyReps).values({
    companyId: loneCompany.id,
    userId: repA.user.id,
    isPrimary: true,
    origin: "self_registered",
  });
  const [target] = await db
    .insert(projects)
    .values({
      nameEn: `${stamp} Writeback Project`,
      nameNormalized: `${stamp}-wb`,
      ownerUserId: repA.user.id,
      createdBy: repA.user.id,
    })
    .returning();

  const projectless = await createQuotationThread(
    repA,
    { projectId: null, companyId: loneCompany.id, contactId: null },
    version,
    [line],
    [],
  );
  await issueVersion(coordinator, projectless.id, {
    smacReference: `${stamp}-wb`,
    verification: "unverified",
  });
  await acceptThread(coordinator, projectless.id);
  await confirmPayment(repA, projectless.id, "2026-08-01");

  await refuses(
    "a projectless quotation refuses a request that names no project [S74]",
    "dispatches.errors.projectRequired",
    () =>
      requestDispatch(repA, {
        lines: linesOf("6.0000", "60.00"),
        dispatchDate: "2026-09-30",
        quotationThreadId: projectless.id,
        companyId: null,
        userId: null,
        projectId: null,
      }),
  );

  const writeback = await requestDispatch(repA, {
    lines: linesOf("6.0000", "60.00"),
    dispatchDate: "2026-09-30",
    quotationThreadId: projectless.id,
    companyId: null,
    userId: null,
    projectId: target.id,
  });
  check(
    "*** the request carries the project and the QUOTATION does not, yet *** [S74]",
    writeback.projectId === target.id &&
      (await getQuotationThread(repA, projectless.id))?.projectId === null,
  );
  check(
    "…and the company has not joined the project either [S27], [S74]",
    !(await listProjectCompanies(repA, target.id)).some(
      (row) => row.companyId === loneCompany.id,
    ),
  );

  await submitDispatchRequest(repA, writeback.id);
  check(
    "submitting still writes nothing back — asking is not deciding [S74]",
    (await getQuotationThread(repA, projectless.id))?.projectId === null,
  );

  await approveDispatchRequest(coordinator, writeback.id);
  check(
    "*** approving writes the project onto the quotation *** [S74], [S72]",
    (await getQuotationThread(repA, projectless.id))?.projectId === target.id,
  );
  check(
    "*** …and adds its company to that project *** [S74], [S27]",
    (await listProjectCompanies(repA, target.id)).some(
      (row) => row.companyId === loneCompany.id,
    ),
  );

  // A SECOND dispatch on the same thread must not fail on its predecessor's
  // write-back. The thread already carries the project the request names, so
  // there is nothing to write and nothing to refuse.
  const second = await approvedDispatch(coordinator, {
    lines: linesOf("2.0000", "60.00"),
    dispatchDate: "2026-10-01",
    quotationThreadId: projectless.id,
    companyId: null,
    userId: null,
    projectId: null,
  });
  check(
    "*** a second dispatch does not trip on the first one's write-back *** [S74]",
    second.projectId === target.id && second.status === "approved",
    `got project ${second.projectId}, status ${second.status}`,
  );

  /*
   * **The invariant, not the fixture**, and since `S72` it is two invariants
   * rather than one.
   *
   *  1. `S116` — every reader that SHOWS a dispatch derives its square metres
   *     from the same lines, so none of them can disagree.
   *  2. `S72` — every reader that COUNTS one reads only the approved. *An
   *     approved dispatch is the only event that credits a target — not the
   *     request.* An unapproved request must be **absent** from those readers,
   *     never present as a zero: a zero is a figure, and a figure that moves
   *     when somebody asks for something is the defect this rule exists to
   *     prevent.
   *
   * Both are claimed over EVERY dispatch in the database rather than the ones
   * this run wrote. `verify:schema25` §14 makes `S116`'s structural half —
   * there is no `sqm` column left for a second answer to live in — and §15
   * makes `S72`'s.
   */
  const everyDispatch = await db
    .select({ id: dispatchesTable.id, status: dispatchesTable.status })
    .from(dispatchesTable);

  /** Walk one scope of the list to exhaustion. */
  async function listedSqm(
    status?: "draft" | "submitted" | "approved" | "refused",
  ): Promise<Map<string, string>> {
    const seen = new Map<string, string>();
    for (let page = 1; ; page += 1) {
      const { rows, total } = await listDispatches(coordinator, {
        page,
        status,
      });
      for (const row of rows) seen.set(row.id, row.sqm);
      if (seen.size >= total || rows.length === 0) break;
    }
    return seen;
  }

  // The default scope is the WORKING list `S122`: everything but the archive.
  const listed = await listedSqm();
  const archived = await listedSqm("refused");
  // `S85`'s reader, and deliberately: it is the figure a rep is measured on,
  // and its query joins differently from the other two. A derived figure has to
  // be asserted at EVERY reader — the first version of this section checked
  // only the two that happened to join a second table, and a third caller that
  // did not was silently answering zero.
  const measured = new Map(
    (await dispatchesInPeriod("2000-01-01", "2100-01-01")).map((row) => [
      row.id,
      row.sqm,
    ]),
  );

  let disagreeing = 0;
  let counted = 0;
  let miscounted = 0;
  let leaked = 0;
  for (const row of everyDispatch) {
    const fromLines = await sqmOf(row.id);
    const fromDetail = (await getDispatch(coordinator, row.id))?.sqm;
    // `S122` — a refused request is out of the working list and in the
    // archive. Which list to ask is part of the claim.
    const fromList = (row.status === "refused" ? archived : listed).get(row.id);
    if (fromList !== fromLines || fromDetail !== fromLines) disagreeing += 1;

    const fromPeriod = measured.get(row.id);
    if (row.status === "approved") {
      counted += 1;
      if (fromPeriod !== fromLines) miscounted += 1;
    } else if (fromPeriod !== undefined) {
      leaked += 1;
    }
  }

  check(
    "*** no dispatch's figure disagrees with its lines, on any reader *** [S116]",
    disagreeing === 0,
    `${disagreeing} of ${everyDispatch.length} disagree`,
  );
  console.log(
    `  --    ${counted} approved of ${everyDispatch.length}, ${everyDispatch.length - counted} not`,
  );
  check(
    "every approved dispatch is counted, at its own figure [S72], [S85]",
    miscounted === 0,
    `${miscounted} disagree`,
  );
  check(
    "*** and NOTHING unapproved reaches the figure at all *** [S72]",
    leaked === 0,
    `${leaked} unapproved request(s) are being counted`,
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
      failures === 0
        ? "\nAll checks passed."
        : `\n${failures} CHECK(S) FAILED.`,
    );
    await closeDatabase();
    process.exit(failures === 0 ? 0 : 1);
  })
  .catch(async (error) => {
    console.error(error);
    await closeDatabase();
    process.exit(1);
  });
