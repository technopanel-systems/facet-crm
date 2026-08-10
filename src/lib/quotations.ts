/**
 * Quotations — the data layer `09 §5`, and the chain `04 flow 6–13` describes.
 *
 * One **thread** per deal, with **versions** on it. The rep's request *is*
 * version 1: status `requested`, no SMAC reference `[10 §4]`, `[04 flow 6]`.
 * The coordinator creates the real document in SMAC and records its reference,
 * which makes that version `issued`. A revision is version 2 carrying the `RE`
 * number `[07 C2]`; earlier versions go `superseded` and are read-only, and
 * only the latest is live. Both routes produce a version — the rep asking for
 * a change, and the coordinator editing directly.
 *
 * Visibility is `visibleQuotationThreadsFilter` and nothing else: the raising
 * rep, an explicit thread share, or visibility of the parent project
 * `[11 §2]`. No query in this file writes its own predicate.
 *
 * Money is computed, never typed `[16 §1]`. SMAC still owns it: `08 D5`
 * governs disagreement, and computing the mirror removes the commonest way the
 * two diverge. Every figure stays a string end to end — a square-metre number
 * the business is measured on must not pass through a float.
 *
 * **`accepted` is internal approval, not a won deal** `[16 §5]`. It means the
 * coordinator has the signatures. The customer commits at
 * `payment_confirmed_at` and then `accepted_for_processing_at`. Nothing that
 * counts, ranks or forecasts may read the end state as "bought".
 */

import {
  and,
  asc,
  count,
  desc,
  eq,
  exists,
  inArray,
  isNull,
  ne,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { QueryBuilder, type AnyPgColumn } from "drizzle-orm/pg-core";

import { db } from "@/db";
import {
  companies,
  contacts,
  productClasses,
  productColours,
  productFireRatings,
  productSuppliers,
  productThicknesses,
  projectCompanies,
  projects,
  quotationLines,
  quotationServiceLines,
  quotationThreads,
  quotationVersions,
  serviceTypes,
  users,
} from "@/db/schema";
import { withAudit, type AuditActor, type AuditEntry } from "@/lib/audit";
import {
  can,
  canViewRecord,
  visibleProjectsFilter,
  visibleQuotationThreadsFilter,
  type AuthSession,
} from "@/lib/authz";
import {
  DEFAULT_VAT_RATE,
  QUOTATION_THREAD_END_STATES,
  QUOTATION_VERSION_ORIGINS,
  QUOTATION_VERSION_STATUSES,
  SMAC_VERIFICATIONS,
  type QuotationThreadEndState,
  type QuotationVersionOrigin,
  type QuotationVersionStatus,
  type SameValues,
  type SmacVerification,
} from "@/lib/enums";
import { RuleError } from "@/lib/validation";

export type QuotationThread = typeof quotationThreads.$inferSelect;
export type QuotationVersion = typeof quotationVersions.$inferSelect;

/** Compile-time proof that `enums.ts` still matches the database. */
export type ThreadEndStateMatchesSchema = SameValues<
  QuotationThreadEndState,
  NonNullable<QuotationThread["endState"]>
>;
export type VersionStatusMatchesSchema = SameValues<
  QuotationVersionStatus,
  QuotationVersion["status"]
>;
export type VersionOriginMatchesSchema = SameValues<
  QuotationVersionOrigin,
  QuotationVersion["origin"]
>;
export type SmacVerificationMatchesSchema = SameValues<
  SmacVerification,
  QuotationVersion["smacReferenceVerification"]
>;

export {
  QUOTATION_THREAD_END_STATES,
  QUOTATION_VERSION_ORIGINS,
  QUOTATION_VERSION_STATUSES,
  SMAC_VERIFICATIONS,
};
export type {
  QuotationThreadEndState,
  QuotationVersionOrigin,
  QuotationVersionStatus,
  SmacVerification,
};

const PAGE_SIZE = 25;

/* ------------------------------------------------------------------ *
 * Exact decimal arithmetic `[16 §1]`
 *
 * `numeric` columns arrive as strings and leave as strings. Everything in
 * between is scaled `bigint`, so no money or square-metre figure is ever a
 * float. The scales are the ones the schema declares: SQM(14,4), MONEY(14,2),
 * vat_rate(5,2).
 * ------------------------------------------------------------------ */

const MONEY_SCALE = 2;
const SQM_SCALE = 4;

// `BigInt(0)` rather than `0n`, throughout: `tsconfig.json` targets ES2017 and
// bigint *literals* need ES2020. The calls are equivalent and cost nothing;
// they are here so nobody has to change the whole app's compile target to read
// this file. Do not "tidy" them back to `0n` without bumping that target.
const ZERO = BigInt(0);
const pow10 = (exponent: number): bigint => BigInt(10) ** BigInt(exponent);

/** `"86.3040"` at scale 4 → `863040`. Inputs come from columns already at or
 *  below their declared scale, so nothing is silently truncated here. */
function toScaled(value: string, scale: number): bigint {
  const negative = value.startsWith("-");
  const body = negative ? value.slice(1) : value;
  const [whole, fraction = ""] = body.split(".");
  const padded = `${fraction}${"0".repeat(scale)}`.slice(0, scale);
  const magnitude =
    BigInt(whole || "0") * pow10(scale) + BigInt(padded || "0");
  return negative ? -magnitude : magnitude;
}

/** `863040` at scale 4 → `"86.3040"`. */
function fromScaled(value: bigint, scale: number): string {
  const negative = value < ZERO;
  const magnitude = negative ? -value : value;
  const divisor = pow10(scale);
  const whole = magnitude / divisor;
  const fraction = (magnitude % divisor).toString().padStart(scale, "0");
  const sign = negative ? "-" : "";
  return scale === 0 ? `${sign}${whole}` : `${sign}${whole}.${fraction}`;
}

/** Half-up, on the magnitude, sign restored. Bankers' rounding would be a
 *  surprise on an invoice a customer reads. */
function divideRounded(numerator: bigint, denominator: bigint): bigint {
  const negative = numerator < ZERO !== denominator < ZERO;
  const n = numerator < ZERO ? -numerator : numerator;
  const d = denominator < ZERO ? -denominator : denominator;
  const two = BigInt(2);
  const quotient = (n * two + d) / (d * two);
  return negative ? -quotient : quotient;
}

/**
 * `unit_price × sqm`, rounded to money scale.
 *
 * The unit price is **per square metre** `[16 §1]`, not per sheet — the
 * founder's own statement of the rule. Verified against quotation 9592:
 * `12 × 1.24 × 5.8 = 86.3040` m² at 120.00 → `10,356.48`.
 */
function multiplyMoneyBySqm(moneyScaled: bigint, sqmScaled: bigint): bigint {
  return divideRounded(moneyScaled * sqmScaled, pow10(SQM_SCALE));
}

/** `amount × rate ÷ 100`, both at money scale, result at money scale. */
function applyPercent(amountScaled: bigint, rateScaled: bigint): bigint {
  return divideRounded(amountScaled * rateScaled, pow10(MONEY_SCALE + 2));
}

/* ------------------------------------------------------------------ *
 * The generated product name `[08 B1]`, `[08 D1]`
 * ------------------------------------------------------------------ */

export type ProductNameParts = {
  supplierCode: string;
  classCode: string;
  fireRatingCode: string;
  colourCode: string | null;
  customColour: string | null;
  thicknessMm: string;
  thicknessIsStandard: boolean;
};

/**
 * The printed product name, generated from the attribute parts so FACET's
 * output matches SMAC's without anyone retyping it `[08 D1]`.
 *
 * `08 B1` decomposes one real code — `N- CA FR 168` — into supplier, class,
 * fire rating and colour, and says the standard 4 mm thickness is omitted from
 * the printed name and written only for the thicker sheets.
 *
 * **`17 §4` settles the layout question `16 §10` left open.** `08 A` lists
 * `Product Name · thickness` as two columns on the SMAC form, which read
 * against `08 B1`'s "written" — but this name is FACET's own and does not
 * reproduce SMAC's form. The thickness joins the name, and 4 mm is omitted.
 * No real 5 mm quotation needs to be found first.
 *
 * The colour is the typed value `[17 §2]`, so in practice it always arrives as
 * `customColour`; `colourCode` is still read first for a row a non-form caller
 * wrote against the lookup.
 */
export function productDisplayName(parts: ProductNameParts): string {
  const colour = parts.colourCode ?? parts.customColour ?? "";
  const base = `${parts.supplierCode}- ${parts.classCode} ${parts.fireRatingCode} ${colour}`.trim();
  if (parts.thicknessIsStandard) return base;
  // Trailing zeros off a numeric(5,2): "5.00" reads as "5mm", not "5.00mm".
  const mm = parts.thicknessMm.replace(/\.?0+$/, "");
  return `${base} ${mm}mm`;
}

/* ------------------------------------------------------------------ *
 * Qualification — derived from the event, never a field `[10 §1]`, `[04]`
 * ------------------------------------------------------------------ */

const subquery = new QueryBuilder();

/**
 * `exists (select 1 from quotation_threads where company_id = <column>)`.
 *
 * A company becomes qualified when a quotation is requested against it
 * `[04 qualification]`, `[10 §1]`. The system knows this from the event and
 * nobody ticks a box — so this is a correlated predicate, not a column, and
 * there is nothing to keep in step.
 *
 * Exported for `companies.ts`. The dependency runs one way only: nothing here
 * imports the companies module.
 */
export function companyIsQualified(companyIdColumn: AnyPgColumn): SQL<boolean> {
  // Typed through `sql<boolean>` because `exists()` is `SQL<unknown>`, and
  // this is selected as a column rather than only used in a WHERE. The cast
  // is honest: `exists` really does evaluate to a boolean in Postgres.
  return sql<boolean>`${exists(
    subquery
      .select({ one: sql`1` })
      .from(quotationThreads)
      .where(eq(quotationThreads.companyId, companyIdColumn)),
  )}`;
}

/* ------------------------------------------------------------------ *
 * Expiry `[07 C7]`, `[16 §3]`, `[16 §7]`
 * ------------------------------------------------------------------ */

/** The system, not whoever happened to open the page `[16 §3]`. */
const SYSTEM_ACTOR: AuditActor = { actorUserId: null, actingAsUserId: null };

/**
 * Today as `YYYY-MM-DD` in Riyadh, for comparing against a `date` column.
 *
 * The app's timezone is fixed at Asia/Riyadh, and a validity date is a day
 * there — not an instant. The sweep itself uses Postgres's `current_date` and
 * never this; this is only for the one comparison that happens in TypeScript.
 */
function today(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Riyadh",
    dateStyle: "short",
  }).format(new Date());
}

/**
 * Mark every thread whose live version has passed its validity date.
 *
 * FACET has no scheduler, so this runs when a quotation screen is read
 * `[16 §3]`. It is one statement and writes nothing when nothing is due. The
 * same function is what a scheduled job will call when Phase 10 adds one —
 * there is no second code path.
 *
 * Two exclusions, both rules rather than conveniences:
 *  - a thread that already has an end state is finished;
 *  - **a payment-confirmed thread does not expire** `[16 §7]`. The customer
 *    has committed, and `07 C3` makes payment the gate that opens dispatch,
 *    not a state a date can take back.
 */
export async function expireOverdueThreads(): Promise<number> {
  return withAudit(SYSTEM_ACTOR, async (tx, log) => {
    const expired = await tx
      .update(quotationThreads)
      .set({ endState: "expired" })
      .where(
        and(
          isNull(quotationThreads.endState),
          isNull(quotationThreads.paymentConfirmedAt),
          exists(
            subquery
              .select({ one: sql`1` })
              .from(quotationVersions)
              .where(
                and(
                  eq(quotationVersions.threadId, quotationThreads.id),
                  ne(quotationVersions.status, "superseded"),
                  sql`${quotationVersions.validUntil} < current_date`,
                ),
              ),
          ),
        ),
      )
      .returning({ id: quotationThreads.id });

    for (const row of expired) {
      log({
        action: "quotation_thread.expired",
        entityType: "quotation_thread",
        entityId: row.id,
        before: { endState: null },
        after: { endState: "expired" },
      });
    }
    return expired.length;
  });
}

/* ------------------------------------------------------------------ *
 * Reads
 * ------------------------------------------------------------------ */

export type QuotationThreadListRow = {
  id: string;
  projectId: string;
  projectNameEn: string;
  projectNameAr: string | null;
  companyId: string;
  companyNameEn: string;
  companyNameAr: string | null;
  raisedByName: string;
  endState: QuotationThreadEndState | null;
  paymentConfirmedAt: Date | null;
  smacReference: string | null;
  versionNumber: number;
  versionStatus: QuotationVersionStatus;
  validUntil: string | null;
  grandTotal: string | null;
  createdAt: Date;
};

/** The live version of each thread: the one that is not superseded. */
function liveVersionFilter(): SQL {
  return ne(quotationVersions.status, "superseded");
}

function searchFilter(query: string | undefined): SQL | undefined {
  const trimmed = query?.trim();
  if (!trimmed) return undefined;
  const pattern = `%${trimmed}%`;
  return or(
    sql`${quotationVersions.smacReference} ilike ${pattern}`,
    sql`${projects.nameEn} ilike ${pattern}`,
    sql`${companies.nameEn} ilike ${pattern}`,
  );
}

export async function listQuotationThreads(
  session: AuthSession,
  options: {
    q?: string;
    projectId?: string;
    companyId?: string;
    page?: number;
  } = {},
): Promise<{
  rows: QuotationThreadListRow[];
  total: number;
  page: number;
}> {
  // Expiry happens on read `[16 §3]`; a list is the commonest read.
  await expireOverdueThreads();

  const page = Math.max(1, options.page ?? 1);
  const where = and(
    visibleQuotationThreadsFilter(session),
    liveVersionFilter(),
    searchFilter(options.q),
    options.projectId
      ? eq(quotationThreads.projectId, options.projectId)
      : undefined,
    options.companyId
      ? eq(quotationThreads.companyId, options.companyId)
      : undefined,
  );

  const base = () =>
    db
      .select({
        id: quotationThreads.id,
        projectId: quotationThreads.projectId,
        projectNameEn: projects.nameEn,
        projectNameAr: projects.nameAr,
        companyId: quotationThreads.companyId,
        companyNameEn: companies.nameEn,
        companyNameAr: companies.nameAr,
        raisedByName: users.name,
        endState: quotationThreads.endState,
        paymentConfirmedAt: quotationThreads.paymentConfirmedAt,
        smacReference: quotationVersions.smacReference,
        versionNumber: quotationVersions.versionNumber,
        versionStatus: quotationVersions.status,
        validUntil: quotationVersions.validUntil,
        grandTotal: quotationVersions.grandTotal,
        createdAt: quotationThreads.createdAt,
      })
      .from(quotationThreads)
      .innerJoin(
        quotationVersions,
        eq(quotationVersions.threadId, quotationThreads.id),
      )
      .innerJoin(projects, eq(quotationThreads.projectId, projects.id))
      .innerJoin(companies, eq(quotationThreads.companyId, companies.id))
      .innerJoin(users, eq(quotationThreads.raisedByUserId, users.id));

  const rows = await base()
    .where(where)
    .orderBy(desc(quotationThreads.createdAt))
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE);

  const [totals] = await db
    .select({ total: count() })
    .from(quotationThreads)
    .innerJoin(
      quotationVersions,
      eq(quotationVersions.threadId, quotationThreads.id),
    )
    .innerJoin(projects, eq(quotationThreads.projectId, projects.id))
    .innerJoin(companies, eq(quotationThreads.companyId, companies.id))
    .where(where);

  return { rows, total: totals?.total ?? 0, page };
}

export type QuotationProjectOption = {
  id: string;
  nameEn: string;
  nameAr: string | null;
  companies: { id: string; nameEn: string; nameAr: string | null }[];
  contacts: {
    id: string;
    companyId: string;
    nameEn: string;
    nameAr: string | null;
  }[];
};

/**
 * What the new-quotation form may choose from: the projects this identity can
 * see, each with its **live** company links and those companies' contacts.
 *
 * The company list is the project's links and nothing wider `[16 §6]`, and it
 * is built from the same rule the server then enforces — a dropdown that
 * offers what the action refuses is how a rule becomes a bug report.
 *
 * Three queries rather than one join, so a project with twenty contacts does
 * not arrive twenty times.
 */
export async function listQuotationProjectOptions(
  session: AuthSession,
): Promise<QuotationProjectOption[]> {
  const visibleProjects = await db
    .select({
      id: projects.id,
      nameEn: projects.nameEn,
      nameAr: projects.nameAr,
    })
    .from(projects)
    .where(visibleProjectsFilter(session))
    .orderBy(asc(projects.nameEn));

  if (visibleProjects.length === 0) return [];
  const projectIds = visibleProjects.map((row) => row.id);

  const links = await db
    .select({
      projectId: projectCompanies.projectId,
      companyId: companies.id,
      nameEn: companies.nameEn,
      nameAr: companies.nameAr,
    })
    .from(projectCompanies)
    .innerJoin(companies, eq(projectCompanies.companyId, companies.id))
    .where(
      and(
        inArray(projectCompanies.projectId, projectIds),
        isNull(projectCompanies.removedAt),
      ),
    )
    .orderBy(asc(companies.nameEn));

  const companyIds = [...new Set(links.map((row) => row.companyId))];
  const contactRows = companyIds.length
    ? await db
        .select({
          id: contacts.id,
          companyId: contacts.companyId,
          nameEn: contacts.nameEn,
          nameAr: contacts.nameAr,
        })
        .from(contacts)
        .where(inArray(contacts.companyId, companyIds))
        .orderBy(asc(contacts.nameEn))
    : [];

  return visibleProjects.map((project) => {
    const own = links.filter((link) => link.projectId === project.id);
    const ownCompanyIds = new Set(own.map((link) => link.companyId));
    return {
      ...project,
      companies: own.map(({ companyId, nameEn, nameAr }) => ({
        id: companyId,
        nameEn,
        nameAr,
      })),
      contacts: contactRows.filter((row) => ownCompanyIds.has(row.companyId)),
    };
  });
}

export type QuotationLineRow = {
  id: string;
  supplierId: string;
  classId: string;
  fireRatingId: string;
  colourId: string | null;
  customColour: string | null;
  thicknessId: string;
  widthM: string;
  lengthM: string;
  quantityPcs: string;
  sqm: string | null;
  unitPrice: string | null;
  lineTotal: string | null;
  vatRate: string | null;
  vatAmount: string | null;
  /** Generated from the parts, never stored `[08 D1]`. */
  displayName: string;
};

export type QuotationServiceLineRow = {
  id: string;
  serviceTypeId: string;
  serviceNameEn: string;
  serviceNameAr: string;
  quantity: string;
  unit: string;
  unitPrice: string | null;
  quotationLineId: string | null;
  /** Computed, like every other money figure `[16 §1]`. */
  lineTotal: string | null;
};

export type QuotationVersionDetail = QuotationVersion & {
  createdByName: string | null;
  lines: QuotationLineRow[];
  serviceLines: QuotationServiceLineRow[];
};

export type QuotationThreadDetail = QuotationThread & {
  projectNameEn: string;
  projectNameAr: string | null;
  companyNameEn: string;
  companyNameAr: string | null;
  contactNameEn: string | null;
  contactNameAr: string | null;
  raisedByName: string;
  cancelledByName: string | null;
  paymentConfirmedByName: string | null;
  versions: QuotationVersion[];
  live: QuotationVersionDetail;
  /**
   * Whether the viewer may open the project and company records themselves.
   *
   * Seeing a quotation shows you the project title, the company name and the
   * contact name — a quotation without them is unreadable — but it does not
   * grant access to those records `[16 §10]`. This is the coordinator's case
   * exactly: they process every quotation in the company and see none of the
   * customer detail behind it. False renders the name as plain text rather
   * than a link, the same way `listProjectCompanies` already does.
   */
  projectViewable: boolean;
  companyViewable: boolean;
};

async function loadLines(versionId: string): Promise<QuotationLineRow[]> {
  const rows = await db
    .select({
      line: quotationLines,
      supplierCode: productSuppliers.code,
      classCode: productClasses.code,
      fireRatingCode: productFireRatings.code,
      colourCode: productColours.code,
      thicknessMm: productThicknesses.thicknessMm,
      thicknessIsStandard: productThicknesses.isStandard,
    })
    .from(quotationLines)
    .innerJoin(
      productSuppliers,
      eq(quotationLines.supplierId, productSuppliers.id),
    )
    .innerJoin(productClasses, eq(quotationLines.classId, productClasses.id))
    .innerJoin(
      productFireRatings,
      eq(quotationLines.fireRatingId, productFireRatings.id),
    )
    .leftJoin(productColours, eq(quotationLines.colourId, productColours.id))
    .innerJoin(
      productThicknesses,
      eq(quotationLines.thicknessId, productThicknesses.id),
    )
    .where(eq(quotationLines.versionId, versionId))
    .orderBy(asc(quotationLines.createdAt));

  return rows.map(({ line, ...parts }) => ({
    id: line.id,
    supplierId: line.supplierId,
    classId: line.classId,
    fireRatingId: line.fireRatingId,
    colourId: line.colourId,
    customColour: line.customColour,
    thicknessId: line.thicknessId,
    widthM: line.widthM,
    lengthM: line.lengthM,
    quantityPcs: line.quantityPcs,
    sqm: line.sqm,
    unitPrice: line.unitPrice,
    lineTotal: line.lineTotal,
    vatRate: line.vatRate,
    vatAmount: line.vatAmount,
    displayName: productDisplayName({
      supplierCode: parts.supplierCode,
      classCode: parts.classCode,
      fireRatingCode: parts.fireRatingCode,
      colourCode: parts.colourCode,
      customColour: line.customColour,
      thicknessMm: parts.thicknessMm,
      thicknessIsStandard: parts.thicknessIsStandard,
    }),
  }));
}

async function loadServiceLines(
  versionId: string,
): Promise<QuotationServiceLineRow[]> {
  const rows = await db
    .select({
      line: quotationServiceLines,
      serviceNameEn: serviceTypes.nameEn,
      serviceNameAr: serviceTypes.nameAr,
    })
    .from(quotationServiceLines)
    .innerJoin(
      serviceTypes,
      eq(quotationServiceLines.serviceTypeId, serviceTypes.id),
    )
    .where(eq(quotationServiceLines.versionId, versionId))
    .orderBy(asc(quotationServiceLines.createdAt));

  return rows.map(({ line, serviceNameEn, serviceNameAr }) => ({
    id: line.id,
    serviceTypeId: line.serviceTypeId,
    serviceNameEn,
    serviceNameAr,
    quantity: line.quantity,
    unit: line.unit,
    unitPrice: line.unitPrice,
    quotationLineId: line.quotationLineId,
    lineTotal: line.unitPrice
      ? fromScaled(
          multiplyMoneyBySqm(
            toScaled(line.unitPrice, MONEY_SCALE),
            toScaled(line.quantity, SQM_SCALE),
          ),
          MONEY_SCALE,
        )
      : null,
  }));
}

async function loadVersionDetail(
  version: QuotationVersion,
): Promise<QuotationVersionDetail> {
  const [creator] = version.createdBy
    ? await db
        .select({ name: users.name })
        .from(users)
        .where(eq(users.id, version.createdBy))
        .limit(1)
    : [];

  const [lines, serviceLines] = await Promise.all([
    loadLines(version.id),
    loadServiceLines(version.id),
  ]);

  return {
    ...version,
    createdByName: creator?.name ?? null,
    lines,
    serviceLines,
  };
}

export async function getQuotationThread(
  session: AuthSession,
  id: string,
): Promise<QuotationThreadDetail | null> {
  await expireOverdueThreads();

  const [row] = await db
    .select({
      thread: quotationThreads,
      projectNameEn: projects.nameEn,
      projectNameAr: projects.nameAr,
      companyNameEn: companies.nameEn,
      companyNameAr: companies.nameAr,
      contactNameEn: contacts.nameEn,
      contactNameAr: contacts.nameAr,
      raisedByName: users.name,
    })
    .from(quotationThreads)
    .innerJoin(projects, eq(quotationThreads.projectId, projects.id))
    .innerJoin(companies, eq(quotationThreads.companyId, companies.id))
    .innerJoin(users, eq(quotationThreads.raisedByUserId, users.id))
    .leftJoin(contacts, eq(quotationThreads.contactId, contacts.id))
    .where(
      and(eq(quotationThreads.id, id), visibleQuotationThreadsFilter(session)),
    )
    .limit(1);

  if (!row) return null;

  const versions = await db
    .select()
    .from(quotationVersions)
    .where(eq(quotationVersions.threadId, id))
    .orderBy(desc(quotationVersions.versionNumber));

  const liveVersion = versions.find((v) => v.status !== "superseded");
  // A thread always has a live version — they are created together, in one
  // transaction. If this is ever null the data is broken, not the request.
  if (!liveVersion) throw new Error(`Thread ${id} has no live version`);

  const names = await namesFor([
    row.thread.cancelledByUserId,
    row.thread.paymentConfirmedByUserId,
  ]);

  const [projectViewable, companyViewable] = await Promise.all([
    canViewRecord(session, "project", row.thread.projectId),
    canViewRecord(session, "company", row.thread.companyId),
  ]);

  return {
    ...row.thread,
    projectNameEn: row.projectNameEn,
    projectNameAr: row.projectNameAr,
    companyNameEn: row.companyNameEn,
    companyNameAr: row.companyNameAr,
    contactNameEn: row.contactNameEn,
    contactNameAr: row.contactNameAr,
    raisedByName: row.raisedByName,
    cancelledByName: names.get(row.thread.cancelledByUserId ?? "") ?? null,
    paymentConfirmedByName:
      names.get(row.thread.paymentConfirmedByUserId ?? "") ?? null,
    versions,
    live: await loadVersionDetail(liveVersion),
    projectViewable,
    companyViewable,
  };
}

/** One query for the handful of user ids a detail screen names. */
async function namesFor(ids: (string | null)[]): Promise<Map<string, string>> {
  const wanted = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  if (wanted.length === 0) return new Map();
  const rows = await db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(or(...wanted.map((id) => eq(users.id, id))));
  return new Map(rows.map((row) => [row.id, row.name]));
}

/** A superseded version, read-only `[07 C2]`. */
export async function getQuotationVersion(
  session: AuthSession,
  threadId: string,
  versionId: string,
): Promise<QuotationVersionDetail | null> {
  if (!(await canViewRecord(session, "quotation_thread", threadId))) {
    return null;
  }
  const [version] = await db
    .select()
    .from(quotationVersions)
    .where(
      and(
        eq(quotationVersions.id, versionId),
        eq(quotationVersions.threadId, threadId),
      ),
    )
    .limit(1);
  if (!version) return null;
  return loadVersionDetail(version);
}

/* ------------------------------------------------------------------ *
 * Business rules, checked in the application layer
 * ------------------------------------------------------------------ */

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Log = (entry: AuditEntry) => void;

/**
 * The quotation's company must be one of the project's **live** links
 * `[16 §6]`.
 *
 * The project–company link is already the model of who is on a project
 * `[12 §5, §6]`, and a quotation addressed to a company with no connection to
 * the site is not something the business does. The refusal names the next step
 * rather than dead-ending: `quotations.errors.companyNotOnProject` tells the
 * rep to add the company to the project, where `14 §4`'s editor already lives.
 */
async function assertCompanyOnProject(
  projectId: string,
  companyId: string,
): Promise<void> {
  const [link] = await db
    .select({ id: projectCompanies.id })
    .from(projectCompanies)
    .where(
      and(
        eq(projectCompanies.projectId, projectId),
        eq(projectCompanies.companyId, companyId),
        isNull(projectCompanies.removedAt),
      ),
    )
    .limit(1);
  if (!link) {
    throw new RuleError("quotations.errors.companyNotOnProject", "companyId");
  }
}

/** A contact belongs to one company `[07 A2]`; it must be that company's. */
async function assertContactOnCompany(
  companyId: string,
  contactId: string | null,
): Promise<void> {
  if (!contactId) return;
  const [contact] = await db
    .select({ id: contacts.id })
    .from(contacts)
    .where(and(eq(contacts.id, contactId), eq(contacts.companyId, companyId)))
    .limit(1);
  if (!contact) {
    throw new RuleError("quotations.errors.contactNotOnCompany", "contactId");
  }
}

/**
 * `12 §12` — exactly one colour: a lookup code or a typed one, never both and
 * never neither. The database refuses the other cases; this names the field.
 *
 * Since `17 §2` every form writes the typed one, so in practice this is the
 * "you left the colour blank" message — hence `customColour` as the field.
 */
function assertColourChoice(line: QuotationLineInput): void {
  const chosen = [line.colourId, line.customColour].filter(Boolean).length;
  if (chosen !== 1) {
    throw new RuleError("quotations.errors.colourChoice", "customColour");
  }
}

/**
 * Lines may be edited only while the live version is still `requested`.
 *
 * Once the coordinator has issued it, the document exists in SMAC and a change
 * is a **new version**, not an edit `[07 C2]`. Returns the version row so the
 * caller does not read it twice.
 */
async function assertVersionEditable(
  tx: Tx,
  threadId: string,
): Promise<QuotationVersion> {
  const [thread] = await tx
    .select({ endState: quotationThreads.endState })
    .from(quotationThreads)
    .where(eq(quotationThreads.id, threadId))
    .limit(1);
  if (!thread) throw new RuleError("quotations.errors.notFound");
  if (thread.endState) {
    throw new RuleError("quotations.errors.threadClosed");
  }

  const version = await liveVersionOf(tx, threadId);
  if (version.status !== "requested") {
    throw new RuleError("quotations.errors.versionNotEditable");
  }
  return version;
}

async function liveVersionOf(
  tx: Tx,
  threadId: string,
): Promise<QuotationVersion> {
  const [version] = await tx
    .select()
    .from(quotationVersions)
    .where(
      and(
        eq(quotationVersions.threadId, threadId),
        ne(quotationVersions.status, "superseded"),
      ),
    )
    .orderBy(desc(quotationVersions.versionNumber))
    .limit(1);
  if (!version) throw new RuleError("quotations.errors.notFound");
  return version;
}

/** Visibility grants edit `[14 §2, §3]` — the same question the read asks. */
async function assertThreadVisible(
  session: AuthSession,
  threadId: string,
): Promise<void> {
  if (!(await canViewRecord(session, "quotation_thread", threadId))) {
    throw new RuleError("quotations.errors.notFound");
  }
}

/**
 * The coordinator's acts: issuing, returning for edit, accepting, rejecting
 * and cancelling.
 *
 * All five are gated on the one existing flag, `can_approve_quotation`, which
 * the seed grants to Sales Coordinator and Super Admin and to nobody else —
 * which is exactly "coordinator-only" `[07 C4]`, `[10 §8]`, `[04 flow 10]`,
 * with no role name in code and no invented flag. The executive deliberately
 * does not hold it `[12 §3]`.
 */
async function assertCoordinator(
  session: AuthSession,
  threadId: string,
): Promise<void> {
  await assertThreadVisible(session, threadId);
  if (!can(session, "canApproveQuotation")) {
    throw new RuleError("quotations.errors.coordinatorOnly");
  }
}

/* ------------------------------------------------------------------ *
 * Totals — recomputed after every line change `[16 §1]`
 * ------------------------------------------------------------------ */

/**
 * Recompute and store the four version totals.
 *
 * Derived columns, so they get no audit entry of their own: they are a pure
 * function of the line change that is already logged in this same
 * transaction, and a second entry would say nothing the first does not imply.
 */
async function recomputeVersionTotals(tx: Tx, versionId: string): Promise<void> {
  const lines = await tx
    .select({
      sqm: quotationLines.sqm,
      lineTotal: quotationLines.lineTotal,
      vatAmount: quotationLines.vatAmount,
    })
    .from(quotationLines)
    .where(eq(quotationLines.versionId, versionId));

  const services = await tx
    .select({
      quantity: quotationServiceLines.quantity,
      unitPrice: quotationServiceLines.unitPrice,
    })
    .from(quotationServiceLines)
    .where(eq(quotationServiceLines.versionId, versionId));

  // Service square metres are tracked separately and never enter total_sqm —
  // targets measure cladding dispatched, not fabrication `[08 D4]`, `[12 §10]`.
  let totalSqm = ZERO;
  let totalExclVat = ZERO;
  let totalVat = ZERO;

  for (const line of lines) {
    if (line.sqm) totalSqm += toScaled(line.sqm, SQM_SCALE);
    if (line.lineTotal) totalExclVat += toScaled(line.lineTotal, MONEY_SCALE);
    if (line.vatAmount) totalVat += toScaled(line.vatAmount, MONEY_SCALE);
  }

  // Services carry no VAT columns of their own `[09 §5.5]`, but they are line
  // items on the same SMAC quotation and that form taxes every line `[08 A]`.
  // The default rate applies rather than leaving them untaxed `[16 §1]`.
  const serviceVatRate = toScaled(DEFAULT_VAT_RATE, MONEY_SCALE);
  for (const service of services) {
    if (!service.unitPrice) continue;
    const amount = multiplyMoneyBySqm(
      toScaled(service.unitPrice, MONEY_SCALE),
      toScaled(service.quantity, SQM_SCALE),
    );
    totalExclVat += amount;
    totalVat += applyPercent(amount, serviceVatRate);
  }

  await tx
    .update(quotationVersions)
    .set({
      totalSqm: fromScaled(totalSqm, SQM_SCALE),
      totalExclVat: fromScaled(totalExclVat, MONEY_SCALE),
      totalVat: fromScaled(totalVat, MONEY_SCALE),
      grandTotal: fromScaled(totalExclVat + totalVat, MONEY_SCALE),
    })
    .where(eq(quotationVersions.id, versionId));
}

/**
 * The money a product line carries.
 *
 * `sqm` is a generated column, so it does not exist until the row does — the
 * arithmetic is repeated here rather than read back, which is also what lets
 * an insert and its totals land in one round trip. It is the same expression
 * the database uses: `quantity_pcs × width_m × length_m` `[08 D2]`.
 *
 * **An unpriced line is not a zero-priced line** `[16 §1]`: with no unit price
 * both money columns stay null and the line contributes nothing to the totals.
 */
function lineMoney(input: QuotationLineInput): {
  lineTotal: string | null;
  vatAmount: string | null;
} {
  if (!input.unitPrice) return { lineTotal: null, vatAmount: null };

  const sqm = divideRounded(
    toScaled(input.quantityPcs, SQM_SCALE) *
      toScaled(input.widthM, SQM_SCALE) *
      toScaled(input.lengthM, SQM_SCALE),
    pow10(SQM_SCALE * 2),
  );
  const lineTotal = multiplyMoneyBySqm(
    toScaled(input.unitPrice, MONEY_SCALE),
    sqm,
  );
  const vatAmount = input.vatRate
    ? applyPercent(lineTotal, toScaled(input.vatRate, MONEY_SCALE))
    : null;

  return {
    lineTotal: fromScaled(lineTotal, MONEY_SCALE),
    vatAmount: vatAmount === null ? null : fromScaled(vatAmount, MONEY_SCALE),
  };
}

/* ------------------------------------------------------------------ *
 * Inputs
 * ------------------------------------------------------------------ */

export type QuotationThreadInput = {
  projectId: string;
  companyId: string;
  contactId: string | null;
};

export type QuotationVersionInput = {
  validUntil: string | null;
  deliveryPeriod: string | null;
  paymentMethod: string | null;
  shipmentTerms: string | null;
};

export type QuotationLineInput = {
  supplierId: string;
  classId: string;
  fireRatingId: string;
  colourId: string | null;
  customColour: string | null;
  thicknessId: string;
  widthM: string;
  lengthM: string;
  quantityPcs: string;
  unitPrice: string | null;
  vatRate: string | null;
};

export type ServiceLineInput = {
  serviceTypeId: string;
  quantity: string;
  unitPrice: string | null;
  quotationLineId: string | null;
};

/* ------------------------------------------------------------------ *
 * Mutations
 * ------------------------------------------------------------------ */

async function insertLine(
  tx: Tx,
  log: Log,
  versionId: string,
  input: QuotationLineInput,
): Promise<string> {
  const [row] = await tx
    .insert(quotationLines)
    .values({
      versionId,
      supplierId: input.supplierId,
      classId: input.classId,
      fireRatingId: input.fireRatingId,
      colourId: input.colourId,
      customColour: input.customColour,
      thicknessId: input.thicknessId,
      // `12 §11` — quotation lines are sheets only; the application writes it
      // rather than a CHECK, because this is a current scope boundary on one
      // module and the column is shared with production `[13 §2]`.
      formFactor: "sheet",
      widthM: input.widthM,
      lengthM: input.lengthM,
      quantityPcs: input.quantityPcs,
      unitPrice: input.unitPrice,
      vatRate: input.vatRate,
      ...lineMoney(input),
    })
    .returning();

  log({
    action: "quotation_line.added",
    entityType: "quotation_line",
    entityId: row.id,
    after: row,
  });
  return row.id;
}

async function insertServiceLine(
  tx: Tx,
  log: Log,
  versionId: string,
  input: ServiceLineInput,
): Promise<void> {
  const [row] = await tx
    .insert(quotationServiceLines)
    .values({
      versionId,
      serviceTypeId: input.serviceTypeId,
      quantity: input.quantity,
      // All services are priced per square metre `[12 §10]`; the application
      // writes it, for the same reason `form_factor` is written `[13 §2]`.
      unit: "sqm",
      unitPrice: input.unitPrice,
      quotationLineId: input.quotationLineId,
    })
    .returning();

  log({
    action: "quotation_service_line.added",
    entityType: "quotation_service_line",
    entityId: row.id,
    after: row,
  });
}

/**
 * The rep raises the request `[04 flow 6]`. **That request is version 1**:
 * status `requested`, origin `initial_request`, no SMAC reference `[10 §4]`.
 *
 * Thread, version and every line land in one transaction — a thread without a
 * live version is not a state the rest of this module can read.
 */
export async function createQuotationThread(
  session: AuthSession,
  thread: QuotationThreadInput,
  version: QuotationVersionInput,
  lines: QuotationLineInput[],
  serviceLines: ServiceLineInput[],
): Promise<QuotationThread> {
  // FACET requires a project even though SMAC does not `[08 C3]`, and the
  // project is what visibility hangs off `[11 §2]`.
  if (!(await canViewRecord(session, "project", thread.projectId))) {
    throw new RuleError("quotations.errors.projectNotVisible", "projectId");
  }
  await assertCompanyOnProject(thread.projectId, thread.companyId);
  await assertContactOnCompany(thread.companyId, thread.contactId);

  if (lines.length === 0) {
    throw new RuleError("quotations.errors.atLeastOneLine");
  }
  lines.forEach(assertColourChoice);

  return withAudit(session.actor, async (tx, log) => {
    const [created] = await tx
      .insert(quotationThreads)
      .values({
        projectId: thread.projectId,
        companyId: thread.companyId,
        contactId: thread.contactId,
        raisedByUserId: session.user.id,
      })
      .returning();

    log({
      action: "quotation_thread.created",
      entityType: "quotation_thread",
      entityId: created.id,
      after: created,
    });

    const [firstVersion] = await tx
      .insert(quotationVersions)
      .values({
        threadId: created.id,
        versionNumber: 1,
        origin: "initial_request",
        status: "requested",
        validUntil: version.validUntil,
        deliveryPeriod: version.deliveryPeriod,
        paymentMethod: version.paymentMethod,
        shipmentTerms: version.shipmentTerms,
        createdBy: session.user.id,
      })
      .returning();

    log({
      action: "quotation_version.created",
      entityType: "quotation_version",
      entityId: firstVersion.id,
      after: firstVersion,
    });

    for (const line of lines) {
      await insertLine(tx, log, firstVersion.id, line);
    }
    for (const service of serviceLines) {
      await insertServiceLine(tx, log, firstVersion.id, service);
    }
    await recomputeVersionTotals(tx, firstVersion.id);

    return created;
  });
}

export async function addQuotationLine(
  session: AuthSession,
  threadId: string,
  input: QuotationLineInput,
): Promise<void> {
  await assertThreadVisible(session, threadId);
  assertColourChoice(input);

  await withAudit(session.actor, async (tx, log) => {
    const version = await assertVersionEditable(tx, threadId);
    await insertLine(tx, log, version.id, input);
    await recomputeVersionTotals(tx, version.id);
  });
}

export async function updateQuotationLine(
  session: AuthSession,
  threadId: string,
  lineId: string,
  input: QuotationLineInput,
): Promise<void> {
  await assertThreadVisible(session, threadId);
  assertColourChoice(input);

  await withAudit(session.actor, async (tx, log) => {
    const version = await assertVersionEditable(tx, threadId);

    const [before] = await tx
      .select()
      .from(quotationLines)
      .where(
        and(
          eq(quotationLines.id, lineId),
          eq(quotationLines.versionId, version.id),
        ),
      )
      .limit(1);
    if (!before) throw new RuleError("quotations.errors.notFound");

    const [after] = await tx
      .update(quotationLines)
      .set({ ...input, ...lineMoney(input) })
      .where(eq(quotationLines.id, lineId))
      .returning();

    log({
      action: "quotation_line.updated",
      entityType: "quotation_line",
      entityId: lineId,
      before,
      after,
    });

    await recomputeVersionTotals(tx, version.id);
  });
}

/**
 * Remove a line.
 *
 * This is the one place FACET deletes a row, and it is not a business event
 * being erased: a line on a version that has never left `requested` is a
 * half-finished draft, not history. History is the superseded versions
 * `[07 C2]`, which are never touched. The removal is still audited with the
 * full row in `before`.
 */
export async function removeQuotationLine(
  session: AuthSession,
  threadId: string,
  lineId: string,
): Promise<void> {
  await assertThreadVisible(session, threadId);

  await withAudit(session.actor, async (tx, log) => {
    const version = await assertVersionEditable(tx, threadId);

    const remaining = await tx
      .select({ id: quotationLines.id })
      .from(quotationLines)
      .where(eq(quotationLines.versionId, version.id));

    const target = remaining.find((row) => row.id === lineId);
    if (!target) throw new RuleError("quotations.errors.notFound");
    if (remaining.length <= 1) {
      throw new RuleError("quotations.errors.lastLine");
    }

    const [before] = await tx
      .select()
      .from(quotationLines)
      .where(eq(quotationLines.id, lineId))
      .limit(1);

    // A service line may point at this product line `[08 D4]`; clear the
    // reference rather than let the foreign key refuse the delete.
    await tx
      .update(quotationServiceLines)
      .set({ quotationLineId: null })
      .where(eq(quotationServiceLines.quotationLineId, lineId));

    await tx.delete(quotationLines).where(eq(quotationLines.id, lineId));

    log({
      action: "quotation_line.removed",
      entityType: "quotation_line",
      entityId: lineId,
      before,
    });

    await recomputeVersionTotals(tx, version.id);
  });
}

export async function addServiceLine(
  session: AuthSession,
  threadId: string,
  input: ServiceLineInput,
): Promise<void> {
  await assertThreadVisible(session, threadId);

  await withAudit(session.actor, async (tx, log) => {
    const version = await assertVersionEditable(tx, threadId);
    await insertServiceLine(tx, log, version.id, input);
    await recomputeVersionTotals(tx, version.id);
  });
}

export async function updateServiceLine(
  session: AuthSession,
  threadId: string,
  lineId: string,
  input: ServiceLineInput,
): Promise<void> {
  await assertThreadVisible(session, threadId);

  await withAudit(session.actor, async (tx, log) => {
    const version = await assertVersionEditable(tx, threadId);

    const [before] = await tx
      .select()
      .from(quotationServiceLines)
      .where(
        and(
          eq(quotationServiceLines.id, lineId),
          eq(quotationServiceLines.versionId, version.id),
        ),
      )
      .limit(1);
    if (!before) throw new RuleError("quotations.errors.notFound");

    const [after] = await tx
      .update(quotationServiceLines)
      .set({
        serviceTypeId: input.serviceTypeId,
        quantity: input.quantity,
        unitPrice: input.unitPrice,
        quotationLineId: input.quotationLineId,
      })
      .where(eq(quotationServiceLines.id, lineId))
      .returning();

    log({
      action: "quotation_service_line.updated",
      entityType: "quotation_service_line",
      entityId: lineId,
      before,
      after,
    });

    await recomputeVersionTotals(tx, version.id);
  });
}

export async function removeServiceLine(
  session: AuthSession,
  threadId: string,
  lineId: string,
): Promise<void> {
  await assertThreadVisible(session, threadId);

  await withAudit(session.actor, async (tx, log) => {
    const version = await assertVersionEditable(tx, threadId);

    const [before] = await tx
      .select()
      .from(quotationServiceLines)
      .where(
        and(
          eq(quotationServiceLines.id, lineId),
          eq(quotationServiceLines.versionId, version.id),
        ),
      )
      .limit(1);
    if (!before) throw new RuleError("quotations.errors.notFound");

    await tx
      .delete(quotationServiceLines)
      .where(eq(quotationServiceLines.id, lineId));

    log({
      action: "quotation_service_line.removed",
      entityType: "quotation_service_line",
      entityId: lineId,
      before,
    });

    await recomputeVersionTotals(tx, version.id);
  });
}

/* ------------------------------------------------------------------ *
 * The chain: issue → return for edit → revise → accept / reject / cancel
 * ------------------------------------------------------------------ */

/**
 * The coordinator has created the real quotation in SMAC and records its
 * reference `[04 flow 7, 11]`, `[10 §4]`. `requested → issued`.
 *
 * The reference is typed by a human and can be wrong `[04 A2]`, which is what
 * `smac_reference_verification` is for. FACET never generates the number — not
 * the first one, and not the `RE` form on a revision.
 */
export async function issueVersion(
  session: AuthSession,
  threadId: string,
  input: { smacReference: string; verification: SmacVerification },
): Promise<void> {
  await assertCoordinator(session, threadId);

  await withAudit(session.actor, async (tx, log) => {
    const version = await liveVersionOf(tx, threadId);
    if (version.status !== "requested") {
      throw new RuleError("quotations.errors.alreadyIssued");
    }

    const [after] = await tx
      .update(quotationVersions)
      .set({
        smacReference: input.smacReference,
        smacReferenceVerification: input.verification,
        status: "issued",
      })
      .where(eq(quotationVersions.id, version.id))
      .returning();

    log({
      action: "quotation_version.issued",
      entityType: "quotation_version",
      entityId: version.id,
      before: {
        status: version.status,
        smacReference: version.smacReference,
        smacReferenceVerification: version.smacReferenceVerification,
      },
      after: {
        status: after.status,
        smacReference: after.smacReference,
        smacReferenceVerification: after.smacReferenceVerification,
      },
    });
  });
}

/**
 * The coordinator sends it back for an edit round `[04 flow 10]`.
 *
 * The version stays `requested` and editable — this is a counter, not a state
 * change. The rep fixes the lines and the coordinator issues it.
 */
export async function returnForEdit(
  session: AuthSession,
  threadId: string,
): Promise<void> {
  await assertCoordinator(session, threadId);

  await withAudit(session.actor, async (tx, log) => {
    const version = await liveVersionOf(tx, threadId);
    if (version.status !== "requested") {
      throw new RuleError("quotations.errors.versionNotEditable");
    }

    const [after] = await tx
      .update(quotationVersions)
      .set({ returnForEditRound: version.returnForEditRound + 1 })
      .where(eq(quotationVersions.id, version.id))
      .returning();

    log({
      action: "quotation_version.returned_for_edit",
      entityType: "quotation_version",
      entityId: version.id,
      before: { returnForEditRound: version.returnForEditRound },
      after: { returnForEditRound: after.returnForEditRound },
    });
  });
}

/**
 * A revision — version N+1, carrying forward the lines `[07 C2]`.
 *
 * Three origins, three callers, one mechanism:
 *  - `rep_change_request` — the rep asks for a change;
 *  - `coordinator_direct_edit` — the coordinator changes it on a call;
 *  - `expiry_revision` — `07 C7`'s "revise if price or materials changed".
 *
 * The new version starts `requested` with **no SMAC reference**: the `RE`
 * number is typed when the coordinator issues it, like every other SMAC link
 * `[04 A2]`. The previous version becomes `superseded` in the same
 * transaction, which is what keeps "only the latest is live" true without a
 * database constraint no document asked for.
 */
export async function createRevision(
  session: AuthSession,
  threadId: string,
  origin: Exclude<QuotationVersionOrigin, "initial_request">,
): Promise<void> {
  if (origin === "coordinator_direct_edit") {
    await assertCoordinator(session, threadId);
  } else {
    await assertThreadVisible(session, threadId);
  }

  await withAudit(session.actor, async (tx, log) => {
    const [thread] = await tx
      .select()
      .from(quotationThreads)
      .where(eq(quotationThreads.id, threadId))
      .limit(1);
    if (!thread) throw new RuleError("quotations.errors.notFound");

    // An expired thread may be revised — that is one of `07 C7`'s two
    // follow-on actions. Any other end state is final.
    if (thread.endState && thread.endState !== "expired") {
      throw new RuleError("quotations.errors.threadClosed");
    }

    const previous = await liveVersionOf(tx, threadId);

    await tx
      .update(quotationVersions)
      .set({ status: "superseded" })
      .where(eq(quotationVersions.id, previous.id));
    log({
      action: "quotation_version.superseded",
      entityType: "quotation_version",
      entityId: previous.id,
      before: { status: previous.status },
      after: { status: "superseded" },
    });

    // Carry the validity forward only while it still has time to run. A date
    // already in the past is not an offer window, and copying it would let the
    // expiry sweep re-expire the new version on the very next read — which
    // would make `07 C7`'s "revise" no remedy for expiry at all, when revise
    // and extend are meant to be the two alternatives. Null leaves the new
    // version with no expiry until someone sets one.
    const carriedValidity =
      previous.validUntil && previous.validUntil >= today()
        ? previous.validUntil
        : null;

    const [next] = await tx
      .insert(quotationVersions)
      .values({
        threadId,
        versionNumber: previous.versionNumber + 1,
        origin,
        status: "requested",
        validUntil: carriedValidity,
        deliveryPeriod: previous.deliveryPeriod,
        paymentMethod: previous.paymentMethod,
        shipmentTerms: previous.shipmentTerms,
        createdBy: session.user.id,
      })
      .returning();
    log({
      action: "quotation_version.created",
      entityType: "quotation_version",
      entityId: next.id,
      after: next,
    });

    // Carry the lines forward. A revision starts from what was quoted, not
    // from an empty form — the change is usually one price or one colour.
    const lines = await tx
      .select()
      .from(quotationLines)
      .where(eq(quotationLines.versionId, previous.id))
      .orderBy(asc(quotationLines.createdAt));
    const idMap = new Map<string, string>();
    for (const line of lines) {
      const [copy] = await tx
        .insert(quotationLines)
        .values({
          versionId: next.id,
          supplierId: line.supplierId,
          classId: line.classId,
          fireRatingId: line.fireRatingId,
          colourId: line.colourId,
          customColour: line.customColour,
          thicknessId: line.thicknessId,
          formFactor: line.formFactor,
          widthM: line.widthM,
          lengthM: line.lengthM,
          quantityPcs: line.quantityPcs,
          unitPrice: line.unitPrice,
          vatRate: line.vatRate,
          lineTotal: line.lineTotal,
          vatAmount: line.vatAmount,
        })
        .returning();
      idMap.set(line.id, copy.id);
    }

    const services = await tx
      .select()
      .from(quotationServiceLines)
      .where(eq(quotationServiceLines.versionId, previous.id))
      .orderBy(asc(quotationServiceLines.createdAt));
    for (const service of services) {
      await tx.insert(quotationServiceLines).values({
        versionId: next.id,
        serviceTypeId: service.serviceTypeId,
        quantity: service.quantity,
        unit: service.unit,
        unitPrice: service.unitPrice,
        // Re-point at the copied line, never at the superseded version's.
        quotationLineId: service.quotationLineId
          ? (idMap.get(service.quotationLineId) ?? null)
          : null,
      });
    }

    // Revising is `07 C7`'s answer to expiry, so it clears the expired state.
    if (thread.endState === "expired") {
      await tx
        .update(quotationThreads)
        .set({ endState: null })
        .where(eq(quotationThreads.id, threadId));
      log({
        action: "quotation_thread.revived",
        entityType: "quotation_thread",
        entityId: threadId,
        before: { endState: "expired" },
        after: { endState: null },
      });
    }

    await recomputeVersionTotals(tx, next.id);
  });
}

/**
 * `07 C7`'s other follow-on action: **extend if nothing has changed.**
 *
 * Extending clears an `expired` end state, because the record is live again.
 * If price or materials changed it is a revision instead, not this.
 */
export async function extendValidity(
  session: AuthSession,
  threadId: string,
  validUntil: string,
): Promise<void> {
  await assertThreadVisible(session, threadId);

  await withAudit(session.actor, async (tx, log) => {
    const [thread] = await tx
      .select()
      .from(quotationThreads)
      .where(eq(quotationThreads.id, threadId))
      .limit(1);
    if (!thread) throw new RuleError("quotations.errors.notFound");
    if (thread.endState && thread.endState !== "expired") {
      throw new RuleError("quotations.errors.threadClosed");
    }

    const version = await liveVersionOf(tx, threadId);
    await tx
      .update(quotationVersions)
      .set({ validUntil })
      .where(eq(quotationVersions.id, version.id));
    log({
      action: "quotation_version.validity_extended",
      entityType: "quotation_version",
      entityId: version.id,
      before: { validUntil: version.validUntil },
      after: { validUntil },
    });

    if (thread.endState === "expired") {
      await tx
        .update(quotationThreads)
        .set({ endState: null })
        .where(eq(quotationThreads.id, threadId));
      log({
        action: "quotation_thread.revived",
        entityType: "quotation_thread",
        entityId: threadId,
        before: { endState: "expired" },
        after: { endState: null },
      });
    }
  });
}

/** Shared body for the three coordinator end states. */
async function setEndState(
  session: AuthSession,
  threadId: string,
  endState: QuotationThreadEndState,
  extra: Partial<typeof quotationThreads.$inferInsert> = {},
): Promise<void> {
  await assertCoordinator(session, threadId);

  await withAudit(session.actor, async (tx, log) => {
    const [before] = await tx
      .select()
      .from(quotationThreads)
      .where(eq(quotationThreads.id, threadId))
      .limit(1);
    if (!before) throw new RuleError("quotations.errors.notFound");
    // Expired is not final — `07 C7` allows extend or revise. Everything else
    // is, and re-deciding a decided quotation is a revision, not an edit.
    if (before.endState && before.endState !== "expired") {
      throw new RuleError("quotations.errors.threadClosed");
    }

    const [after] = await tx
      .update(quotationThreads)
      .set({ endState, ...extra })
      .where(eq(quotationThreads.id, threadId))
      .returning();

    log({
      action: `quotation_thread.${endState}`,
      entityType: "quotation_thread",
      entityId: threadId,
      before: { endState: before.endState },
      after: { endState: after.endState },
    });
  });
}

/**
 * The coordinator accepts, after obtaining the signatures `[04 flow 10]`,
 * `[07 C3]`, `[08 C2]`, `[12 §13]` — not the rep.
 *
 * **This is internal approval, not a won deal** `[16 §5]`. The customer
 * commits later, at `payment_confirmed_at` and `accepted_for_processing_at`.
 * Nothing that counts, ranks or forecasts may read this end state as "bought"
 * — `07 D4`'s conversion measure and `10 §11`'s `quotations_accepted` are the
 * two places that will be tempting.
 */
export async function acceptThread(
  session: AuthSession,
  threadId: string,
): Promise<void> {
  await setEndState(session, threadId, "accepted");
}

/** Rejection belongs to the quotation; loss belongs to the project `[07 C5]`. */
export async function rejectThread(
  session: AuthSession,
  threadId: string,
): Promise<void> {
  await setEndState(session, threadId, "rejected");
}

/**
 * Cancellation is coordinator-only `[07 C4]` and **a written reason is
 * required** `[10 §8]`: it kills a signed quotation, and the reason is the one
 * field that makes the audit entry worth reading.
 */
export async function cancelThread(
  session: AuthSession,
  threadId: string,
  reason: string,
): Promise<void> {
  if (!reason.trim()) {
    throw new RuleError(
      "quotations.errors.cancellationReasonRequired",
      "cancellationReason",
    );
  }
  await setEndState(session, threadId, "cancelled", {
    cancelledByUserId: session.user.id,
    cancelledAt: new Date(),
    cancellationReason: reason.trim(),
  });
}

/**
 * The rep ticks payment confirmed, with a date `[07 C3]`.
 *
 * The rep receives the payment, which is why it is theirs and not the
 * coordinator's. No permission flag exists for it and none is invented:
 * visibility grants edit `[14 §2]`, and the audit log plus
 * `payment_confirmed_by_user_id` record who actually did it.
 *
 * This is not an amounts ledger. Its value is the gate: dispatch is blocked
 * until it is set — enforced in Slice 3, where dispatch is built.
 */
export async function confirmPayment(
  session: AuthSession,
  threadId: string,
  confirmedOn: string,
): Promise<void> {
  await assertThreadVisible(session, threadId);

  await withAudit(session.actor, async (tx, log) => {
    const [before] = await tx
      .select()
      .from(quotationThreads)
      .where(eq(quotationThreads.id, threadId))
      .limit(1);
    if (!before) throw new RuleError("quotations.errors.notFound");
    if (
      before.endState === "cancelled" ||
      before.endState === "rejected"
    ) {
      throw new RuleError("quotations.errors.threadClosed");
    }

    const [after] = await tx
      .update(quotationThreads)
      .set({
        paymentConfirmedByUserId: session.user.id,
        // A date the rep types, read in Riyadh, stored as an instant at the
        // start of that day so the column keeps meaning one calendar day.
        paymentConfirmedAt: new Date(`${confirmedOn}T00:00:00+03:00`),
      })
      .where(eq(quotationThreads.id, threadId))
      .returning();

    log({
      action: "quotation_thread.payment_confirmed",
      entityType: "quotation_thread",
      entityId: threadId,
      before: { paymentConfirmedAt: before.paymentConfirmedAt },
      after: {
        paymentConfirmedAt: after.paymentConfirmedAt,
        paymentConfirmedByUserId: after.paymentConfirmedByUserId,
      },
    });
  });
}

/**
 * The rep marks it accepted for processing `[04 flow 13]` — **after** payment
 * `[04 flow 12]`. This, with payment, is where the customer commits `[16 §5]`.
 */
export async function markAcceptedForProcessing(
  session: AuthSession,
  threadId: string,
): Promise<void> {
  await assertThreadVisible(session, threadId);

  await withAudit(session.actor, async (tx, log) => {
    const [before] = await tx
      .select()
      .from(quotationThreads)
      .where(eq(quotationThreads.id, threadId))
      .limit(1);
    if (!before) throw new RuleError("quotations.errors.notFound");
    if (!before.paymentConfirmedAt) {
      throw new RuleError("quotations.errors.paymentFirst");
    }
    if (before.acceptedForProcessingAt) return; // idempotent

    const [after] = await tx
      .update(quotationThreads)
      .set({ acceptedForProcessingAt: new Date() })
      .where(eq(quotationThreads.id, threadId))
      .returning();

    log({
      action: "quotation_thread.accepted_for_processing",
      entityType: "quotation_thread",
      entityId: threadId,
      before: { acceptedForProcessingAt: null },
      after: { acceptedForProcessingAt: after.acceptedForProcessingAt },
    });
  });
}
