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
 *   8. Qualification is derived from the event `[10 §1]`.
 *   9. *** A quotation cannot be written without a stock *** `S118` — the
 *      database refusing one, beside the writer that cannot omit one.
 *  10. *** A quotation always keeps at least one product line *** `S60` — all
 *      three moments: raising, removing the last one, and issuing.
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
  commentMentions,
  comments,
  companies,
  companyReps,
  productClasses,
  productFireRatings,
  productSuppliers,
  productThicknesses,
  projectCompanies,
  projects,
  quotationThreads,
  quotationVersions,
  roles,
  serviceTypes,
  users,
} from "@/db/schema";
import type { AuthSession } from "@/lib/authz";
import { normalizeName } from "@/lib/normalize";
import { chainState } from "@/lib/chain";
import { getCompany } from "@/lib/companies";
import { NOTIFICATION_TYPES, SAUDI_CODE } from "@/lib/enums";
import { listCountries } from "@/lib/lookups";
import { listNotifications, type DecisionPayload } from "@/lib/notifications";
import {
  acceptThread,
  addQuotationLine,
  addServiceLine,
  cancelThread,
  createQuotationThread,
  createRevision,
  getQuotationThread,
  issueVersion,
  listQuotationThreads,
  rejectThread,
  removeQuotationLine,
  updateQuotationLine,
} from "@/lib/quotations";

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
    .where(eq(productSuppliers.nameEn, "N"))
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
      nameNormalized: normalizeName(`${stamp} Co`),
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
      name: `${stamp} Project`,
      nameNormalized: normalizeName(`${stamp} Project`),
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
      nameNormalized: normalizeName(`${stamp} Unquoted`),
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
      stock: "dammam",
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
    ["reject", () => rejectThread(repA, thread.id, "a reason")],
  ] as const) {
    await refuses(`a rep may not ${label}`, "quotations.errors.coordinatorOnly", fn);
  }
  await refuses(
    "cancelling needs a written reason [10 §8]",
    "quotations.errors.cancellationReasonRequired",
    () => cancelThread(coordinator, thread.id, "   "),
  );
  // `S62` `S128` — and so does rejecting, which until this slice took no reason
  // at all: no parameter, no column, no field. `AUDIT 1` called it the worst of
  // `S62`'s three acts.
  await refuses(
    "*** rejecting needs a written reason too *** [S62], [S128]",
    "quotations.errors.rejectionReasonRequired",
    () => rejectThread(coordinator, thread.id, "   "),
  );

  /* --- 6. Payment is not on the quotation at all `S133` ------------ */

  // This section refused accepted-for-processing before payment until
  // `S133`. Both acts are gone, with the three columns behind them: `S70`
  // records payment on the DISPATCH and `S73` makes a method a condition of
  // approving one, so there is no ordering left on a quotation to assert.
  // `verify:slice3` owns what replaced it - the payment method at approval.

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
    Boolean(coordinatorView?.projectName),
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
      nameNormalized: normalizeName(`${stamp} Unlinked`),
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
        { stock: "riyadh" },
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

  /* --- 12. Acceptance is internal approval only ------------------- */

  console.log("\n12. Accepted is internal approval, not a won deal [16 §5]");
  await acceptThread(coordinator, thread.id);
  detail = await getQuotationThread(repA, thread.id);
  check("end state is accepted", detail?.endState === "accepted");
  // **What "not a won deal" is measured against now** `S133`. The old
  // assertion read `paymentConfirmedAt === null`, which is unaskable since
  // the column went. Winning is an approved dispatch `S31`, and `S132` puts
  // an accepted thread at *with the customer* - a position, not a win - so
  // the chain is what says it.
  check(
    "and the chain reads with-the-customer, never won [S132]",
    detail !== null &&
      chainState({
        versionStatus: detail.live.status,
        endState: detail.endState,
      }).position === "withCustomer",
  );

  /* --- 13. The audit trail ---------------------------------------- */

  console.log("\n13. Every write is audited [07 E1]");
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

  /* --- 14. A quotation is drawn from one stock [S118] -------------- */

  console.log(
    "\n14. *** A quotation cannot be written without a stock *** [S118]",
  );

  // The claim is about the COLUMN, not about the row this script happened to
  // write. A fixture that carries a stock proves only that the fixture carries
  // one; what S118 needs is that a version without one cannot exist.
  const [stockColumn] = (await db.execute(sql`
    select is_nullable, data_type, udt_name
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'quotation_versions'
      and column_name = 'stock'
  `)) as unknown as {
    is_nullable: string;
    data_type: string;
    udt_name: string;
  }[];
  check(
    "quotation_versions.stock exists and is NOT NULL [S118]",
    stockColumn?.is_nullable === "NO",
    `got ${stockColumn?.is_nullable ?? "no such column"}`,
  );
  check(
    "…and it is the `stock` enum, not free text",
    stockColumn?.data_type === "USER-DEFINED" && stockColumn?.udt_name === "stock",
    `got ${stockColumn?.data_type} / ${stockColumn?.udt_name}`,
  );

  // The refusal itself, at the database, against a thread that really exists.
  // Raw SQL rather than the data layer on purpose: `QuotationVersionInput`
  // makes the omission a compile error, so TypeScript is the only thing that
  // can be asked about the writer, and this is the only way left to ask the
  // database. A NOT NULL is not a row in `pg_constraint` on Postgres 17, so
  // the assertion is on the message Postgres raises and the column it names.
  try {
    await db.execute(sql`
      insert into quotation_versions (thread_id, version_number, origin)
      values (${thread.id}, 99, 'initial_request')
    `);
    failures += 1;
    console.error(
      "  FAIL  a version with no stock was accepted — the database allowed it",
    );
  } catch (error) {
    // The whole `cause` chain, not `error.message`: the driver wraps the
    // refusal as "Failed query: …" and Postgres's own wording — with the
    // column it names — sits one level down. Same shape as
    // `verify-schema25`'s `causeChain`, and the reason that helper exists.
    const parts: string[] = [];
    let current: unknown = error;
    for (let depth = 0; current && depth < 5; depth += 1) {
      if (!(current instanceof Error)) {
        parts.push(String(current));
        break;
      }
      const pg = current as { column_name?: string; code?: string };
      parts.push(current.message, pg.column_name ?? "", pg.code ?? "");
      current = current.cause;
    }
    const thrown = parts.filter(Boolean).join(" | ");
    check(
      "*** a quotation version with no stock is refused *** [S118]",
      // `23502` is not_null_violation, and the column it names must be ours —
      // a refusal for some other missing column would prove nothing here.
      thrown.includes("23502") && thrown.includes("stock"),
      `threw ${thrown.slice(0, 200)}`,
    );
  }

  // And the writer agrees with it. `dammam` deliberately, not `riyadh`: the
  // first value of an enum is what a silent default would produce, so the
  // round-trip would pass against `riyadh` whether or not anything read the
  // input at all.
  detail = await getQuotationThread(repA, thread.id);
  check(
    "*** the version carries the stock the rep chose *** [S118]",
    detail?.live.stock === "dammam",
    `got ${detail?.live.stock}`,
  );
  // Version 2 came from §8's revision, which takes no input at all — so this
  // is the carry-forward, and the only reason the value survived a revision.
  check(
    "…and a revision carried it forward unchanged [S66]",
    detail?.versions.every((version) => version.stock === "dammam") === true,
    detail?.versions.map((v) => `v${v.versionNumber}=${v.stock}`).join(", "),
  );

  /* --- 15. At least one product line [S60] ------------------------ */

  console.log(
    "\n15. *** A quotation always keeps at least one product line *** [S60]",
  );

  // **Three moments, and until now only two of them were guarded** — and
  // neither of those cited the rule, so nothing in the codebase could be read
  // as enforcing it. `tx.delete(quotationLines)` appears exactly once in
  // `src/`, inside `removeQuotationLine`, and `createQuotationThread` is the
  // only writer that can create a version with none; between them no
  // application path could reach the state. What had no guard was **issuing**,
  // which is where the rule stops being repairable: `S61` freezes the lines at
  // `issued` and `S66` makes a revision a new version rather than a way back.

  await refuses(
    "*** a quotation cannot be RAISED with no product line *** [S60]",
    "quotations.errors.atLeastOneLine",
    () =>
      createQuotationThread(
        repA,
        { projectId: project.id, companyId: company.id, contactId: null },
        { stock: "riyadh" },
        [],
        [],
      ),
  );

  // The thread §2 built carries one line, so removing it is removing the last.
  const soleThread = await createQuotationThread(
    repA,
    { projectId: project.id, companyId: company.id, contactId: null },
    { stock: "riyadh" },
    [
      {
        supplierId: supplier.id,
        classId: productClass.id,
        fireRatingId: fireRating.id,
        customColour: "168",
        thicknessId: thickness.id,
        widthM: "1.0000",
        lengthM: "1.0000",
        quantityPcs: "4.0000",
        unitPrice: "100.00",
      },
    ],
    [],
  );
  const soleDetail = await getQuotationThread(repA, soleThread.id);
  await refuses(
    "*** nor have its last line REMOVED *** [S60]",
    "quotations.errors.lastLine",
    () =>
      removeQuotationLine(repA, soleThread.id, soleDetail!.live.lines[0].id),
  );

  // **The moment this slice added, and the one that needed constructing.** No
  // application path produces a lineless version, so the only way to put
  // `issueVersion` in front of one is to write it the way the two scripts that
  // made the thirteen wrote theirs — directly. That is the state the guard
  // exists for: `createRevision` carries the previous version's lines forward,
  // so a lineless version already in the database yields a lineless revision
  // that is `requested`, and therefore issuable.
  const [emptyThread] = await db
    .insert(quotationThreads)
    .values({
      projectId: project.id,
      companyId: company.id,
      raisedByUserId: repA.user.id,
    })
    .returning();
  const [emptyVersion] = await db
    .insert(quotationVersions)
    .values({
      threadId: emptyThread.id,
      versionNumber: 1,
      origin: "initial_request",
      status: "requested",
      stock: "riyadh",
      createdBy: repA.user.id,
    })
    .returning();
  await refuses(
    "*** and a version with no line cannot be ISSUED *** [S60], [S61]",
    "quotations.errors.atLeastOneLine",
    () =>
      issueVersion(coordinator, emptyThread.id, {
        smacReference: `${stamp}-60`,
        verification: "unverified",
      }),
  );
  check(
    "…and it is still requested, so nothing was half-issued [S63]",
    (await getQuotationThread(coordinator, emptyThread.id))?.live.status ===
      "requested",
  );

  // **Give it the line rather than delete the row.** Nothing is cleaned up in
  // these scripts `[12 §7]`, and §18 of `verify:schema25` asserts over every
  // row that no version is lineless — so a fixture built to prove the refusal
  // must not be left behind as the one row that breaks the claim. Completing
  // it is not cleanup: nothing is removed, and the mirror half of the rule is
  // worth asserting anyway.
  await addQuotationLineRow(emptyVersion.id, "7.0000");
  await issueVersion(coordinator, emptyThread.id, {
    smacReference: `${stamp}-60`,
    verification: "unverified",
  });
  const nowIssued = await getQuotationThread(coordinator, emptyThread.id);
  check(
    "*** give it one line and the same call goes through *** [S60], [S63]",
    nowIssued?.live.status === "issued" &&
      nowIssued.live.lines.length === 1 &&
      nowIssued.live.totalSqm === "7.0000",
    `${nowIssued?.live.status}, ${nowIssued?.live.lines.length} line(s), ${nowIssued?.live.totalSqm} m2`,
  );

  /* --- 16. The reason reaches the rep [S62], [S128] --------------- */

  console.log(
    "\n16. *** A decision that ends the rep's work carries a reason that reaches them *** [S62], [S128]",
  );

  /**
   * `S62` asks for two things and `AUDIT 1` found one of three acts doing both:
   * *returning, rejecting or cancelling requires a written reason, which
   * becomes a comment on the thread*. `S128` adds the third — it has to reach
   * the rep, because *a record that vanishes with its reason in a column nobody
   * reads is the same as no reason at all*.
   *
   * Driven on threads the REP raised and the COORDINATOR closes, because
   * `setEndState` drops a self-directed row: a coordinator closing her own
   * thread would tell nobody and prove nothing.
   */
  const decisionsFor = async (threadId: string) => {
    const { rows } = await listNotifications(repA);
    return rows
      .filter((row) => row.typeKey === NOTIFICATION_TYPES.decisionEndedWork)
      .map((row) => row.payload)
      .filter(
        (payload): payload is DecisionPayload => payload?.kind === "decision",
      )
      .filter((payload) => payload.recordId === threadId);
  };

  const commentsOn = async (threadId: string): Promise<string[]> =>
    (
      await db
        .select({ body: comments.body })
        .from(comments)
        .where(
          and(
            eq(comments.recordType, "quotation_thread"),
            eq(comments.recordId, threadId),
          ),
        )
    ).map((row) => row.body);

  for (const [act, key, run] of [
    [
      "rejected",
      "quotation_rejected",
      (id: string, reason: string) => rejectThread(coordinator, id, reason),
    ],
    [
      "cancelled",
      "quotation_cancelled",
      (id: string, reason: string) => cancelThread(coordinator, id, reason),
    ],
  ] as const) {
    const closing = await createQuotationThread(
      repA,
      { projectId: project.id, companyId: company.id, contactId: null },
      { stock: "riyadh" },
      [
        {
          supplierId: supplier.id,
          classId: productClass.id,
          fireRatingId: fireRating.id,
          customColour: "168",
          thicknessId: thickness.id,
          widthM: "1.0000",
          lengthM: "1.0000",
          quantityPcs: "3.0000",
          unitPrice: "100.00",
        },
      ],
      [],
    );
    const reason = `${stamp} the customer went with somebody else — ${act}`;
    await run(closing.id, reason);

    const bodies = await commentsOn(closing.id);
    check(
      `*** a ${act} quotation's reason becomes a comment on the thread *** [S62]`,
      bodies.length === 1 && bodies[0] === reason,
      `${bodies.length} comment(s): ${bodies.join(" | ")}`,
    );

    const [told] = await decisionsFor(closing.id);
    check(
      `*** …and it reaches the rep who raised it *** [S128]`,
      told?.decision === key && told?.reason === reason,
      `got ${JSON.stringify(told)}`,
    );
    check(
      `…as a link, since the rep can still open their own thread [S112]`,
      told?.recordViewable === true &&
        told?.href === `/quotations/${closing.id}`,
      `viewable=${told?.recordViewable} href=${told?.href}`,
    );

    // **No mention beside it** `S92`. `returnForEdit` tags the raiser because
    // the tag is the only thing that reaches them; here the news item IS the
    // telling, and a mention would ring a second bell reading "Mentioned you"
    // for the same sentence.
    const [mentions] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(commentMentions)
      .innerJoin(comments, eq(comments.id, commentMentions.commentId))
      .where(
        and(
          eq(comments.recordType, "quotation_thread"),
          eq(comments.recordId, closing.id),
        ),
      );
    check(
      `…and the comment carries NO mention — one act, one bell [S92]`,
      (mentions?.total ?? 0) === 0,
      `${mentions?.total} mention(s)`,
    );
  }

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
