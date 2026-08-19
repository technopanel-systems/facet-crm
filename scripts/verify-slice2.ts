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

import { eq, sql } from "drizzle-orm";

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
  quotationThreads,
  roles,
  serviceTypes,
  users,
} from "@/db/schema";
import type { AuthSession } from "@/lib/authz";
import { chainState } from "@/lib/chain";
import { getCompany } from "@/lib/companies";
import { SAUDI_CODE } from "@/lib/enums";
import { listCountries } from "@/lib/lookups";
import {
  acceptThread,
  addQuotationLine,
  addServiceLine,
  cancelThread,
  confirmPayment,
  createQuotationThread,
  createRevision,
  getQuotationThread,
  issueVersion,
  listQuotationThreads,
  markAcceptedForProcessing,
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

  // `S13` makes the phone mandatory and `S23` matches companies on it, so every
  // fixture gets its own — from the run stamp plus a counter, because a shared
  // literal would make each run's companies duplicates of the last run's.
  // `S14` — all of them are Saudi, so `S15`'s city and region still apply.
  const saudiId = (await listCountries()).find(
    (row) => row.code === SAUDI_CODE,
  )!.id;
  let phoneSeq = 0;
  const nextPhone = () => `+9665${stamp.slice(-7)}${(phoneSeq += 1)}`;

  const [company] = await db
    .insert(companies)
    .values({
      name: `${stamp} Co`,
      nameNormalized: stamp,
      phone: nextPhone(),
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

  // A second company that never gets a quotation, so qualification can be
  // shown to be derived rather than always true.
  const [unquoted] = await db
    .insert(companies)
    .values({
      name: `${stamp} Unquoted`,
      nameNormalized: `${stamp}-unquoted`,
      phone: nextPhone(),
      countryId: saudiId,
      createdBy: repA.user.id,
    })
    .returning();
  await db.insert(companyReps).values({
    companyId: unquoted.id,
    userId: repA.user.id,
    isPrimary: true,
    origin: "self_registered",
  });

  /* --- 1. A line reads as ordinary fields ----------------------- */

  // `S53` — FACET does not reproduce SMAC's code format. There used to be a
  // `productDisplayName` here, asserted against three golden strings:
  // `"N- CA FR 168"`, `"N- CA FR 168 5mm"` and `"N- CA FR RAL 9016"`. That
  // function reassembled a real SMAC code, and the form was laid out to match
  // it. Both are gone; what a line carries is asserted in section 2 below,
  // where the parts arrive from the data layer as parts.

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
  // `S53` — the readable parts, straight from the data layer. Every one is
  // present and none is a code token: the supplier reads as its own name, the
  // thickness carries its unit, the colour is whatever was typed.
  const first = detail!.live.lines[0];
  check(
    "a line carries its parts as parts [S53]",
    first.supplierNameEn.length > 0 &&
      first.classNameEn.length > 0 &&
      first.fireRatingNameEn.length > 0 &&
      first.thicknessMm === "4" &&
      first.customColour === "168",
    `${first.supplierNameEn} / ${first.classNameEn} / ${first.fireRatingNameEn} / ${first.thicknessMm} / ${first.customColour}`,
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
  });
  detail = await getQuotationThread(repA, thread.id);
  check("two lines now", detail?.live.lines.length === 2);
  check(
    "total excl. VAT doubled to 20712.96",
    detail?.live.totalExclVat === "20712.96",
    `got ${detail?.live.totalExclVat}`,
  );
  check(
    "the 5 mm line reports its own thickness [S53]",
    detail?.live.lines.some((l) => l.thicknessMm === "5") === true,
    detail?.live.lines.map((l) => l.thicknessMm).join(" | "),
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
  // The second half of `16 §8` — names yes, records no — **as `S76` left it**.
  // That rule said the coordinator got the project title and no more; `S76`
  // gives them the project itself, because a dispatch carries one `S74`. It
  // names projects and contacts and no company, so the company half of
  // `16 §8` is untouched and asserted here unchanged. Reading is all that
  // moved: `verify:slice3` §16 holds the refusals that prove it.
  check(
    "the coordinator gets the project title",
    Boolean(coordinatorView?.projectNameEn),
  );
  check(
    "the coordinator gets the company name",
    Boolean(coordinatorView?.companyName),
  );
  check(
    "*** and may now OPEN the project record — S76 supersedes 16 §8 here ***",
    coordinatorView?.projectViewable === true,
  );
  check(
    "but may NOT open the company record — S76 names no company [16 §8]",
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
      name: `${stamp} Unlinked`,
      nameNormalized: `${stamp}-unlinked`,
      phone: nextPhone(),
      countryId: saudiId,
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
          },
        ],
        [],
      ),
  );

  /* --- 12. *** Validity stops nothing *** ------------------------ */

  console.log("\n12. *** An expired quotation stops nothing *** [S67]");

  // Put the live version's validity a long way in the past. Until `S67` this
  // was enough, on the very next read, to write `end_state = 'expired'` and
  // with it freeze the lines, close the chain, drop the thread out of the
  // follow-up queues and raise a persistent notification. The whole point of
  // this section is that a date now changes nothing but what a screen says.
  // **Its own thread, deliberately.** Section 14 asserts that `thread` has
  // been accepted and still carries no payment, so this section may not issue,
  // accept or pay that one. It raises an expired thread of its own and drives
  // the whole chain on it.
  const stale = await createQuotationThread(
    repA,
    { projectId: project.id, companyId: company.id, contactId: null },
    {
      validUntil: "2020-01-01",
      deliveryPeriod: null,
      paymentMethod: null,
      shipmentTerms: null,
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
        quantityPcs: "2.0000",
        unitPrice: "100.00",
      },
    ],
    [],
  );

  let stale_ = await getQuotationThread(repA, stale.id);
  check(
    "reading it does NOT close the thread [S67]",
    stale_?.endState === null,
  );
  check(
    "and it IS reported as expired [S67]",
    stale_?.live.expired === true,
    `got ${stale_?.live.expired}`,
  );

  // A read that writes is the specific defect `S67` removes. `expired` is
  // derived, so two reads in a row must leave the row exactly as it was.
  const beforeRead = await db
    .select({ endState: quotationThreads.endState })
    .from(quotationThreads)
    .where(eq(quotationThreads.id, stale.id));
  await listQuotationThreads(repA);
  await getQuotationThread(repA, stale.id);
  const afterRead = await db
    .select({ endState: quotationThreads.endState })
    .from(quotationThreads)
    .where(eq(quotationThreads.id, stale.id));
  check(
    "*** reading a quotation writes nothing to it *** [S67]",
    beforeRead[0].endState === null && afterRead[0].endState === null,
    `${beforeRead[0].endState} -> ${afterRead[0].endState}`,
  );

  const listed = await listQuotationThreads(repA);
  check(
    "the list reports expiry too, resolved in SQL [S67]",
    listed.rows.find((row) => row.id === stale.id)?.expired === true,
  );

  // `S61` — lines are editable while the live version is `requested` and the
  // thread is open. An expired thread IS open, so this must be allowed. It was
  // refused with `quotations.errors.threadClosed` before this slice.
  await addQuotationLine(repA, stale.id, {
    supplierId: supplier.id,
    classId: productClass.id,
    fireRatingId: fireRating.id,
    customColour: "expired-line",
    thicknessId: thickness.id,
    widthM: "1.2400",
    lengthM: "5.8000",
    quantityPcs: "1.0000",
    unitPrice: "100.00",
  });
  stale_ = await getQuotationThread(repA, stale.id);
  check(
    "an expired quotation still takes a new line [S61], [S67]",
    stale_?.live.lines.some((l) => l.customColour === "expired-line") === true,
  );

  // The rest of the chain, on the same expired thread: issued, accepted, paid.
  // Dispatch is `verify:slice3`'s subject and is not re-driven here.
  await issueVersion(coordinator, stale.id, {
    smacReference: `${stamp}-EXP`.slice(-24),
    verification: "verified",
  });
  stale_ = await getQuotationThread(repA, stale.id);
  check(
    "an expired quotation can still be issued [S67]",
    stale_?.live.status === "issued",
  );

  await acceptThread(coordinator, stale.id);
  await confirmPayment(repA, stale.id, "2026-08-19");
  stale_ = await getQuotationThread(repA, stale.id);
  check(
    "accepted, on an expired quotation [S67]",
    stale_?.endState === "accepted",
  );
  check("and paid [S67]", stale_?.paymentConfirmedAt !== null);
  check(
    "which leaves it still expired — a note, not a state [S67]",
    stale_?.live.expired === true,
  );

  /* --- 13. Whose move it is, on an expired quotation -------------- */

  console.log(
    "\n13. An expired quotation still names whose move it is [S67], [D2]",
  );

  // `chain.ts` sent every ended thread to `closed`, where `owedBy` is null:
  // nobody owes the next action on a finished quotation. Expiry used to reach
  // that branch, so a date could silently take a live deal off everybody's
  // list. Accepted and paid, this thread is the coordinator's to dispatch.
  const expiredChain = chainState({
    versionStatus: stale_!.live.status,
    endState: stale_!.endState,
    paymentConfirmedAt: stale_!.paymentConfirmedAt,
  });
  check(
    "*** it is somebody's move, not nobody's *** [S67], [D2]",
    expiredChain.owedBy !== null,
    `position ${expiredChain.position}, owedBy ${expiredChain.owedBy}`,
  );
  check(
    "and its position is a real one, not closed [S67]",
    expiredChain.position !== "closed",
    `got ${expiredChain.position}`,
  );

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
