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
 *  9b. A summary square-metre figure rounds half-up `D32` — pure, and the
 *      of-which parts still add up to the figure beside them.
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
 *  30. **Who created a record is a measure** `S123`, and `S127` costs her
 *      nothing. Both figures over every dispatch in the database rather than
 *      this run's: the SQL is checked against the same two questions counted
 *      in TypeScript from a whole read of `dispatches` and `audit_log`, with
 *      the month rebuilt from the Riyadh offset rather than from `at time
 *      zone`, so the derivation is what is trusted and not the fixtures.
 *      Then the three claims the rule turns on: an edit that moved only the
 *      date is counted though `lines_changed_after_submission` says `false`
 *      `S120`; an impersonated edit is read through `acting_as_user_id` and
 *      so is NOT counted; and `S127`'s own request scores zero in both.
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

import { and, count, eq, like, sql } from "drizzle-orm";

import { closeDatabase, db } from "@/db";
import {
  auditLog,
  companies,
  companyReps,
  dispatchLines,
  dispatches as dispatchesTable,
  notificationTypes,
  notifications,
  productClasses,
  productFireRatings,
  productSuppliers,
  productThicknesses,
  projectCompanies,
  projectCreditSplits,
  projects,
  quotationLines,
  quotationVersions,
  recordShares,
  roles,
  serviceTypes,
  targets as targetsTable,
  users,
} from "@/db/schema";
import { canOpenRecord, canViewRecord, type AuthSession } from "@/lib/authz";
import { normalizeName } from "@/lib/normalize";
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
  formatSqm,
  formatWholeSqm,
  fromScaled,
  percentOf,
  roundSqm,
  toScaled,
} from "@/lib/decimal";
import {
  approveDispatchRequest,
  cancelDispatch,
  dispatchesInPeriod,
  getDispatch,
  listDispatchableThreads,
  listDispatches,
  refuseDispatchRequest,
  requestDispatch,
  requestOriginForPeriod,
  reviveDispatchRequest,
  setDispatchSmacNumber,
  submitDispatchRequest,
  updateDispatchRequest,
  type Dispatch,
  type DispatchInput,
} from "@/lib/dispatches";
import { NOTIFICATION_TYPES, SAUDI_CODE } from "@/lib/enums";
import { followUpScope, setNextFollowUp } from "@/lib/follow-ups";
import { listCountries } from "@/lib/lookups";
import { listNotifications, type DecisionPayload } from "@/lib/notifications";
import {
  addProjectCompany,
  createProject,
  getProject,
  listProjectCompanies,
  listProjects,
  PROJECT_END_STATES,
  projectState,
  updateProject,
} from "@/lib/projects";

import {
  acceptThread,
  addServiceLine,
  createQuotationThread,
  createRevision,
  getQuotationThread,
  issueVersion,
  listQuotationFormOptions,
  updateQuotationLine,
  type QuotationLineInput,
  type QuotationVersionInput,
} from "@/lib/quotations";
import {
  achievementForPeriod,
  currentPeriod,
  listTargetHistory,
  nextPeriodStart,
  setTarget,
} from "@/lib/targets";
import { projectTimeline } from "@/lib/timeline";

/**
 * `S130` `S119` — the three fields every request now carries. Riyadh and CT
 * because they are the unconstrained pair: `dispatches_stock_shipment` binds
 * South and Dammam, so a fixture using either would be asserting `S119` by
 * accident everywhere rather than where the sections that mean to do it are.
 */
const SHIP = { stock: "riyadh", shipment: "ct", cargoDestination: null } as const;

/**
 * `S70` `S71` `S73` — what the coordinator records when she approves. The
 * method is required and the note is not; sections that mean to assert either
 * pass their own rather than this.
 */
const PAID = { method: "bank_transfer_full", note: null } as const;

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
  await approveDispatchRequest(session, request.id, PAID);
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

/**
 * The run's stamp. **Module scope, so the `finally` at the foot of the file can
 * reach it** — every account this script writes is `${stamp}-…@example.test`,
 * which is what `endRunAccounts` below matches on.
 */
const stamp = `verify3-${Date.now()}`;

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
    .where(eq(productSuppliers.nameEn, "N"))
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
    // `throw`, not `process.exit`: this run has already created its
    // accounts, and an exit skips the `finally` that ends them `[S111]`.
    throw new Error("The lookups are not seeded. Run: npm run db:seed");
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
      nameNormalized: normalizeName(`${stamp} Co`),
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
      name: `${stamp} Project`,
      nameNormalized: normalizeName(`${stamp} Project`),
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
  };

  // Thread 1 — will be paid, and is what the linked dispatches go against.
  const mainThread = await createQuotationThread(
    repA,
    { projectId: project.id, companyId: company.id, contactId: null },
    version,
    [line],
    [],
  );
  // A service line, so §11 can prove service m² never reach a target.
  await addServiceLine(repA, mainThread.id, {
    serviceTypeId: service.id,
    quantity: "10.0000",
    unitPrice: "25.00",
    quotationLineId: null,
  });

  // Thread 2 — issued, never paid. The payment gate's subject, and since
  // `S72` it has to be ISSUED to be one: the gate now fires at the approval,
  // and a thread that was never issued is refused earlier, by `S126`. An
  // unissued thread would prove the wrong refusal.
  const onDeliveryThread = await createQuotationThread(
    repA,
    { projectId: project.id, companyId: company.id, contactId: null },
    version,
    [line],
    [],
  );
  await issueVersion(coordinator, onDeliveryThread.id, {
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
    ...SHIP,
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
    ...SHIP,
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
    () => approveDispatchRequest(repA, repRequest.id, PAID),
  );
  await refuses(
    "and neither may the manager — approving is operational [12 §3]",
    "dispatches.errors.approveOnly",
    () => approveDispatchRequest(manager, repRequest.id, PAID),
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

  /* --- 3. Approval needs a payment METHOD [S73], [S70], [S71] ----- */

  console.log(
    "\n3. Approval needs a payment METHOD, not a confirmed payment [S73], [S70]",
  );

  // **This section inverted with `S73`, and the inversion is the rule.**
  //
  // `07 C3` gated dispatch on `quotation_threads.payment_confirmed_at`. `S72`
  // moved that gate from the request to the approval; `S73` replaces the
  // CONDITION. Three things changed rather than one:
  //
  //   * The old gate asked *has money arrived?*. `on_delivery` `S71` answers
  //     "no" and is still a legitimate way to buy — which is why a rule that
  //     names it cannot also require money first.
  //   * It read a state on ANOTHER table, so it could never be a CHECK. The
  //     method is on the dispatch row, so `dispatches_payment_method` holds
  //     it, and `verify:schema25` §16 asserts that over every row.
  //   * It sat inside the thread branch, so a FREE ENTRY `S75` passed no
  //     payment gate at all. §3b below is that half, and it is new.
  //   * `S133` has since removed the old gate ENTIRELY - the column, the two
  //     acts that wrote it, and the chain rung `paid` that was its last
  //     reader. So this section no longer contrasts paid with unpaid; every
  //     quotation is unpaid as far as FACET is concerned, and the method on
  //     the dispatch is the only payment fact there is.
  //
  // An unissued quotation is a different matter and still refuses at the
  // request: `S126` is about what may be dispatched against at all.
  // **December, and the date is load-bearing.** This request used to be
  // refused and never approved, so its date did not matter. `S73` makes the
  // approval succeed, and §10-§11 below assert September's achievement as an
  // exact worked example — a proof that quietly added five square metres to
  // two reps' targets would be failing those checks for the wrong reason.
  const onDeliveryRequest = await requestDispatch(coordinator, {
    ...SHIP,
    lines: linesOf("10.0000"),
    dispatchDate: "2026-12-10",
    quotationThreadId: onDeliveryThread.id,
    companyId: null,
    userId: null,
    projectId: null,
  });
  check(
    "*** an unpaid quotation may be REQUESTED against *** [S72]",
    onDeliveryRequest.status === "draft",
  );
  await submitDispatchRequest(coordinator, onDeliveryRequest.id);
  await refuses(
    "*** approval refuses with NO payment method *** [S73]",
    "dispatches.errors.paymentMethodRequired",
    () =>
      approveDispatchRequest(coordinator, onDeliveryRequest.id, {
        method: null,
        note: null,
      }),
  );
  check(
    "and the refused approval left the request submitted, not half-approved",
    (await getDispatch(coordinator, onDeliveryRequest.id))?.status === "submitted",
  );
  // **The inversion.** Before `S73` the same call refused with
  // `dispatches.errors.paymentNotConfirmed` - a key that no longer exists,
  // reading a column that no longer exists either `S133`.
  await approveDispatchRequest(coordinator, onDeliveryRequest.id, {
    method: "on_delivery",
    note: null,
  });
  const onDeliveryApproved = await getDispatch(coordinator, onDeliveryRequest.id);
  check(
    "*** an UNCONFIRMED quotation approves, on delivery *** [S73], [S71]",
    onDeliveryApproved?.status === "approved" &&
      onDeliveryApproved.paymentMethod === "on_delivery",
    `got status ${onDeliveryApproved?.status}, method ${onDeliveryApproved?.paymentMethod}`,
  );
  // **The column that check read is gone** `S133`. It asserted that the
  // thread carried no `payment_confirmed_at` after approving on delivery,
  // which was the sharpest way to say the old gate was not being satisfied
  // quietly. There is no such column now - `S70` records payment on the
  // dispatch and nowhere else - so the assertion above, that the DISPATCH
  // carries `on_delivery`, is the whole of it.
  check(
    "an issued quotation IS offered - the list matches the write [S72]",
    (await listDispatchableThreads(coordinator)).some(
      (thread) => thread.id === onDeliveryThread.id,
    ),
  );

  /* --- 3b. The method on the FREE-ENTRY route, which had no gate --- */

  console.log(
    "\n3b. The method is required on every route of S75, not the linked one alone [S73]",
  );

  // Before `S73` this call succeeded. The gate lived inside
  // `if (request.quotationThreadId)`, so a free entry — having no thread —
  // reached `approved` with the payment question never asked at all.
  const freeRequest = await requestDispatch(coordinator, {
    ...SHIP,
    lines: linesOf("7.0000"),
    // December, for the reason above §3's first request.
    dispatchDate: "2026-12-10",
    quotationThreadId: null,
    companyId: company.id,
    userId: null,
    projectId: null,
  });
  await submitDispatchRequest(coordinator, freeRequest.id);
  await refuses(
    "*** a FREE ENTRY cannot be approved without a method either *** [S73], [S75]",
    "dispatches.errors.paymentMethodRequired",
    () =>
      approveDispatchRequest(coordinator, freeRequest.id, {
        method: null,
        note: null,
      }),
  );
  // `S71` — *handled by finance* is credit, تساهيل or a company contract,
  // settled in SMAC. It is also what `companies.has_credit_terms` was reaching
  // for as a flag nothing ever set: `0022` dropped it, because `S70` and `S73`
  // were its only citations and both were rewritten into this list.
  await approveDispatchRequest(coordinator, freeRequest.id, {
    method: "handled_by_finance",
    note: "credit terms, settled in SMAC",
  });
  const freeApproved = await getDispatch(coordinator, freeRequest.id);
  check(
    "*** and approves with one, note and all *** [S71], [S70]",
    freeApproved?.paymentMethod === "handled_by_finance" &&
      freeApproved.paymentNote === "credit terms, settled in SMAC",
    `got ${freeApproved?.paymentMethod} / ${freeApproved?.paymentNote}`,
  );
  // *An optional note carries anything the list does not* `S71` — optional
  // being the half a required field would quietly break.
  const noNote = await approvedDispatch(coordinator, {
    ...SHIP,
    lines: linesOf("5.0000"),
    // December, for the reason above §3's first request.
    dispatchDate: "2026-12-10",
    quotationThreadId: null,
    companyId: company.id,
    userId: null,
    projectId: null,
  });
  check(
    "the note is optional [S71]",
    (await getDispatch(coordinator, noNote.id))?.paymentNote === null,
  );

  await issueVersion(coordinator, mainThread.id, {
    smacReference: `${stamp}-9592`,
    verification: "unverified",
  });
  await acceptThread(coordinator, mainThread.id);

  check(
    "an accepted, issued quotation IS offered [S126]",
    (await listDispatchableThreads(coordinator)).some(
      (thread) => thread.id === mainThread.id,
    ),
  );

  const linked = await approvedDispatch(coordinator, {
    ...SHIP,
    lines: linesOf("100.0000"),
    dispatchDate: "2026-09-10",
    quotationThreadId: mainThread.id,
    companyId: null,
    userId: null,
    projectId: null,
  });
  check("the dispatch approved against it [S72]", !!linked.id);
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
    ...SHIP,
        lines: linesOf("1.0000"),
        dispatchDate: "2026-09-10",
        quotationThreadId: mainThread.id,
        companyId: project.id, // any id that is not the thread's company
        userId: null,
        projectId: null,
      }),
  );

  const secondPartial = await approvedDispatch(coordinator, {
    ...SHIP,
    lines: linesOf("5000.0000"), // far beyond the 86.3040 m² quoted
    dispatchDate: "2026-09-11",
    quotationThreadId: mainThread.id,
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
    ...SHIP,
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
    ...SHIP,
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
    ...SHIP,
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
    ...SHIP,
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
    ...SHIP,
    lines: linesOf("100.0000"),
    dispatchDate: "2026-10-05",
    quotationThreadId: mainThread.id,
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

  /* --- 9b. The display rounding, pure [D32] ---------------------- */

  console.log(
    "\n9b. A summary square-metre figure rounds half-up [D32] — no database",
  );
  {
    const shown: [string, string][] = [
      ["674.8080", "675"],
      ["800.0000", "800"],
      ["5800.0000", "5,800"],
      ["1234567.8900", "1,234,568"],
      ["0.5000", "1"],
      ["0.4999", "0"],
      ["0.0000", "0"],
      // The line figure this must NOT be applied to, proved as arithmetic:
      // a document line reconciles against what SMAC issued `S5`.
      ["2.9768", "3"],
      ["-12.6000", "-13"],
    ];
    for (const [raw, expected] of shown) {
      check(
        `${raw} shows as ${expected}`,
        formatSqm(raw) === expected,
        `got ${formatSqm(raw)}`,
      );
    }

    // **The parts must add up to the total shown beside them.** Rounding each
    // one independently gains a metre here — 101 + 101 against 201 — which is
    // why `/targets` derives the second part instead of rounding it.
    const achieved = "201.0000";
    const linked = "100.5000";
    const direct = "100.5000";
    const derived = roundSqm(achieved) - roundSqm(linked);
    check(
      "the of-which parts add up to the achieved figure [D32]",
      roundSqm(linked) + derived === roundSqm(achieved),
      `${formatSqm(linked)} + ${formatWholeSqm(derived)} vs ${formatSqm(achieved)}`,
    );
    check(
      "  …where rounding each part on its own would not [D32]",
      roundSqm(linked) + roundSqm(direct) !== roundSqm(achieved),
      `${formatSqm(linked)} + ${formatSqm(direct)} vs ${formatSqm(achieved)}`,
    );

    // `D32`'s pace percentage and `/targets`' attainment percentage are one
    // function; a second would be how the two screens start disagreeing.
    const percents: [string, string, number, number][] = [
      ["674.8080", "800.0000", SQM_SCALE, 84],
      ["704.0000", "800.0000", SQM_SCALE, 88],
      // Working days done over working days in the month, at scale 0.
      ["18", "22", 0, 82],
      ["22", "22", 0, 100],
      // The only case a percentage cannot answer.
      ["5", "0", 0, 0],
    ];
    for (const [value, of, scale, expected] of percents) {
      check(
        `${value} of ${of} is ${expected}%`,
        percentOf(value, of, scale) === expected,
        `got ${percentOf(value, of, scale)}`,
      );
    }
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
  // against `mainThread` and — separately — 40 m² with no thread at all.
  const [buyerTwo] = await db
    .insert(companies)
    .values({
      name: `${stamp} Buyer Two`,
      nameNormalized: normalizeName(`${stamp} Buyer Two`),
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
      nameNormalized: normalizeName(`${stamp} Bystander`),
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

  // **Deltas, not totals.** Sections 3 and 7 both dispatch against `mainThread`
  // and either could gain a row; a hardcoded total would then fail for a reason
  // that has nothing to do with S26. What must hold is how the figure MOVES.
  const baseline = toScaled(firstBuyerBefore?.dispatchedSqm ?? "0", SQM_SCALE);

  // A direct dispatch has no thread, so it reaches no project `S75` — this is
  // the assertion that fails the day someone routes a dispatch to a project by
  // its company instead of by its quotation thread.
  await approvedDispatch(coordinator, {
    ...SHIP,
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
    ...SHIP,
    lines: linesOf("7.0000"),
    dispatchDate: "2026-09-13",
    quotationThreadId: mainThread.id,
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
  await approvedDispatch(coordinator, {
    ...SHIP,
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
  // thread. `mainThread` belongs to `project`.
  const takenFrom = await approvedDispatch(coordinator, {
    ...SHIP,
    lines: linesOf("3.0000"),
    dispatchDate: "2026-09-14",
    quotationThreadId: mainThread.id,
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
      name: `${stamp} Other Project`,
      sqmExpected: null,
      cityId: null,
      endState: null,
      lostReasonId: null,
      lossReason: null,
      inProduction: false,
      committed: false,
    },
    [{ companyId: company.id }],
  );
  await refuses(
    "a dispatch whose project differs from its quotation's is refused [S74]",
    "dispatches.errors.projectNotOnThread",
    () =>
      approvedDispatch(coordinator, {
    ...SHIP,
        lines: linesOf("1.0000"),
        dispatchDate: "2026-09-14",
        quotationThreadId: mainThread.id,
        companyId: null,
        userId: null,
        projectId: otherProject.id,
      }),
  );

  // …and raising with no project at all is refused **at the data layer**,
  // not only by the form `S50`. This is what branch two of this section used
  // to prove the opposite of: it took a project-less quotation through issue,
  // payment and dispatch, and every step of that life is now unreachable.
  await refuses(
    "*** a quotation cannot be raised with no project *** [S50]",
    "quotations.errors.projectNotVisible",
    () =>
      createQuotationThread(
        repA,
        {
          projectId: "00000000-0000-0000-0000-000000000000",
          companyId: company.id,
          contactId: null,
        },
        version,
        [line],
        [],
      ),
  );

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
      name: `${stamp} Stale Project`,
      sqmExpected: null,
      cityId: null,
      endState: null,
      lostReasonId: null,
      lossReason: null,
      inProduction: false,
      committed: false,
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
        name: `${stamp} Renamed By Coordinator`,
        sqmExpected: null,
        cityId: null,
        endState: null,
        lostReasonId: null,
        lossReason: null,
        inProduction: false,
        committed: false,
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
   * already uses for its share row. **`followUpScope` rather than `followUps`**:
   * the latter pages, and a page-one question is not the question being asked —
   * §12's own trap. It read `followUpsForRecipient`, which asked in the
   * recipient's own scope; that existed for the daily digest and left with it
   * in session 24 `S91`. Here the caller IS the recipient, so this asks the
   * identical question.
   */
  await db
    .update(projects)
    .set({ createdAt: sql`now() - interval '400 days'` })
    .where(eq(projects.id, stale.id));

  const staleRows = (rows: { anchorType: string; anchorId: string }[]) =>
    rows.filter(
      (row) => row.anchorType === "project" && row.anchorId === stale.id,
    ).length;
  const repAQueue = staleRows((await followUpScope(repA)).rows);
  const coordinatorQueue = staleRows((await followUpScope(coordinator)).rows);
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

  // **Accepted and deliberately not issued.** The fixture carried a confirmed
  // payment here until `S133`, because that pairing was the assertion: the
  // old payment gate passed while `S126` refused, so a refusal could not be
  // `07 C3`'s. With payment off the quotation entirely there is no second
  // gate left to be mistaken for, and the version status is the whole test.
  const notIssuedThread = await createQuotationThread(
    repA,
    { projectId: project.id, companyId: company.id, contactId: null },
    version,
    [line],
    [],
  );
  await refuses(
    "*** a paid but UNISSUED quotation refuses *** [S126]",
    "dispatches.errors.quotationNotIssued",
    () =>
      approvedDispatch(coordinator, {
    ...SHIP,
        lines: linesOf("1.0000"),
        dispatchDate: "2026-09-20",
        quotationThreadId: notIssuedThread.id,
        companyId: null,
        userId: null,
        projectId: null,
      }),
  );
  check(
    "…and it is not offered in the dispatchable list either [S126]",
    (await listDispatchableThreads(coordinator)).every(
      (thread) => thread.id !== notIssuedThread.id,
    ),
    "the form would offer what the action refuses",
  );

  // The other half of the same rule, which is what makes it a rule rather than
  // a gate: issue it and the same call goes through.
  await issueVersion(coordinator, notIssuedThread.id, {
    smacReference: `${stamp}-126`,
    verification: "unverified",
  });
  const nowIssued = (await listDispatchableThreads(coordinator)).find(
    (thread) => thread.id === notIssuedThread.id,
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
    (thread) => thread.id === notIssuedThread.id,
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
    ...SHIP,
    lines: prefilled.lines,
    dispatchDate: "2026-09-21",
    quotationThreadId: notIssuedThread.id,
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
    ...SHIP,
    lines: [
      // Half the quantity went out, at a renegotiated price…
      { ...prefilled.lines[0], quantityPcs: "6.0000", unitPrice: "110.00" },
      // …plus a product the quotation never had `S116`.
      ...linesOf("10.0000", "80.00"),
    ],
    dispatchDate: "2026-09-22",
    quotationThreadId: notIssuedThread.id,
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
  const quotedAfter = await getQuotationThread(coordinator, notIssuedThread.id);
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
    ...SHIP,
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
    ...SHIP,
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
    ...SHIP,
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
    ...SHIP,
    lines: linesOf("30.0000", "80.00"),
    dispatchDate: "2026-09-25",
    quotationThreadId: mainThread.id,
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
    ...SHIP,
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
    ...SHIP,
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
    ...SHIP,
        lines: linesOf("1.0000", "80.00"),
        dispatchDate: "2026-09-26",
        projectId: null,
      }),
  );
  await refuses(
    "…nor approve one that has not been submitted [S72]",
    "dispatches.errors.notSubmitted",
    () => approveDispatchRequest(coordinator, repPath.id, PAID),
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
    ...SHIP,
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
    ...SHIP,
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

  await approveDispatchRequest(coordinator, repPath.id, PAID);
  await refuses(
    "an approved dispatch is not editable by anyone — approval is final [S73]",
    "dispatches.errors.requestNotEditable",
    () =>
      updateDispatchRequest(coordinator, repPath.id, {
    ...SHIP,
        lines: linesOf("1.0000", "80.00"),
        dispatchDate: "2026-09-26",
        projectId: null,
      }),
  );
  await refuses(
    "…and cannot be approved a second time",
    "dispatches.errors.notSubmitted",
    () => approveDispatchRequest(coordinator, repPath.id, PAID),
  );

  /* --- 20. Refusal and revival [S124], [S122] -------------------- */

  console.log(
    "\n20. *** A refusal carries a reason and archives the request *** [S124], [S122]",
  );

  const doomed = await requestDispatch(repA, {
    ...SHIP,
    lines: linesOf("7.0000", "60.00"),
    dispatchDate: "2026-09-27",
    quotationThreadId: mainThread.id,
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
  const scope = { threadId: mainThread.id };
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
    ...SHIP,
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
    // `throw`, not `process.exit`: this run has already created its
    // accounts, and an exit skips the `finally` that ends them `[S111]`.
    throw new Error("Roles are not seeded. Run: npm run db:seed");
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
      nameNormalized: normalizeName(`${stamp} Coordinator Co`),
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
    ...SHIP,
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
  await approveDispatchRequest(herself, hers.id, PAID);
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
    (row) => row.id === mainThread.id,
  );
  const beforeChain = (
    await listDispatches(coordinator, {
      threadId: mainThread.id,
      status: "approved",
    })
  ).total;

  const pending = await requestDispatch(repA, {
    ...SHIP,
    lines: linesOf("500.0000", "100.00"),
    dispatchDate: "2026-09-30",
    quotationThreadId: mainThread.id,
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
    (row) => row.id === mainThread.id,
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
        threadId: mainThread.id,
        status: "approved",
      })
    ).total === beforeChain,
  );

  // The other half of the same claim: approving it DOES move all three. A
  // figure that never moves is not proof that this one is right.
  await approveDispatchRequest(coordinator, pending.id, PAID);
  check(
    "…and approving it moves every one of them [S72]",
    (await figureFor(company.id)) !== beforeCompany &&
      (await listDispatchableThreads(coordinator)).find(
        (row) => row.id === mainThread.id,
      )?.dispatchedSqm !== beforeThread?.dispatchedSqm &&
      (
        await listDispatches(coordinator, {
          threadId: mainThread.id,
          status: "approved",
        })
      ).total ===
        beforeChain + 1,
  );

  /* --- 24. Shipment, and the CT rule [S119], [S130] --------------- */

  console.log(
    "\n24. *** South and Dammam stock have no trucks, so a dispatch from either is CT *** [S119], [S130]",
  );

  // **`S130` is what makes this rule assertable at all.** The stock used to be
  // on `quotation_versions` alone `S118`, and read from there the rule spans
  // two rows: it could never be a CHECK, it could not reach a free entry, and
  // a revision `S66` could move the value underneath a dispatch that had
  // already been raised. On the dispatch it is `dispatches_stock_shipment`.
  const ctInput = {
    lines: linesOf("3.0000"),
    dispatchDate: "2026-09-12",
    quotationThreadId: null,
    companyId: company.id,
    userId: null,
    projectId: null,
    cargoDestination: null,
  };
  for (const forced of ["south", "dammam"] as const) {
    for (const wrong of ["tt", "cargo"] as const) {
      await refuses(
        `*** ${forced} stock cannot be ${wrong.toUpperCase()} *** [S119]`,
        "dispatches.errors.shipmentMustBeCt",
        () =>
          requestDispatch(coordinator, {
            ...ctInput,
            stock: forced,
            shipment: wrong,
          }),
      );
    }
    const ok = await requestDispatch(coordinator, {
      ...ctInput,
      stock: forced,
      shipment: "ct",
    });
    check(
      `${forced} stock is fine as CT [S119]`,
      ok.stock === forced && ok.shipment === "ct",
      `got ${ok.stock} / ${ok.shipment}`,
    );
  }

  // **Riyadh and Malham take all three**, and Malham is the point: *TT is
  // discouraged there, never refused — the coordinator's knowledge, not a rule
  // FACET enforces* `S119`. An implementation that helpfully blocked it would
  // be breaking the rule rather than enforcing it, so the absence is asserted
  // rather than assumed.
  for (const stockName of ["riyadh", "malham"] as const) {
    for (const method of ["ct", "tt", "cargo"] as const) {
      const raised = await requestDispatch(coordinator, {
        ...ctInput,
        stock: stockName,
        shipment: method,
        cargoDestination: method === "cargo" ? "Jeddah" : null,
      });
      check(
        `${stockName} stock takes ${method.toUpperCase()} [S119]`,
        raised.stock === stockName && raised.shipment === method,
        `got ${raised.stock} / ${raised.shipment}`,
      );
    }
  }

  // `S119` — *Cargo carries a destination note*, and it is **optional**. The
  // pairing is what is refused, never the absence, and it is refused rather
  // than discarded: an input that vanishes is `AUDIT 1 F3`'s defect.
  const cargoNoNote = await requestDispatch(coordinator, {
    ...ctInput,
    stock: "riyadh",
    shipment: "cargo",
  });
  check(
    "a Cargo destination is OPTIONAL [S119]",
    cargoNoNote.cargoDestination === null,
  );
  for (const method of ["ct", "tt"] as const) {
    await refuses(
      `*** a destination on a ${method.toUpperCase()} dispatch is REFUSED, not dropped *** [S119]`,
      "dispatches.errors.cargoDestinationOnly",
      () =>
        requestDispatch(coordinator, {
          ...ctInput,
          stock: "riyadh",
          shipment: method,
          cargoDestination: "Jeddah",
        }),
    );
  }

  // **The same two refusals on the EDIT** `S125` `S62`. The rule holds in the
  // coordinator's window as well as the rep's, which is what one shared
  // `assertShipment` is for — two copies of it would drift.
  const editable = await requestDispatch(coordinator, {
    ...ctInput,
    stock: "riyadh",
    shipment: "tt",
  });
  await refuses(
    "*** and editing cannot move it to a stock its shipment forbids *** [S119], [S130]",
    "dispatches.errors.shipmentMustBeCt",
    () =>
      updateDispatchRequest(coordinator, editable.id, {
        lines: linesOf("3.0000"),
        dispatchDate: "2026-09-12",
        projectId: null,
        stock: "dammam",
        shipment: "tt",
        cargoDestination: null,
      }),
  );
  await updateDispatchRequest(coordinator, editable.id, {
    lines: linesOf("3.0000"),
    dispatchDate: "2026-09-12",
    projectId: null,
    stock: "dammam",
    shipment: "ct",
    cargoDestination: null,
  });
  check(
    "*** the coordinator may change the stock until approval *** [S130]",
    (await getDispatch(coordinator, editable.id))?.stock === "dammam",
  );

  /* --- 25. The dispatch's stock is its own [S130] ----------------- */

  console.log(
    "\n25. *** A dispatch may draw from a different stock than its quotation, and the quotation is not rewritten *** [S130]",
  );

  // `mainThread` was raised from Dammam by the fixture at the head of this
  // script. The dispatch takes Riyadh, which is the whole of `S130`'s first
  // sentence — and `S119` then lets it be TT, which the quotation's own stock
  // would have forbidden. That is why the column had to move.
  const [quotedStock] = await db
    .select({ stock: quotationVersions.stock })
    .from(quotationVersions)
    .where(eq(quotationVersions.threadId, mainThread.id))
    .orderBy(quotationVersions.versionNumber)
    .limit(1);
  const elsewhere = await approvedDispatch(coordinator, {
    lines: linesOf("4.0000"),
    dispatchDate: "2026-09-13",
    quotationThreadId: mainThread.id,
    companyId: null,
    userId: null,
    projectId: null,
    stock: "riyadh",
    shipment: "tt",
    cargoDestination: null,
  });
  check(
    "*** the dispatch carries its OWN stock, not the quotation's *** [S130]",
    elsewhere.stock === "riyadh" && quotedStock?.stock !== "riyadh",
    `dispatch ${elsewhere.stock}, quotation ${quotedStock?.stock}`,
  );
  const [afterwards] = await db
    .select({ stock: quotationVersions.stock })
    .from(quotationVersions)
    .where(eq(quotationVersions.threadId, mainThread.id))
    .orderBy(quotationVersions.versionNumber)
    .limit(1);
  check(
    "*** and the quotation is NOT rewritten *** [S130]",
    afterwards?.stock === quotedStock?.stock,
    `was ${quotedStock?.stock}, now ${afterwards?.stock}`,
  );
  await refuses(
    "*** after approval the stock cannot change *** [S130], [S73]",
    "dispatches.errors.requestNotEditable",
    () =>
      updateDispatchRequest(coordinator, elsewhere.id, {
        lines: linesOf("4.0000"),
        dispatchDate: "2026-09-13",
        projectId: null,
        stock: "malham",
        shipment: "tt",
        cargoDestination: null,
      }),
  );

  /* --- 26. The SMAC dispatch number [S121] ------------------------ */

  console.log(
    "\n26. *** Approved, then numbered — and the number is not a condition of approval *** [S121]",
  );

  // The negative half first, because it is the one a later writer could break
  // by "helpfully" requiring the number at approval.
  const numbering = await requestDispatch(coordinator, {
    ...SHIP,
    lines: linesOf("6.0000"),
    dispatchDate: "2026-09-14",
    quotationThreadId: null,
    companyId: company.id,
    userId: null,
    projectId: null,
  });
  await refuses(
    "*** a number cannot be written before approval *** [S121]",
    "dispatches.errors.notApproved",
    () => setDispatchSmacNumber(coordinator, numbering.id, `${stamp}-DN-1`),
  );
  await submitDispatchRequest(coordinator, numbering.id);
  await refuses(
    "nor while it sits with the coordinator [S121]",
    "dispatches.errors.notApproved",
    () => setDispatchSmacNumber(coordinator, numbering.id, `${stamp}-DN-1`),
  );

  await approveDispatchRequest(coordinator, numbering.id, PAID);
  const unnumbered = await getDispatch(coordinator, numbering.id);
  check(
    "*** it approved with NO number — the number is not a condition *** [S121]",
    unnumbered?.status === "approved" && unnumbered.smacDispatchNumber === null,
    `got ${unnumbered?.status} / ${unnumbered?.smacDispatchNumber}`,
  );
  check(
    "and an unnumbered approved dispatch still credits its target [S72], [S121]",
    (await dispatchesInPeriod("2026-09-01", "2026-10-01")).some(
      (row) => row.id === numbering.id,
    ),
  );

  await setDispatchSmacNumber(coordinator, numbering.id, `${stamp}-DN-1`);
  check(
    "*** approved, THEN numbered *** [S121]",
    (await getDispatch(coordinator, numbering.id))?.smacDispatchNumber ===
      `${stamp}-DN-1`,
  );

  // `S121` — *which is unique*. Checked in the data layer so it lands as a
  // field message; `dispatches_smac_number_key` is what holds under a race,
  // and `verify:schema25` §16 asserts that over every row.
  const otherNumbered = await approvedDispatch(coordinator, {
    ...SHIP,
    lines: linesOf("6.0000"),
    dispatchDate: "2026-09-14",
    quotationThreadId: null,
    companyId: company.id,
    userId: null,
    projectId: null,
  });
  await refuses(
    "*** and it is unique *** [S121]",
    "dispatches.errors.smacNumberTaken",
    () => setDispatchSmacNumber(coordinator, otherNumbered.id, `${stamp}-DN-1`),
  );
  await setDispatchSmacNumber(coordinator, numbering.id, `${stamp}-DN-1`);
  check(
    "re-writing the SAME number on the SAME dispatch is not a collision [S5]",
    (await getDispatch(coordinator, numbering.id))?.smacDispatchNumber ===
      `${stamp}-DN-1`,
  );
  await setDispatchSmacNumber(coordinator, numbering.id, `${stamp}-DN-2`);
  check(
    "*** a mistyped number is hers to correct *** [S5], [S121]",
    (await getDispatch(coordinator, numbering.id))?.smacDispatchNumber ===
      `${stamp}-DN-2`,
  );
  await refuses(
    "*** only the coordinator may write it *** [S121], [S62]",
    "dispatches.errors.smacNumberOnly",
    () => setDispatchSmacNumber(repA, numbering.id, `${stamp}-DN-3`),
  );

  /* --- 27. The difference flag [S120], [S77] ---------------------- */

  console.log(
    "\n27. *** A dispatch that differs from its quotation is flagged, and the flag says who *** [S120], [S77]",
  );

  /**
   * `S120` — *nobody is notified*. The baseline, asserted at the foot.
   *
   * **`decision.ended_work` is excluded from both ends, and that is the rule
   * rather than a fudge.** `S120`'s claim is about the FLAG: a dispatch that
   * differs from its quotation is visible to three people and interrupts
   * nobody. `S128` is a different rule about a different event — this section
   * refuses a request `S124`, and *a decision that ends someone's work reaches
   * them*. Counting every row would make S120's assertion fail for S128's
   * reason, which is an assertion failing for the wrong reason.
   *
   * The exclusion is by type key rather than by a smaller window, so a
   * notification of any OTHER kind raised anywhere in this section still fails
   * it — which is what the rule actually claims.
   */
  const notifiableCount = async (): Promise<number> =>
    (
      await db
        .select({ total: count() })
        .from(notifications)
        .innerJoin(
          notificationTypes,
          eq(notificationTypes.id, notifications.notificationTypeId),
        )
        .where(
          sql`${notificationTypes.key} <> ${NOTIFICATION_TYPES.decisionEndedWork}`,
        )
    )[0]?.total ?? 0;

  const notifiedBefore = await notifiableCount();
  const decisionsBefore =
    (
      await db
        .select({ total: count() })
        .from(notifications)
        .innerJoin(
          notificationTypes,
          eq(notificationTypes.id, notifications.notificationTypeId),
        )
        .where(
          sql`${notificationTypes.key} = ${NOTIFICATION_TYPES.decisionEndedWork}`,
        )
    )[0]?.total ?? 0;

  /**
   * A thread of its own, issued, with two lines — so a section that drops one
   * still leaves a dispatch, and so "added" and "dropped" are different
   * assertions rather than the same one twice.
   */
  async function issuedThread(
    label: string,
    lines: QuotationLineInput[],
  ): Promise<{ id: string; prefill: DispatchInput["lines"] }> {
    const thread = await createQuotationThread(
      repA,
      { projectId: project.id, companyId: company.id, contactId: null },
      version,
      lines,
      [],
    );
    await issueVersion(coordinator, thread.id, {
      smacReference: `${stamp}-${label}`,
      verification: "unverified",
    });
    const offered = (await listDispatchableThreads(coordinator)).find(
      (row) => row.id === thread.id,
    )!;
    return { id: thread.id, prefill: offered.lines };
  }

  /** The flag as the LIST resolves it, which is a different query from the
   *  detail's — `S116`'s lesson was that one reader is not the readers. */
  async function flagOnList(id: string): Promise<boolean | null | undefined> {
    for (let page = 1; ; page += 1) {
      const { rows, total } = await listDispatches(coordinator, { page });
      const found = rows.find((row) => row.id === id);
      if (found) return found.differsFromQuotation;
      if (page * 25 >= total || rows.length === 0) return undefined;
    }
  }

  const twoLines: QuotationLineInput[] = [
    { ...line, quantityPcs: "3.0000" },
    { ...line, customColour: "9006", quantityPcs: "4.0000" },
  ];

  /* --- the negative half first: an unedited dispatch is NOT flagged --- */

  const untouched = await issuedThread("120a", twoLines);
  const asQuotedReq = await requestDispatch(repA, {
    ...SHIP,
    lines: untouched.prefill,
    dispatchDate: "2026-09-27",
    quotationThreadId: untouched.id,
    companyId: null,
    userId: null,
    projectId: null,
  });
  await submitDispatchRequest(repA, asQuotedReq.id);
  const asQuotedFlag = (await getDispatch(coordinator, asQuotedReq.id))!;
  check(
    "*** an unedited dispatch is NOT flagged *** [S120]",
    asQuotedFlag.differsFromQuotation === false &&
      asQuotedFlag.differedAtSubmission === false &&
      asQuotedFlag.linesChangedAfterSubmission === false,
    `differs ${asQuotedFlag.differsFromQuotation}, at submit ${asQuotedFlag.differedAtSubmission}`,
  );
  check(
    "…and the LIST resolves the same answer, in SQL before pagination [S120]",
    (await flagOnList(asQuotedReq.id)) === false,
    `got ${await flagOnList(asQuotedReq.id)}`,
  );

  /* --- a colour swapped at the same price and quantity ---------------- */

  const colourOnly = await issuedThread("120b", twoLines);
  const swapped = await requestDispatch(repA, {
    ...SHIP,
    // Same price, same quantity, same everything but the colour — the exact
    // case `S120` names, and the one a quantity-only comparison would miss.
    lines: colourOnly.prefill.map((row, index) =>
      index === 0 ? { ...row, customColour: "7016" } : row,
    ),
    dispatchDate: "2026-09-27",
    quotationThreadId: colourOnly.id,
    companyId: null,
    userId: null,
    projectId: null,
  });
  await submitDispatchRequest(repA, swapped.id);
  const swappedFlag = (await getDispatch(coordinator, swapped.id))!;
  check(
    "*** a colour swapped at the same price and quantity IS flagged *** [S120]",
    swappedFlag.differsFromQuotation === true &&
      swappedFlag.differedAtSubmission === true &&
      swappedFlag.linesChangedAfterSubmission === false,
    `differs ${swappedFlag.differsFromQuotation}, at submit ${swappedFlag.differedAtSubmission}`,
  );
  check(
    "…and it is the REP's deviation, on both readers [S120]",
    (await flagOnList(swapped.id)) === true,
  );
  // `S77` — the measurement beside the flag. Quoted is the version's own total
  // `S59`; approved-against-it is nothing yet, because this one is submitted.
  check(
    "*** what was quoted, and what has actually gone out against it *** [S77]",
    swappedFlag.quotedSqm !== null &&
      swappedFlag.dispatchedAgainstVersionSqm === "0.0000",
    `quoted ${swappedFlag.quotedSqm}, dispatched ${swappedFlag.dispatchedAgainstVersionSqm}`,
  );

  /* --- an added line, and a dropped one ------------------------------- */

  const addedThread = await issuedThread("120c", twoLines);
  const addedReq = await requestDispatch(repA, {
    ...SHIP,
    lines: [...addedThread.prefill, ...linesOf("2.0000", "60.00")],
    dispatchDate: "2026-09-27",
    quotationThreadId: addedThread.id,
    companyId: null,
    userId: null,
    projectId: null,
  });
  await submitDispatchRequest(repA, addedReq.id);
  check(
    "a product the quotation never had is a difference [S120], [S116]",
    (await getDispatch(coordinator, addedReq.id))?.differsFromQuotation === true,
  );

  const dropped = await issuedThread("120d", twoLines);
  const droppedReq = await requestDispatch(repA, {
    ...SHIP,
    lines: dropped.prefill.slice(0, 1),
    dispatchDate: "2026-09-27",
    quotationThreadId: dropped.id,
    companyId: null,
    userId: null,
    projectId: null,
  });
  await submitDispatchRequest(repA, droppedReq.id);
  check(
    "…and so is a line the dispatch left behind [S120]",
    (await getDispatch(coordinator, droppedReq.id))?.differsFromQuotation ===
      true,
  );

  /* --- reordering is not a difference --------------------------------- */

  const reordered = await issuedThread("120e", twoLines);
  const reorderedReq = await requestDispatch(repA, {
    ...SHIP,
    lines: [...reordered.prefill].reverse(),
    dispatchDate: "2026-09-27",
    quotationThreadId: reordered.id,
    companyId: null,
    userId: null,
    projectId: null,
  });
  await submitDispatchRequest(repA, reorderedReq.id);
  check(
    "*** the same lines in a different order are NOT a difference *** [S120]",
    (await getDispatch(coordinator, reorderedReq.id))?.differsFromQuotation ===
      false,
    "the comparison is a sorted multiset, not a positional walk",
  );

  /* --- an unpriced quotation line, priced by the rep ------------------- */

  // **The founder's decision, exercised rather than asserted.** `S58` lets a
  // quotation line carry no price and `S116` makes the rep price it before
  // submitting, so the dispatch holds a price the quotation never did. That IS
  // a difference — *any difference flags it*, and in money terms a line that
  // was never priced was never quoted. No line in the fixtures had ever been
  // unpriced, so this one is built on purpose: the decision would otherwise
  // ship with nothing behind it.
  const unpriced = await issuedThread("120f", [
    { ...line, unitPrice: null, quantityPcs: "5.0000" },
  ]);
  check(
    "an unpriced quotation line arrives unpriced [S58], [S116]",
    unpriced.prefill[0].unitPrice === "",
    `got "${unpriced.prefill[0].unitPrice}"`,
  );
  const pricedReq = await requestDispatch(repA, {
    ...SHIP,
    lines: unpriced.prefill.map((row) => ({ ...row, unitPrice: "77.00" })),
    dispatchDate: "2026-09-27",
    quotationThreadId: unpriced.id,
    companyId: null,
    userId: null,
    projectId: null,
  });
  await submitDispatchRequest(repA, pricedReq.id);
  check(
    "*** pricing it IS a difference — no exception was invented *** [S120], [S58]",
    (await getDispatch(coordinator, pricedReq.id))?.differsFromQuotation ===
      true,
  );

  /* --- the coordinator's edit attributes to HER ------------------------ */

  const hersThread = await issuedThread("120g", twoLines);
  const hersReq = await requestDispatch(repA, {
    ...SHIP,
    lines: hersThread.prefill,
    dispatchDate: "2026-09-27",
    quotationThreadId: hersThread.id,
    companyId: null,
    userId: null,
    projectId: null,
  });
  await submitDispatchRequest(repA, hersReq.id);
  // She edits the submitted request `S125` `S62` — the phone call, not a
  // refusal — and changes a quantity.
  await updateDispatchRequest(coordinator, hersReq.id, {
    lines: hersThread.prefill.map((row, index) =>
      index === 0 ? { ...row, quantityPcs: "1.0000" } : row,
    ),
    dispatchDate: "2026-09-27",
    projectId: null,
    ...SHIP,
  });
  const hersFlag = (await getDispatch(coordinator, hersReq.id))!;
  check(
    "*** a gap the coordinator introduced is NOT the rep's deviation *** [S120], [S123]",
    hersFlag.differsFromQuotation === true &&
      hersFlag.differedAtSubmission === false &&
      hersFlag.linesChangedAfterSubmission === true,
    `differs ${hersFlag.differsFromQuotation}, rep ${hersFlag.differedAtSubmission}, hers ${hersFlag.linesChangedAfterSubmission}`,
  );
  // An edit that touches no line is not a difference anybody made.
  await updateDispatchRequest(coordinator, asQuotedReq.id, {
    lines: untouched.prefill,
    dispatchDate: "2026-09-28",
    projectId: null,
    ...SHIP,
  });
  const dateOnly = (await getDispatch(coordinator, asQuotedReq.id))!;
  check(
    "…and an edit that moves only the date changes neither half [S120]",
    dateOnly.differsFromQuotation === false &&
      dateOnly.differedAtSubmission === false &&
      dateOnly.linesChangedAfterSubmission === false,
    `hers ${dateOnly.linesChangedAfterSubmission}`,
  );

  /* --- both, and the correction back ---------------------------------- */

  const bothOf = await issuedThread("120h", twoLines);
  const bothReq = await requestDispatch(repA, {
    ...SHIP,
    lines: bothOf.prefill.map((row, index) =>
      index === 0 ? { ...row, customColour: "5010" } : row,
    ),
    dispatchDate: "2026-09-27",
    quotationThreadId: bothOf.id,
    companyId: null,
    userId: null,
    projectId: null,
  });
  await submitDispatchRequest(repA, bothReq.id);
  await updateDispatchRequest(coordinator, bothReq.id, {
    lines: bothOf.prefill.map((row, index) =>
      index === 0 ? { ...row, customColour: "5010", unitPrice: "10.00" } : row,
    ),
    dispatchDate: "2026-09-27",
    projectId: null,
    ...SHIP,
  });
  const bothFlag = (await getDispatch(coordinator, bothReq.id))!;
  check(
    "*** the rep deviated AND she changed it again — the screen can say both *** [S120]",
    bothFlag.differsFromQuotation === true &&
      bothFlag.differedAtSubmission === true &&
      bothFlag.linesChangedAfterSubmission === true,
    `rep ${bothFlag.differedAtSubmission}, hers ${bothFlag.linesChangedAfterSubmission}`,
  );

  const back = await issuedThread("120i", twoLines);
  const backReq = await requestDispatch(repA, {
    ...SHIP,
    lines: back.prefill.map((row, index) =>
      index === 0 ? { ...row, customColour: "5010" } : row,
    ),
    dispatchDate: "2026-09-27",
    quotationThreadId: back.id,
    companyId: null,
    userId: null,
    projectId: null,
  });
  await submitDispatchRequest(repA, backReq.id);
  await updateDispatchRequest(coordinator, backReq.id, {
    lines: back.prefill,
    dispatchDate: "2026-09-27",
    projectId: null,
    ...SHIP,
  });
  const backFlag = (await getDispatch(coordinator, backReq.id))!;
  check(
    "*** she brought it back to the quotation — nothing differs, the rep's half is KEPT *** [S120]",
    backFlag.differsFromQuotation === false &&
      backFlag.differedAtSubmission === true &&
      backFlag.linesChangedAfterSubmission === true,
    `differs ${backFlag.differsFromQuotation}, rep ${backFlag.differedAtSubmission}`,
  );

  /* --- a free entry is outside the question altogether ---------------- */

  const freeFlagged = await requestDispatch(coordinator, {
    ...SHIP,
    lines: linesOf("5.0000"),
    dispatchDate: "2026-09-27",
    quotationThreadId: null,
    companyId: company.id,
    userId: repB.user.id,
    projectId: null,
  });
  await submitDispatchRequest(coordinator, freeFlagged.id);
  const freeFlag = (await getDispatch(coordinator, freeFlagged.id))!;
  check(
    "*** a free entry is NULL on every half, never false *** [S120], [S75]",
    freeFlag.differsFromQuotation === null &&
      freeFlag.differedAtSubmission === null &&
      freeFlag.linesChangedAfterSubmission === null &&
      freeFlag.quotedSqm === null,
    `differs ${freeFlag.differsFromQuotation}, rep ${freeFlag.differedAtSubmission}`,
  );
  check(
    "…and the list says the same, so no figure can count it as compliant [S120]",
    (await flagOnList(freeFlagged.id)) === null,
    `got ${await flagOnList(freeFlagged.id)}`,
  );

  /* --- stable against a later revision -------------------------------- */

  // `S120` — *the comparison is against the version the dispatch was raised
  // from, not the latest one* `S68`. A revision supersedes that version `S66`
  // and starts from its lines; changing the NEW one must not reach backwards.
  const revised = await issuedThread("120j", twoLines);
  const beforeRevision = await requestDispatch(repA, {
    ...SHIP,
    lines: revised.prefill,
    dispatchDate: "2026-09-27",
    quotationThreadId: revised.id,
    companyId: null,
    userId: null,
    projectId: null,
  });
  await submitDispatchRequest(repA, beforeRevision.id);
  await approveDispatchRequest(coordinator, beforeRevision.id, PAID);
  check(
    "a dispatch raised exactly as quoted, and approved, is not flagged [S120]",
    (await getDispatch(coordinator, beforeRevision.id))
      ?.differsFromQuotation === false,
  );

  await createRevision(repA, revised.id, "rep_change_request");
  const [newLine] = await db
    .select({ id: quotationLines.id })
    .from(quotationLines)
    .innerJoin(
      quotationVersions,
      eq(quotationVersions.id, quotationLines.versionId),
    )
    .where(
      and(
        eq(quotationVersions.threadId, revised.id),
        eq(quotationVersions.status, "requested"),
      ),
    )
    .limit(1);
  await updateQuotationLine(repA, revised.id, newLine.id, {
    ...line,
    customColour: "1013",
    quantityPcs: "99.0000",
  });
  const afterRevision = (await getDispatch(coordinator, beforeRevision.id))!;
  check(
    "*** a later revision does not retroactively create a gap *** [S120], [S126], [S66]",
    afterRevision.differsFromQuotation === false &&
      afterRevision.differedAtSubmission === false,
    `differs ${afterRevision.differsFromQuotation}`,
  );
  check(
    "…and the flag survives approval, which is what permanent means [S120], [S73]",
    afterRevision.status === "approved",
    `got ${afterRevision.status}`,
  );

  /* --- revival clears it, and resubmission recomputes ----------------- */

  const revivable = await issuedThread("120k", twoLines);
  const revivedReq = await requestDispatch(repA, {
    ...SHIP,
    lines: revivable.prefill.map((row, index) =>
      index === 0 ? { ...row, quantityPcs: "1.0000" } : row,
    ),
    dispatchDate: "2026-09-27",
    quotationThreadId: revivable.id,
    companyId: null,
    userId: null,
    projectId: null,
  });
  await submitDispatchRequest(repA, revivedReq.id);
  check(
    "a deviating request carries the rep's half [S120]",
    (await getDispatch(coordinator, revivedReq.id))?.differedAtSubmission ===
      true,
  );
  await refuseDispatchRequest(coordinator, revivedReq.id, `${stamp} 120 refused`);
  await reviveDispatchRequest(coordinator, revivedReq.id);
  const revivedFlag = (await getDispatch(coordinator, revivedReq.id))!;
  check(
    "*** a revived request is treated as new — both halves clear *** [S120], [S122]",
    revivedFlag.differedAtSubmission === null &&
      revivedFlag.linesChangedAfterSubmission === null,
    `rep ${revivedFlag.differedAtSubmission}, hers ${revivedFlag.linesChangedAfterSubmission}`,
  );
  // The derived comparison does NOT clear — the lines still differ, and they
  // are still this rep's to edit. Only the attribution was withdrawn with the
  // submission it belonged to.
  check(
    "…while the comparison itself still reads the lines as they stand [S120]",
    revivedFlag.differsFromQuotation === true,
  );
  await updateDispatchRequest(repA, revivedReq.id, {
    lines: revivable.prefill,
    dispatchDate: "2026-09-27",
    projectId: null,
    ...SHIP,
  });
  await submitDispatchRequest(repA, revivedReq.id);
  const resubmitted = (await getDispatch(coordinator, revivedReq.id))!;
  check(
    "*** and resubmitting recomputes it against the same version *** [S120], [S122]",
    resubmitted.differsFromQuotation === false &&
      resubmitted.differedAtSubmission === false &&
      resubmitted.linesChangedAfterSubmission === false,
    `differs ${resubmitted.differsFromQuotation}, rep ${resubmitted.differedAtSubmission}`,
  );

  /* --- the quoted lines, and who may read them ------------------------ */

  check(
    "*** a flagged dispatch carries the version's own lines, to compare *** [S120], [S77]",
    swappedFlag.quotedLines.length === 2 &&
      swappedFlag.quotedLines.some((row) => row.customColour === "9006"),
    `${swappedFlag.quotedLines.length} quoted line(s)`,
  );
  check(
    "…and one that matches carries none — the same list twice is not a comparison [D51]",
    asQuotedFlag.quotedLines.length === 0 && freeFlag.quotedLines.length === 0,
    `${asQuotedFlag.quotedLines.length} / ${freeFlag.quotedLines.length}`,
  );
  // `S120` — *visible to the rep, the coordinator and the manager*. No new
  // visibility term was written: all three already see the dispatch through
  // `visibleDispatchesFilter`, and the flag rides on the row.
  const managerSees = await getDispatch(manager, swapped.id);
  const repSees = await getDispatch(repA, swapped.id);
  check(
    "*** the flag is visible to the rep, the coordinator and the manager *** [S120]",
    managerSees?.differsFromQuotation === true &&
      repSees?.differsFromQuotation === true,
    `manager ${managerSees?.differsFromQuotation}, rep ${repSees?.differsFromQuotation}`,
  );
  // And **nobody is notified about the flag** `S120`, which the rule says
  // outright. Counted across the whole section rather than matched on a body:
  // every act above — eleven requests, eleven submissions, two coordinator
  // edits, a refusal, a revival and an approval — must have raised nothing
  // between them but the one thing a DIFFERENT rule requires.
  const notifiedAfter = await notifiableCount();
  check(
    "*** …and NOBODY is notified about the difference *** [S120]",
    notifiedAfter === notifiedBefore,
    `${notifiedBefore} before, ${notifiedAfter} after`,
  );

  // The other end of the same window, so the exclusion above cannot hide a
  // silence: `S128` says *a refused dispatch request carries a written reason
  // that reaches the rep who raised it*, and this section refuses exactly one.
  const [decisionsAfter] = await db
    .select({ total: count() })
    .from(notifications)
    .innerJoin(
      notificationTypes,
      eq(notificationTypes.id, notifications.notificationTypeId),
    )
    .where(
      sql`${notificationTypes.key} = ${NOTIFICATION_TYPES.decisionEndedWork}`,
    );
  check(
    "…while the ONE refusal in it does tell the rep, which is S128, not S120 [S128], [S124]",
    (decisionsAfter?.total ?? 0) === decisionsBefore + 1,
    `${decisionsBefore} before, ${decisionsAfter?.total} after`,
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

  /* --- 28. Won is derived; committed is the rep's [S31], [S28], [S29] --- */

  console.log(
    "\n28. *** A project is won when a dispatch against it is approved *** [S31]",
  );

  // A project of its own, so the three states below are this section's and not
  // a leftover from §15's write-back.
  const winnable = await createProject(
    repA,
    {
      name: `${stamp} Winnable Project`,
      sqmExpected: null,
      cityId: null,
      endState: null,
      lostReasonId: null,
      lossReason: null,
      inProduction: false,
      committed: false,
    },
    [{ companyId: company.id }],
  );

  /**
   * `won`, from both readers.
   *
   * **Two readers, not one.** A derived figure is asserted at every reader
   * (`CLAUDE.md`): `getProject` selects `projectIsWon()` into a single-row
   * query and `listProjects` selects it into a paginated one, and the
   * correlated-subquery trap the rule exists for bites exactly one of those
   * shapes at a time. Reading only the detail would have passed with the list
   * silently returning `false` for everything.
   */
  async function wonBoth(id: string): Promise<{ detail: boolean; list: boolean }> {
    const detail = await getProject(repA, id);
    if (!detail) throw new Error(`project ${id} not visible`);
    const page = await listProjects(repA, { q: stamp });
    const row = page.rows.find((candidate) => candidate.id === id);
    if (!row) throw new Error(`project ${id} not on the list of ${page.total}`);
    return { detail: detail.won, list: row.won };
  }

  const beforeAnything = await wonBoth(winnable.id);
  check(
    "a project with no dispatch at all is not won [S31]",
    beforeAnything.detail === false && beforeAnything.list === false,
    `detail=${beforeAnything.detail} list=${beforeAnything.list}`,
  );

  // **A dispatch reaches a project through a quotation today** `S74`. The free
  // route names none — `requestDispatch` writes `project_id` null on it
  // deliberately, and neither `/dispatches/new?mode=direct` nor its page ever
  // asks. That is `S75`'s remaining half and it is not this rule's to build,
  // so the win below is proved on the route that can carry a project.
  const winnableThread = await createQuotationThread(
    repA,
    { projectId: winnable.id, companyId: company.id, contactId: null },
    version,
    [{ ...line, quantityPcs: "40.0000" }],
    [],
  );
  await issueVersion(coordinator, winnableThread.id, {
    smacReference: `${stamp}-win`,
    verification: "unverified",
  });

  // **A request is not an approval** `S72`. Raised and submitted, so it is
  // sitting on the coordinator's desk — the state `S86` calls waiting, and the
  // one a stored flag written at request time would have got wrong.
  const awaitingHer = await requestDispatch(repA, {
    ...SHIP,
    lines: linesOf("40.0000"),
    dispatchDate: "2026-09-20",
    quotationThreadId: winnableThread.id,
    companyId: null,
    userId: null,
    projectId: null,
  });
  await submitDispatchRequest(repA, awaitingHer.id);
  check(
    "the request carries the project its quotation names [S74]",
    (await getDispatch(coordinator, awaitingHer.id))?.projectId === winnable.id,
  );

  const whileSubmitted = await wonBoth(winnable.id);
  check(
    "*** a project with only a SUBMITTED request is not won *** [S31], [S72]",
    whileSubmitted.detail === false && whileSubmitted.list === false,
    `detail=${whileSubmitted.detail} list=${whileSubmitted.list}`,
  );

  await approveDispatchRequest(coordinator, awaitingHer.id, PAID);

  const afterApproval = await wonBoth(winnable.id);
  check(
    "*** approving it wins the project, on the detail AND on the list *** [S31]",
    afterApproval.detail === true && afterApproval.list === true,
    `detail=${afterApproval.detail} list=${afterApproval.list}`,
  );

  // `S77` — one quotation produces any number of dispatches, so a won project
  // must stay dispatchable. Asked of `listDispatchableThreads`, which is what
  // the request form reads now that `S50` took the project picker off it: the
  // question was never about a list of projects, it was about whether a second
  // dispatch can be raised at all.
  check(
    "…and its quotation is still offered, so a second dispatch can be raised [S77], [S74]",
    (await listDispatchableThreads(coordinator)).some(
      (row) => row.id === winnableThread.id && row.projectId === winnable.id,
    ),
  );

  // **Nothing hand-sets it.** `end_state` carries one value now, so the type
  // itself refuses `won` — this asserts the vocabulary rather than a guard,
  // which is the point: there is no guard to forget.
  check(
    "the end-state vocabulary offers no way to claim a win [S31], [S28]",
    PROJECT_END_STATES.length === 1 && PROJECT_END_STATES[0] === "lost",
    PROJECT_END_STATES.join(","),
  );

  // **And the half that is NOT built, asserted so it cannot be forgotten**
  // `S75`. A free entry names no project, so it wins none. `S31` is true as
  // written — a dispatch that names no project wins nothing — but the route
  // cannot name one at all, which is what `S75`'s marker still stands for.
  const unlinkedWin = await approvedDispatch(coordinator, {
    ...SHIP,
    lines: linesOf("11.0000"),
    dispatchDate: "2026-09-21",
    quotationThreadId: null,
    companyId: company.id,
    userId: repA.user.id,
    projectId: winnable.id,
  });
  check(
    "a FREE ENTRY still names no project, so it wins none [S75], [S31]",
    unlinkedWin.projectId === null,
    `got ${unlinkedWin.projectId}`,
  );

  console.log("\n   Committed is the rep's, and is never a win [S29], [S31]");

  // `S29`'s fifth item, on a project that has dispatched nothing.
  const promised = await createProject(
    repA,
    {
      name: `${stamp} Promised Project`,
      sqmExpected: null,
      cityId: null,
      endState: null,
      lostReasonId: null,
      lossReason: null,
      inProduction: false,
      committed: true,
    },
    [{ companyId: company.id }],
  );

  const committedState = await wonBoth(promised.id);
  check(
    "*** committed is NEVER counted as won *** [S31], [S65]",
    committedState.detail === false && committedState.list === false,
    `detail=${committedState.detail} list=${committedState.list}`,
  );
  check(
    "…and the state a screen prints says committed, not won [S28]",
    projectState({ won: false, endState: null, committed: true }) ===
      "committed",
  );
  check(
    "…while a won project that is ALSO committed reads as won [S31]",
    projectState({ won: true, endState: null, committed: true }) === "won",
  );
  check(
    "…and a lost one reads as lost, so nothing clears the column [S29]",
    projectState({ won: false, endState: "lost", committed: true }) === "lost",
  );

  // The rep clears it the same way they set it — `S29` says they set it, and
  // a judgement that cannot be withdrawn is not a judgement.
  const withdrawn = await updateProject(repA, promised.id, {
    name: promised.name,
    sqmExpected: null,
    cityId: null,
    endState: null,
    lostReasonId: null,
    lossReason: null,
    inProduction: false,
    committed: false,
  });
  check(
    "a rep clears their own commitment [S29]",
    withdrawn.committed === false,
    `committed=${withdrawn.committed}`,
  );

  console.log(
    "\n29. *** A cancelled dispatch credits nothing and wins nothing *** [S73], [S31], [S128]",
  );

  /**
   * `S73`'s second half, and `S128`'s reason for existing.
   *
   * **Dated in DECEMBER on purpose.** §11 asserts September's achievement as an
   * exact worked example and §10 October's; a new approval in either month
   * moves a number this script proves by arithmetic. Nothing measures December.
   */
  const CANCEL_MONTH = "2026-12";
  const CANCEL_DATE = "2026-12-08";

  const undoneProject = await createProject(
    repA,
    {
      name: `${stamp} Undone Project`,
      sqmExpected: null,
      cityId: null,
      endState: null,
      lostReasonId: null,
      lossReason: null,
      inProduction: false,
      committed: false,
    },
    [{ companyId: company.id }],
  );

  /**
   * **A SPLIT, so `S128`'s second recipient exists.** *That reason reaches
   * everyone whose work it ends — the rep who raised it, and any rep whose
   * credit it takes back `S80`.* With no split there is only one person and the
   * hard half of the rule is never exercised: rep B holds no company here and
   * cannot see the dispatch at all, which is exactly the case `S128` calls
   * *the message carries the reason and stands alone*.
   *
   * Effective 1 December, which is after today `S110` forbids backdating and
   * on or before the dispatch's own date — `creditForDispatches` takes the
   * generation in force on THAT date, so this one applies to it.
   */
  await setCreditSplit(manager, undoneProject.id, {
    effectiveFrom: "2026-12-01",
    userIds: [repA.user.id, repB.user.id],
  });

  const undoneThread = await createQuotationThread(
    repA,
    { projectId: undoneProject.id, companyId: company.id, contactId: null },
    version,
    [{ ...line, quantityPcs: "40.0000" }],
    [],
  );
  await issueVersion(coordinator, undoneThread.id, {
    smacReference: `${stamp}-DOOM`,
    verification: "unverified",
  });
  /**
   * **Raised by the rep, approved by the coordinator, and that is deliberate.**
   * `approvedDispatch` walks all three acts as ONE identity, which §21 needs to
   * assert `S127`. Here it would defeat the point: `cancelDispatch` drops a
   * self-directed row, so a coordinator cancelling a request she also raised
   * would tell nobody and the section would pass having proved nothing.
   */
  const undoneRequest = await requestDispatch(repA, {
    ...SHIP,
    lines: linesOf("50.0000"),
    dispatchDate: CANCEL_DATE,
    quotationThreadId: undoneThread.id,
    companyId: null,
    userId: null,
    projectId: null,
  });
  await submitDispatchRequest(repA, undoneRequest.id);
  await approveDispatchRequest(coordinator, undoneRequest.id, PAID);
  const [undone] = await db
    .select()
    .from(dispatchesTable)
    .where(eq(dispatchesTable.id, undoneRequest.id))
    .limit(1);
  const undoneSqm = await sqmOf(undone.id);

  // The state before, so every "after" below is a change rather than a
  // coincidence.
  const wonBefore = await wonBoth(undoneProject.id);
  const monthBefore = await achievementForPeriod(manager, CANCEL_MONTH);
  const repABefore =
    monthBefore.find((row) => row.userId === repA.user.id)?.achievedSqm ??
    "0.0000";
  const repBBefore =
    monthBefore.find((row) => row.userId === repB.user.id)?.achievedSqm ??
    "0.0000";
  check(
    "the dispatch wins its project while it is approved [S31]",
    wonBefore.detail === true && wonBefore.list === true,
    `detail=${wonBefore.detail} list=${wonBefore.list}`,
  );

  /* --- The gates, each with its own key [S73] ----------------------- */

  await refuses(
    "a rep may not cancel — only internal sales [S73]",
    "dispatches.errors.cancelOnly",
    () => cancelDispatch(repA, undone.id, "the customer changed their mind"),
  );
  await refuses(
    "a cancellation with no written reason is refused [S73], [S128]",
    "dispatches.errors.cancellationReasonRequired",
    () => cancelDispatch(coordinator, undone.id, "   "),
  );

  /* --- The act ------------------------------------------------------ */

  const CANCEL_REASON = "finance refused the transfer, so this cannot go out";
  await cancelDispatch(coordinator, undone.id, CANCEL_REASON);

  const cancelled = await getDispatch(coordinator, undone.id);
  check(
    "the dispatch is cancelled and carries its reason [S73]",
    cancelled?.status === "cancelled" && cancelled?.cancellationReason === CANCEL_REASON,
    `status=${cancelled?.status} reason=${cancelled?.cancellationReason}`,
  );
  check(
    "…and it KEEPS its approval stamps — approval is final, not undone [S73]",
    cancelled?.approvedAt !== null && cancelled?.approvedByName !== null,
    `approvedAt=${cancelled?.approvedAt} by=${cancelled?.approvedByName}`,
  );
  check(
    "…and its payment method, which the widened CHECK permits [S71], [S73]",
    cancelled?.paymentMethod === PAID.method,
    `got ${cancelled?.paymentMethod}`,
  );
  // `S31` — *its difference flag stays with it*. This one matches its
  // quotation, so the assertion is that the comparison still resolves at all
  // rather than going null: a cancelled dispatch keeps both sides frozen.
  check(
    "…and its difference flag, which S31 keeps with it [S120], [S31]",
    cancelled?.differsFromQuotation !== null &&
      cancelled?.differedAtSubmission !== null,
    `differs=${cancelled?.differsFromQuotation} atSubmission=${cancelled?.differedAtSubmission}`,
  );
  // Credit is rendered only for an approved dispatch, so a cancelled one shows
  // none — which is the screen half of "credits nothing".
  check(
    "…and it shows no credit table any more [S31]",
    cancelled?.credit === null,
    `got ${JSON.stringify(cancelled?.credit)}`,
  );

  /* --- It credits nothing and wins nothing [S31] -------------------- */

  const wonAfter = await wonBoth(undoneProject.id);
  check(
    "*** cancelling UN-WINS the project, at both readers *** [S31], [S73]",
    wonAfter.detail === false && wonAfter.list === false,
    `detail=${wonAfter.detail} list=${wonAfter.list}`,
  );

  const monthAfter = await achievementForPeriod(manager, CANCEL_MONTH);
  const repAAfter =
    monthAfter.find((row) => row.userId === repA.user.id)?.achievedSqm ??
    "0.0000";
  const repBAfter =
    monthAfter.find((row) => row.userId === repB.user.id)?.achievedSqm ??
    "0.0000";
  // Half each `S81`, so the pair sums to exactly the dispatch's own sqm `18 §5`
  // and both halves leave the month together.
  const halves = divideEqually(toScaled(undoneSqm, SQM_SCALE), 2).map((share) =>
    fromScaled(share, SQM_SCALE),
  );
  check(
    "*** the square metres leave rep A's month, exactly *** [S85], [S31]",
    sumSqm([repAAfter, halves[0]]) === repABefore,
    `before=${repABefore} after=${repAAfter} share=${halves[0]}`,
  );
  check(
    "*** and the co-credited rep's, exactly *** [S80], [S85], [S31]",
    sumSqm([repBAfter, halves[1]]) === repBBefore,
    `before=${repBBefore} after=${repBAfter} share=${halves[1]}`,
  );

  const decemberRows = await dispatchesInPeriod("2026-12-01", "2027-01-01");
  check(
    "…and the one predicate every figure composes no longer returns it [S72]",
    decemberRows.every((row) => row.id !== undone.id),
    `${decemberRows.length} row(s) in ${CANCEL_MONTH}`,
  );

  /* --- Never revived [S73] ------------------------------------------ */

  // Five acts, five keys. `S73` says *never revived: a new dispatch is raised
  // instead* — and nothing in `cancelDispatch` enforces that. Each of these
  // refuses by falling through a status guard written for another rule, which
  // is exactly the kind of claim that decays silently if nobody asserts it.
  await refuses(
    "a cancelled dispatch is never revived [S73], [S122]",
    "dispatches.errors.notRefused",
    () => reviveDispatchRequest(coordinator, undone.id),
  );
  await refuses(
    "…never re-approved [S73]",
    "dispatches.errors.notSubmitted",
    () => approveDispatchRequest(coordinator, undone.id, PAID),
  );
  await refuses(
    "…never re-submitted [S73]",
    "dispatches.errors.notDraft",
    () => submitDispatchRequest(repA, undone.id),
  );
  await refuses(
    "…never edited [S73], [S125]",
    "dispatches.errors.requestNotEditable",
    () =>
      updateDispatchRequest(coordinator, undone.id, {
        ...SHIP,
        lines: linesOf("50.0000"),
        dispatchDate: CANCEL_DATE,
        projectId: null,
      }),
  );
  await refuses(
    "…never numbered [S121], [S73]",
    "dispatches.errors.notApproved",
    () => setDispatchSmacNumber(coordinator, undone.id, `${stamp}-NOPE`),
  );
  await refuses(
    "…and never cancelled twice [S73]",
    "dispatches.errors.notApproved",
    () => cancelDispatch(coordinator, undone.id, "again"),
  );

  /* --- The telling [S128] ------------------------------------------- */

  const decisionsFor = async (
    who: AuthSession,
  ): Promise<DecisionPayload[]> => {
    const { rows } = await listNotifications(who);
    return rows
      .filter((row) => row.typeKey === NOTIFICATION_TYPES.decisionEndedWork)
      .map((row) => row.payload)
      .filter(
        (payload): payload is DecisionPayload => payload?.kind === "decision",
      )
      .filter((payload) => payload.recordId === undone.id);
  };

  const [toldA] = await decisionsFor(repA);
  check(
    "*** the rep who raised it is told, with the reason *** [S128]",
    toldA?.decision === "dispatch_cancelled" && toldA?.reason === CANCEL_REASON,
    `got ${JSON.stringify(toldA)}`,
  );
  check(
    "…and for them it IS a link, because they can open the dispatch [S112]",
    toldA?.recordViewable === true && toldA?.href === `/dispatches/${undone.id}`,
    `viewable=${toldA?.recordViewable} href=${toldA?.href}`,
  );

  /**
   * **The half of `S128` that no other assertion reaches.**
   *
   * Rep B holds no company, is not on this dispatch and cannot open it — the
   * negative is asserted first, because a message that "stands alone" proves
   * nothing if the record turns out to be visible after all. Then: the reason
   * is there anyway, and the link is not.
   *
   * *This is a deliberate exception to `S112`* — an audit row is never shown
   * without joining back to the record and applying its visibility. *Here the
   * rep's own credit was taken, so the reason reaches them even where the
   * record does not.*
   */
  check(
    "the co-credited rep genuinely CANNOT open the dispatch [S128], [18 §2]",
    (await canOpenRecord(repB, "dispatch", undone.id)) === false,
  );
  const [toldB] = await decisionsFor(repB);
  check(
    "*** the co-credited rep is told anyway, and the reason stands alone *** [S128], [S80]",
    toldB?.reason === CANCEL_REASON &&
      toldB?.recordViewable === false &&
      toldB?.href === null,
    `got ${JSON.stringify(toldB)}`,
  );

  const cancelAudit = await db
    .select({ action: auditLog.action })
    .from(auditLog)
    .where(
      and(
        eq(auditLog.entityId, undone.id),
        eq(auditLog.action, "dispatch.cancelled"),
      ),
    );
  check(
    "the cancellation is audited [07 E1], [S112]",
    cancelAudit.length === 1,
    `${cancelAudit.length} row(s)`,
  );

  /**
   * **The invariant, over every project in the database**, not the four this
   * section made. The module's derivation against a hand-written truth: if
   * `projectIsWon`'s subquery ever loses a table qualifier and correlates
   * against itself, it returns `false` everywhere and every check above still
   * passes on the row it just created. This is the reader that would not.
   */
  const everyProject = await db
    .select({ id: projects.id, endState: projects.endState })
    .from(projects);
  const trulyWon = new Set(
    (
      (await db.execute(sql`
        select distinct d.project_id::text as id
        from dispatches d
        where d.project_id is not null and d.status = 'approved'
      `)) as unknown as { id: string }[]
    ).map((row) => row.id),
  );
  let wrongWin = 0;
  for (const row of everyProject) {
    const seen = await getProject(manager, row.id);
    if (!seen) continue;
    if (seen.won !== trulyWon.has(row.id)) wrongWin += 1;
  }
  check(
    "*** no project's derived win disagrees with its dispatches, on any row *** [S31]",
    wrongWin === 0,
    `${wrongWin} of ${everyProject.length} disagree (${trulyWon.size} genuinely won)`,
  );


  /* --- 30. S123 — who created a record is a measure [S123], [S127] ---- */

  console.log(
    "\n30. *** Who created a record is a measure *** [S123], [S127]",
  );

  // **The month bounds the ACT**, so it is the month this run is happening in,
  // not a fixture date. `dispatch_date` on the rows below is November; their
  // `created_at` is now, and `created_at` is what `S123` counts.
  const s123From = currentPeriod();
  const s123To = nextPeriodStart(s123From);

  // Deltas, not absolutes. This script keeps its rows `[12 §7]`, so an earlier
  // section's dispatch is already in these figures and a run in the same month
  // as the last one sees both. What each act below must move is exact; what the
  // database happened to contain before it is not this section's claim.
  const before = await requestOriginForPeriod(manager, s123From, s123To);
  const beforeA = before.find((row) => row.userId === repA.user.id);
  check(
    "the rep is measured at all, so the deltas below have something to move",
    beforeA !== undefined,
  );

  /* --- Figure one: a request raised FOR a rep [S123] ------------------ */

  // The path `71af2a3` built: `S108` never asks a rep who they are, and only a
  // `can_dispatch` holder may name somebody else. `herself` is `S127`'s
  // run-scoped coordinator, and the company is hers — which is `S127` again,
  // and keeps this out of the shared fixtures.
  const forRep = await requestDispatch(herself, {
    ...SHIP,
    lines: linesOf("21.0000", "70.00"),
    dispatchDate: "2026-11-04",
    quotationThreadId: null,
    companyId: herCompany.id,
    userId: repA.user.id,
    projectId: null,
  });
  check(
    "*** the coordinator raises a request FOR a rep *** [S123]",
    forRep.recordedByUserId === herUser.id && forRep.userId === repA.user.id,
    `recorded by ${forRep.recordedByUserId}, credits ${forRep.userId}`,
  );

  /* --- Figure two: an edit S120's column does not record [S123] ------- */

  // A quotation-linked request, deliberately: `S120` says *a free-entry
  // dispatch is outside the question entirely*, so contrasting the two figures
  // on a free entry would prove nothing. Here the column exists and is `false`,
  // and `S123` still counts the edit.
  const [s123Company] = await db
    .insert(companies)
    .values({
      name: `${stamp} Origin Co`,
      nameNormalized: normalizeName(`${stamp} Origin Co`),
      phone: `+9665${stamp.slice(-7)}5`,
      countryId: saudiId,
      createdBy: repA.user.id,
    })
    .returning();
  await db.insert(companyReps).values({
    companyId: s123Company.id,
    userId: repA.user.id,
    isPrimary: true,
    origin: "self_registered",
  });
  const [s123Project] = await db
    .insert(projects)
    .values({
      name: `${stamp} Origin Project`,
      nameNormalized: normalizeName(`${stamp} Origin Project`),
      ownerUserId: repA.user.id,
      createdBy: repA.user.id,
    })
    .returning();
  // `S27` — a thread may only name a project its company takes part in,
  // which `assertCompanyOnProject` holds. The link is what lets the request
  // below derive its project `S74` instead of naming one on every edit.
  await addProjectCompany(repA, s123Project.id, {
    companyId: s123Company.id,
  });
  const s123Thread = await createQuotationThread(
    repA,
    {
      projectId: s123Project.id,
      companyId: s123Company.id,
      contactId: null,
    },
    version,
    [line],
    [],
  );
  await issueVersion(coordinator, s123Thread.id, {
    smacReference: `${stamp}-origin`,
    verification: "unverified",
  });

  const dateMoved = await requestDispatch(repA, {
    ...SHIP,
    lines: linesOf("9.0000", "65.00"),
    dispatchDate: "2026-11-05",
    quotationThreadId: s123Thread.id,
    companyId: null,
    userId: null,
    projectId: null,
  });
  await submitDispatchRequest(repA, dateMoved.id);
  check(
    "a submitted request starts with the lines UNMOVED [S120]",
    (await getDispatch(repA, dateMoved.id))?.linesChangedAfterSubmission ===
      false,
  );

  // **The same lines, a different date.** `linesOf` is a pure function of its
  // two arguments, so this hands back exactly the set the rep submitted and
  // `linesDigestFor` sees no change.
  await updateDispatchRequest(coordinator, dateMoved.id, {
    ...SHIP,
    lines: linesOf("9.0000", "65.00"),
    dispatchDate: "2026-11-06",
    projectId: null,
  });
  const afterDateEdit = (await getDispatch(coordinator, dateMoved.id))!;
  check(
    "*** the coordinator edited it, and S120's column still says false *** [S120]",
    afterDateEdit.dispatchDate === "2026-11-06" &&
      afterDateEdit.linesChangedAfterSubmission === false,
    `${afterDateEdit.dispatchDate}, linesChanged ${afterDateEdit.linesChangedAfterSubmission}`,
  );

  /* --- Impersonation: coalesce, never the raw actor [S123], [07 A6] --- */

  // A real edit through the real writer, rather than a hand-inserted audit row.
  // The manager is at the keyboard **acting as** the coordinator who raised
  // `forRep`, so `actor_user_id` and `acting_as_user_id` disagree — which is
  // exactly the row that separates the two readings. `session.user.id` was the
  // coordinator, so this is her editing her own draft and `S123` must not count
  // it; reading the raw actor would.
  const asHer: AuthSession = {
    user: { ...herUser, role: coordRole },
    realUser: manager.user,
    isImpersonating: true,
    actor: { actorUserId: manager.user.id, actingAsUserId: herUser.id },
  };
  await updateDispatchRequest(asHer, forRep.id, {
    ...SHIP,
    lines: linesOf("21.0000", "70.00"),
    dispatchDate: "2026-11-07",
    projectId: null,
  });
  const [impersonated] = await db
    .select({
      actorUserId: auditLog.actorUserId,
      actingAsUserId: auditLog.actingAsUserId,
    })
    .from(auditLog)
    .where(
      and(
        eq(auditLog.entityType, "dispatch"),
        eq(auditLog.entityId, forRep.id),
        eq(auditLog.action, "dispatch.edited"),
      ),
    );
  check(
    "the impersonated edit is a row where the two readings DISAGREE [07 A6]",
    impersonated?.actorUserId === manager.user.id &&
      impersonated?.actingAsUserId === herUser.id,
    `actor ${impersonated?.actorUserId}, acting as ${impersonated?.actingAsUserId}`,
  );

  /* --- Recomputed over EVERY row, not this run's [S123] --------------- */

  // The same two questions asked a different way: read both tables whole and
  // count in TypeScript. Not a second call to the same SQL — the window is
  // rebuilt from the Riyadh offset rather than from `at time zone`, and the
  // grouping is a Map rather than a `filter` clause. Where the two agree over
  // every dispatch in the database, the derivation is the thing being trusted
  // rather than the fixtures.
  const originDispatches = await db
    .select({
      id: dispatchesTable.id,
      userId: dispatchesTable.userId,
      recordedByUserId: dispatchesTable.recordedByUserId,
      createdAt: dispatchesTable.createdAt,
    })
    .from(dispatchesTable);
  const originEdits = await db
    .select({
      entityId: auditLog.entityId,
      actorUserId: auditLog.actorUserId,
      actingAsUserId: auditLog.actingAsUserId,
      createdAt: auditLog.createdAt,
    })
    .from(auditLog)
    .where(eq(auditLog.action, "dispatch.edited"));

  // Riyadh is UTC+3 and keeps no daylight saving, so midnight there is the
  // offset written out. Built this way on purpose: reusing `at time zone` would
  // be asserting the SQL against itself.
  const windowStart = new Date(`${s123From}T00:00:00+03:00`);
  const windowEnd = new Date(`${s123To}T00:00:00+03:00`);
  const inOriginWindow = (at: Date) => at >= windowStart && at < windowEnd;

  const bump = (into: Map<string, number>, key: string) =>
    into.set(key, (into.get(key) ?? 0) + 1);

  const raisedTally = new Map<string, number>();
  const forThemTally = new Map<string, number>();
  const raiserOf = new Map<string, string>();
  const repOf = new Map<string, string>();
  for (const row of originDispatches) {
    raiserOf.set(row.id, row.recordedByUserId);
    repOf.set(row.id, row.userId);
    if (!inOriginWindow(row.createdAt)) continue;
    bump(raisedTally, row.userId);
    if (row.recordedByUserId !== row.userId) bump(forThemTally, row.userId);
  }

  // One request, however many times she touched it: `S123` counts *a request
  // the coordinator had to edit*, not the edits.
  const editedIds = new Set<string>();
  for (const row of originEdits) {
    if (!row.entityId || !inOriginWindow(row.createdAt)) continue;
    const raiser = raiserOf.get(row.entityId);
    if (raiser === undefined) continue;
    if ((row.actingAsUserId ?? row.actorUserId) !== raiser) {
      editedIds.add(row.entityId);
    }
  }
  const editedTally = new Map<string, number>();
  for (const id of editedIds) bump(editedTally, repOf.get(id) as string);

  const after = await requestOriginForPeriod(manager, s123From, s123To);
  check(
    "the manager reads every measured person, so 'every row' means it [S123]",
    manager.user.role.seesAllReps === true && after.length > 0,
    `seesAllReps ${manager.user.role.seesAllReps}, ${after.length} rows`,
  );

  const disagreements = after.filter(
    (row) =>
      row.raised !== (raisedTally.get(row.userId) ?? 0) ||
      row.raisedForThem !== (forThemTally.get(row.userId) ?? 0) ||
      row.editedByAnother !== (editedTally.get(row.userId) ?? 0),
  );
  console.log(
    `  --    ${after.length} measured, over ${originDispatches.length} dispatches and ${originEdits.length} edit rows`,
  );
  check(
    "*** the SQL agrees with the recomputation, for every measured person *** [S123]",
    disagreements.length === 0,
    disagreements
      .map(
        (row) =>
          `${row.userName}: sql ${row.raised}/${row.raisedForThem}/${row.editedByAnother}` +
          ` vs ts ${raisedTally.get(row.userId) ?? 0}/${forThemTally.get(row.userId) ?? 0}/${editedTally.get(row.userId) ?? 0}`,
      )
      .join("; "),
  );

  // The other direction. The check above compares the rows the SQL returned; a
  // figure the SQL never emitted a row for would pass it silently, so every
  // person the recomputation found is required to be either inactive or present.
  const measuredIds = new Set(after.map((row) => row.userId));
  const activeUsers = new Set(
    (
      await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.isActive, true))
    ).map((row) => row.id),
  );
  const missing = [...raisedTally.keys(), ...editedTally.keys()].filter(
    (id) => activeUsers.has(id) && !measuredIds.has(id),
  );
  check(
    "…and no active person with a figure is missing from the table [S123]",
    missing.length === 0,
    `${missing.length} missing`,
  );

  /* --- The deltas each act had to move [S123] ------------------------- */

  const afterA = after.find((row) => row.userId === repA.user.id);
  check(
    "*** the request raised FOR the rep moved figure one, and only it *** [S123]",
    afterA !== undefined &&
      beforeA !== undefined &&
      afterA.raisedForThem === beforeA.raisedForThem + 1,
    `raisedForThem ${beforeA?.raisedForThem} → ${afterA?.raisedForThem}`,
  );
  check(
    "…and both requests moved the denominator they are read against [S123]",
    afterA !== undefined && beforeA !== undefined &&
      afterA.raised === beforeA.raised + 2,
    `raised ${beforeA?.raised} → ${afterA?.raised}`,
  );
  check(
    "*** S123 counts an edit S120's column does not record *** [S123], [S120]",
    afterA !== undefined &&
      beforeA !== undefined &&
      afterA.editedByAnother === beforeA.editedByAnother + 1 &&
      editedIds.has(dateMoved.id) &&
      afterDateEdit.linesChangedAfterSubmission === false,
    `editedByAnother ${beforeA?.editedByAnother} → ${afterA?.editedByAnother}`,
  );
  check(
    "*** and the impersonated edit is NOT counted — coalesce, not the raw actor *** [S123]",
    !editedIds.has(forRep.id),
    "the raw actor_user_id reading would have counted it",
  );

  /* --- S127 scores zero in both figures [S127], [S123] ---------------- */

  // *The coordinator may raise a dispatch request against her own company and
  // approve it herself.* §21 walked that; this is what it must cost her in
  // `S123`'s terms, which is nothing. Asserted on the row rather than on her
  // total, so no later section can perturb it.
  check(
    "*** S127's own request is created for nobody *** [S127], [S123]",
    raiserOf.get(hers.id) === repOf.get(hers.id),
    `raised by ${raiserOf.get(hers.id)}, credits ${repOf.get(hers.id)}`,
  );
  check(
    "*** …and nobody else edited it, so it counts in NEITHER figure *** [S127], [S123]",
    !editedIds.has(hers.id),
  );
  const herRow = after.find((row) => row.userId === herUser.id);
  check(
    "…while she is in the table with the request she did raise [S127], [S123]",
    herRow !== undefined && herRow.raised >= 1 && herRow.raisedForThem === 0,
    `raised ${herRow?.raised}, for her ${herRow?.raisedForThem}`,
  );

  // **Never an enforcement** `S123`. Nothing above refused anything, and the
  // rep whose figures moved can still raise, submit and be approved exactly as
  // before — the number is looked at, and that is all it does.
  const unblocked = await requestDispatch(repA, {
    ...SHIP,
    lines: linesOf("3.0000", "50.00"),
    dispatchDate: "2026-11-08",
    quotationThreadId: null,
    companyId: s123Company.id,
    userId: null,
    projectId: null,
  });
  check(
    "*** a rep with a figure against them is not blocked by it *** [S123]",
    unblocked.status === "draft" && unblocked.userId === repA.user.id,
  );

  // Nothing is cleaned up: FACET does not delete history `[12 §7]`, and this
  // script does not get an exception. Every row it writes is prefixed with the
  // run's timestamp so a development database stays readable.
  void dispatchesTable;
  void targetsTable;
}

main()
  .then(() => {
    console.log(
      failures === 0
        ? "\nAll checks passed."
        : `\n${failures} CHECK(S) FAILED.`,
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
