/**
 * Rep-written reports — `09 §8.2`, reshaped and given its purpose by `20`.
 *
 * **Why a rep is asked to type anything at all `[20 §1]`:** so customer
 * knowledge becomes company property rather than personal property. `19` moves
 * the pipeline when someone leaves; without this table the relationship history
 * moves with none of it. Every rule below is settled against that test.
 *
 * The rules this module owns, each cited:
 *
 *  1. **Two entry types `[20 §2]`.** An interaction is anchored to a company,
 *     which is required; the contact and project are optional and must belong
 *     to that company. A field note has no company at all — a category, an
 *     optional city and free text — and touches no customer timeline.
 *  2. **A channel, exactly one outcome, and free text that is always there
 *     `[20 §3]`.** There is no "asked for a quotation" outcome: qualification
 *     is derived from a real thread `[10 §1]` and the form offers a link that
 *     raises one.
 *  3. **Signals are not outcomes `[20 §4]`.** Optional, many per report, with
 *     an optional reference so they aggregate, and allowed on any report rather
 *     than only a loss.
 *  4. **`on_hold` carries a date and suppresses follow-ups until it passes
 *     `[20 §5]`.** Nothing is written to the company: the suppression is
 *     derived on read, so correcting the report corrects the suppression.
 *  5. **A report is ONE row `[20 §9]`.** Editing is an UPDATE and must never
 *     double-count. The anchor is editable too — a report filed against the
 *     wrong company is corrected, not abandoned, because FACET does not delete.
 *  6. **Only the author, and only on the day they wrote it `[S39]`.** After
 *     that it stands. The clock is `created_at` in Riyadh, never `report_date`:
 *     a rep may backdate the day a visit happened, and a window keyed on that
 *     could be reopened by editing the date the report claims to cover.
 *  7. **Two halves, with different visibility `[S38]`.** *What happened* —
 *     channel, outcome, project, signals — goes to whoever can see the record,
 *     including through a share. *The note* goes to its author and to anyone
 *     who sees all reps. `listColumns` therefore does not name `narrative`;
 *     `withNotes` fetches it separately for the rows that may carry it.
 *  8. **No permission flag `[20 §13]`.** Every rep logs; the only identity
 *     question is authorship on edit. Reads compose
 *     `visibleRepReportsFilter` — a report follows its anchor `[20 §10]`,
 *     except its author, who keeps their own `[S40]`.
 *
 * Every read composes a filter from `authz`; every write goes through
 * `withAudit`, which owns the transaction.
 *
 * Replacing a report's signal set is the one place this phase **deletes** a
 * row. A signal is a component of its parent, not history — the same reading
 * under which `quotations.ts` deletes a line off an unissued version — and
 * `20 §9`'s "never double-count" requires it.
 */

import { and, asc, count, desc, eq, gte, ilike, inArray, isNull, lte, or, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  cities,
  companies,
  contacts,
  projectCompanies,
  projects,
  repReportSignals,
  repReports,
  users,
} from "@/db/schema";
import { withAudit } from "@/lib/audit";
import {
  canOpenRecord,
  canViewRecord,
  readableNoteFilter,
  visibleRepReportsFilter,
  type AuthSession,
} from "@/lib/authz";
import {
  FIELD_NOTE_CATEGORIES,
  ON_HOLD_OUTCOME,
  REPORT_CHANNELS,
  REPORT_ENTRY_TYPES,
  REPORT_OUTCOMES,
  REPORT_SIGNALS,
  SIGNAL_REFERENCE_MAX,
  type FieldNoteCategory,
  type ReportChannel,
  type ReportEntryType,
  type ReportOutcome,
  type ReportSignal,
  type SameValues,
} from "@/lib/enums";
import { RuleError } from "@/lib/validation";

export type RepReport = typeof repReports.$inferSelect;

/** Compile-time proof that `enums.ts` still matches the database. */
export type EntryTypeMatchesSchema = SameValues<
  ReportEntryType,
  RepReport["entryType"]
>;
export type ChannelMatchesSchema = SameValues<
  ReportChannel,
  NonNullable<RepReport["channel"]>
>;
export type OutcomeMatchesSchema = SameValues<
  ReportOutcome,
  NonNullable<RepReport["outcome"]>
>;
export type CategoryMatchesSchema = SameValues<
  FieldNoteCategory,
  NonNullable<RepReport["category"]>
>;
export type SignalMatchesSchema = SameValues<
  ReportSignal,
  (typeof repReportSignals.$inferSelect)["signal"]
>;

export {
  FIELD_NOTE_CATEGORIES,
  REPORT_CHANNELS,
  REPORT_ENTRY_TYPES,
  REPORT_OUTCOMES,
  REPORT_SIGNALS,
};
export type { FieldNoteCategory, ReportChannel, ReportEntryType, ReportOutcome, ReportSignal };

const PAGE_SIZE = 25;

/** A signal and, optionally, the thing it points at `[20 §4]`. */
export type SignalInput = {
  signal: ReportSignal;
  reference: string | null;
};

/**
 * Everything a rep may type on the log form. Primitives only, and dates stay
 * `YYYY-MM-DD` strings end to end — never a `Date` into the data layer.
 */
export type ReportInput = {
  entryType: ReportEntryType;
  reportDate: string;
  narrative: string;
  /** Interaction only, and then required `[20 §2]`. */
  companyId: string | null;
  contactId: string | null;
  projectId: string | null;
  channel: ReportChannel | null;
  outcome: ReportOutcome | null;
  /** Required when the outcome is `on_hold`, forbidden otherwise `[20 §5]`. */
  onHoldUntil: string | null;
  /** Field note only `[20 §2]`. */
  category: FieldNoteCategory | null;
  cityId: string | null;
  signals: SignalInput[];
};

export type ReportSignalRow = {
  signal: ReportSignal;
  reference: string | null;
};

export type ReportListRow = {
  id: string;
  entryType: ReportEntryType;
  reportDate: string;
  /** The note half `[S38]`. `null` means **withheld from this viewer**, never
   *  empty: `normalise` refuses a blank narrative and the column is NOT NULL. */
  narrative: string | null;
  userId: string;
  userName: string;
  channel: ReportChannel | null;
  outcome: ReportOutcome | null;
  category: FieldNoteCategory | null;
  onHoldUntil: string | null;
  companyId: string | null;
  companyName: string | null;
  projectId: string | null;
  projectNameEn: string | null;
  projectNameAr: string | null;
  contactName: string | null;
  cityNameEn: string | null;
  cityNameAr: string | null;
  signals: ReportSignalRow[];
  createdAt: Date;
};

export type ReportDetail = ReportListRow & {
  contactId: string | null;
  cityId: string | null;
  /** Whether the viewer may open the anchor's own record `[16 §10]` shape. */
  companyViewable: boolean;
  projectViewable: boolean;
  /** Whose words these are. Decides what the page says, not what it offers. */
  isAuthor: boolean;
  /** `S39` — the author, on the day they wrote it. The Edit control renders
   *  only for this; `updateReport` refuses in step, so the UI is never the
   *  gate `[19 §3]`. */
  editable: boolean;
};

/* ------------------------------------------------------------------ *
 * Validation — shape first, then the cross-table rules `[13 §1]`
 * ------------------------------------------------------------------ */

type Normalised = {
  values: Omit<ReportInput, "signals">;
  signals: SignalInput[];
};

/**
 * Force the shape `20 §2` describes, refusing rather than silently correcting
 * where the caller and the entry type disagree.
 *
 * The database holds the same rule as `rep_reports_shape` `[13 §1]`; this is
 * what turns a constraint violation into a field message instead of a 500.
 */
function normalise(input: ReportInput): Normalised {
  const narrative = input.narrative.trim();
  if (narrative.length === 0) {
    throw new RuleError("reports.errors.narrativeRequired", "narrative");
  }

  const signals = normaliseSignals(input.signals);

  if (input.entryType === "field_note") {
    if (!input.category) {
      throw new RuleError("reports.errors.categoryRequired", "category");
    }
    return {
      values: {
        entryType: "field_note",
        reportDate: input.reportDate,
        narrative,
        // A field note is anchored to nobody `[20 §2]`. Anything the caller
        // sent here is dropped, not saved against a guessed customer.
        companyId: null,
        contactId: null,
        projectId: null,
        channel: null,
        outcome: null,
        onHoldUntil: null,
        category: input.category,
        cityId: input.cityId,
      },
      signals,
    };
  }

  if (!input.companyId) {
    throw new RuleError("reports.errors.companyRequired", "companyId");
  }
  if (!input.channel) {
    throw new RuleError("reports.errors.channelRequired", "channel");
  }
  if (!input.outcome) {
    throw new RuleError("reports.errors.outcomeRequired", "outcome");
  }

  const onHold = input.outcome === ON_HOLD_OUTCOME;
  if (onHold && !input.onHoldUntil) {
    throw new RuleError("reports.errors.onHoldDateRequired", "onHoldUntil");
  }

  return {
    values: {
      entryType: "interaction",
      reportDate: input.reportDate,
      narrative,
      companyId: input.companyId,
      contactId: input.contactId,
      projectId: input.projectId,
      channel: input.channel,
      outcome: input.outcome,
      // Set only for `on_hold`; a date left behind by changing the outcome is
      // cleared rather than kept, or `rep_reports_on_hold` would refuse.
      onHoldUntil: onHold ? input.onHoldUntil : null,
      category: null,
      cityId: null,
    },
    signals,
  };
}

function normaliseSignals(signals: SignalInput[]): SignalInput[] {
  const seen = new Set<ReportSignal>();
  return signals.map((entry) => {
    if (seen.has(entry.signal)) {
      // `rep_report_signals_key` would refuse this as a 500; say why instead.
      throw new RuleError("reports.errors.signalDuplicated", "signals");
    }
    seen.add(entry.signal);

    const reference = entry.reference?.trim() ?? "";
    if (reference.length > SIGNAL_REFERENCE_MAX) {
      throw new RuleError("reports.errors.signalReferenceTooLong", "signals");
    }
    return { signal: entry.signal, reference: reference || null };
  });
}

/**
 * The cross-table rules, which `13 §1` keeps out of the database because they
 * are not about what one row contains in isolation.
 *
 * Visibility is asked FIRST and of both anchors: a company or project the actor
 * cannot see does not exist to them, and answering "that contact is not on that
 * company" about a record they may not read would leak its shape.
 */
async function assertAnchorsUsable(
  session: AuthSession,
  values: Normalised["values"],
): Promise<void> {
  if (!values.companyId) return;

  if (!(await canViewRecord(session, "company", values.companyId))) {
    throw new RuleError("reports.errors.companyNotVisible", "companyId");
  }

  if (values.contactId) {
    const [contact] = await db
      .select({ companyId: contacts.companyId })
      .from(contacts)
      .where(eq(contacts.id, values.contactId))
      .limit(1);
    if (!contact || contact.companyId !== values.companyId) {
      throw new RuleError("reports.errors.contactNotOnCompany", "contactId");
    }
  }

  if (values.projectId) {
    // `20 §10` — a report naming a project is visible only to someone who can
    // see the project, so writing one requires the same.
    if (!(await canViewRecord(session, "project", values.projectId))) {
      throw new RuleError("reports.errors.projectNotVisible", "projectId");
    }
    const [link] = await db
      .select({ id: projectCompanies.id })
      .from(projectCompanies)
      .where(
        and(
          eq(projectCompanies.projectId, values.projectId),
          eq(projectCompanies.companyId, values.companyId),
          isNull(projectCompanies.removedAt),
        ),
      )
      .limit(1);
    if (!link) {
      throw new RuleError("reports.errors.projectNotOnCompany", "projectId");
    }
  }
}

/* ------------------------------------------------------------------ *
 * Writing
 * ------------------------------------------------------------------ */

/**
 * Log an interaction or a field note.
 *
 * **No flag gate `[20 §13]`.** Logging is what every rep does; the screen this
 * serves must be nearly free to use `[20 §12]`.
 */
export async function createReport(
  session: AuthSession,
  input: ReportInput,
): Promise<RepReport> {
  const { values, signals } = normalise(input);
  await assertAnchorsUsable(session, values);

  return withAudit(session.actor, async (tx, log) => {
    const [created] = await tx
      .insert(repReports)
      .values({ ...values, userId: session.user.id })
      .returning();

    if (signals.length > 0) {
      await tx
        .insert(repReportSignals)
        .values(signals.map((row) => ({ ...row, reportId: created.id })));
    }

    log({
      action: "report.created",
      entityType: "rep_report",
      entityId: created.id,
      after: { ...created, signals },
    });
    return created;
  });
}

/**
 * Correct a report. **One row, always** `[20 §9]` — an UPDATE, never a second
 * row, because counts read the current outcome and a correction must not
 * double-count.
 *
 * **The author only, and only on the day they wrote it** `[S39]`. After that
 * it stands. A manager reads a report but never rewrites someone else's words:
 * an identity question rather than a visibility one, which is why
 * `ViewableRecordType` gains no value `[20 §13]`.
 *
 * The window is measured on `created_at` in Riyadh, never on `report_date`. A
 * rep may log Thursday's visit on Sunday, and keying the window on the day the
 * report *covers* would both close it before they could fix a typo and let a
 * three-week-old report be reopened by editing the date it claims to cover.
 * The check lives here rather than only on the form: a hidden Edit button is a
 * hint, and this is where the rule holds `[19 §3]`.
 *
 * The signal set is **replaced**, not appended to. A no-op save writes no audit
 * row, the way `updateUser` behaves — `withAudit` inserts nothing when `log` is
 * never called.
 */
export async function updateReport(
  session: AuthSession,
  id: string,
  input: ReportInput,
): Promise<RepReport> {
  const [existing] = await db
    .select()
    .from(repReports)
    .where(eq(repReports.id, id))
    .limit(1);
  if (!existing) {
    throw new RuleError("reports.errors.notFound");
  }
  if (existing.userId !== session.user.id) {
    throw new RuleError("reports.errors.authorOnly");
  }
  if (riyadhDay(existing.createdAt) !== today()) {
    throw new RuleError("reports.errors.editWindowClosed");
  }

  const { values, signals } = normalise(input);
  await assertAnchorsUsable(session, values);

  const priorSignals = await db
    .select({
      signal: repReportSignals.signal,
      reference: repReportSignals.reference,
    })
    .from(repReportSignals)
    .where(eq(repReportSignals.reportId, id))
    .orderBy(asc(repReportSignals.signal));

  return withAudit(session.actor, async (tx, log) => {
    const changed = (
      Object.keys(values) as (keyof typeof values)[]
    ).filter((key) => existing[key] !== values[key]);

    const wanted = new Map(signals.map((row) => [row.signal, row.reference]));
    const held = new Map(priorSignals.map((row) => [row.signal, row.reference]));

    const removed = priorSignals
      .filter((row) => !wanted.has(row.signal))
      .map((row) => row.signal);
    const added = signals.filter((row) => !held.has(row.signal));
    const rereferenced = signals.filter(
      (row) => held.has(row.signal) && held.get(row.signal) !== row.reference,
    );
    const signalsChanged =
      removed.length > 0 || added.length > 0 || rereferenced.length > 0;

    if (changed.length === 0 && !signalsChanged) return existing;

    let updated = existing;
    if (changed.length > 0) {
      const [row] = await tx
        .update(repReports)
        .set(values)
        .where(eq(repReports.id, id))
        .returning();
      updated = row;
    }

    if (removed.length > 0) {
      await tx
        .delete(repReportSignals)
        .where(
          and(
            eq(repReportSignals.reportId, id),
            inArray(repReportSignals.signal, removed),
          ),
        );
    }
    if (added.length > 0) {
      await tx
        .insert(repReportSignals)
        .values(added.map((row) => ({ ...row, reportId: id })));
    }
    for (const row of rereferenced) {
      await tx
        .update(repReportSignals)
        .set({ reference: row.reference })
        .where(
          and(
            eq(repReportSignals.reportId, id),
            eq(repReportSignals.signal, row.signal),
          ),
        );
    }

    log({
      action: "report.updated",
      entityType: "rep_report",
      entityId: id,
      before: {
        ...Object.fromEntries(changed.map((key) => [key, existing[key]])),
        ...(signalsChanged ? { signals: priorSignals } : {}),
      },
      after: {
        ...Object.fromEntries(changed.map((key) => [key, values[key]])),
        ...(signalsChanged ? { signals } : {}),
      },
    });
    return updated;
  });
}

/* ------------------------------------------------------------------ *
 * Reading
 * ------------------------------------------------------------------ */

/**
 * Search reaches the note only where the viewer may read it `[S38]`.
 *
 * Without `readableNoteFilter` here, a rep who holds the company through a
 * share could binary-search another rep's private note by content without ever
 * seeing it rendered. Withholding the column from the select and leaving this
 * `ilike` open looks correct and leaks anyway. The company-name half is
 * unrestricted — the row itself was never the secret.
 */
function searchFilter(session: AuthSession, query: string | undefined) {
  const trimmed = query?.trim();
  if (!trimmed) return undefined;
  const pattern = `%${trimmed}%`;
  return or(
    and(readableNoteFilter(session), ilike(repReports.narrative, pattern)),
    ilike(companies.name, pattern),
  );
}

export type ReportListOptions = {
  q?: string;
  entryType?: ReportEntryType;
  outcome?: ReportOutcome;
  companyId?: string;
  projectId?: string;
  userId?: string;
  from?: string;
  to?: string;
  page?: number;
};

export async function listReports(
  session: AuthSession,
  options: ReportListOptions = {},
): Promise<{ rows: ReportListRow[]; total: number; page: number }> {
  const page = Math.max(1, options.page ?? 1);

  // The visibility filter is the FIRST term, and the same `where` feeds the
  // count, so the total can never disagree with the page.
  const where = and(
    visibleRepReportsFilter(session),
    searchFilter(session, options.q),
    options.entryType ? eq(repReports.entryType, options.entryType) : undefined,
    options.outcome ? eq(repReports.outcome, options.outcome) : undefined,
    options.companyId ? eq(repReports.companyId, options.companyId) : undefined,
    options.projectId ? eq(repReports.projectId, options.projectId) : undefined,
    options.userId ? eq(repReports.userId, options.userId) : undefined,
    options.from ? gte(repReports.reportDate, options.from) : undefined,
    options.to ? lte(repReports.reportDate, options.to) : undefined,
  );

  const rows = await db
    .select(listColumns)
    .from(repReports)
    .innerJoin(users, eq(users.id, repReports.userId))
    .leftJoin(companies, eq(companies.id, repReports.companyId))
    .leftJoin(projects, eq(projects.id, repReports.projectId))
    .leftJoin(contacts, eq(contacts.id, repReports.contactId))
    .leftJoin(cities, eq(cities.id, repReports.cityId))
    .where(where)
    .orderBy(desc(repReports.reportDate), desc(repReports.createdAt))
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE);

  const [totals] = await db
    .select({ total: count() })
    .from(repReports)
    .innerJoin(users, eq(users.id, repReports.userId))
    .leftJoin(companies, eq(companies.id, repReports.companyId))
    .where(where);

  return {
    rows: await withNotes(session, await withSignals(rows)),
    total: totals?.total ?? 0,
    page,
  };
}

/**
 * The *what happened* half `[S38]`, and only that.
 *
 * `narrative` is deliberately absent: every reader of this object composes
 * `withNotes`, which fetches the note in a second query narrowed to the rows
 * whose note the viewer may read. A withheld note is never named in the select
 * that builds someone's page, so it does not leave Postgres.
 */
const listColumns = {
  id: repReports.id,
  entryType: repReports.entryType,
  reportDate: repReports.reportDate,
  userId: repReports.userId,
  userName: users.name,
  channel: repReports.channel,
  outcome: repReports.outcome,
  category: repReports.category,
  onHoldUntil: repReports.onHoldUntil,
  companyId: repReports.companyId,
  companyName: companies.name,
  projectId: repReports.projectId,
  projectNameEn: projects.nameEn,
  projectNameAr: projects.nameAr,
  contactName: contacts.name,
  cityNameEn: cities.nameEn,
  cityNameAr: cities.nameAr,
  createdAt: repReports.createdAt,
} as const;

type BareRow = Omit<ReportListRow, "signals" | "narrative">;
type SignalledRow = BareRow & { signals: ReportSignalRow[] };

/** One extra query for the whole page, rather than one per row. */
async function withSignals(rows: BareRow[]): Promise<SignalledRow[]> {
  if (rows.length === 0) return [];

  const found = await db
    .select({
      reportId: repReportSignals.reportId,
      signal: repReportSignals.signal,
      reference: repReportSignals.reference,
    })
    .from(repReportSignals)
    .where(
      inArray(
        repReportSignals.reportId,
        rows.map((row) => row.id),
      ),
    )
    .orderBy(asc(repReportSignals.signal));

  const byReport = new Map<string, ReportSignalRow[]>();
  for (const row of found) {
    const bucket = byReport.get(row.reportId) ?? [];
    bucket.push({ signal: row.signal, reference: row.reference });
    byReport.set(row.reportId, bucket);
  }

  return rows.map((row) => ({ ...row, signals: byReport.get(row.id) ?? [] }));
}

/**
 * The note half `[S38]`, attached only where this viewer may read it.
 *
 * One extra query for the whole page, the same shape as `withSignals` — and
 * the reason the split is not a `case … end` in the SELECT list: a Drizzle
 * `sql` template drops the table qualifier there, silently, and `listColumns`
 * is used under five joins. Selecting the column in a separate single-table
 * statement narrowed by `readableNoteFilter` is both safe and literal: the
 * note a viewer may not read is never named in a select they run.
 *
 * A row with no match gets `null` — withheld, not empty.
 */
async function withNotes(
  session: AuthSession,
  rows: SignalledRow[],
): Promise<ReportListRow[]> {
  if (rows.length === 0) return [];

  const readable = await db
    .select({ id: repReports.id, narrative: repReports.narrative })
    .from(repReports)
    .where(
      and(
        inArray(
          repReports.id,
          rows.map((row) => row.id),
        ),
        readableNoteFilter(session),
      ),
    );

  const byReport = new Map(readable.map((row) => [row.id, row.narrative]));
  return rows.map((row) => ({
    ...row,
    narrative: byReport.get(row.id) ?? null,
  }));
}

/**
 * Every visible report in a date range, unpaginated.
 *
 * The daily view counts them and has no page to show, and running it through
 * `listReports` would mean reassembling pages to reach a total — two readings
 * of the same set, which is how a count and a list start disagreeing. Same
 * filter, same `authz` predicate, no second copy of the rule.
 */
export async function reportsInRange(
  session: AuthSession,
  range: { from: string; to: string },
  userIds?: string[],
): Promise<ReportListRow[]> {
  if (userIds && userIds.length === 0) return [];

  const rows = await db
    .select(listColumns)
    .from(repReports)
    .innerJoin(users, eq(users.id, repReports.userId))
    .leftJoin(companies, eq(companies.id, repReports.companyId))
    .leftJoin(projects, eq(projects.id, repReports.projectId))
    .leftJoin(contacts, eq(contacts.id, repReports.contactId))
    .leftJoin(cities, eq(cities.id, repReports.cityId))
    .where(
      and(
        visibleRepReportsFilter(session),
        gte(repReports.reportDate, range.from),
        lte(repReports.reportDate, range.to),
        userIds ? inArray(repReports.userId, userIds) : undefined,
      ),
    )
    .orderBy(desc(repReports.reportDate), desc(repReports.createdAt));

  return withNotes(session, await withSignals(rows));
}

export async function getReport(
  session: AuthSession,
  id: string,
): Promise<ReportDetail | null> {
  const [row] = await db
    .select({
      ...listColumns,
      contactId: repReports.contactId,
      cityId: repReports.cityId,
    })
    .from(repReports)
    .innerJoin(users, eq(users.id, repReports.userId))
    .leftJoin(companies, eq(companies.id, repReports.companyId))
    .leftJoin(projects, eq(projects.id, repReports.projectId))
    .leftJoin(contacts, eq(contacts.id, repReports.contactId))
    .leftJoin(cities, eq(cities.id, repReports.cityId))
    // The same rule the list asks of every row, asked of this one.
    .where(and(eq(repReports.id, id), visibleRepReportsFilter(session)))
    .limit(1);

  if (!row) return null;

  const [full] = await withNotes(session, await withSignals([row]));
  return {
    ...full,
    contactId: row.contactId,
    cityId: row.cityId,
    // Seeing the report does not imply being allowed to open its anchor —
    // the shape `16 §10` established for the coordinator. `canOpenRecord`
    // because this decides a link, not an act `S76`.
    companyViewable: row.companyId
      ? await canOpenRecord(session, "company", row.companyId)
      : false,
    projectViewable: row.projectId
      ? await canOpenRecord(session, "project", row.projectId)
      : false,
    isAuthor: row.userId === session.user.id,
    editable:
      row.userId === session.user.id && riyadhDay(row.createdAt) === today(),
  };
}

/* ------------------------------------------------------------------ *
 * `on hold` — derived on read, never stored `[20 §5]`
 * ------------------------------------------------------------------ */

const RIYADH_DAY = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Riyadh",
  dateStyle: "short",
});

/**
 * Which calendar day in Riyadh an instant fell on, as `YYYY-MM-DD`.
 *
 * The app's timezone is fixed, and **UTC is the wrong answer here** `[S39]`: a
 * report typed at 02:00 Riyadh is 23:00 UTC the day before, so a UTC window
 * would close it before the rep had had breakfast.
 */
export function riyadhDay(at: Date): string {
  return RIYADH_DAY.format(at);
}

/** Today in Riyadh, as `YYYY-MM-DD`. The app's timezone is fixed and a report
 *  date is a calendar day there, not an instant. */
export function today(): string {
  return riyadhDay(new Date());
}

/**
 * The same question for many companies at once, for the coverage screen.
 *
 * Deliberately **unfiltered by `visibleRepReportsFilter`**: suppression is a
 * property of the company, not of the viewer. A manager who can see the company
 * but not some rep's report must still see that it is on hold, or coverage
 * would chase a customer who has asked to be left alone. The caller has already
 * scoped which companies it may ask about.
 */
export async function onHoldByCompany(
  companyIds: string[],
): Promise<Map<string, string>> {
  if (companyIds.length === 0) return new Map();

  const rows = await db
    .select({
      companyId: repReports.companyId,
      until: sql<string>`max(${repReports.onHoldUntil})`,
    })
    .from(repReports)
    .where(
      and(
        inArray(repReports.companyId, companyIds),
        eq(repReports.outcome, ON_HOLD_OUTCOME),
        gte(repReports.onHoldUntil, today()),
      ),
    )
    .groupBy(repReports.companyId);

  return new Map(
    rows
      .filter((row): row is { companyId: string; until: string } =>
        Boolean(row.companyId),
      )
      .map((row) => [row.companyId, row.until]),
  );
}
