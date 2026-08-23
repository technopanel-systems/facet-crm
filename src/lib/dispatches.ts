/**
 * Dispatch `S72` — what a rep asks to send out and the coordinator approves.
 * The **approval** is the one event that credits a target `[04 C1]`.
 *
 * The rules, and where each comes from:
 *
 *  1. **The act is SPLIT** `S72`. A rep requests with no flag at all; the
 *     coordinator checks the request and approves it, behind `can_dispatch` —
 *     which is now read as *may **approve** a dispatch*. There is no new flag,
 *     and `S76`'s five widenings in `authz.ts` ride on the same boolean and
 *     keep their exact meaning: the approver is the person the recorder was.
 *  2. **Always a company, a rep and lines. The quotation link is OPTIONAL**
 *     `[07 C6]` — customers sometimes buy directly from internal sales or from
 *     a rep.
 *  3. **Against a quotation: blocked until payment is confirmed** `[07 C3]` —
 *     and since `S72` that block lands on the **approval**, not the request.
 *     The founder moved it: a rep who cannot even ask until finance has
 *     confirmed sits absurdly beside `S71`'s *on delivery*, which by
 *     definition is not confirmed before the goods move, and `S72` puts the
 *     half that deals with finance on the coordinator. `S73` replaces the
 *     condition itself in the payment slice; this only moved where it fires.
 *     A free entry has no quotation, so the rule has no object there.
 *  4. **One quotation, several partial dispatches** `[04 quantities]`.
 *     Quotation quantity ≠ paid quantity ≠ dispatched quantity, so nothing
 *     here caps a dispatch against what was quoted or paid.
 *  5. **Company and rep are DERIVED from the thread when there is one**
 *     `[18 §7]`. CLAUDE.md's first design principle, and it closes `07 D3`'s
 *     stated worry: if the coordinator picks the rep, the credited person
 *     becomes a dropdown choice rather than a fact of the quotation chain.
 *  6. **The project is recorded on the dispatch** `S74`, and derived the same
 *     way whenever the thread has one: shown, never chosen. When the thread
 *     has none `S50`, whoever raises the request chooses — from the projects
 *     THEY hold, which for a rep is their own or a share.
 *
 *     **The write-back happens when the coordinator approves** `S74`. It used
 *     to fire at record time, because there was no approval act to hang it on;
 *     `S72` creates one, so the quotation gains its project — and its company
 *     joins that project as a participant `S27` — at the moment the dispatch
 *     becomes real. A refused request writes nothing back, which is the whole
 *     point of moving it: a project written onto a quotation by a request
 *     nobody approved would be a decision nobody made.
 *
 *     **A dispatch's project is never different from its thread's** `S74`.
 *     The pair spans two rows, so no CHECK can hold it; it is enforced here,
 *     exactly as the company is, and asserted for every row ever written by
 *     `verify:schema25` §11.
 *  7. **Requesting or approving a dispatch NEVER sets a credit split**
 *     `[07 D3]`, `[12 §1]`. This module does not import `setCreditSplit`, and
 *     `verify-slice3` counts rows to prove it.
 *  8. **Only from an ISSUED quotation** `S126`. A requested version is still
 *     being edited `S61` and is not something to dispatch against. The
 *     dispatch records the version, not only the thread, because issuing is a
 *     version act — and because a later revision supersedes that version
 *     `S66`, so a rule checked through the thread would start reporting a
 *     lawful historical dispatch as a violation.
 *  9. **A dispatch carries its own lines** `S116`, priced, never service
 *     lines. They are COPIED from the issued version when there is one, and
 *     typed from nothing on the free-entry route `S75`. Any of them may differ
 *     from the quotation's; the dispatch may add a product it never had.
 *
 * 10. **Approval is the event, not the row** `S72`. *An approved dispatch is
 *     the only event that credits a target — not the request.* So no figure
 *     anywhere may count a row by its existence, and the seven that read
 *     dispatches all compose `approvedDispatches()` below. Seven hand-written
 *     `status = 'approved'` terms is how one gets missed, and a missed one
 *     silently counts somebody's unapproved request toward their month.
 *
 * **`sqm` is derived, not stored.** It is `sum(dispatch_lines.sqm)`, resolved
 * in SQL at every reader here and in `projects.ts`, `targets.ts` and
 * `timeline.ts`. See `dispatchSqm` for the qualifier trap that makes the
 * subquery worth writing out in full.
 *
 * Every read composes a filter from `authz`; every write goes through
 * `withAudit`, which owns the transaction `[07 E1]`.
 */

import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  inArray,
  isNotNull,
  isNull,
  lt,
  lte,
  ne,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { db } from "@/db";
import {
  companies,
  dispatchLines,
  dispatchStatusEnum,
  dispatches,
  productClasses,
  productFireRatings,
  productSuppliers,
  productThicknesses,
  projects,
  quotationLines,
  quotationThreads,
  quotationVersions,
  users,
} from "@/db/schema";
import { withAudit } from "@/lib/audit";
import {
  can,
  canOpenRecord,
  canViewRecord,
  dispatchCompanyLookupFilter,
  visibleDispatchesFilter,
  visibleProjectsFilter,
  visibleQuotationThreadsFilter,
  type AuthSession,
} from "@/lib/authz";
import {
  creditForDispatches,
  type CreditableDispatch,
  type DispatchCredit,
} from "@/lib/credit-splits";
import { SQM_SCALE, ZERO, toScaled } from "@/lib/decimal";
import { ensureProjectParticipant } from "@/lib/projects";
import { productLineMoney } from "@/lib/quotations";
import { RuleError } from "@/lib/validation";

export type Dispatch = typeof dispatches.$inferSelect;

/** `S72` — the four states of a request. The union comes from the pg enum, so
 *  a value added to the database and forgotten here is a type error. */
export type DispatchStatus = Dispatch["status"];

/** The states a working list shows `S122` — everything but the archive. */
export const DISPATCH_STATUSES = dispatchStatusEnum.enumValues;

/**
 * Narrow a `?status=` from the URL. Unknown or absent is the default scope,
 * which is not one of the four — `listDispatches` reads `undefined` as
 * *everything but refused*.
 */
export function asDispatchStatus(value: string | undefined): DispatchStatus | undefined {
  return DISPATCH_STATUSES.find((status) => status === value);
}

const PAGE_SIZE = 25;

/**
 * A dispatch's square metres `S116` — the sum of its lines, in SQL.
 *
 * Correlated rather than joined, so it composes into a paginated `select`
 * without a `group by` that would have to name every other column, and so it
 * is resolved **before** pagination (`CLAUDE.md`). Cast back to the line's own
 * `numeric(14,4)` so a dispatch reads `"12.0000"` and not `"12"` — every
 * comparison against this figure is a string comparison.
 *
 * **Written out, with no interpolated columns, and that is load-bearing.**
 * A Drizzle column interpolated into a `sql` template in the SELECT list loses
 * its table qualifier whenever the outer query joins nothing — `dispatch_id`
 * and `id` both then resolve inside the subquery, against `dispatch_lines`,
 * and the comparison is `dispatch_lines.dispatch_id = dispatch_lines.id`.
 * That is never true, so every row reads `0.0000` and no error is raised. It
 * happened to be correct in the joined callers here and silently wrong in the
 * one without a join, which is the worst possible way for it to behave.
 * Naming both tables outright is the fix; the alias `dl` keeps the inner
 * `sqm` unambiguous.
 */
const dispatchSqm = sql<string>`(
  select coalesce(sum(dl.sqm), 0)::numeric(14, 4)
  from dispatch_lines dl
  where dl.dispatch_id = dispatches.id
)`;

/**
 * **The one place a figure asks whether a dispatch counts** `S72`.
 *
 * *An approved dispatch is the only event that credits a target — not the
 * request.* Before `S72` there was no request, so the row's existence was the
 * event and every reader simply counted rows. There are now four states and
 * three of them count for nothing, so each of the seven readers composes this:
 *
 *  1. `dispatchesInPeriod` — `S85`'s achievement, and every target figure
 *  2. `listDispatchableThreads` — what has already gone out against a thread
 *  3. `projects.ts` `dispatchedSqmByCompany` — `S26`'s per-participant sqm
 *  4. `follow-ups.ts` `dispatchEvents` — whether a project has moved
 *  5. `timeline.ts` — `S41`'s *dispatched* event
 *  6. `getDispatch` — the credit table, which is rendered only once approved
 *  7. `listDispatches({ status })`, which the two `hasDispatch` callers pass
 *     `"approved"` so an unapproved request cannot advance a chain `[chain.ts]`
 *
 * **One function rather than seven `eq(...)` terms**, for the reason
 * `dispatchedSqmByCompany` already carries: seven copies is how one gets
 * missed, and a missed one does not fail — it silently counts somebody's
 * unapproved request toward their month. `verify:slice3` asserts the figure at
 * every one of the seven rather than at the two that are easiest to reach,
 * which is the lesson `S116` left behind.
 *
 * It reads `status`, not `approved_at`. The two cannot disagree — the
 * `dispatches_approval_stamps` CHECK holds them together at the database — and
 * the status is the sentence the rule is written in.
 */
export function approvedDispatches(): SQL {
  return eq(dispatches.status, "approved");
}

/**
 * One product line on a dispatch `S116` — the same shape as a quotation's,
 * with one difference the type itself states: **`unitPrice` is not nullable.**
 * *Every line carries a price; nothing is dispatched free.* An unpriced
 * quotation line `S58` arrives on the form with an empty price box, and the
 * caller fills it before this type can be built.
 *
 * No service line `S116`, no `formFactor` (dead on `quotation_lines`, and not
 * copied into a new table), and no `sqm` — the column is generated.
 */
export type DispatchLineInput = {
  supplierId: string;
  classId: string;
  fireRatingId: string;
  customColour: string;
  thicknessId: string;
  widthM: string;
  lengthM: string;
  quantityPcs: string;
  unitPrice: string;
};

export type DispatchInput = {
  /** At least one `S116`. Their generated square metres ARE the dispatch's. */
  lines: DispatchLineInput[];
  /** `YYYY-MM-DD`. */
  dispatchDate: string;
  /** Optional `[07 C6]`. When set, company and rep are derived from it. */
  quotationThreadId: string | null;
  /** Free entry only. Ignored — and refused if it disagrees — when a
   *  thread is given `[18 §7]`. */
  companyId: string | null;
  /**
   * Free entry only, and only a `can_dispatch` holder may name someone else
   * `S123`. A rep raising their own request is not asked: the system knows who
   * they are `S108`.
   */
  userId: string | null;
  /**
   * `S74`. Required when the thread has no project of its own `S50`; ignored,
   * and refused if it disagrees, when the thread has one. Null on the free
   * route, which names no project this slice `S75`.
   */
  projectId: string | null;
};

/**
 * What an edit may change `S125` `S62` — and, as much to the point, what it
 * may not.
 *
 * The quotation, the company and the rep are **not** here. Changing which
 * quotation a request is against is raising a different request, and `S122`
 * already says what to do with one nobody wants: *a rep who wants to withdraw
 * a submitted request asks the coordinator to refuse it — there is no separate
 * act.* What is left is what a phone call actually corrects: a quantity, a
 * price, a colour, the date, and the project when the quotation had none.
 */
export type DispatchEditInput = {
  lines: DispatchLineInput[];
  dispatchDate: string;
  /**
   * `S74`. Only reaches anything on a request whose thread has no project of
   * its own `S50`, or a free entry, where it stays null `S75`.
   *
   * **The coordinator may set this, and that is the founder's decision**, not
   * a reading of `S76`'s list. `S76` says her edit right reaches a submitted
   * request's *own fields* and never the project or contact **records** it
   * names — and which project a dispatch names IS one of its own fields. The
   * write-back fires at her approval `S74`, so the choice becomes hers at that
   * moment; refusing a request over a project she could correct in the same
   * phone call is exactly what `S125` exists to avoid. She still cannot edit
   * the project itself: `canViewRecord` is not widened, so `updateProject`
   * refuses her as it always has.
   */
  projectId: string | null;
};

export type DispatchListRow = {
  id: string;
  dispatchDate: string;
  /** Derived — `sum(dispatch_lines.sqm)`, never a column `S116`. */
  sqm: string;
  companyId: string;
  companyName: string;
  /** May the viewer OPEN the company? `can_dispatch` sees the name only
   *  `[18 §2]` — which `S76` did not change for companies — so the screen
   *  renders plain text rather than a link. */
  companyViewable: boolean;
  userId: string;
  userName: string;
  recordedByName: string;
  /** `S125` — who RAISED it, which is who may edit it while it is a draft.
   *  Not the same as `userId`, the rep it credits, when the coordinator raised
   *  one for somebody `S123`. */
  recordedByUserId: string;
  quotationThreadId: string | null;
  smacReference: string | null;
  threadViewable: boolean;
  /** Derived from the null thread, never stored `[07 C6]`. */
  isDirect: boolean;
  /** `S72` — where this row is in its life. Every screen branches on it. */
  status: DispatchStatus;
  /** `S72` — when the rep handed it over. Null on a draft, and on a draft
   *  only: the `dispatches_submitted_at` CHECK says so. */
  submittedAt: Date | null;
  approvedByName: string | null;
  approvedAt: Date | null;
  createdAt: Date;
};

/**
 * One line as a screen reads it — the lookup names resolved, as `S53` asks.
 *
 * **And the four lookup ids beside them**, which the detail screen never
 * renders: the edit form `S125` has to preselect each `<select>`, and carrying
 * them here is one query rather than a second one that would have to re-derive
 * which line is which.
 */
export type DispatchLineRow = {
  id: string;
  supplierId: string;
  classId: string;
  fireRatingId: string;
  thicknessId: string;
  supplierNameEn: string;
  supplierNameAr: string;
  classNameEn: string;
  classNameAr: string;
  fireRatingNameEn: string;
  fireRatingNameAr: string;
  customColour: string;
  /** Trailing zeros off a `numeric(5,2)`: `"4.00"` reads as `4`, not `4.00`. */
  thicknessMm: string;
  widthM: string;
  lengthM: string;
  quantityPcs: string;
  sqm: string;
  unitPrice: string;
  lineTotal: string;
  /** At `VAT_RATE`, always `S57`. The rate itself is stored nowhere. */
  vatAmount: string;
};

export type DispatchDetail = DispatchListRow & {
  projectId: string | null;
  projectNameEn: string | null;
  projectNameAr: string | null;
  projectViewable: boolean;
  /**
   * `S74` — the QUOTATION's own project, which is a different question from the
   * dispatch's and the one the edit form needs: a request whose thread has a
   * project of its own has nothing to choose, and one whose thread has none
   * `S50` is where the choice — and the write-back at approval — lives.
   *
   * Null on a free entry, where there is no thread to ask.
   */
  threadProjectId: string | null;
  lines: DispatchLineRow[];
  /** `S124` — set on a refused request and nowhere else, which the
   *  `dispatches_refusal_reason` CHECK holds at the database. */
  refusalReason: string | null;
  /**
   * **Null until the request is approved** `S72`. Credit is a consequence of
   * approval, so a request that has not been approved has none — and a screen
   * showing a credit table beside an unapproved request would be stating a
   * share of a month that nobody has been given. The screen renders the card
   * only when this is set.
   */
  credit: DispatchCredit | null;
};

/**
 * A thread a dispatch request may be raised against: visible to the rep, and
 * **issued** `S126`.
 *
 * Not *paid*. That gate moved to the approval with `S72`, so this list is now
 * what a rep may ask about rather than what the coordinator may record.
 */
export type DispatchableThread = {
  id: string;
  /** `S126` — the issued version, which is the one the lines come from. */
  versionId: string;
  /** Never null: `issueVersion` is what writes it, and only issued threads
   *  reach this list `S126`. */
  smacReference: string;
  /** Null when the quotation has no project `S50` — the coordinator picks one
   *  as part of dispatching it `S74`. */
  projectId: string | null;
  projectNameEn: string | null;
  projectNameAr: string | null;
  companyId: string;
  companyName: string;
  raisedByUserId: string;
  raisedByName: string;
  /** The issued version's total, for information. Never a cap `[04 quantities]`. */
  quotedSqm: string | null;
  /** Running total **approved** against this thread `S72`. Also not a cap. */
  dispatchedSqm: string;
  /**
   * The issued version's product lines, as line INPUTS `S116` — *"a dispatch
   * raised from a quotation arrives pre-filled with its lines"*. Service lines
   * are not among them `S116`.
   *
   * A quotation line with no price `S58` arrives with `unitPrice` empty, which
   * is the one value here the form must not simply keep: `assertLines` refuses
   * it, because every dispatched line carries a price `S116`, and `S72` makes
   * that the REP's job — *the rep prices it before submitting*.
   */
  lines: DispatchLineInput[];
};

/* ------------------------------------------------------------------ *
 * Writing — the six acts of `S72`
 *
 * `recordDispatch` was one function because there was one act. `S72` splits it
 * into six, and the shape of the split is the rule: **request** and **submit**
 * are the rep's and need no flag at all; **approve**, **refuse** and **revive**
 * are the coordinator's and are the whole of what `can_dispatch` now means;
 * **edit** belongs to whichever of them is holding it (`S125`, `S62`).
 *
 * There is no `recordDispatch` any more. Building the new acts beside it would
 * have left two ways to create a dispatch, one of which skips approval — the
 * failure mode `CLAUDE.md` names, and the one that would quietly keep crediting
 * targets from the old path.
 * ------------------------------------------------------------------ */

/**
 * `S116` — the lines ARE the dispatch, every one carries a price, and they add
 * up to something.
 *
 * Shared by the request and the edit, because both write the same rows and a
 * second copy of these three refusals could drift. Nothing went out is not a
 * dispatch: with no lines every derived figure would read zero rather than
 * fail, which is worse than a refusal.
 */
function assertLines(lines: DispatchLineInput[]): void {
  if (lines.length === 0) {
    throw new RuleError("dispatches.errors.atLeastOneLine");
  }
  // **Every line carries a price; nothing is dispatched free** `S116`. An
  // unpriced quotation line `S58` is exactly what arrives here empty, and this
  // is the refusal that makes the rep price it before submitting.
  for (const line of lines) {
    if (!line.unitPrice.trim()) {
      throw new RuleError("dispatches.errors.linePriceRequired", "unitPrice");
    }
    if (!line.customColour.trim()) {
      throw new RuleError("dispatches.errors.lineColourRequired", "customColour");
    }
  }
  // The square metres are the lines' own `S116`, so this is not a typed field
  // to validate — it is arithmetic on what was entered, and the only thing left
  // to refuse is a dispatch that adds up to nothing.
  const sqmScaled = lines.reduce(
    (total, line) =>
      total +
      toScaled(line.quantityPcs, SQM_SCALE) *
        toScaled(line.widthM, SQM_SCALE) *
        toScaled(line.lengthM, SQM_SCALE),
    ZERO,
  );
  if (sqmScaled <= ZERO) {
    throw new RuleError("dispatches.errors.sqmPositive", "quantityPcs");
  }
}

/**
 * Write the lines, in the same transaction as the row they belong to `S116`.
 *
 * `productLineMoney` is `quotations.ts`'s own, imported rather than repeated: a
 * second copy of the arithmetic could drift on rounding or on `S57`'s rate, and
 * `S120`'s comparison would then be measuring the drift.
 */
async function writeLines(
  tx: Parameters<Parameters<typeof withAudit>[1]>[0],
  log: Parameters<Parameters<typeof withAudit>[1]>[1],
  dispatchId: string,
  lines: DispatchLineInput[],
): Promise<void> {
  for (const line of lines) {
    const money = productLineMoney(line);
    const [row] = await tx
      .insert(dispatchLines)
      .values({
        dispatchId,
        supplierId: line.supplierId,
        classId: line.classId,
        fireRatingId: line.fireRatingId,
        customColour: line.customColour.trim(),
        thicknessId: line.thicknessId,
        widthM: line.widthM,
        lengthM: line.lengthM,
        quantityPcs: line.quantityPcs,
        unitPrice: line.unitPrice,
        // Both non-null above: `assertLines` refused an empty price, so
        // `productLineMoney` cannot have returned nulls here.
        lineTotal: money.lineTotal as string,
        vatAmount: money.vatAmount as string,
      })
      .returning();

    log({
      action: "dispatch_line.added",
      entityType: "dispatch_line",
      entityId: row.id,
      after: row,
    });
  }
}

/**
 * `S74` — which project the dispatch records, and whether it is a choice.
 *
 * Two branches and one rule. When the thread has a project the dispatch takes
 * it, shown and never chosen, and a disagreeing input is **refused rather than
 * silently corrected**: a dispatch that disagrees with the quotation it is
 * against is a mistake worth naming. When the thread has none `S50`, whoever is
 * raising or editing chooses, checked against the same filter the picker is
 * built from so the form never offers what this refuses.
 *
 * For a rep that filter is their own projects and their shares `S30`; for the
 * coordinator it is every project, which is `S76` and not a widening this slice
 * made.
 */
async function projectForThread(
  session: AuthSession,
  threadProjectId: string | null,
  chosen: string | null,
): Promise<string> {
  if (threadProjectId) {
    if (chosen && chosen !== threadProjectId) {
      throw new RuleError("dispatches.errors.projectNotOnThread", "projectId");
    }
    return threadProjectId;
  }
  if (!chosen) {
    throw new RuleError("dispatches.errors.projectRequired", "projectId");
  }
  const [pickable] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.id, chosen), visibleProjectsFilter(session)))
    .limit(1);
  if (!pickable) {
    throw new RuleError("dispatches.errors.projectNotVisible", "projectId");
  }
  return chosen;
}

/**
 * The row an act is about, or a refusal that does not say whether it exists.
 *
 * Visibility first, through the same filter every list uses: a request the
 * actor cannot see does not exist to them, and telling them it is in the wrong
 * state would say that it does.
 */
async function loadRequest(
  session: AuthSession,
  id: string,
): Promise<Dispatch> {
  const [row] = await db
    .select()
    .from(dispatches)
    .where(and(eq(dispatches.id, id), visibleDispatchesFilter(session)))
    .limit(1);
  if (!row) {
    throw new RuleError("dispatches.errors.requestNotVisible");
  }
  return row;
}

/**
 * **A rep raises a dispatch request** `S72`. No flag, no gate of its own.
 *
 * What still refuses is what the request NAMES: a thread the rep cannot see, a
 * version the coordinator has not issued `S126`, a project that is not theirs.
 * Those are visibility and rule checks, not a permission to dispatch.
 *
 * Three ways in `S75`, which are two entry points here: against a quotation the
 * lines arrive prefilled and are kept or edited — the first two routes,
 * indistinguishable on purpose, because `S120` flags a difference in *values*
 * rather than an editing act — and a free entry types them from nothing.
 *
 * **What is NOT checked here any more:** the payment gate `[07 C3]`, which now
 * lands on the approval (see the module note), and `can_dispatch`, which is the
 * whole of `S72`. **What is not done here any more:** `S74`'s write-back, which
 * fires when the coordinator approves.
 */
export async function requestDispatch(
  session: AuthSession,
  input: DispatchInput,
): Promise<Dispatch> {
  assertLines(input.lines);

  let companyId = input.companyId;
  let userId = input.userId;
  let projectId = input.projectId;
  /** `S126` — the issued version this is raised from. Null on the free route. */
  let versionId: string | null = null;

  if (input.quotationThreadId) {
    // The field name below is the FORM's, not the column's: `ruleErrorState`
    // keys `fieldErrors` by it, so `threadId` — which no screen renders —
    // meant these refusals were shown to nobody.
    if (
      !(await canViewRecord(
        session,
        "quotation_thread",
        input.quotationThreadId,
      ))
    ) {
      throw new RuleError("dispatches.errors.threadNotVisible", "quotationThreadId");
    }

    const [thread] = await db
      .select({
        companyId: quotationThreads.companyId,
        raisedByUserId: quotationThreads.raisedByUserId,
        projectId: quotationThreads.projectId,
      })
      .from(quotationThreads)
      .where(eq(quotationThreads.id, input.quotationThreadId))
      .limit(1);
    if (!thread) {
      throw new RuleError("dispatches.errors.threadNotVisible", "quotationThreadId");
    }

    // `S126` — **and the coordinator must have issued it.** A `requested`
    // version is still being edited `S61`; a revision creates the next one and
    // supersedes this `S66`, so at most one version of a thread is not
    // superseded and `issued` is the only status that may be dispatched
    // against.
    const [issued] = await db
      .select({ id: quotationVersions.id })
      .from(quotationVersions)
      .where(
        and(
          eq(quotationVersions.threadId, input.quotationThreadId),
          eq(quotationVersions.status, "issued"),
        ),
      )
      .limit(1);
    if (!issued) {
      throw new RuleError("dispatches.errors.quotationNotIssued", "quotationThreadId");
    }
    versionId = issued.id;

    // `18 §7` — derived, not asked for. A caller that supplies a different
    // company is refused rather than silently corrected.
    if (companyId && companyId !== thread.companyId) {
      throw new RuleError("dispatches.errors.companyNotOnThread", "companyId");
    }
    companyId = thread.companyId;
    // The CREDITED rep is the thread's raiser, not whoever is at the keyboard:
    // `07 D3`'s worry is that the credited person becomes a dropdown choice
    // rather than a fact of the quotation chain.
    userId = thread.raisedByUserId;
    projectId = await projectForThread(session, thread.projectId, projectId);
  } else {
    if (!companyId) {
      throw new RuleError("dispatches.errors.companyRequired", "companyId");
    }
    // `S108` — a rep raising their own request is never asked who they are.
    // Only a `can_dispatch` holder may name somebody else, which is `S123`'s
    // *"a record created for a rep by the coordinator or a manager"*.
    if (userId && userId !== session.user.id && !can(session, "canDispatch")) {
      throw new RuleError("dispatches.errors.repNotSelf", "userId");
    }
    userId = userId ?? session.user.id;
    // The company must be one this identity may name `[18 §2]` — for a
    // coordinator that is any company, by name; for anyone else it is the
    // ordinary visibility rule, which is exactly what a rep needs and already
    // had.
    const [namable] = await db
      .select({ id: companies.id })
      .from(companies)
      .where(and(eq(companies.id, companyId), dispatchCompanyLookupFilter(session)))
      .limit(1);
    if (!namable) {
      throw new RuleError("dispatches.errors.companyNotVisible", "companyId");
    }
    // The free route names no project this slice `S75`: its stated-purpose half
    // is not built, and nothing may reach a project without a thread to have
    // derived it from.
    projectId = null;
  }

  return withAudit(session.actor, async (tx, log) => {
    const [created] = await tx
      .insert(dispatches)
      .values({
        companyId: companyId as string,
        userId: userId as string,
        quotationThreadId: input.quotationThreadId,
        // `S126` — null together with the thread, which the
        // `dispatches_quotation_pair` CHECK holds at the database.
        quotationVersionId: versionId,
        projectId,
        dispatchDate: input.dispatchDate,
        recordedByUserId: session.user.id,
        // `S72` — a request, and nothing more. The approval stamps stay null
        // until the coordinator approves, and the `dispatches_approval_stamps`
        // CHECK is what stops them being set any other way.
        status: "draft",
      })
      .returning();

    log({
      action: "dispatch.requested",
      entityType: "dispatch",
      entityId: created.id,
      after: created,
    });

    await writeLines(tx, log, created.id, input.lines);

    return created;
  });
}

/**
 * Who may edit a request, and while it is in which state `S125` `S62`.
 *
 * > *A rep edits their own request until they submit it. After that the
 * > coordinator edits it, usually after phoning the rep — that is faster than
 * > refusing and re-raising.*
 *
 * **"Their own" is who RAISED it, not who it credits.** The two differ when the
 * coordinator raises one for a rep `S123`, and the person who can correct a
 * request is the person who typed it.
 *
 * An approved request is not editable at all — approval is final `S73` — and a
 * refused one is archived until the coordinator revives it `S122`.
 */
function assertEditable(session: AuthSession, request: Dispatch): void {
  if (request.status === "draft") {
    if (request.recordedByUserId !== session.user.id) {
      throw new RuleError("dispatches.errors.notYourRequest");
    }
    return;
  }
  if (request.status === "submitted") {
    if (!can(session, "canDispatch")) {
      throw new RuleError("dispatches.errors.coordinatorEditsSubmitted");
    }
    return;
  }
  throw new RuleError("dispatches.errors.requestNotEditable");
}

/**
 * Edit a request `S125` `S62` — the rep's while it is a draft, the
 * coordinator's once it is submitted.
 *
 * **The lines are replaced rather than diffed.** They are a set, the form posts
 * the whole set, and `S120` compares a dispatch's VALUES to its quotation's
 * rather than tracking which row was touched — so nothing depends on a line
 * keeping its id. Every removal and every addition is audited, so what changed
 * is recoverable from the log.
 *
 * **The `dispatch.edited` audit row is what `S123` will count.** *A request the
 * coordinator had to edit before approving* is one of that rule's two figures,
 * and the audit row carries the actor and the moment. No column is landed for
 * it here: `S123` is its own session, and a column with no reader is a defect.
 */
export async function updateDispatchRequest(
  session: AuthSession,
  id: string,
  input: DispatchEditInput,
): Promise<void> {
  assertLines(input.lines);

  const request = await loadRequest(session, id);
  assertEditable(session, request);

  let projectId = request.projectId;
  if (request.quotationThreadId) {
    const [thread] = await db
      .select({ projectId: quotationThreads.projectId })
      .from(quotationThreads)
      .where(eq(quotationThreads.id, request.quotationThreadId))
      .limit(1);
    if (!thread) {
      throw new RuleError("dispatches.errors.threadNotVisible", "quotationThreadId");
    }
    projectId = await projectForThread(session, thread.projectId, input.projectId);
  }

  await withAudit(session.actor, async (tx, log) => {
    const [after] = await tx
      .update(dispatches)
      .set({ dispatchDate: input.dispatchDate, projectId })
      .where(eq(dispatches.id, id))
      .returning();

    log({
      action: "dispatch.edited",
      entityType: "dispatch",
      entityId: id,
      before: {
        dispatchDate: request.dispatchDate,
        projectId: request.projectId,
      },
      after: { dispatchDate: after.dispatchDate, projectId: after.projectId },
    });

    const removed = await tx
      .delete(dispatchLines)
      .where(eq(dispatchLines.dispatchId, id))
      .returning();
    for (const row of removed) {
      log({
        action: "dispatch_line.removed",
        entityType: "dispatch_line",
        entityId: row.id,
        before: row,
      });
    }

    await writeLines(tx, log, id, input.lines);
  });
}

/**
 * **The rep hands it over** `S72`. Their own draft, and only theirs.
 *
 * `S116` says *a dispatch request with an unpriced line cannot be submitted*.
 * It cannot be SAVED either: `dispatch_lines.unit_price` is NOT NULL, so the
 * refusal lands at `assertLines` rather than here, which satisfies the rule
 * earlier than the rule asks. What is still worth checking at this moment is
 * that lines exist at all — an edit could in principle leave none behind, and a
 * lineless request would reach the coordinator reading as 0 m².
 */
export async function submitDispatchRequest(
  session: AuthSession,
  id: string,
): Promise<void> {
  const request = await loadRequest(session, id);
  if (request.status !== "draft") {
    throw new RuleError("dispatches.errors.notDraft");
  }
  if (request.recordedByUserId !== session.user.id) {
    throw new RuleError("dispatches.errors.notYourRequest");
  }

  const [lines] = await db
    .select({ total: count() })
    .from(dispatchLines)
    .where(eq(dispatchLines.dispatchId, id));
  if ((lines?.total ?? 0) === 0) {
    throw new RuleError("dispatches.errors.atLeastOneLine");
  }

  await withAudit(session.actor, async (tx, log) => {
    const [after] = await tx
      .update(dispatches)
      // `submitted_at` is not `created_at`: a revived request `S122` is
      // submitted again, later, and this is the age the coordinator's queue
      // sorts on — and `S89`'s, when the waiting list arrives.
      .set({ status: "submitted", submittedAt: new Date() })
      .where(eq(dispatches.id, id))
      .returning();

    log({
      action: "dispatch.submitted",
      entityType: "dispatch",
      entityId: id,
      before: { status: request.status },
      after: { status: after.status, submittedAt: after.submittedAt },
    });
  });
}

/**
 * **The coordinator approves** `S72` — the one event that credits a target.
 *
 * Three things happen here and nowhere else:
 *
 *  1. **The payment gate** `[07 C3]`, moved off the request by the founder's
 *     decision (module note). A free entry has no thread, so the rule has no
 *     object; `S73` will replace the condition itself with a payment method.
 *  2. **`S74`'s write-back.** The quotation gains the project the request named
 *     and its company joins that project `S27`, in this transaction, so a
 *     refused request writes nothing back. Guarded on the column still being
 *     null, and **tolerant of a thread that already carries the same project**:
 *     a second dispatch against one quotation would otherwise fail on its own
 *     predecessor's work. Different is still refused — that is a real
 *     disagreement.
 *  3. **The stamps.** `status`, `approved_at` and `approved_by_user_id` move
 *     together; the `dispatches_approval_stamps` CHECK is what makes asking any
 *     one of them the same question.
 *
 * **`S127` — nothing checks that the approver is not the raiser, deliberately.**
 * *The coordinator may raise a dispatch request against her own company and
 * approve it herself... nothing blocks the same person from both acts.* The
 * absence is asserted rather than assumed: `verify-slice3` walks request,
 * submit and approve as one identity, so a four-eyes rule added here later
 * fails a check instead of quietly repealing `S127`.
 */
export async function approveDispatchRequest(
  session: AuthSession,
  id: string,
): Promise<void> {
  if (!can(session, "canDispatch")) {
    throw new RuleError("dispatches.errors.approveOnly");
  }

  const request = await loadRequest(session, id);
  if (request.status !== "submitted") {
    throw new RuleError("dispatches.errors.notSubmitted");
  }

  await withAudit(session.actor, async (tx, log) => {
    if (request.quotationThreadId) {
      const [thread] = await tx
        .select({
          projectId: quotationThreads.projectId,
          paymentConfirmedAt: quotationThreads.paymentConfirmedAt,
        })
        .from(quotationThreads)
        .where(eq(quotationThreads.id, request.quotationThreadId))
        .limit(1);
      if (!thread) {
        throw new RuleError("dispatches.errors.threadNotVisible");
      }
      if (!thread.paymentConfirmedAt) {
        throw new RuleError("dispatches.errors.paymentNotConfirmed");
      }

      if (!thread.projectId && request.projectId) {
        const written = await tx
          .update(quotationThreads)
          .set({ projectId: request.projectId })
          .where(
            and(
              eq(quotationThreads.id, request.quotationThreadId),
              isNull(quotationThreads.projectId),
            ),
          )
          .returning({ id: quotationThreads.id });
        if (written.length !== 1) {
          throw new RuleError("dispatches.errors.projectAlreadySet", "projectId");
        }
        log({
          action: "quotation_thread.project_set",
          entityType: "quotation_thread",
          entityId: request.quotationThreadId,
          before: { projectId: null },
          after: { projectId: request.projectId },
        });

        // `S74` — and the quotation's company joins that project if it is not
        // already a participant. Through `projects.ts`'s one writer, so `S27`
        // holds for this route exactly as for a rep adding one by hand.
        await ensureProjectParticipant(
          tx,
          log,
          request.projectId,
          request.companyId,
        );
      } else if (
        thread.projectId &&
        request.projectId &&
        thread.projectId !== request.projectId
      ) {
        // The thread gained a different project between the request and this
        // approval — another dispatch's write-back. A real disagreement, and
        // refusing names it rather than silently picking one.
        throw new RuleError("dispatches.errors.projectAlreadySet", "projectId");
      }
    }

    const [after] = await tx
      .update(dispatches)
      .set({
        status: "approved",
        approvedAt: new Date(),
        approvedByUserId: session.user.id,
      })
      .where(eq(dispatches.id, id))
      .returning();

    log({
      action: "dispatch.approved",
      entityType: "dispatch",
      entityId: id,
      before: { status: request.status },
      after: {
        status: after.status,
        approvedAt: after.approvedAt,
        approvedByUserId: after.approvedByUserId,
      },
    });
  });
}

/**
 * **The coordinator refuses** `S124` — the same person who approves.
 *
 * *A refusal carries a reason and archives the request* `S122`. The reason is
 * required and stored on the row, which is what the archive shows; `S128` will
 * carry it to the rep, and that is its own session. `submitted_at` stays: a
 * refused request WAS submitted, and clearing when would lose it.
 */
export async function refuseDispatchRequest(
  session: AuthSession,
  id: string,
  reason: string,
): Promise<void> {
  if (!can(session, "canDispatch")) {
    throw new RuleError("dispatches.errors.refuseOnly");
  }
  const body = reason.trim();
  if (!body) {
    throw new RuleError("dispatches.errors.refusalReasonRequired", "reason");
  }

  const request = await loadRequest(session, id);
  if (request.status !== "submitted") {
    throw new RuleError("dispatches.errors.notSubmitted");
  }

  await withAudit(session.actor, async (tx, log) => {
    const [after] = await tx
      .update(dispatches)
      .set({ status: "refused", refusalReason: body })
      .where(eq(dispatches.id, id))
      .returning();

    log({
      action: "dispatch.refused",
      entityType: "dispatch",
      entityId: id,
      before: { status: request.status },
      after: { status: after.status, refusalReason: after.refusalReason },
    });
  });
}

/**
 * **Only the coordinator may revive one, and a revived request is treated as
 * new** `S122`.
 *
 * It *returns to the rep, unsubmitted, and they edit and submit it as they
 * would a new one* `S125` — so the status goes back to `draft` and
 * `submitted_at` clears with it. The rep it returns to is the one who raised
 * it, which is what `assertEditable` reads.
 *
 * **The reason clears.** A revived request is out of the archive, so the column
 * that puts it there is wrong to keep — and the `dispatches_refusal_reason`
 * CHECK would refuse the row anyway. Nothing is lost: the `dispatch.refused`
 * audit row keeps the reason permanently `S112`, which is what `S107` means.
 */
export async function reviveDispatchRequest(
  session: AuthSession,
  id: string,
): Promise<void> {
  if (!can(session, "canDispatch")) {
    throw new RuleError("dispatches.errors.reviveOnly");
  }

  const request = await loadRequest(session, id);
  if (request.status !== "refused") {
    throw new RuleError("dispatches.errors.notRefused");
  }

  await withAudit(session.actor, async (tx, log) => {
    const [after] = await tx
      .update(dispatches)
      .set({ status: "draft", refusalReason: null, submittedAt: null })
      .where(eq(dispatches.id, id))
      .returning();

    log({
      action: "dispatch.revived",
      entityType: "dispatch",
      entityId: id,
      before: { status: request.status, refusalReason: request.refusalReason },
      after: { status: after.status },
    });
  });
}

/* ------------------------------------------------------------------ *
 * Reading
 * ------------------------------------------------------------------ */

function searchFilter(query: string | undefined) {
  const trimmed = query?.trim();
  if (!trimmed) return undefined;
  const pattern = `%${trimmed}%`;
  return or(
    sql`${companies.name} ilike ${pattern}`,
    sql`${users.name} ilike ${pattern}`,
  );
}

export async function listDispatches(
  session: AuthSession,
  options: {
    q?: string;
    userId?: string;
    companyId?: string;
    threadId?: string;
    /** `07 C6` — the direct route, made countable. */
    direct?: boolean;
    /**
     * `S72` — one of the four states, or absent for the **working list**:
     * everything but `refused`, because *a refused dispatch request is
     * archived and kept out of the working lists* `S122`. Absent is not
     * "everything"; the archive is reached by asking for it.
     *
     * A caller wanting the figure rather than the screen passes `"approved"` —
     * which is what the two `hasDispatch` callers do, so an unapproved request
     * cannot advance a chain.
     */
    status?: DispatchStatus;
    from?: string;
    to?: string;
    page?: number;
  } = {},
): Promise<{ rows: DispatchListRow[]; total: number; page: number }> {
  const page = Math.max(1, options.page ?? 1);
  const recordedBy = alias(users, "recorded_by");
  const approvedBy = alias(users, "approved_by");

  const where = and(
    visibleDispatchesFilter(session),
    searchFilter(options.q),
    options.status
      ? eq(dispatches.status, options.status)
      : ne(dispatches.status, "refused"),
    options.userId ? eq(dispatches.userId, options.userId) : undefined,
    options.companyId ? eq(dispatches.companyId, options.companyId) : undefined,
    options.threadId
      ? eq(dispatches.quotationThreadId, options.threadId)
      : undefined,
    options.direct === true ? isNull(dispatches.quotationThreadId) : undefined,
    options.direct === false
      ? isNotNull(dispatches.quotationThreadId)
      : undefined,
    options.from ? gte(dispatches.dispatchDate, options.from) : undefined,
    options.to ? lte(dispatches.dispatchDate, options.to) : undefined,
  );

  const rows = await db
    .select({
      id: dispatches.id,
      dispatchDate: dispatches.dispatchDate,
      sqm: dispatchSqm,
      companyId: dispatches.companyId,
      companyName: companies.name,
      userId: dispatches.userId,
      userName: users.name,
      recordedByName: recordedBy.name,
      recordedByUserId: dispatches.recordedByUserId,
      quotationThreadId: dispatches.quotationThreadId,
      smacReference: quotationVersions.smacReference,
      status: dispatches.status,
      submittedAt: dispatches.submittedAt,
      approvedByName: approvedBy.name,
      approvedAt: dispatches.approvedAt,
      createdAt: dispatches.createdAt,
    })
    .from(dispatches)
    .innerJoin(companies, eq(companies.id, dispatches.companyId))
    .innerJoin(users, eq(users.id, dispatches.userId))
    .innerJoin(recordedBy, eq(recordedBy.id, dispatches.recordedByUserId))
    .leftJoin(approvedBy, eq(approvedBy.id, dispatches.approvedByUserId))
    // `S126` — the version this dispatch was RAISED FROM, so the reference is
    // the one it was dispatched against. LEFT, for the free-entry route `S75`.
    .leftJoin(
      quotationVersions,
      eq(quotationVersions.id, dispatches.quotationVersionId),
    )
    .where(where)
    // **The submitted scope is a QUEUE, and a queue is oldest first** `S87`.
    // It is what the coordinator works through, so the request that has been
    // waiting longest is the one at the top; every other scope is a record of
    // what happened, and reads newest first like every other list.
    .orderBy(
      ...(options.status === "submitted"
        ? [asc(dispatches.submittedAt)]
        : [desc(dispatches.dispatchDate), desc(dispatches.createdAt)]),
    )
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE);

  const [totals] = await db
    .select({ total: count() })
    .from(dispatches)
    .innerJoin(companies, eq(companies.id, dispatches.companyId))
    .innerJoin(users, eq(users.id, dispatches.userId))
    .where(where);

  const decorated = await decorate(session, rows);
  return { rows: decorated, total: totals?.total ?? 0, page };
}

type BareRow = {
  id: string;
  dispatchDate: string;
  sqm: string;
  companyId: string;
  companyName: string;
  userId: string;
  userName: string;
  recordedByName: string;
  recordedByUserId: string;
  quotationThreadId: string | null;
  smacReference: string | null;
  status: DispatchStatus;
  submittedAt: Date | null;
  approvedByName: string | null;
  approvedAt: Date | null;
  createdAt: Date;
};

/**
 * Add the two "may I open this?" flags.
 *
 * `16 §10` / `18 §2`: a coordinator sees the company NAME but may not open the
 * record, so the screen needs to know which to render. The name is already in
 * the row; only the link is in question.
 *
 * **The SMAC reference is no longer looked up here.** It used to be a second
 * query taking each thread's HIGHEST version number, which answered with
 * today's value rather than the dispatched one: the moment a rep revised, that
 * version was `requested` with a null reference and every dispatch already
 * recorded against the issued one silently lost its reference on screen. Since
 * `S126` the dispatch names the version it was raised from, so the caller
 * joins it and the lookup is gone.
 */
async function decorate(
  session: AuthSession,
  rows: BareRow[],
): Promise<DispatchListRow[]> {
  const threadIds = [
    ...new Set(
      rows
        .map((row) => row.quotationThreadId)
        .filter((id): id is string => id !== null),
    ),
  ];

  // `canOpenRecord`, not `canViewRecord`: both of these decide whether the
  // screen draws a link, which since `S76` is a different question from
  // whether the viewer may act `[authz:370]`.
  const companyIds = [...new Set(rows.map((row) => row.companyId))];
  const companyViewable = new Map<string, boolean>(
    await Promise.all(
      companyIds.map(
        async (id) => [id, await canOpenRecord(session, "company", id)] as const,
      ),
    ),
  );
  const threadViewable = new Map<string, boolean>(
    await Promise.all(
      threadIds.map(
        async (id) =>
          [id, await canOpenRecord(session, "quotation_thread", id)] as const,
      ),
    ),
  );

  return rows.map((row) => ({
    ...row,
    companyViewable: companyViewable.get(row.companyId) ?? false,
    threadViewable: row.quotationThreadId
      ? (threadViewable.get(row.quotationThreadId) ?? false)
      : false,
    isDirect: row.quotationThreadId === null,
  }));
}

/**
 * A dispatch's lines, with the four lookup names resolved `S53`.
 *
 * The same joins `loadLines` makes for a quotation version, against the same
 * four tables — the shape is the same shape `S116` says it is. `unitPrice`,
 * `lineTotal` and `vatAmount` are non-null columns here, so no screen has to
 * decide what an unpriced dispatch line would mean: there is no such thing.
 */
async function loadDispatchLines(
  dispatchId: string,
): Promise<DispatchLineRow[]> {
  const rows = await db
    .select({
      line: dispatchLines,
      supplierNameEn: productSuppliers.nameEn,
      supplierNameAr: productSuppliers.nameAr,
      classNameEn: productClasses.nameEn,
      classNameAr: productClasses.nameAr,
      fireRatingNameEn: productFireRatings.nameEn,
      fireRatingNameAr: productFireRatings.nameAr,
      thicknessMm: productThicknesses.thicknessMm,
    })
    .from(dispatchLines)
    .innerJoin(
      productSuppliers,
      eq(dispatchLines.supplierId, productSuppliers.id),
    )
    .innerJoin(productClasses, eq(dispatchLines.classId, productClasses.id))
    .innerJoin(
      productFireRatings,
      eq(dispatchLines.fireRatingId, productFireRatings.id),
    )
    .innerJoin(
      productThicknesses,
      eq(dispatchLines.thicknessId, productThicknesses.id),
    )
    .where(eq(dispatchLines.dispatchId, dispatchId))
    .orderBy(asc(dispatchLines.createdAt));

  return rows.map(({ line, ...parts }) => ({
    id: line.id,
    supplierId: line.supplierId,
    classId: line.classId,
    fireRatingId: line.fireRatingId,
    thicknessId: line.thicknessId,
    supplierNameEn: parts.supplierNameEn,
    supplierNameAr: parts.supplierNameAr,
    classNameEn: parts.classNameEn,
    classNameAr: parts.classNameAr,
    fireRatingNameEn: parts.fireRatingNameEn,
    fireRatingNameAr: parts.fireRatingNameAr,
    customColour: line.customColour,
    thicknessMm: parts.thicknessMm.replace(/\.?0+$/, ""),
    widthM: line.widthM,
    lengthM: line.lengthM,
    quantityPcs: line.quantityPcs,
    // Generated, so it is null in the insert type and never null in a row.
    sqm: line.sqm as string,
    unitPrice: line.unitPrice,
    lineTotal: line.lineTotal,
    vatAmount: line.vatAmount,
  }));
}

export async function getDispatch(
  session: AuthSession,
  id: string,
): Promise<DispatchDetail | null> {
  const recordedBy = alias(users, "recorded_by");
  const approvedBy = alias(users, "approved_by");

  const [row] = await db
    .select({
      id: dispatches.id,
      dispatchDate: dispatches.dispatchDate,
      sqm: dispatchSqm,
      companyId: dispatches.companyId,
      companyName: companies.name,
      userId: dispatches.userId,
      userName: users.name,
      recordedByName: recordedBy.name,
      recordedByUserId: dispatches.recordedByUserId,
      quotationThreadId: dispatches.quotationThreadId,
      smacReference: quotationVersions.smacReference,
      status: dispatches.status,
      submittedAt: dispatches.submittedAt,
      refusalReason: dispatches.refusalReason,
      approvedByName: approvedBy.name,
      approvedAt: dispatches.approvedAt,
      createdAt: dispatches.createdAt,
      projectId: dispatches.projectId,
      projectNameEn: projects.nameEn,
      projectNameAr: projects.nameAr,
      // `S74` — the thread's own, for the edit form's choose-or-show branch.
      threadProjectId: quotationThreads.projectId,
    })
    .from(dispatches)
    .innerJoin(companies, eq(companies.id, dispatches.companyId))
    .innerJoin(users, eq(users.id, dispatches.userId))
    .innerJoin(recordedBy, eq(recordedBy.id, dispatches.recordedByUserId))
    .leftJoin(approvedBy, eq(approvedBy.id, dispatches.approvedByUserId))
    // `S126` — the version it was raised from, never the thread's latest.
    .leftJoin(
      quotationVersions,
      eq(quotationVersions.id, dispatches.quotationVersionId),
    )
    // `S74` — the dispatch's OWN project, not its thread's. The two agree
    // whenever there is a thread, and this is the column that says so.
    .leftJoin(projects, eq(projects.id, dispatches.projectId))
    // And the thread itself, for the one thing only it can answer: whether the
    // quotation had a project of its own `S50`. LEFT, for the free route `S75`.
    .leftJoin(
      quotationThreads,
      eq(quotationThreads.id, dispatches.quotationThreadId),
    )
    // The same VISIBILITY rule the list asks of every row, asked of this one —
    // and deliberately no status term. `S122` keeps a refused request out of
    // the working lists, not out of sight: *a rep sees their own; coordinators
    // and managers see all*, and the archive opens one.
    .where(and(eq(dispatches.id, id), visibleDispatchesFilter(session)))
    .limit(1);

  if (!row) return null;

  const [decorated, lines] = await Promise.all([
    decorate(session, [row]).then(([only]) => only),
    loadDispatchLines(row.id),
  ]);
  // **Credit is a consequence of approval** `S72`, so an unapproved request has
  // none to show. Not zero and not a table of shares nobody has been given —
  // absent, which is what the screen renders.
  const credits =
    row.status === "approved"
      ? await creditForDispatches([
          {
            id: row.id,
            userId: row.userId,
            userName: row.userName,
            sqm: row.sqm,
            dispatchDate: row.dispatchDate,
            projectId: row.projectId,
          },
        ])
      : null;

  return {
    ...decorated,
    projectId: row.projectId,
    projectNameEn: row.projectNameEn,
    projectNameAr: row.projectNameAr,
    threadProjectId: row.threadProjectId,
    refusalReason: row.refusalReason,
    // `S76`'s own reason, on the screen it was written for: the coordinator
    // records this dispatch, so the project it carries is theirs to open.
    projectViewable: row.projectId
      ? await canOpenRecord(session, "project", row.projectId)
      : false,
    // `S116` — what actually went out, which is what the invoice is made from.
    lines,
    credit: credits?.get(row.id) ?? null,
  };
}

/**
 * Threads a dispatch request may be raised against: visible to this identity
 * and **issued** `S126`.
 *
 * The dropdown never offers what the action refuses — the same principle
 * `listQuotationFormOptions` follows. An unissued quotation is simply not in
 * the list, and the screen says why rather than letting someone pick it and be
 * told no.
 *
 * **Payment is no longer one of those refusals** `S72`. `requestDispatch` does
 * not check it, so this list must not either, or the two would disagree and a
 * rep would find a quotation missing with nothing to explain it. The check is
 * `approveDispatchRequest`'s now.
 *
 * **`status = 'issued'`, not `<> 'superseded'`** `S126`. It used to take the
 * live version whatever its status, which offered threads whose version was
 * still `requested` and being edited `S61`. The narrowing has a second effect
 * worth naming: a thread mid-revision has no issued version at all `S66`, so it
 * leaves this list until the coordinator issues the new one. That is the rule,
 * not a gap — there is nothing stable to dispatch against in between.
 *
 * It also makes `smacReference` non-null: `issueVersion` is what writes it, and
 * writing it is what makes a version issued.
 *
 * Ordered by the thread's own age rather than by `payment_confirmed_at`, which
 * is null on most of these now.
 *
 * **The project join is LEFT** `S50`: a quotation with no project is precisely
 * the one `S74`'s second branch exists for, and an inner join would hide it
 * from the only screen that can resolve it.
 *
 * **Each thread carries its issued version's lines** `S116` — a dispatch
 * raised from a quotation arrives pre-filled with them. They travel to the form
 * with the option, so choosing a quotation fills the rows without a second
 * navigation. Service lines are not among them `S116`.
 */
/**
 * The issued versions' product lines, keyed by version `S116`.
 *
 * One query for every offered thread rather than one per thread, and service
 * lines are not among them: `S116` says a dispatch never carries one.
 */
async function prefillByVersion(
  versionIds: string[],
): Promise<Map<string, DispatchLineInput[]>> {
  const prefill = new Map<string, DispatchLineInput[]>();
  if (versionIds.length === 0) return prefill;

  const lines = await db
    .select({
      versionId: quotationLines.versionId,
      supplierId: quotationLines.supplierId,
      classId: quotationLines.classId,
      fireRatingId: quotationLines.fireRatingId,
      customColour: quotationLines.customColour,
      thicknessId: quotationLines.thicknessId,
      widthM: quotationLines.widthM,
      lengthM: quotationLines.lengthM,
      quantityPcs: quotationLines.quantityPcs,
      unitPrice: quotationLines.unitPrice,
    })
    .from(quotationLines)
    .where(inArray(quotationLines.versionId, versionIds))
    // The order the quotation lists them in, so the prefilled rows read the
    // same way round as the quotation the coordinator is holding.
    .orderBy(asc(quotationLines.createdAt));

  for (const line of lines) {
    const bucket = prefill.get(line.versionId) ?? [];
    bucket.push({
      supplierId: line.supplierId,
      classId: line.classId,
      fireRatingId: line.fireRatingId,
      customColour: line.customColour,
      thicknessId: line.thicknessId,
      widthM: line.widthM,
      lengthM: line.lengthM,
      quantityPcs: line.quantityPcs,
      // `S58` — an unpriced quotation line arrives unpriced, and the empty box
      // is the point: `S116` makes the rep price it before this is a dispatch,
      // and `recordDispatch` refuses it if they do not.
      unitPrice: line.unitPrice ?? "",
    });
    prefill.set(line.versionId, bucket);
  }
  return prefill;
}

export async function listDispatchableThreads(
  session: AuthSession,
): Promise<DispatchableThread[]> {
  const rows = await db
    .select({
      id: quotationThreads.id,
      versionId: quotationVersions.id,
      smacReference: quotationVersions.smacReference,
      projectId: quotationThreads.projectId,
      projectNameEn: projects.nameEn,
      projectNameAr: projects.nameAr,
      companyId: quotationThreads.companyId,
      companyName: companies.name,
      raisedByUserId: quotationThreads.raisedByUserId,
      raisedByName: users.name,
      quotedSqm: quotationVersions.totalSqm,
    })
    .from(quotationThreads)
    .innerJoin(
      quotationVersions,
      and(
        eq(quotationVersions.threadId, quotationThreads.id),
        // `S126` — issued, which is the only status that may be dispatched
        // against. At most one version of a thread ever holds it.
        eq(quotationVersions.status, "issued"),
      ),
    )
    .leftJoin(projects, eq(projects.id, quotationThreads.projectId))
    .innerJoin(companies, eq(companies.id, quotationThreads.companyId))
    .innerJoin(users, eq(users.id, quotationThreads.raisedByUserId))
    // **No payment term** since `S72`. The gate moved to the approval, so a rep
    // may request against any issued quotation they can see and the coordinator
    // is the one who cannot approve it until finance has confirmed. Offering
    // only paid quotations here would put the gate back on the rep by the side
    // door, and the rep would never learn why a quotation was missing.
    .where(visibleQuotationThreadsFilter(session))
    .orderBy(desc(quotationThreads.createdAt));

  if (rows.length === 0) return [];

  // The running total, summed from the LINES `S116` — an inner join, because a
  // dispatch always has at least one and one with none would be a defect this
  // figure should not paper over with a zero.
  const dispatched = await db
    .select({
      threadId: dispatches.quotationThreadId,
      // Written out for the reason `dispatchSqm` carries above.
      total: sql<string>`coalesce(sum(dispatch_lines.sqm), 0)::numeric(14, 4)`,
    })
    .from(dispatches)
    .innerJoin(dispatchLines, eq(dispatchLines.dispatchId, dispatches.id))
    .where(
      and(
        // `S72` — *dispatched so far* means approved. A request sitting with
        // the coordinator has not gone out, and counting it here would tell the
        // next rep that a quantity had shipped when nothing had.
        approvedDispatches(),
        inArray(
          dispatches.quotationThreadId,
          rows.map((row) => row.id),
        ),
      ),
    )
    .groupBy(dispatches.quotationThreadId);

  const totals = new Map(
    dispatched.map((row) => [row.threadId as string, row.total]),
  );

  const prefill = await prefillByVersion(rows.map((row) => row.versionId));

  return rows.map((row) => ({
    ...row,
    // Non-null by `S126`: only an issued version reaches this list, and
    // issuing is the act that writes the reference.
    smacReference: row.smacReference as string,
    dispatchedSqm: totals.get(row.id) ?? "0.0000",
    lines: prefill.get(row.versionId) ?? [],
  }));
}

/**
 * Companies a `can_dispatch` holder may NAME on the direct-dispatch form
 * `[18 §2]`. Search, not browse: a typed query of at least two characters, a
 * small limit, and names only — no address, no contacts, no link.
 */
export async function searchDispatchCompanies(
  session: AuthSession,
  query: string,
  limit = 20,
): Promise<{ id: string; name: string }[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];
  const pattern = `%${trimmed}%`;

  return db
    .select({
      id: companies.id,
      name: companies.name,
    })
    .from(companies)
    .where(
      and(
        dispatchCompanyLookupFilter(session),
        isNull(companies.archivedAt),
        isNull(companies.mergedIntoId),
        // One name field `S12`, so one column to match — this was the only
        // place the Arabic name was ever searched.
        sql`${companies.name} ilike ${pattern}`,
      ),
    )
    .orderBy(companies.name)
    .limit(limit);
}

/**
 * Projects a `can_dispatch` holder may name on a dispatch `S74`.
 *
 * Ordered by name. **Only a LOST project is left out** `[07 C5]`: it is
 * finished, and offering one is offering a mistake. Everything else stays —
 * and `won` in particular, because `S31` makes a project won when the payment
 * arrives, which is the moment before the dispatch this picker exists for.
 * Filtering to `end_state is null` would have hidden exactly the projects most
 * likely to be dispatched against. `is distinct from` rather than `<>`, or
 * the null end state — the ordinary case — fails the comparison and every
 * live project disappears.
 *
 * **Ordinary project visibility since `S76`.** It used to compose a name-only
 * lookup filter of its own, because the only role holding `can_dispatch` could
 * not see a project at all while `S74` obliges that role to choose one; `S76`
 * made the coordinator's sight real and the stopgap came out with it. What is
 * left in the `where` is the picker's own rule, above, and no visibility rule
 * of its own.
 *
 * **It cannot be narrowed to the company's own projects.** `S74`'s second half
 * is that the company is ADDED to the project it did not belong to, so a
 * picker that only offered projects it already belonged to would make the rule
 * unusable.
 */
export async function listDispatchProjectOptions(
  session: AuthSession,
): Promise<{ id: string; nameEn: string; nameAr: string | null }[]> {
  return db
    .select({
      id: projects.id,
      nameEn: projects.nameEn,
      nameAr: projects.nameAr,
    })
    .from(projects)
    .where(
      and(
        visibleProjectsFilter(session),
        sql`${projects.endState} is distinct from 'lost'`,
      ),
    )
    .orderBy(projects.nameEn);
}

/**
 * Every dispatch in a period, for achievement `[04 C1]`.
 *
 * **Deliberately unfiltered by `visibleDispatchesFilter`.** The visibility
 * question on the targets screen is *whose totals may you read*, answered by
 * `visibleMeasuredUsersFilter` over PEOPLE. Filtering the underlying rows as
 * well would understate a person's total, and a silently wrong number is worse
 * than a refused screen. A `user_id IN (…)` filter would be wrong for the same
 * reason in reverse: a dispatch naming rep Y can credit rep X through a split.
 */
export async function dispatchesInPeriod(
  periodStart: string,
  nextPeriodStart: string,
): Promise<(CreditableDispatch & { isDirect: boolean })[]> {
  const rows = await db
    .select({
      id: dispatches.id,
      userId: dispatches.userId,
      userName: users.name,
      // `S116` — summed from the lines, in SQL, like every other reader of
      // this figure. The correlated form composes here as it does on the list.
      sqm: dispatchSqm,
      dispatchDate: dispatches.dispatchDate,
      quotationThreadId: dispatches.quotationThreadId,
      // `S74` — the dispatch's own project. A credit split is a fact about a
      // project on a date, so it reads what the dispatch records, not what
      // its thread happens to say today.
      projectId: dispatches.projectId,
    })
    .from(dispatches)
    .innerJoin(users, eq(users.id, dispatches.userId))
    .where(
      and(
        // **`S72`'s central claim, at the reader that matters most.** *An
        // approved dispatch is the only event that credits a target — not the
        // request.* Every square metre on the targets screen passes through
        // here, so this is the one term whose absence would be a rep's month
        // reading high for work nobody has approved.
        approvedDispatches(),
        gte(dispatches.dispatchDate, periodStart),
        lt(dispatches.dispatchDate, nextPeriodStart),
      ),
    );

  return rows.map((row) => ({
    id: row.id,
    userId: row.userId,
    userName: row.userName,
    sqm: row.sqm,
    dispatchDate: row.dispatchDate,
    projectId: row.projectId,
    isDirect: row.quotationThreadId === null,
  }));
}
