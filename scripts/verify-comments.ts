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
 *   1. All five record types take a comment, and the database refuses a sixth
 *      `[25 §9]` — asserted by CONSTRAINT NAME, not by "it threw".
 *   2. Visibility follows the record `[25 §10]`, in both directions. The
 *      negative half matters most.
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

import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";

import { closeDatabase, db } from "@/db";
import {
  auditLog,
  commentMentions,
  comments,
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
import { type AuthSession } from "@/lib/authz";
import {
  addComment,
  getComment,
  listComments,
  updateComment,
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
import { recordTimeline, companyTimeline, eventsInRange } from "@/lib/timeline";

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
 * Assert the DATABASE refuses, by constraint name.
 *
 * postgres.js puts the constraint on `error.cause`, so the chain is walked —
 * `verify-phase10a.ts` learned that the hard way. Naming the constraint is what
 * makes this an assertion about the schema rather than about any one query.
 */
async function databaseRefuses(
  label: string,
  constraint: string,
  fn: () => Promise<unknown>,
): Promise<void> {
  try {
    await fn();
    failures += 1;
    console.error(`  FAIL  ${label} — the database allowed it`);
  } catch (error) {
    const text = causeChain(error);
    check(
      `${label} (${constraint})`,
      text.includes(constraint),
      `got ${text.slice(0, 160)}`,
    );
  }
}

function causeChain(error: unknown): string {
  const parts: string[] = [];
  let current: unknown = error;
  while (current instanceof Error) {
    parts.push(current.message);
    const withConstraint = current as Error & { constraint_name?: string };
    if (withConstraint.constraint_name) parts.push(withConstraint.constraint_name);
    current = current.cause;
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
  const stamp = `verifyc-${Date.now()}`;
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

  const [contact] = await db
    .insert(contacts)
    .values({
      companyId: company.id,
      name: `${stamp} Contact`,
      nameNormalized: stamp,
      createdBy: repA.user.id,
    })
    .returning();

  const thread = await createQuotationThread(
    repA,
    { projectId: project.id, companyId: company.id, contactId: null },
    {
      validUntil: "2031-01-01",
      deliveryPeriod: "4 weeks",
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
        vatRate: "15.00",
      },
    ],
    [],
  );

  const [dispatch] = await db
    .insert(dispatchesTable)
    .values({
      companyId: company.id,
      userId: repA.user.id,
      sqm: "86.3040",
      quotationThreadId: null,
      dispatchDate: today(),
      recordedByUserId: coordinator.user.id,
    })
    .returning();

  /* --- 1. All five record types, and the database refuses a sixth -- */

  console.log("\n1. Comments land on all five record types [25 §9]");

  const anchors = [
    { type: "company" as const, id: company.id },
    { type: "contact" as const, id: contact.id },
    { type: "project" as const, id: project.id },
    { type: "quotation_thread" as const, id: thread.id },
    { type: "dispatch" as const, id: dispatch.id },
  ];

  for (const anchor of anchors) {
    const created = await addComment(repA, {
      recordType: anchor.type,
      recordId: anchor.id,
      body: `${stamp} a note on a ${anchor.type}`,
      mentions: [],
    });
    check(
      `a ${anchor.type} takes a comment [25 §9]`,
      created.recordType === anchor.type && created.recordId === anchor.id,
    );
  }

  check(
    "all five are held, one thread per record [25 §9]",
    (await Promise.all(anchors.map((a) => listComments(repA, a.type, a.id)))).every(
      (list) => list.length === 1,
    ),
  );

  // The CHECK is stated positively so a value added to the shared enum later
  // cannot silently become commentable. Nothing else would catch that.
  await databaseRefuses(
    "the database refuses a comment on a quotation VERSION [25 §9]",
    "comments_record_type",
    () =>
      db.insert(comments).values({
        recordType: "quotation_version",
        recordId: thread.id,
        authorUserId: repA.user.id,
        body: `${stamp} should not exist`,
      }),
  );

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

  console.log("\n2. Visibility follows the record [25 §10]");

  check(
    "the owning rep reads the company's comments",
    (await listComments(repA, "company", company.id)).length === 1,
  );

  // The negative half, which matters most: an outsider composing the SAME
  // filters must see none of it.
  const outsiderCompanyThread = await recordTimeline(
    outsider,
    "company",
    company.id,
  );
  check(
    "an outsider sees NO comment on a company they do not hold [25 §10]",
    outsiderCompanyThread.total === 0,
    `saw ${outsiderCompanyThread.total}`,
  );

  await refuses(
    "an outsider cannot comment on a record they cannot see [25 §10]",
    "comments.errors.recordNotFound",
    () =>
      addComment(outsider, {
        recordType: "company",
        recordId: company.id,
        body: `${stamp} should be refused`,
        mentions: [],
      }),
  );

  // A share is what changes the answer — the rule reports already follow.
  //
  // **Still a hand-written row, deliberately.** `grantShare` in
  // `src/lib/sharing.ts` is the real path as of feature slice 3, and this
  // fixture is not converted to it: this script asserts nothing about sharing,
  // so the coupling would buy no assertion and would make a comments run fail
  // when sharing changed. What the two paths agree is asserted once, in
  // `verify-sharing.ts` §5, which follows a REAL share through every filter —
  // including `visibleCommentsFilter`, the one this line exists to exercise.
  await db.insert(recordShares).values({
    recordType: "company",
    recordId: company.id,
    sharedWithUserId: repB.user.id,
    sharedByUserId: manager.user.id,
  });
  check(
    "a SHARED rep reads the same company's comments [25 §10]",
    (await recordTimeline(repB, "company", company.id)).total === 1,
  );

  // `16 §10` reaching through: the coordinator sees every thread, so they see
  // every thread conversation — and still no company conversation.
  const coordinatorThreadView = await recordTimeline(
    coordinator,
    "quotation_thread",
    thread.id,
  );
  check(
    "the coordinator reads every quotation conversation [16 §10], [25 §10]",
    coordinatorThreadView.total === 2,
    `saw ${coordinatorThreadView.total}`,
  );
  const coordinatorCompanyView = await eventsInRange(
    coordinator,
    { from: today(), to: today() },
    [repA.user.id],
  );
  check(
    "…and NOT the company conversation behind it [16 §8], [25 §10]",
    !coordinatorCompanyView.some(
      (event) =>
        event.kind === "comment" && event.companyId === company.id,
    ),
  );

  /* --- 3. Editable by the author, never deleted ------------------- */

  console.log("\n3. Editable by the author, never deleted [25 §12]");

  const [own] = await listComments(repA, "company", company.id);
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
    (await listComments(repA, "company", company.id)).length === 1,
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
  check(
    "…and carries the in_app channel [04 C3]",
    mentionType.defaultChannel === "in_app",
  );

  const before = await mentionsFor(repB.user.id);
  await addComment(repA, {
    recordType: "company",
    recordId: company.id,
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
    recordType: "company",
    recordId: company.id,
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
    (raised[0]?.payload as { recordType?: string })?.recordType === "company",
  );

  const selfBefore = await mentionsFor(repA.user.id);
  await addComment(repA, {
    recordType: "company",
    recordId: company.id,
    body: `${stamp} tagging myself`,
    mentions: [repA.user.id],
  });
  check(
    "tagging yourself raises nothing — you know [25 §11]",
    (await mentionsFor(repA.user.id)) === selfBefore,
  );

  // The set is REWRITTEN by an edit, and only a NEW name is notified.
  const rewriteTarget = (await listComments(repA, "company", company.id)).find(
    (row) => row.body === `${stamp} first tag`,
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
    recordType: "company",
    recordId: company.id,
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

  console.log("\n6. Comments join the record's timeline [25 §9]");

  const companyThread = await companyTimeline(repA, company.id);
  check(
    "a company comment appears on the company timeline [25 §9]",
    companyThread.events.some((event) => event.kind === "comment"),
  );
  check(
    "…attributed to whoever wrote it [20 §8]",
    companyThread.events
      .filter((event) => event.kind === "comment")
      .every((event) => event.actorUserId !== null),
  );
  check(
    "…and the reports and system events are still there [25 §9]",
    companyThread.events.some((event) => event.kind !== "comment"),
  );

  /**
   * **The second trap.** The six derived sources are anchored to a company or a
   * project, and every one of their anchor terms falls to `undefined` when
   * neither is set. Without the guard in `gather`, a contact scope would answer
   * "every event this viewer can see" instead of "this record's" — silently,
   * and as over-disclosure rather than a crash.
   */
  const contactThread = await recordTimeline(repA, "contact", contact.id);
  check(
    "*** a contact's thread carries its OWN comment and nothing else *** [25 §9]",
    contactThread.total === 1 &&
      contactThread.events.every((event) => event.kind === "comment"),
    `total ${contactThread.total}, kinds ${[...new Set(contactThread.events.map((e) => e.kind))].join(",")}`,
  );
  const dispatchThread = await recordTimeline(repA, "dispatch", dispatch.id);
  check(
    "a dispatch's thread likewise — no reports, no company events [25 §9]",
    dispatchThread.total === 1 &&
      dispatchThread.events.every((event) => event.kind === "comment"),
    `total ${dispatchThread.total}`,
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
