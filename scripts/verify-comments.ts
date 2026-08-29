/**
 * Verification scaffolding for comments and mentions — NOT a feature.
 *
 * `scripts/verify-slice3.ts` is the pattern this copies, for the reason
 * `CLAUDE.md` records: the throwaway script that verified the auth checklist
 * was deleted, so its results cannot be reproduced. This one is **kept**.
 *
 * It drives `src/lib/comments.ts`, `src/lib/timeline.ts`,
 * `src/lib/daily-activity.ts` and `src/lib/quotations.ts` in process — no
 * browser, no HTTP — and checks the things that are otherwise only claimed:
 *
 *   1. Both record types take a comment, and the database refuses a company, a
 *      contact and a dispatch `S114` — asserted by CONSTRAINT NAME, not by "it
 *      threw".
 *   2. Visibility follows the record `S131`, in both directions. The negative
 *      half matters most — including `S76`'s exception, which gives the
 *      coordinator the project and none of the conversation on it, at all three
 *      readers of that rule.
 *   3. Editable by the author, never deleted `[25 §12]`.
 *   4. A mention raises `mention.received`, act-now and NOT persistent
 *      `[25 §11]`, `[21 §4]` — and TWO mentions of the same person on the same
 *      record both land. The central trap.
 *   5. A mention of somebody who cannot see the record still raises `[25 §11]`,
 *      and its payload withholds the body and the link.
 *   6. Comments join the record's timeline `[25 §9]`, and the record-only scope
 *      returns the record's comments and NOTHING else. The other central trap.
 *   7. Counted, never summed `[25 §14]`. The central claim of the slice.
 *   8. The return-for-edit reason is a comment `[25 §13]`, in one transaction.
 *   9. A non-persistent act-now notification can be dismissed `[21 §4]`.
 *  10. Every write is audited `[07 E1]`.
 *
 * Usage: `npm run verify:comments`
 *
 * That needs `NODE_ENV=development` in `.env`. `--env-file` is not optional and
 * cannot be replaced by the `process.loadEnvFile` call below: this script
 * reaches `@/lib/authz`, and `src/auth/index.ts` reads `AUTH_SECRET` at module
 * scope — before any statement in this file runs.
 *
 * **It refuses to run outside development** `[15 §7]`: it writes real rows.
 *
 * It needs a seeded database — `npm run db:seed`, which is also what seeds the
 * sixth notification type — and the fixture accounts:
 * `DEV_FIXTURE_PASSWORD=… npm run dev:fixtures`.
 *
 * **Nothing is cleaned up.** FACET does not delete history `[12 §7]` and this
 * script gets no exception, so every row it writes carries a run stamp.
 */

process.loadEnvFile(".env");

import { and, desc, eq, gte, inArray, like, sql } from "drizzle-orm";

import { closeDatabase, db } from "@/db";
import {
  auditLog,
  commentMentions,
  companies,
  companyReps,
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
import { canOpenRecord, type AuthSession } from "@/lib/authz";
import { normalizeName } from "@/lib/normalize";
import {
  addComment,
  getComment,
  listComments,
  updateComment,
  type Comment,
} from "@/lib/comments";
import { dailyActivity } from "@/lib/daily-activity";
import { NOTIFICATION_TYPES, SAUDI_CODE } from "@/lib/enums";
import { listCountries } from "@/lib/lookups";
import { listNotifications, markRead, unresolvedCount } from "@/lib/notifications";
import {
  createQuotationThread,
  issueVersion,
  returnForEdit,
} from "@/lib/quotations";
import { createReport, today } from "@/lib/reports";
import {
  recordTimeline,
  projectTimeline,
  companyTimeline,
  eventsInRange,
  type TimelineEvent,
} from "@/lib/timeline";

import { addDispatchLine } from "./dispatch-fixture";

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

/**
 * Assert that the DATABASE refuses, by constraint name `[13 §1]`.
 *
 * **This stood here until `0027` and is back for `27b`.** Its old caller
 * offered `record_type = 'quotation_version'`; the sweep dropped that value
 * from the enum, so there was nothing left to refuse and the helper went with
 * it. `S114` gives it three callers again — a company, a contact and a dispatch
 * are values the enum still carries and the CHECK now rejects, which is exactly
 * the shape a constraint-name assertion is for.
 *
 * **By NAME, never by "it threw".** A typo in the insert throws too, and would
 * pass an assertion that only caught an exception. Drizzle wraps a driver error
 * in one whose message is just "Failed query: …" and postgres.js puts the
 * constraint on the `cause`, so reading `error.message` alone passes on nothing
 * and fails on everything — hence `causeChain`. Same helper as
 * `verify-schema25.ts`, which is where it survived the sweep.
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

/** How many `mention.received` rows this person is holding, unresolved. */
async function mentionsFor(userId: string): Promise<number> {
  const rows = await db
    .select({ id: notifications.id })
    .from(notifications)
    .innerJoin(
      notificationTypes,
      eq(notificationTypes.id, notifications.notificationTypeId),
    )
    .where(
      and(
        eq(notifications.recipientUserId, userId),
        eq(notificationTypes.key, NOTIFICATION_TYPES.mentionReceived),
      ),
    );
  return rows.length;
}

/**
 * The run's stamp. **Module scope, so the `finally` at the foot of the file can
 * reach it** — every account this script writes is `${stamp}-…@example.test`,
 * which is what `endRunAccounts` below matches on.
 */
const stamp = `verifyc-${Date.now()}`;

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
      "verify-comments refuses to run outside development.\n" +
        `  NODE_ENV is ${process.env.NODE_ENV ?? "unset"}, and must be "development".`,
    );
    process.exit(1);
  }

  const manager = await sessionFor("manager@example.test");
  const coordinator = await sessionFor("coordinator@example.test");

  // Reps created FOR THIS RUN. `dailyActivity` counts every comment in the
  // range, and this script does not clean up `[12 §7]`, so shared fixture
  // accounts would mean the second run counted the first run's comments and
  // §7's assertions drifted.
  const [repRole] = await db
    .select()
    .from(roles)
    .where(eq(roles.nameEn, "Sales Rep"))
    .limit(1);
  if (!repRole) {
    console.error("Roles are not seeded. Run: npm run db:seed");
    process.exit(1);
  }

  const [mentionType] = await db
    .select()
    .from(notificationTypes)
    .where(eq(notificationTypes.key, NOTIFICATION_TYPES.mentionReceived))
    .limit(1);
  if (!mentionType) {
    console.error(
      "The mention.received notification type is not seeded. Run: npm run db:seed",
    );
    process.exit(1);
  }

  const [repAUser, repBUser, outsiderUser] = await db
    .insert(users)
    .values([
      { name: `${stamp} Rep A`, email: `${stamp}-a@example.test`, roleId: repRole.id },
      { name: `${stamp} Rep B`, email: `${stamp}-b@example.test`, roleId: repRole.id },
      // Holds nothing and is shared nothing: the negative half of §2 and §5.
      { name: `${stamp} Outsider`, email: `${stamp}-out@example.test`, roleId: repRole.id },
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
  const outsider = asSession(outsiderUser);

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
  if (!supplier || !productClass || !fireRating || !thickness) {
    // `throw`, not `process.exit`: this run has already created its
    // accounts, and an exit skips the `finally` that ends them `[S111]`.
    throw new Error("The lookups are not seeded. Run: npm run db:seed");
  }

  /* --- Fixtures: a company and a project held by rep A ------------- */

  // `S13` makes the phone mandatory and `S23` matches companies on it, so every
  // fixture gets its own — derived from the run stamp, because a shared literal
  // would make each run's companies duplicates of the last run's. `S14` — and
  // every fixture company is Saudi, so `S15`'s city and region still apply.
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

  /* **The contact fixture went in `27b`.** It existed only to take a comment
   * and to prove `S76`'s exception withheld the conversation on one; `S114`
   * removed both, so a row nothing reads is unused structure `CLAUDE.md`.
   *
   * **The dispatch below stays**, and not out of caution: nothing asserts on it
   * directly any more either, but it is a SOURCE of the derived events §6 and
   * §7 count — a dispatched event on the company and project timelines. §6's
   * new company-scope negative is guarded on that timeline being non-empty, so
   * deleting the dispatch would weaken the guard rather than tidy the file. */

  const thread = await createQuotationThread(
    repA,
    { projectId: project.id, companyId: company.id, contactId: null },
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

  const [dispatch] = await db
    .insert(dispatchesTable)
    .values({
      // `S130` `S119` `S70` — a hand-written dispatch names all three, as
      // every dispatch does. Riyadh and CT are the unconstrained pair
      // (`dispatches_stock_shipment`), and an APPROVED row must carry a
      // payment method or `dispatches_payment_method` refuses it `S73`.
      stock: "riyadh" as const,
      shipment: "ct" as const,
      paymentMethod: "bank_transfer_full" as const,
      companyId: company.id,
      userId: repA.user.id,
      quotationThreadId: null,
      dispatchDate: today(),
      recordedByUserId: coordinator.user.id,
      // `S72` — a hand-written dispatch says which of the four states it is
      // in, and these fixtures all want the one that COUNTS: an approved
      // dispatch is the only thing that credits a target, and every figure
      // below reads it through `approvedDispatches()`. The three stamps move
      // together or the `dispatches_approval_stamps` CHECK refuses the row.
      status: "approved" as const,
      submittedAt: new Date(),
      approvedByUserId: coordinator.user.id,
      approvedAt: new Date(),
    })
    .returning();
  // `S116` — a dispatch carries its own lines and its square metres are their
  // sum, so a hand-written row needs one or it reads as 0 m².
  await addDispatchLine(dispatch.id, "86.3040");

  /* --- 1. Both record types, and the database refuses the other three -- */

  console.log("\n1. Comments land on both record types [S114]");

  const anchors = [
    { type: "project" as const, id: project.id },
    { type: "quotation_thread" as const, id: thread.id },
  ];

  // Kept by anchor: §2 reads them back through `getComment`, which is a second
  // reader of the same rule and had to be narrowed with the filter.
  const commentIds = new Map<string, string>();
  for (const anchor of anchors) {
    const created = await addComment(repA, {
      recordType: anchor.type,
      recordId: anchor.id,
      body: `${stamp} a note on a ${anchor.type}`,
      mentions: [],
    });
    commentIds.set(anchor.type, created.id);
    check(
      `a ${anchor.type} takes a comment [S114]`,
      created.recordType === anchor.type && created.recordId === anchor.id,
    );
  }

  check(
    "both are held, one thread per record [S114]",
    (await Promise.all(anchors.map((a) => listComments(repA, a.type, a.id)))).every(
      (list) => list.length === 1,
    ),
  );

  /* **The other three, refused by the database itself** `S114`, `0032`.
   *
   * The positive loop above cannot prove this. `addComment` would refuse a
   * company on the TYPE before a statement was ever built, which proves that
   * TypeScript narrowed and nothing at all about the database — and
   * `COMMENT_RECORD_TYPES` and the CHECK are two statements of one rule that
   * can drift apart. So these go in as raw SQL, past the type, and the
   * constraint NAME is what is asserted rather than "it threw": a typo in the
   * insert throws too.
   *
   * **The positive half above is what stops this passing for the wrong
   * reason.** A CHECK refusing everything would go green on all three of these
   * and red on both of those, which is the shape `CLAUDE.md` records eight
   * sightings of. */
  for (const kind of ["company", "contact", "dispatch"] as const) {
    await databaseRefuses(
      `the database refuses a comment on a ${kind} [S114]`,
      "comments_record_type",
      `insert into comments (record_type, record_id, author_user_id, body)
       values ('${kind}', '${company.id}', '${repA.user.id}', '${stamp} refused')`,
    );
  }

  // All roles comment `[25 §9]` — no flag gate, the way logging has none.
  const coordinatorComment = await addComment(coordinator, {
    recordType: "quotation_thread",
    recordId: thread.id,
    body: `${stamp} the coordinator speaks`,
    mentions: [],
  });
  check(
    "the coordinator comments without a flag — all roles do [25 §9]",
    coordinatorComment.authorUserId === coordinator.user.id,
  );
  /* --- 2. Visibility follows the record, both directions ----------- */

  console.log("\n2. Visibility follows the record [S131]");

  check(
    "the owning rep reads the project's comments",
    (await listComments(repA, "project", project.id)).length === 1,
  );

  // The negative half, which matters most: an outsider composing the SAME
  // filters must see none of it.
  const outsiderProjectThread = await projectTimeline(outsider, project.id);
  check(
    "an outsider sees NO comment on a project they do not hold [S131]",
    outsiderProjectThread.total === 0,
    `saw ${outsiderProjectThread.total}`,
  );

  await refuses(
    "an outsider cannot comment on a record they cannot see [S131]",
    "comments.errors.recordNotFound",
    () =>
      addComment(outsider, {
        recordType: "project",
        recordId: project.id,
        body: `${stamp} should be refused`,
        mentions: [],
      }),
  );

  /* A share is what changes the answer — the rule reports already follow.
   *
   * **It is a PROJECT share, and that is not a detail of the port.** This was a
   * company share until `27b`, reaching the company branch of
   * `visibleCommentsFilter`. That branch is gone, and a company share does not
   * cascade to the company's projects `S30` `[04 Q7]` — so pointing the old row
   * at the same project would assert a grant the rules do not make, and would
   * have gone RED, correctly. The share that opens a project's conversation is
   * a share on the project.
   *
   * **Still a hand-written row, deliberately.** `grantShare` in
   * `src/lib/sharing.ts` is the real path as of feature slice 3, and this
   * fixture is not converted to it: this script asserts nothing about sharing,
   * so the coupling would buy no assertion and would make a comments run fail
   * when sharing changed. What the two paths agree is asserted once, in
   * `verify-sharing.ts` §5, which follows a REAL share through every filter —
   * including `visibleCommentsFilter`, the one this line exists to exercise. */
  await db.insert(recordShares).values({
    recordType: "project",
    recordId: project.id,
    sharedWithUserId: repB.user.id,
    sharedByUserId: manager.user.id,
  });
  check(
    "a SHARED rep reads the same project's comments [S131]",
    (await projectTimeline(repB, project.id)).events.filter(
      (event: TimelineEvent) => event.kind === "comment",
    ).length === 1,
  );

  // `16 §10` reaching through: the coordinator sees every thread, so she sees
  // every thread conversation — and still none of the project's.
  const coordinatorThreadView = await recordTimeline(
    coordinator,
    "quotation_thread",
    thread.id,
  );
  check(
    "the coordinator reads every quotation conversation [16 §10], [S131]",
    coordinatorThreadView.total === 2,
    `saw ${coordinatorThreadView.total}`,
  );

  /* `S131` — her sight of the record stops at the record.
   *
   * The finding `AUDIT 1 F2` raised: `visibleCommentsFilter` composed each
   * anchor's READ filter, and `S76` had widened two of those to `undefined` for
   * `can_dispatch`, so both branches degraded to *"the record exists"* and the
   * coordinator read every rep's project and contact conversation.
   *
   * **Since `27b` the project is the whole of that exception.** `S114` took the
   * conversation off a contact entirely, so the contact half is trivially true
   * — there is nothing on a contact for anybody to read — and asserting it here
   * would be a check that passes by reading nothing, which is the shape
   * `WORKFLOW §5` already carries four rows about. `S131` was amended in the
   * same slice to say so.
   *
   * Both halves, on what the DATA LAYER returns. A narrowing asserted only on
   * the closed side proves nothing about who is left holding the record. */
  check(
    "the coordinator can still OPEN the project [S76]",
    await canOpenRecord(coordinator, "project", project.id),
  );
  check(
    "*** …and reads NONE of the project's conversation *** [S131]",
    (await listComments(coordinator, "project", project.id)).length === 0,
    `saw ${(await listComments(coordinator, "project", project.id)).length}`,
  );
  check(
    "the rep who could read it still can — one role moved, not the rule [S131]",
    (await listComments(repA, "project", project.id)).length === 1,
  );
  check(
    "the record she holds in her own right is untouched [S62], [S131]",
    (await listComments(coordinator, "quotation_thread", thread.id)).length === 2,
    `saw ${(await listComments(coordinator, "quotation_thread", thread.id)).length}`,
  );

  // `/activity` and `dailyActivity` read `commentEvents`, which composes the
  // same filter — so they inherit rather than restating it. Asserted on the
  // comment id itself: a comment event carries no project id when the reader
  // may not have it.
  const coordinatorGlobal = await eventsInRange(
    coordinator,
    { from: today(), to: today() },
    [repA.user.id],
  );
  check(
    "…and the global read inherits it [S131]",
    coordinatorGlobal.length > 0 &&
      !coordinatorGlobal.some(
        (event) => event.key === `comment:${commentIds.get("project")}`,
      ),
    `read ${coordinatorGlobal.length} event(s) in range`,
  );

  // The second reader. It asked `canOpenRecord`, which since `S76` answers a
  // different question, so the filter alone would have left this one wide.
  check(
    "getComment refuses her the project comment too [S131]",
    (await getComment(coordinator, commentIds.get("project")!)) === null,
  );
  check(
    "…and still hands it to the rep who owns the project [S131]",
    (await getComment(repA, commentIds.get("project")!)) !== null,
  );

  /* The third reader, and the sharpest statement of the rule: tagging her does
   * not hand over what the filter withholds. She gets the link, because `S76`
   * really did give her the project; she does not get the words. */
  await addComment(repA, {
    recordType: "project",
    recordId: project.id,
    body: `${stamp} tagging the coordinator on a project`,
    mentions: [coordinator.user.id],
  });
  const coordinatorRows = await listNotifications(coordinator, { page: 1 });
  const coordinatorMention = coordinatorRows.rows.find(
    (row) =>
      row.typeKey === NOTIFICATION_TYPES.mentionReceived &&
      row.payload?.kind === "mention" &&
      row.payload.recordId === project.id,
  );
  check(
    "a tag on a project comment reaches her — `25 §11` gates nothing [25 §11]",
    coordinatorMention !== undefined,
  );
  check(
    "*** …carrying the LINK, because S76 gave her the record *** [S76]",
    coordinatorMention?.payload?.kind === "mention" &&
      coordinatorMention.payload.recordViewable === true &&
      coordinatorMention.payload.href !== null,
  );
  check(
    "*** …and NOT the body, because S131 did not give her the words *** [S131]",
    coordinatorMention?.payload?.kind === "mention" &&
      coordinatorMention.payload.body === null,
  );

  /* --- 3. Editable by the author, never deleted ------------------- */

  console.log("\n3. Editable by the author, never deleted [25 §12]");

  // `listComments` is oldest-first, so `[0]` is §1's own note on the project —
  // stable whatever §2 appended after it.
  const [own] = await listComments(repA, "project", project.id);
  await updateComment(repA, own.id, {
    body: `${stamp} corrected`,
    mentions: [],
  });
  const edited = await getComment(repA, own.id);
  check("the author's edit lands", edited?.body === `${stamp} corrected`);
  check("…and stamps edited_at [25 §12]", edited?.editedAt !== null);

  await refuses(
    "a MANAGER cannot rewrite somebody else's words [25 §12]",
    "comments.errors.authorOnly",
    () => updateComment(manager, own.id, { body: "rewritten", mentions: [] }),
  );
  await refuses(
    "nor can a shared rep [25 §12]",
    "comments.errors.authorOnly",
    () => updateComment(repB, own.id, { body: "rewritten", mentions: [] }),
  );

  check(
    "the comment survives every refusal — nothing is deleted [12 §7]",
    (await listComments(repA, "project", project.id)).some(
      (row: Comment) => row.id === own.id,
    ),
  );

  // A no-op save writes nothing, the way `updateReport` and `updateUser` behave.
  const beforeNoOp = await db
    .select({ id: auditLog.id })
    .from(auditLog)
    .where(eq(auditLog.entityId, own.id));
  await updateComment(repA, own.id, {
    body: `${stamp} corrected`,
    mentions: [],
  });
  const afterNoOp = await db
    .select({ id: auditLog.id })
    .from(auditLog)
    .where(eq(auditLog.entityId, own.id));
  check(
    "a no-op save writes no audit row",
    beforeNoOp.length === afterNoOp.length,
    `${beforeNoOp.length} → ${afterNoOp.length}`,
  );

  /* --- 4. The mention, and the index trap ------------------------- */

  console.log("\n4. A mention raises a notification [25 §11], [21 §4]");

  check(
    "mention.received is act-now and NOT persistent [21 §4]",
    mentionType.tier === "act_now" && mentionType.isPersistent === false,
    `got tier=${mentionType.tier} persistent=${mentionType.isPersistent}`,
  );
  // The channel claim that stood here is gone with its column. `0027` dropped
  // `notification_types.default_channel` and `notifications.channel`: every
  // row said `in_app`, and the only reader of the first was the writer of the
  // second. Delivery is in-app because there is no other kind, which is a
  // stronger statement than a column asserting it.

  const before = await mentionsFor(repB.user.id);
  await addComment(repA, {
    recordType: "project",
    recordId: project.id,
    body: `${stamp} first tag`,
    mentions: [repB.user.id],
  });
  check(
    "tagging somebody raises one notification [25 §11]",
    (await mentionsFor(repB.user.id)) === before + 1,
  );

  /**
   * **The trap this type is anchorless for.**
   *
   * `notifications_live_key` is unique over
   * `(recipient, type, record_type, record_id)` for every unresolved row with a
   * `record_id`, and NOTHING resolves a non-persistent type. Anchored, the
   * second tag of the same person on the same record would hit
   * `on conflict do nothing` and vanish — permanently, and silently.
   */
  await addComment(repA, {
    recordType: "project",
    recordId: project.id,
    body: `${stamp} second tag, same person, same record`,
    mentions: [repB.user.id],
  });
  check(
    "*** a SECOND tag of the same person on the same record also lands *** [21 §4]",
    (await mentionsFor(repB.user.id)) === before + 2,
    `got ${await mentionsFor(repB.user.id)}, expected ${before + 2}`,
  );

  const raised = await db
    .select({ recordId: notifications.recordId, payload: notifications.payload })
    .from(notifications)
    .where(
      and(
        eq(notifications.recipientUserId, repB.user.id),
        eq(notifications.notificationTypeId, mentionType.id),
      ),
    )
    .orderBy(desc(notifications.createdAt))
    .limit(1);
  check(
    "it is raised ANCHORLESS — that is what escapes the index [21 §4]",
    raised[0]?.recordId === null,
  );
  check(
    "…and the record travels in the payload instead [21 §10]",
    (raised[0]?.payload as { recordType?: string })?.recordType === "project",
  );

  const selfBefore = await mentionsFor(repA.user.id);
  await addComment(repA, {
    recordType: "project",
    recordId: project.id,
    body: `${stamp} tagging myself`,
    mentions: [repA.user.id],
  });
  check(
    "tagging yourself raises nothing — you know [25 §11]",
    (await mentionsFor(repA.user.id)) === selfBefore,
  );

  // The set is REWRITTEN by an edit, and only a NEW name is notified.
  const rewriteTarget = (await listComments(repA, "project", project.id)).find(
    (row: Comment) => row.body === `${stamp} first tag`,
  )!;
  const beforeRewrite = await mentionsFor(repB.user.id);
  await updateComment(repA, rewriteTarget.id, {
    body: `${stamp} first tag`,
    mentions: [],
  });
  check(
    "an edit REWRITES the mention set [schema, 20 §9]",
    (await db
      .select({ id: commentMentions.id })
      .from(commentMentions)
      .where(eq(commentMentions.commentId, rewriteTarget.id))).length === 0,
  );
  check(
    "…and un-tagging does not un-send a notification already delivered",
    (await mentionsFor(repB.user.id)) === beforeRewrite,
  );

  /* --- 5. A tag on somebody who cannot see the record ------------- */

  console.log("\n5. A tag on somebody who cannot see the record [25 §11]");

  const outsiderBefore = await mentionsFor(outsider.user.id);
  await addComment(repA, {
    recordType: "project",
    recordId: project.id,
    body: `${stamp} tagging an outsider`,
    mentions: [outsider.user.id],
  });
  check(
    "it still raises — 25 §11 attaches no condition to tagging [25 §11]",
    (await mentionsFor(outsider.user.id)) === outsiderBefore + 1,
  );

  const outsiderRows = await listNotifications(outsider, { page: 1 });
  const outsiderMention = outsiderRows.rows.find(
    (row) => row.typeKey === NOTIFICATION_TYPES.mentionReceived,
  );
  check(
    "…and the payload withholds the record when they may not read it [20 §8.2]",
    outsiderMention?.payload?.kind === "mention" &&
      outsiderMention.payload.recordViewable === false &&
      outsiderMention.payload.body === null &&
      outsiderMention.payload.href === null,
  );
  check(
    "…while still naming who tagged them — it is not a secret from them",
    outsiderMention?.payload?.kind === "mention" &&
      outsiderMention.payload.authorName !== null,
  );

  /* --- 6. Comments join the timeline, and only their own record --- */

  console.log("\n6. Comments join the record's timeline [S114]");

  const projectThread = await projectTimeline(repA, project.id);
  check(
    "a project comment appears on the project timeline [S114]",
    projectThread.events.some((event: TimelineEvent) => event.kind === "comment"),
    `total ${projectThread.total}`,
  );
  check(
    "…attributed to whoever wrote it [20 §8]",
    projectThread.events
      .filter((event: TimelineEvent) => event.kind === "comment")
      .every((event: TimelineEvent) => event.actorUserId !== null),
  );
  check(
    "…and the system events are still there [S41]",
    projectThread.events.some((event: TimelineEvent) => event.kind !== "comment"),
    `kinds ${[...new Set(projectThread.events.map((e: TimelineEvent) => e.kind))].join(",")}`,
  );

  /**
   * **The second trap.** The six derived sources are anchored to a company or a
   * project, and every one of their anchor terms falls to `undefined` when
   * neither is set. Without the guard in `gather`, a record scope would answer
   * "every event this viewer can see" instead of "this record's" — silently,
   * and as over-disclosure rather than a crash.
   *
   * It was asserted on a contact and a dispatch until `27b`. Neither takes a
   * comment now `S114`, so neither has a thread to ask for; the quotation
   * thread is the one record scope left and it carries the whole assertion.
   */
  const threadOnly = await recordTimeline(repA, "quotation_thread", thread.id);
  check(
    "*** a thread's scope carries its OWN comments and nothing else *** [S114]",
    threadOnly.total === 2 &&
      threadOnly.events.every((event: TimelineEvent) => event.kind === "comment"),
    `total ${threadOnly.total}, kinds ${[...new Set(threadOnly.events.map((e: TimelineEvent) => e.kind))].join(",")}`,
  );

  /**
   * **The third trap, and it is `27b`'s own.** `commentAnchor` used to map a
   * company scope to `{type:"company"}`. `S114` makes that literal illegal, and
   * the obvious repair — falling through to `null`, which every other
   * unanchored caller uses — means *no anchor term*, which would put EVERY
   * comment this viewer can see onto one company's timeline. Hence `"none"` and
   * the early return in `commentEvents`.
   *
   * **Both halves, or this passes by reading nothing.** The negative is guarded
   * on the company timeline being non-empty: it still carries its derived
   * events `S41`, and it is only the conversation that is gone. A company scope
   * that returned nothing at all would satisfy a bare `some(...) === false` and
   * tell us nothing.
   */
  const companyThread = await companyTimeline(repA, company.id);
  check(
    "the company timeline still carries its derived events [S41]",
    companyThread.total > 0,
    `saw ${companyThread.total}`,
  );
  check(
    "*** …and NO comment, on a scope that can no longer anchor one *** [S114]",
    companyThread.events.every((event: TimelineEvent) => event.kind !== "comment"),
    `saw ${companyThread.events.filter((e: TimelineEvent) => e.kind === "comment").length} of ${companyThread.total}`,
  );
  check(
    "*** …and it is the ANCHOR that is empty, not the range *** [S114]",
    (await eventsInRange(repA, { from: today(), to: today() }, [repA.user.id]))
      .some((event: TimelineEvent) => event.kind === "comment"),
  );

  /* --- 7. Counted, never summed. The central claim ---------------- */

  console.log("\n7. *** Counted, never summed with reports *** [25 §14]");

  await createReport(repA, {
    entryType: "interaction",
    companyId: company.id,
    contactId: null,
    projectId: null,
    channel: "visit",
    outcome: "introduced",
    category: null,
    cityId: null,
    onHoldUntil: null,
    narrative: `${stamp} a real visit`,
    reportDate: today(),
    signals: [],
  });

  const range = { from: today(), to: today() };
  const before7 = (
    await dailyActivity(manager, { range, userId: repA.user.id })
  ).rows[0];
  check("the rep has a row on the daily view", before7 !== undefined);
  check(
    "reports are counted [25 §14]",
    before7.reportsLogged === 1,
    `got ${before7.reportsLogged}`,
  );
  check(
    "comments are counted SEPARATELY [25 §14]",
    before7.commentsLogged > 0,
    `got ${before7.commentsLogged}`,
  );

  // The claim is not "the other columns are zero" — rep A really did add a
  // company and raise a quotation in this run, and those are system events that
  // SHOULD count. The claim is that one more comment moves the comment column
  // and moves nothing else.
  await addComment(repA, {
    recordType: "project",
    recordId: project.id,
    body: `${stamp} one more, to prove the columns do not leak into each other`,
    mentions: [],
  });
  const after7 = (await dailyActivity(manager, { range, userId: repA.user.id }))
    .rows[0];

  check(
    "*** one more comment moves the comment column *** [25 §14]",
    after7.commentsLogged === before7.commentsLogged + 1,
    `${before7.commentsLogged} → ${after7.commentsLogged}`,
  );
  check(
    "*** and NOT the report column — talking is not logging *** [25 §14]",
    after7.reportsLogged === before7.reportsLogged,
    `${before7.reportsLogged} → ${after7.reportsLogged}`,
  );
  check(
    "*** nor the system-event column — it is in exactly one *** [25 §14]",
    after7.systemEvents === before7.systemEvents,
    `${before7.systemEvents} → ${after7.systemEvents}`,
  );
  check(
    "nor the signal column [25 §14]",
    after7.signalsRaised === before7.signalsRaised,
    `${before7.signalsRaised} → ${after7.signalsRaised}`,
  );
  check(
    "a comment never touches a company — that is contact, and this is not [25 §9]",
    after7.companiesTouched === before7.companiesTouched &&
      after7.companiesTouched === 1,
    `got ${after7.companiesTouched}`,
  );

  /* --- 8. The return-for-edit reason is a comment ----------------- */

  console.log("\n8. The return-for-edit reason becomes a comment [25 §13]");

  await refuses(
    "a return with no reason is refused [25 §13]",
    "quotations.errors.returnReasonRequired",
    () => returnForEdit(coordinator, thread.id, "   "),
  );

  const threadBefore = await listComments(coordinator, "quotation_thread", thread.id);
  const raiserNotifiedBefore = await mentionsFor(repA.user.id);
  await returnForEdit(coordinator, thread.id, `${stamp} line 3 quantity is wrong`);
  const threadAfter = await listComments(coordinator, "quotation_thread", thread.id);
  const returned = threadAfter.find(
    (c) => c.body === `${stamp} line 3 quantity is wrong`,
  );
  check(
    "the reason lands as a comment on the THREAD [25 §13]",
    threadAfter.length === threadBefore.length + 1 && returned !== undefined,
  );
  check(
    "…written by the coordinator who returned it [20 §8]",
    returned?.authorUserId === coordinator.user.id,
  );

  /**
   * **The tag is part of the act, not a choice** `[25 §13]`.
   *
   * `25 §11` governs a person deciding to tell a colleague something. This is
   * the return notifying the person it creates work for: the reason exists to
   * end the WhatsApp round-trip `[25 §9]`, and a reason nobody is told about
   * does not end it. There is no control for it and no way to return without
   * it, which is why it is asserted here rather than left to the screen.
   */
  check(
    "*** returning tags the thread's raiser — the act tells them *** [25 §13]",
    returned?.mentions.some((m) => m.userId === repA.user.id) === true,
    `tagged ${returned?.mentions.map((m) => m.name).join(", ") || "nobody"}`,
  );
  check(
    "…and that reaches their bell, not just the thread [25 §13]",
    (await mentionsFor(repA.user.id)) === raiserNotifiedBefore + 1,
    `${raiserNotifiedBefore} → ${await mentionsFor(repA.user.id)}`,
  );
  check(
    "the raiser is raisedByUserId, so a handover redirects it [19 §1]",
    returned?.mentions.length === 1,
    `tagged ${returned?.mentions.length} people`,
  );

  // One act, one transaction `[25 §13]`: a refused return leaves no reason
  // behind. The thread is now `requested` again with the round bumped, so a
  // second return on an ISSUED version is what proves the rollback.
  await issueVersion(coordinator, thread.id, {
    smacReference: `${stamp}-smac`,
    verification: "unverified",
  });
  const beforeRollback = (await listComments(coordinator, "quotation_thread", thread.id)).length;
  await refuses(
    "a return on an issued version is refused [07 C2]",
    "quotations.errors.versionNotEditable",
    () => returnForEdit(coordinator, thread.id, `${stamp} should roll back`),
  );
  check(
    "*** and its reason rolled back with it — one act, one transaction *** [25 §13]",
    (await listComments(coordinator, "quotation_thread", thread.id)).length === beforeRollback,
  );

  /* --- 9. A non-persistent act-now can be dismissed --------------- */

  console.log("\n9. A notification with no condition can be dismissed [21 §4]");

  const waitingBefore = await unresolvedCount(repB);
  check(
    "an unread mention is waiting on the reader",
    waitingBefore > 0,
    `got ${waitingBefore}`,
  );

  const repBRows = await listNotifications(repB, { page: 1 });
  const mine = repBRows.rows.filter(
    (r) => r.typeKey === NOTIFICATION_TYPES.mentionReceived && !r.readAt,
  );
  for (const notification of mine) await markRead(repB, notification.id);

  check(
    "*** reading it clears the badge — 21 §4's own words, finally built *** [21 §4]",
    (await unresolvedCount(repB)) === waitingBefore - mine.length,
    `got ${await unresolvedCount(repB)}, expected ${waitingBefore - mine.length}`,
  );
  check(
    "…and it is still NOT resolved — reading is not doing [07 G1]",
    (
      await db
        .select({ resolvedAt: notifications.resolvedAt })
        .from(notifications)
        .where(eq(notifications.id, mine[0]!.id))
    )[0]?.resolvedAt === null,
  );

  /* --- 10. Every write is audited --------------------------------- */

  console.log("\n10. Every write is audited [07 E1]");

  const actions = await db
    .select({ action: auditLog.action })
    .from(auditLog)
    .where(
      and(
        inArray(auditLog.entityType, ["comment", "notification"]),
        gte(auditLog.createdAt, sql`now() - interval '30 minutes'`),
      ),
    );
  const seen = new Set(actions.map((a) => a.action));
  check("a comment is audited on creation", seen.has("comment.created"));
  check("…and on edit, which is where 25 §12's record lives", seen.has("comment.updated"));
  check("the mention notification is audited", seen.has("notification.raised"));

  const [editEntry] = await db
    .select({ before: auditLog.before, after: auditLog.after })
    .from(auditLog)
    .where(
      and(eq(auditLog.action, "comment.updated"), eq(auditLog.entityId, own.id)),
    )
    .limit(1);
  check(
    "the audit log holds BOTH sides of the edit [25 §12]",
    (editEntry?.before as { body?: string })?.body !== undefined &&
      (editEntry?.after as { body?: string })?.body !== undefined,
  );

  console.log(`        actions seen: ${[...seen].sort().join(", ")}`);

  // Nothing is cleaned up: FACET does not delete history `[12 §7]`, and there
  // is no delete path for a comment to clean one up with `[25 §12]`.
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
