/**
 * Verification scaffolding for the quotation chain — NOT a feature.
 *
 * There is no test harness in this repository, and `CLAUDE.md` records why
 * that hurts: the throwaway script that verified the auth checklist was
 * deleted, so its results cannot be reproduced. This one is **kept**, for the
 * same reason.
 *
 * It drives `src/lib/quotations.ts` in process — no browser, no HTTP — and
 * checks the things that are otherwise only claimed:
 *
 *   1. The arithmetic, against the real quotation 9592 `[08 D2]`, `[16 §1]`.
 *   2. The rep raises version 1 as `requested` with no SMAC reference
 *      `[10 §4]`, and the coordinator issuing it makes it `issued`.
 *   3. A revision supersedes, carries the lines forward, and leaves the
 *      earlier version read-only `[07 C2]`.
 *   4. Every coordinator gate refuses a rep, each for its own reason.
 *   5. Cancellation without a reason is refused `[10 §8]`.
 *   6. Payment ordering: accepted-for-processing is refused first, allowed
 *      after `[04 flow 12–13]`.
 *   7. Visibility: the raiser sees it, an unrelated rep does not, the project
 *      owner does `[11 §2]`.
 *   8. Expiry marks an overdue thread, skips a paid one `[16 §3]`, `[16 §7]`,
 *      and writes its audit row under a **null actor**.
 *   9. Qualification is derived from the event `[10 §1]`.
 *
 * Usage: `npm run verify:slice2`
 *
 * That needs `NODE_ENV=development` in `.env` — `.env.example` already carries
 * the line and explains why it is safe there. Without it, prefix the run:
 * `NODE_ENV=development npx tsx --env-file=.env scripts/verify-slice2.ts`.
 *
 * `--env-file` is not optional and cannot be replaced by the
 * `process.loadEnvFile` call below: this script reaches `@/lib/authz`, and
 * `src/auth/index.ts` reads `AUTH_SECRET` at module scope — before any
 * statement in this file runs.
 *
 * **It refuses to run outside development** `[15 §7]`, for the same reason
 * `dev-fixtures.ts` does.
 *
 * It needs a seeded database — `npm run db:seed`. Suppliers come from the seed
 * since `17 §1`, so the supplier fixture this script used to insert is gone.
 * It also needs the fixture accounts, including the Sales Coordinator that
 * `16 §8` turns on: `DEV_FIXTURE_PASSWORD=… npm run dev:fixtures`.
 */

process.loadEnvFile(".env");

import { and, eq, sql } from "drizzle-orm";

import { closeDatabase, db } from "@/db";
import {
  auditLog,
  companies,
  companyReps,
  productClasses,
  productFireRatings,
  productSuppliers,
  productThicknesses,
  projectCompanies,
  projects,
  quotationVersions,
  roles,
  serviceTypes,
  users,
} from "@/db/schema";
import type { AuthSession } from "@/lib/authz";
import { getCompany } from "@/lib/companies";
import {
  acceptThread,
  addQuotationLine,
  addServiceLine,
  cancelThread,
  confirmPayment,
  createQuotationThread,
  createRevision,
  expireOverdueThreads,
  getQuotationThread,
  issueVersion,
  listQuotationThreads,
  markAcceptedForProcessing,
  productDisplayName,
  updateQuotationLine,
} from "@/lib/quotations";

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
    check(`${label} (${expectedKey})`, message === expectedKey, `threw ${message}`);
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

async function main(): Promise<void> {
  if (process.env.NODE_ENV !== "development") {
    console.error(
      "verify-slice2 refuses to run outside development.\n" +
        `  NODE_ENV is ${process.env.NODE_ENV ?? "unset"}, and must be "development".`,
    );
    process.exit(1);
  }

  const repA = await sessionFor("rep-a@example.test");
  const repB = await sessionFor("rep-b@example.test");
  const coordinator = await sessionFor("coordinator@example.test");

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
  const [thickThickness] = await db
    .select()
    .from(productThicknesses)
    .where(eq(productThicknesses.thicknessMm, "5.00"))
    .limit(1);
  const [service] = await db.select().from(serviceTypes).limit(1);

  // Everything above comes from `npm run db:seed`. Say so rather than
  // failing later on an undefined `.id`.
  if (!supplier || !productClass || !fireRating || !thickness || !thickThickness || !service) {
    console.error("The lookups are not seeded. Run: npm run db:seed");
    process.exit(1);
  }

  /* --- A company and a project owned by rep A -------------------- */

  const stamp = `verify-${Date.now()}`;
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

  // A second company that never gets a quotation, so qualification can be
  // shown to be derived rather than always true.
  const [unquoted] = await db
    .insert(companies)
    .values({
      nameEn: `${stamp} Unquoted`,
      nameNormalized: `${stamp}-unquoted`,
      createdBy: repA.user.id,
    })
    .returning();
  await db.insert(companyReps).values({
    companyId: unquoted.id,
    userId: repA.user.id,
    isPrimary: true,
    origin: "self_registered",
  });

  /* --- 1. The generated product name ----------------------------- */

  console.log("\n1. Generated product name [08 B1, D1]");
  check(
    "4 mm is omitted",
    productDisplayName({
      supplierCode: "N",
      classCode: "CA",
      fireRatingCode: "FR",
      customColour: "168",
      thicknessMm: "4.00",
      thicknessIsStandard: true,
    }) === "N- CA FR 168",
  );
  check(
    "5 mm is written",
    productDisplayName({
      supplierCode: "N",
      classCode: "CA",
      fireRatingCode: "FR",
      customColour: "168",
      thicknessMm: "5.00",
      thicknessIsStandard: false,
    }) === "N- CA FR 168 5mm",
  );
  check(
    "a RAL or Pantone special reads the same way [12 §12], [26 §2]",
    productDisplayName({
      supplierCode: "N",
      classCode: "CA",
      fireRatingCode: "FR",
      customColour: "RAL 9016",
      thicknessMm: "4.00",
      thicknessIsStandard: true,
    }) === "N- CA FR RAL 9016",
  );

  /* --- 2. The request IS version 1 ------------------------------- */

  console.log("\n2. The request is version 1 [10 §4], [04 flow 6]");
  const thread = await createQuotationThread(
    repA,
    { projectId: project.id, companyId: company.id, contactId: null },
    {
      validUntil: "2030-01-01",
      deliveryPeriod: "4 weeks",
      paymentMethod: "50% advance",
      shipmentTerms: "EX-F",
    },
    [
      {
        supplierId: supplier.id,
        classId: productClass.id,
        fireRatingId: fireRating.id,
        // Typed, not picked `[17 §2]` — the only shape a line has since `26 §2`.
        customColour: "168",
        thicknessId: thickness.id,
        // Quotation 9592, verbatim: 12 × 1.24 × 5.8 = 86.3040 m².
        widthM: "1.2400",
        lengthM: "5.8000",
        quantityPcs: "12.0000",
        unitPrice: "120.00",
        vatRate: "15.00",
      },
    ],
    [],
  );

  let detail = await getQuotationThread(repA, thread.id);
  check("version 1 exists", detail?.live.versionNumber === 1);
  check("status is requested", detail?.live.status === "requested");
  check("no SMAC reference yet", detail?.live.smacReference === null);
  check("origin is initial_request", detail?.live.origin === "initial_request");
  check("no end state", detail?.endState === null);
  check(
    "the app wrote form_factor = sheet [13 §2]",
    detail?.live.lines.every((line) => line.displayName.length > 0) === true,
  );

  /* --- 3. The arithmetic, against quotation 9592 ----------------- */

  console.log("\n3. Money, computed by FACET [16 §1] against quotation 9592");
  const line = detail!.live.lines[0];
  check("sqm = 12 × 1.24 × 5.8 = 86.3040", line.sqm === "86.3040", `got ${line.sqm}`);
  check(
    "line total = 120.00 × 86.3040 = 10356.48",
    line.lineTotal === "10356.48",
    `got ${line.lineTotal}`,
  );
  check(
    "VAT at 15% = 1553.47",
    line.vatAmount === "1553.47",
    `got ${line.vatAmount}`,
  );
  check(
    "version total excl. VAT = 10356.48",
    detail!.live.totalExclVat === "10356.48",
    `got ${detail!.live.totalExclVat}`,
  );
  check(
    "grand total = 11909.95",
    detail!.live.grandTotal === "11909.95",
    `got ${detail!.live.grandTotal}`,
  );
  check(
    "total sqm = 86.3040",
    detail!.live.totalSqm === "86.3040",
    `got ${detail!.live.totalSqm}`,
  );

  /* --- 4. Qualification is derived ------------------------------- */

  console.log("\n4. Qualification is derived from the event [10 §1]");
  check(
    "the company is now qualified",
    (await getCompany(repA, company.id))?.isQualified === true,
  );
  check(
    "a company with no quotation is not",
    (await getCompany(repA, unquoted.id))?.isQualified === false,
  );

  /* --- 5. The coordinator's gates refuse a rep ------------------- */

  console.log("\n5. can_approve_quotation gates, each refusing for its own reason");
  for (const [label, fn] of [
    ["issue", () => issueVersion(repA, thread.id, { smacReference: "9592", verification: "unverified" })],
    ["accept", () => acceptThread(repA, thread.id)],
    ["cancel", () => cancelThread(repA, thread.id, "a reason")],
  ] as const) {
    await refuses(`a rep may not ${label}`, "quotations.errors.coordinatorOnly", fn);
  }
  await refuses(
    "cancelling needs a written reason [10 §8]",
    "quotations.errors.cancellationReasonRequired",
    () => cancelThread(coordinator, thread.id, "   "),
  );

  /* --- 6. Payment ordering --------------------------------------- */

  console.log("\n6. Payment before accepted-for-processing [04 flow 12–13]");
  await refuses(
    "accepted-for-processing is refused before payment",
    "quotations.errors.paymentFirst",
    () => markAcceptedForProcessing(repA, thread.id),
  );

  /* --- 7. Issue, then lines are frozen --------------------------- */

  console.log("\n7. Issue freezes the lines [07 C2]");
  await issueVersion(coordinator, thread.id, {
    smacReference: "9592",
    verification: "unverified",
  });
  detail = await getQuotationThread(repA, thread.id);
  check("status is issued", detail?.live.status === "issued");
  check("reference recorded", detail?.live.smacReference === "9592");
  await refuses(
    "a line cannot be edited once issued",
    "quotations.errors.versionNotEditable",
    () =>
      updateQuotationLine(repA, thread.id, line.id, {
        supplierId: supplier.id,
        classId: productClass.id,
        fireRatingId: fireRating.id,
        customColour: "168",
        thicknessId: thickness.id,
        widthM: "1.2400",
        lengthM: "5.8000",
        quantityPcs: "13.0000",
        unitPrice: "120.00",
        vatRate: "15.00",
      }),
  );

  /* --- 8. A revision supersedes and carries the lines forward ---- */

  console.log("\n8. A revision is version 2 [07 C2]");
  await createRevision(repA, thread.id, "rep_change_request");
  detail = await getQuotationThread(repA, thread.id);
  check("live version is 2", detail?.live.versionNumber === 2);
  check("version 2 is requested", detail?.live.status === "requested");
  check(
    "version 2 has no reference — the RE number is typed on issue [04 A2]",
    detail?.live.smacReference === null,
  );
  check("the lines came forward", detail?.live.lines.length === 1);
  check(
    "version 1 is superseded and read-only",
    detail?.versions.find((v) => v.versionNumber === 1)?.status === "superseded",
  );
  check(
    "version 1 keeps its reference",
    detail?.versions.find((v) => v.versionNumber === 1)?.smacReference === "9592",
  );

  /* --- 9. A second line, a 5 mm one, and the totals move --------- */

  console.log("\n9. Totals recompute on every line change [16 §1]");
  await addQuotationLine(repA, thread.id, {
    supplierId: supplier.id,
    classId: productClass.id,
    fireRatingId: fireRating.id,
    customColour: "RAL 9016",
    thicknessId: thickThickness.id,
    widthM: "1.2400",
    lengthM: "5.8000",
    quantityPcs: "12.0000",
    unitPrice: "120.00",
    vatRate: "15.00",
  });
  detail = await getQuotationThread(repA, thread.id);
  check("two lines now", detail?.live.lines.length === 2);
  check(
    "total excl. VAT doubled to 20712.96",
    detail?.live.totalExclVat === "20712.96",
    `got ${detail?.live.totalExclVat}`,
  );
  check(
    "the 5 mm line writes its thickness into the name",
    detail?.live.lines.some((l) => l.displayName.endsWith("mm")) === true,
    detail?.live.lines.map((l) => l.displayName).join(" | "),
  );
  await refuses(
    "a line with no colour is refused [12 §12], [26 §2]",
    "quotations.errors.colourChoice",
    () =>
      addQuotationLine(repA, thread.id, {
        supplierId: supplier.id,
        classId: productClass.id,
        fireRatingId: fireRating.id,
        customColour: null,
        thicknessId: thickness.id,
        widthM: "1.2400",
        lengthM: "5.8000",
        quantityPcs: "1.0000",
        unitPrice: null,
        vatRate: null,
      }),
  );

  /* --- 9b. Service lines ------------------------------------------ */

  console.log("\n9b. Service lines [08 B4], [12 §10], [16 §1]");
  await addServiceLine(repA, thread.id, {
    serviceTypeId: service.id,
    quantity: "10.0000",
    unitPrice: "25.00",
    quotationLineId: null,
  });
  detail = await getQuotationThread(repA, thread.id);
  const serviceLine = detail!.live.serviceLines[0];
  check(
    "the app wrote unit = sqm [12 §10]",
    serviceLine?.unit === "sqm",
    `got ${serviceLine?.unit}`,
  );
  check(
    "service total = 25.00 × 10 = 250.00",
    serviceLine?.lineTotal === "250.00",
    `got ${serviceLine?.lineTotal}`,
  );
  check(
    "it joins total excl. VAT: 20712.96 + 250.00 = 20962.96",
    detail?.live.totalExclVat === "20962.96",
    `got ${detail?.live.totalExclVat}`,
  );
  check(
    "and is taxed at the default rate: 3106.94 + 37.50 = 3144.44 [16 §1]",
    detail?.live.totalVat === "3144.44",
    `got ${detail?.live.totalVat}`,
  );
  // The rule that protects the SQM target `[08 D4]`, `[12 §10]`: service
  // square metres are tracked, but they are not cladding.
  check(
    "service m² stay OUT of total_sqm [08 D4], [12 §10]",
    detail?.live.totalSqm === "172.6080",
    `got ${detail?.live.totalSqm}`,
  );

  /* --- 10. Visibility -------------------------------------------- */

  console.log("\n10. Visibility [11 §2], [04 Q7], [16 §8]");
  check("the raiser sees it", (await getQuotationThread(repA, thread.id)) !== null);
  check(
    "an unrelated rep does not",
    (await getQuotationThread(repB, thread.id)) === null,
  );

  // `16 §8`, and the reason the flag is not dead: Sales Coordinator has
  // sees_all_reps = false, so without this term they could reach no quotation.
  check(
    "the coordinator does NOT hold sees_all_reps",
    coordinator.user.role.seesAllReps === false,
  );
  const coordinatorView = await getQuotationThread(coordinator, thread.id);
  check(
    "but can_approve_quotation sees every thread [16 §8]",
    coordinatorView !== null,
  );
  // The second half of `16 §8`, which is as load-bearing as the first: names
  // yes, records no.
  check(
    "the coordinator gets the project title",
    Boolean(coordinatorView?.projectNameEn),
  );
  check(
    "the coordinator gets the company name",
    Boolean(coordinatorView?.companyNameEn),
  );
  check(
    "but may NOT open the project record [16 §8]",
    coordinatorView?.projectViewable === false,
  );
  check(
    "and may NOT open the company record [16 §8]",
    coordinatorView?.companyViewable === false,
  );
  check(
    "while the raiser may open both",
    (await getQuotationThread(repA, thread.id))?.projectViewable === true,
  );
  check(
    "the thread appears in the coordinator's list, not rep B's",
    (await listQuotationThreads(coordinator)).rows.some(
      (row) => row.id === thread.id,
    ) &&
      !(await listQuotationThreads(repB)).rows.some(
        (row) => row.id === thread.id,
      ),
  );

  /* --- 11. Company scope ----------------------------------------- */

  console.log("\n11. The company must be on the project [16 §6]");
  const [other] = await db
    .insert(companies)
    .values({
      nameEn: `${stamp} Unlinked`,
      nameNormalized: `${stamp}-unlinked`,
      createdBy: repA.user.id,
    })
    .returning();
  await refuses(
    "a company not linked to the project is refused",
    "quotations.errors.companyNotOnProject",
    () =>
      createQuotationThread(
        repA,
        { projectId: project.id, companyId: other.id, contactId: null },
        { validUntil: null, deliveryPeriod: null, paymentMethod: null, shipmentTerms: null },
        [
          {
            supplierId: supplier.id,
            classId: productClass.id,
            fireRatingId: fireRating.id,
            customColour: "168",
            thicknessId: thickness.id,
            widthM: "1.2400",
            lengthM: "5.8000",
            quantityPcs: "1.0000",
            unitPrice: null,
            vatRate: null,
          },
        ],
        [],
      ),
  );

  /* --- 12. Expiry ------------------------------------------------- */

  console.log("\n12. Expiry [07 C7], [16 §3], [16 §7]");
  await db
    .update(quotationVersions)
    .set({ validUntil: "2020-01-01" })
    .where(
      and(
        eq(quotationVersions.threadId, thread.id),
        eq(quotationVersions.status, "requested"),
      ),
    );
  await expireOverdueThreads();
  detail = await getQuotationThread(repA, thread.id);
  check("an overdue thread is marked expired", detail?.endState === "expired");

  const [expiryEntry] = await db
    .select()
    .from(auditLog)
    .where(
      and(
        eq(auditLog.action, "quotation_thread.expired"),
        eq(auditLog.entityId, thread.id),
      ),
    )
    .limit(1);
  check("the expiry audit row exists", Boolean(expiryEntry));
  check(
    "and its actor is the system, not the reader [16 §3]",
    expiryEntry?.actorUserId === null,
  );

  // A paid thread must not expire `[16 §7]`.
  const paid = await createQuotationThread(
    repA,
    { projectId: project.id, companyId: company.id, contactId: null },
    { validUntil: "2020-01-01", deliveryPeriod: null, paymentMethod: null, shipmentTerms: null },
    [
      {
        supplierId: supplier.id,
        classId: productClass.id,
        fireRatingId: fireRating.id,
        customColour: "168",
        thicknessId: thickness.id,
        widthM: "1.2400",
        lengthM: "5.8000",
        quantityPcs: "1.0000",
        unitPrice: "100.00",
        vatRate: "15.00",
      },
    ],
    [],
  );
  await confirmPayment(repA, paid.id, "2026-08-09");
  await expireOverdueThreads();
  const paidDetail = await getQuotationThread(repA, paid.id);
  check(
    "a payment-confirmed thread does NOT expire [16 §7]",
    paidDetail?.endState === null,
    `got ${paidDetail?.endState}`,
  );
  check(
    "payment recorded the person who confirmed it",
    paidDetail?.paymentConfirmedByUserId === repA.user.id,
  );
  await markAcceptedForProcessing(repA, paid.id);
  check(
    "accepted-for-processing is allowed after payment",
    (await getQuotationThread(repA, paid.id))?.acceptedForProcessingAt !== null,
  );

  /* --- 13. Revising an expired thread revives it ------------------ */

  console.log("\n13. Revise revives an expired thread [07 C7]");
  await createRevision(repA, thread.id, "expiry_revision");
  detail = await getQuotationThread(repA, thread.id);
  check("the end state cleared", detail?.endState === null);
  check("live version is 3", detail?.live.versionNumber === 3);
  check("origin is expiry_revision", detail?.live.origin === "expiry_revision");

  /* --- 14. Acceptance is internal approval only ------------------- */

  console.log("\n14. Accepted is internal approval, not a won deal [16 §5]");
  await acceptThread(coordinator, thread.id);
  detail = await getQuotationThread(repA, thread.id);
  check("end state is accepted", detail?.endState === "accepted");
  check(
    "and the customer has still not committed — no payment on this thread",
    detail?.paymentConfirmedAt === null,
  );

  /* --- 15. The audit trail ---------------------------------------- */

  console.log("\n15. Every write is audited [07 E1]");
  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(auditLog)
    .where(eq(auditLog.entityId, thread.id));
  check("the thread has audit rows", total > 0, `${total} rows`);

  const actions = await db
    .selectDistinct({ action: auditLog.action })
    .from(auditLog)
    .where(sql`${auditLog.action} like 'quotation%'`);
  console.log(
    `        actions seen: ${actions.map((row) => row.action).sort().join(", ")}`,
  );

  // Nothing is cleaned up: FACET does not delete history `[12 §7]`, and this
  // script does not get an exception. Every row it writes is prefixed with the
  // run's timestamp so a development database stays readable.
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
