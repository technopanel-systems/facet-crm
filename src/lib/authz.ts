/**
 * THE authorization module — the single place any permission question is
 * answered. One layer, in application code, in one place `[03]`, CLAUDE.md.
 *
 * Rules of this file:
 *
 *  - No role names. Permissions are the boolean flags on the `roles` row,
 *    read from data `[07 A5 C1]`. Adding a role is configuration.
 *  - No other module reads or writes the `sessions` table, checks a flag, or
 *    decides visibility. Screens and actions call in here.
 *  - Deactivated users lose access immediately: `getSession` re-checks
 *    `users.is_active` on every call and destroys the user's sessions the
 *    moment it finds the flag off `[07 B7]`.
 *  - Impersonation `[07 A5, A6]` lives on the session row. While active,
 *    permissions and visibility are the impersonated user's; the audit actor
 *    carries BOTH identities on every action.
 *
 * Visibility `[04 Q7]`, `[07 B2]`: sharing is per record. Company visibility
 * comes from membership (`company_reps`) or an explicit company share — and a
 * shared company does NOT expose its projects or quotations. Projects and
 * quotation threads need ownership or their own share. One founder-decided
 * extension (phase 6): owning — or being explicitly shared — a project grants
 * visibility of the quotation threads raised on it. Contacts follow their
 * company `[14 §1]`: they have no owner of their own, and per-rep contact
 * privacy is not expressible without a column no document requires.
 *
 * Visibility grants EDIT, not merely read `[14 §2, §3]`. A share is working
 * access — the point of sharing is that both people work the record — and the
 * executive may edit records too. There is deliberately no `can_edit` flag:
 * the answer is that the question needs no flag.
 */

import {
  and,
  asc,
  count,
  eq,
  exists,
  ilike,
  isNull,
  ne,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { QueryBuilder, type AnyPgColumn } from "drizzle-orm/pg-core";
import { getLocale } from "next-intl/server";

import { auth, getSessionToken } from "@/auth";
import { db } from "@/db";
import {
  companies,
  companyReps,
  contacts,
  dispatches,
  projects,
  quotationThreads,
  recordShares,
  repReports,
  roles,
  sessions,
  users,
} from "@/db/schema";
import { redirect } from "@/i18n/navigation";
import { withAudit, type AuditActor } from "@/lib/audit";
import { hashPassword } from "@/lib/passwords";
import { RuleError } from "@/lib/validation";

export type Role = typeof roles.$inferSelect;
export type User = typeof users.$inferSelect;

/**
 * The boolean columns of `roles`, derived from the schema — a new flag
 * column extends this type automatically; nothing here needs to change.
 */
export type PermissionFlag = {
  [K in keyof Role]-?: Role[K] extends boolean ? K : never;
}[keyof Role];

type UserWithRole = User & { role: Role };

export type AuthSession = {
  /**
   * The effective identity — whose permissions and visibility apply. The
   * impersonated user while impersonating, otherwise the real user.
   */
  user: UserWithRole;
  /** The person actually at the keyboard. */
  realUser: UserWithRole;
  isImpersonating: boolean;
  /** Ready to hand to `withAudit` — carries both identities `[07 A6]`. */
  actor: AuditActor;
};

/**
 * Record kinds whose visibility is answerable today (others arrive with
 * their feature phases and must be added HERE, nowhere else).
 *
 * **`"dispatch"` is deliberately absent, though the `record_type` enum has
 * it.** Adding it forces an exhaustive `canViewRecord` case, and Slice 3 has
 * nothing to call one: `canViewRecord` exists for WRITE paths, "where an id
 * arrives from a form and must be checked before it is written into another
 * record", and dispatches are append-only — no document asks for an edit, and
 * deletion is a `delete_request`. The dispatch screens compose
 * `visibleDispatchesFilter` into the WHERE, exactly as the quotation screens
 * do. A dead branch here is the failure CLAUDE.md names.
 *
 * **The trigger for adding it:** the first write path that takes a dispatch id
 * from a form — a void/correct action, or per-dispatch sharing. Add the value
 * and a real case together, in the same change.
 *
 * **Phase 9 tested that rule and added nothing** `[20 §13]`. A rep report is
 * editable, so a report id does arrive from a form — but only its author may
 * edit `[20 §9]`, which is an identity question, not a visibility one. Reads
 * compose `visibleRepReportsFilter` into the WHERE like every other list. A
 * `"rep_report"` case would have had no caller.
 */
export type ViewableRecordType =
  | "company"
  | "contact"
  | "project"
  | "quotation_thread";

/* ------------------------------------------------------------------ *
 * Session
 * ------------------------------------------------------------------ */

async function loadUserWithRole(userId: string): Promise<UserWithRole | null> {
  const [row] = await db
    .select({ user: users, role: roles })
    .from(users)
    .innerJoin(roles, eq(users.roleId, roles.id))
    .where(eq(users.id, userId))
    .limit(1);
  return row ? { ...row.user, role: row.role } : null;
}

/**
 * The current session, or null. This is the only session entry point;
 * `auth()` is never called outside this module.
 */
export async function getSession(): Promise<AuthSession | null> {
  // Auth.js owns cookie parsing and expiry: an expired or unknown token
  // resolves to null here and the row is cleaned up by the library.
  const authSession = await auth();
  if (!authSession?.user?.id) return null;

  const token = await getSessionToken();
  if (!token) return null;

  const [row] = await db
    .select({ session: sessions, user: users, role: roles })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .innerJoin(roles, eq(users.roleId, roles.id))
    .where(eq(sessions.sessionToken, token))
    .limit(1);
  if (!row) return null;

  const realUser: UserWithRole = { ...row.user, role: row.role };

  // Deactivation is immediate `[07 B7]`: the next request a deactivated user
  // makes lands here, finds the flag off, and every one of their sessions is
  // destroyed on the spot.
  if (!realUser.isActive) {
    await db.delete(sessions).where(eq(sessions.userId, realUser.id));
    return null;
  }

  let user = realUser;
  let isImpersonating = false;
  if (row.session.actingAsUserId) {
    const target = await loadUserWithRole(row.session.actingAsUserId);
    if (!target || !target.isActive) {
      // The impersonated account vanished or was deactivated — impersonation
      // auto-ends; the real identity continues.
      await db
        .update(sessions)
        .set({ actingAsUserId: null })
        .where(eq(sessions.sessionToken, token));
    } else {
      user = target;
      isImpersonating = true;
    }
  }

  return {
    user,
    realUser,
    isImpersonating,
    actor: {
      actorUserId: realUser.id,
      actingAsUserId: isImpersonating ? user.id : null,
    },
  };
}

/** Session or a locale-aware redirect to the login page. */
export async function requireSession(): Promise<AuthSession> {
  const session = await getSession();
  if (!session) {
    const locale = await getLocale();
    redirect({ href: "/login", locale });
    throw new Error("unreachable"); // redirect() never returns
  }
  return session;
}

/* ------------------------------------------------------------------ *
 * Permission flags
 * ------------------------------------------------------------------ */

/** Does the effective identity hold this flag? Flags only — never names. */
export function can(session: AuthSession, flag: PermissionFlag): boolean {
  return session.user.role[flag];
}

/**
 * `requireSession` plus a flag check. Throws on denial — server actions
 * surface this as a failure, never as silent success.
 *
 * The refusal is a `RuleError` carrying a translation key, not a raw string:
 * `ruleErrorState` RETHROWS anything else, so a plain `Error` here would reach
 * the user as a 500 instead of a message `[19 §7]`. Currently unused — kept
 * because it is correct, harmless structure `[13 §2]`.
 */
export async function requirePermission(
  flag: PermissionFlag,
): Promise<AuthSession> {
  const session = await requireSession();
  if (!can(session, flag)) {
    throw new RuleError("team.errors.permissionDenied");
  }
  return session;
}

/* ------------------------------------------------------------------ *
 * Per-record visibility `[04 Q7]`
 * ------------------------------------------------------------------ */

async function hasActiveShare(
  userId: string,
  recordType: ViewableRecordType,
  recordId: string,
): Promise<boolean> {
  const [share] = await db
    .select({ id: recordShares.id })
    .from(recordShares)
    .where(
      and(
        eq(recordShares.recordType, recordType),
        eq(recordShares.recordId, recordId),
        eq(recordShares.sharedWithUserId, userId),
        isNull(recordShares.revokedAt),
      ),
    )
    .limit(1);
  return share !== undefined;
}

async function canViewProject(
  userId: string,
  projectId: string,
): Promise<boolean> {
  const [project] = await db
    .select({ ownerUserId: projects.ownerUserId })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  if (!project) return false;
  if (project.ownerUserId === userId) return true;
  return hasActiveShare(userId, "project", projectId);
}

/**
 * May the effective identity see this record?
 *
 * - `sees_all_reps` sees everything.
 * - company: active `company_reps` membership OR an unrevoked company share.
 * - contact: whatever its company resolves to `[14 §1]`.
 * - project: owner OR an explicit project share. Company membership is
 *   deliberately never consulted — a shared company does not expose its
 *   projects `[04 Q7]`.
 * - quotation_thread: raising rep OR an explicit thread share OR visibility
 *   of the parent project (owner/share — founder decision, phase 6).
 *
 * This answers ONE record. A list needs the same rule pushed into SQL — see
 * the filters below. Detail screens use the filters too; this function is for
 * write paths, where an id arrives from a form and must be checked before it
 * is written into another record.
 */
export async function canViewRecord(
  session: AuthSession,
  recordType: ViewableRecordType,
  recordId: string,
): Promise<boolean> {
  if (session.user.role.seesAllReps) return true;
  const userId = session.user.id;

  switch (recordType) {
    case "company": {
      const [membership] = await db
        .select({ id: companyReps.id })
        .from(companyReps)
        .where(
          and(
            eq(companyReps.companyId, recordId),
            eq(companyReps.userId, userId),
            isNull(companyReps.removedAt),
          ),
        )
        .limit(1);
      if (membership) return true;
      return hasActiveShare(userId, "company", recordId);
    }
    case "contact": {
      // A contact has no owner of its own; it follows its company `[14 §1]`.
      const [contact] = await db
        .select({ companyId: contacts.companyId })
        .from(contacts)
        .where(eq(contacts.id, recordId))
        .limit(1);
      if (!contact) return false;
      return canViewRecord(session, "company", contact.companyId);
    }
    case "project":
      return canViewProject(userId, recordId);
    case "quotation_thread": {
      // The coordinator processes every quotation in the company `[16 §10]`.
      if (session.user.role.canApproveQuotation) return true;
      const [thread] = await db
        .select({
          raisedByUserId: quotationThreads.raisedByUserId,
          projectId: quotationThreads.projectId,
        })
        .from(quotationThreads)
        .where(eq(quotationThreads.id, recordId))
        .limit(1);
      if (!thread) return false;
      if (thread.raisedByUserId === userId) return true;
      if (await hasActiveShare(userId, "quotation_thread", recordId)) {
        return true;
      }
      return canViewProject(userId, thread.projectId);
    }
  }
}

/* ------------------------------------------------------------------ *
 * List scoping `[04 Q7]`, `[07 B2]`
 *
 * `canViewRecord` answers one record; a list has to ask the same question of
 * every row, so the rule is expressed a second time as a WHERE fragment.
 * The two are the same rule and must stay that way — a change to one is a
 * change to the other.
 *
 * Each builder returns a fragment for a query selecting from the named table
 * UNALIASED, or `undefined` when the identity sees everything. `undefined` is
 * not a special case for callers: `and(undefined, x)` is `x` in Drizzle, so
 * every list composes the filter without branching.
 *
 * These functions are the ONLY place a visibility predicate is built. A
 * hand-written `where(eq(projects.ownerUserId, session.user.id))` in a page is
 * precisely the bug this exists to prevent, and with no database policies to
 * fall back on `[03]` nothing else would catch it.
 * ------------------------------------------------------------------ */

/** Dialect-less builder: these stay pure, synchronous and connection-free. */
const subquery = new QueryBuilder();

/** `exists (select 1 from record_shares ...)`, correlated on a record column. */
function activeShareExists(
  recordType: ViewableRecordType,
  recordIdColumn: AnyPgColumn,
  userId: string,
): SQL {
  return exists(
    subquery
      .select({ one: sql`1` })
      .from(recordShares)
      .where(
        and(
          eq(recordShares.recordType, recordType),
          // Column-to-column: this is what correlates the subquery.
          eq(recordShares.recordId, recordIdColumn),
          eq(recordShares.sharedWithUserId, userId),
          isNull(recordShares.revokedAt),
        ),
      ),
  );
}

/** `exists (select 1 from company_reps ...)`, correlated on a company column. */
function activeMembershipExists(
  companyIdColumn: AnyPgColumn,
  userId: string,
): SQL {
  return exists(
    subquery
      .select({ one: sql`1` })
      .from(companyReps)
      .where(
        and(
          eq(companyReps.companyId, companyIdColumn),
          eq(companyReps.userId, userId),
          isNull(companyReps.removedAt),
        ),
      ),
  );
}

/** Companies: active membership OR an unrevoked company share. */
export function visibleCompaniesFilter(session: AuthSession): SQL | undefined {
  if (session.user.role.seesAllReps) return undefined;
  const userId = session.user.id;
  return or(
    activeMembershipExists(companies.id, userId),
    activeShareExists("company", companies.id, userId),
  );
}

/**
 * Contacts: whatever their company resolves to `[14 §1]`. The terms are the
 * company rule with `contacts.company_id` substituted for `companies.id`.
 *
 * `record_type` has a `contact` value and `record_shares` could carry one, but
 * nothing writes such a row and no document asks for per-contact sharing, so
 * it is not consulted here. Wiring it up on speculation is what produced v1's
 * dead approval gate.
 */
export function visibleContactsFilter(session: AuthSession): SQL | undefined {
  if (session.user.role.seesAllReps) return undefined;
  const userId = session.user.id;
  return or(
    activeMembershipExists(contacts.companyId, userId),
    activeShareExists("company", contacts.companyId, userId),
  );
}

/**
 * Projects: owner OR an explicit project share.
 *
 * Company membership is NEVER a term here. A shared company does not expose
 * its projects `[04 Q7]` — that is the single rule this whole slice exists to
 * get right. If you are about to join `project_companies` into this function
 * to "fix" a project that will not appear, read `04 Q7` first: the project is
 * not appearing because it is not meant to.
 */
export function visibleProjectsFilter(session: AuthSession): SQL | undefined {
  if (session.user.role.seesAllReps) return undefined;
  const userId = session.user.id;
  return or(
    eq(projects.ownerUserId, userId),
    activeShareExists("project", projects.id, userId),
  );
}

/**
 * Quotation threads: the raising rep, an explicit thread share, or visibility
 * of the parent project `[11 §2]` — plus the coordinator, who sees them all.
 *
 * This is the SQL twin of `canViewRecord`'s `quotation_thread` case above, and
 * the two are one rule — a change to either is a change to both.
 *
 * **`can_approve_quotation` sees every thread** `[16 §10]`. The founder's
 * reason: internal sales creates the quotation in the ERP, so the coordinator
 * is already handling all of them. Without this the flag was dead — the only
 * role that holds it could not reach a single quotation to approve, because
 * `sees_all_reps` is false for Sales Coordinator in the seed.
 *
 * **It is scoped to quotations and stops there.** A coordinator gets no
 * company, contact or project visibility from it — `16 §10` limits them to the
 * project title, company name and contact name that the quotation itself
 * carries. The detail screen enforces that by linking those records only when
 * the viewer may actually open them.
 *
 * The project term is the founder decision in `11 §2`: project visibility
 * cascades to the threads raised on it, or a rep would lose sight of their own
 * deal for want of a share click. Note what none of this does: company
 * membership is still never consulted, here or in `visibleProjectsFilter`.
 * Company → projects does not cascade `[04 Q7]`.
 */
export function visibleQuotationThreadsFilter(
  session: AuthSession,
): SQL | undefined {
  if (session.user.role.seesAllReps) return undefined;
  if (session.user.role.canApproveQuotation) return undefined;
  const userId = session.user.id;
  return or(
    eq(quotationThreads.raisedByUserId, userId),
    activeShareExists("quotation_thread", quotationThreads.id, userId),
    exists(
      subquery
        .select({ one: sql`1` })
        .from(projects)
        .where(
          and(
            // Column-to-column: this is what correlates the subquery.
            eq(projects.id, quotationThreads.projectId),
            or(
              eq(projects.ownerUserId, userId),
              activeShareExists("project", projects.id, userId),
            ),
          ),
        ),
    ),
  );
}

/**
 * Dispatches `[18 §2]`: the coordinator who records them, the rep they credit,
 * or the quotation thread they were dispatched against.
 *
 * **`can_dispatch` sees every dispatch** `[18 §2]` — the founder's answer, and
 * the same shape `16 §10` gives `can_approve_quotation`. State the delta
 * honestly: terms 3 and 4 already give a coordinator every *linked* dispatch
 * (they see every thread, and term 4 cascades that) plus any naming them. What
 * this term actually adds is **another coordinator's direct dispatches** — a
 * small delta, and a real hole when one coordinator covers for another.
 *
 * **The credited rep** (term 3) must see the event that credits their target:
 * `04 C1` makes the dispatch the only source of achieved SQM, and `07 G3`'s
 * success criterion is that every dispatched sqm traces to a rep. One they
 * cannot see is one they cannot check.
 *
 * **The thread cascade** (term 4) extends `11 §2` by one step in the direction
 * `11 §2` already went: project visibility cascades to the threads raised on
 * it because a quotation is part of that deal rather than a separate secret,
 * and a dispatch against that quotation is equally part of it. It exists for
 * exactly one population — a rep who owns or is shared a project, seeing a
 * dispatch on that project's quotation that names a *different* rep. That is
 * the shared-credit case `[18 §3]`: without this term a rep credited by a split
 * cannot see the dispatch that credited them.
 *
 * **No share term, deliberately.** `record_shares` could carry a `dispatch`
 * row and the enum has the value, but nothing writes one and no document asks
 * for per-dispatch sharing — the same reasoning already written above
 * `visibleContactsFilter`. Wiring it up on speculation is what produced v1's
 * dead approval gate.
 */
export function visibleDispatchesFilter(
  session: AuthSession,
): SQL | undefined {
  if (session.user.role.seesAllReps) return undefined;
  if (session.user.role.canDispatch) return undefined;
  const userId = session.user.id;
  return or(
    eq(dispatches.userId, userId),
    exists(
      subquery
        .select({ one: sql`1` })
        .from(quotationThreads)
        .where(
          and(
            // Column-to-column: this is what correlates the subquery.
            eq(quotationThreads.id, dispatches.quotationThreadId),
            // `and(x, undefined)` is `x` in Drizzle, so an identity that sees
            // every thread degrades correctly to "any thread".
            visibleQuotationThreadsFilter(session),
          ),
        ),
    ),
  );
}

/**
 * `exists (select 1 from projects ...)`, correlated on a project column.
 *
 * The SQL twin of `visibleProjectsFilter`, for the tables that reference a
 * project rather than being one. The two are ONE rule — a change to either is a
 * change to both — and the terms are deliberately identical: owner, or an
 * explicit project share. Company membership is not a term here either
 * `[04 Q7]`.
 */
function projectVisibleExists(
  projectIdColumn: AnyPgColumn,
  userId: string,
): SQL {
  return exists(
    subquery
      .select({ one: sql`1` })
      .from(projects)
      .where(
        and(
          // Column-to-column: this is what correlates the subquery.
          eq(projects.id, projectIdColumn),
          or(
            eq(projects.ownerUserId, userId),
            activeShareExists("project", projects.id, userId),
          ),
        ),
      ),
  );
}

/**
 * Rep reports: a report follows its anchor `[20 §10]`.
 *
 * **This supersedes `04 Q6`'s "activities are private to the rep, without
 * exception"**, restated in `01 §4.1` and `09 §8.1`. `20 §1` makes the point of
 * the whole phase that this knowledge stops being personal property, and a
 * report only the writer can read hands nothing over when they leave.
 *
 * Three terms, and the second is the one that is easy to get wrong:
 *
 *  1. **A field note has no anchor, so it follows its author.** It names no
 *     company and touches no customer timeline `[20 §2]`; there is nothing else
 *     for its visibility to hang on.
 *  2. **A company-level report follows the company** — the same two terms as
 *     `visibleCompaniesFilter`, substituting `rep_reports.company_id`.
 *  3. **A report naming a project must clear the project TOO** — `and`, not
 *     `or`. Without this a rep who has been shared a company would read the
 *     name of a project they are not allowed to see, which is exactly what
 *     `04 Q7` forbids and the one rule Slice 1 exists to get right.
 *
 * **Consequence, and it is intended:** a rep removed from a company loses sight
 * of reports they wrote themselves. That is `20 §1` working — the history
 * belonged to the company. It is also why handover needs no report bucket
 * `[20 §10]`: visibility moves the moment the membership does, and `19 §1`
 * leaves the author column alone.
 *
 * **No share term of its own.** `record_shares` could carry a report and
 * nothing writes such a row — the same reasoning as `visibleContactsFilter` and
 * `visibleDispatchesFilter`. A report is reached through its anchor's share.
 */
export function visibleRepReportsFilter(
  session: AuthSession,
): SQL | undefined {
  if (session.user.role.seesAllReps) return undefined;
  const userId = session.user.id;
  return or(
    and(isNull(repReports.companyId), eq(repReports.userId, userId)),
    and(
      or(
        activeMembershipExists(repReports.companyId, userId),
        activeShareExists("company", repReports.companyId, userId),
      ),
      or(
        isNull(repReports.projectId),
        projectVisibleExists(repReports.projectId, userId),
      ),
    ),
  );
}

/**
 * Whose target and achievement this identity may read `[07 D1]`, `[07 D2]`.
 *
 * `sees_all_reps` — manager, executive, super admin — reads everyone's;
 * everybody else reads their own and nobody else's. Note the correct
 * consequence for the coordinator: they hold `can_dispatch` but not
 * `sees_all_reps`, so they see only their own target, which is right —
 * `04 Q12` says a coordinator may carry one, not that they supervise others.
 *
 * This is the predicate that decides ACCESS on the targets screen. It scopes
 * by PERSON, not by dispatch row: a person's achieved sqm is the sum of what
 * credits them, whether or not the viewer could open each underlying dispatch.
 * Filtering the rows as well would understate the number, and a silently wrong
 * total is worse than a refused screen.
 */
export function visibleMeasuredUsersFilter(
  session: AuthSession,
): SQL | undefined {
  if (session.user.role.seesAllReps) return undefined;
  return eq(users.id, session.user.id);
}

/**
 * Companies a `can_dispatch` holder may NAME on the dispatch form `[18 §2]`.
 *
 * A direct dispatch `[07 C6]` requires a company, and the only role holding
 * `can_dispatch` — Sales Coordinator — has `sees_all_reps: false` and no
 * `company_reps` membership, so `visibleCompaniesFilter` returns nothing for
 * them. Without this the flag is dead on arrival, which is precisely the
 * situation `16 §10` was asked about and fixed for quotations.
 *
 * **The grant stops at the name.** `18 §2` is explicit: no company record, no
 * address, no contacts, no projects, no link to open it. `canViewRecord` and
 * `visibleCompaniesFilter` are untouched, so `/companies` and every other
 * screen behave exactly as before; the dispatch screens render a company as
 * plain text unless the viewer may open it on their own. Callers pair this
 * with a typed query and a small limit — a lookup, not a directory dump.
 */
export function dispatchCompanyLookupFilter(
  session: AuthSession,
): SQL | undefined {
  if (session.user.role.canDispatch) return undefined;
  return visibleCompaniesFilter(session);
}

/* ------------------------------------------------------------------ *
 * User management — gated on `can_manage_users`, audited by the data layer
 * ------------------------------------------------------------------ */

/**
 * The active-user directory, for the pickers that name a person: the rep on a
 * direct dispatch, the members of a credit split `[18 §3]`, the subject of a
 * target `[07 D1]`.
 *
 * Names only, and no visibility filter — a list of colleagues is not a record.
 * Every screen that calls this is already behind `can_dispatch`,
 * `can_set_credit_split` or `can_set_targets`, and the write each one feeds
 * re-checks that flag in the data layer.
 *
 * Deactivated accounts are excluded: they may not be given new work. History
 * keeps pointing at them `[04 C2]` — this is the *picker*, not the display.
 */
export async function listActiveUsers(): Promise<
  { id: string; name: string }[]
> {
  return db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(eq(users.isActive, true))
    .orderBy(users.name);
}

/* --- The management screens `[19]` -------------------------------- */

/** `09 §3.1` — no document sets a page size; 25 is a display detail. */
const PAGE_SIZE = 25;

/** The minimum a password may be, matching `scripts/bootstrap-admin.ts`. */
const MIN_PASSWORD_LENGTH = 8;

/**
 * A person as user management sees them.
 *
 * **`password_hash` is never selected.** `canSignIn` is derived from whether
 * one exists `[11 §1]` — "Null = cannot log in" — so a screen can say so
 * without the hash ever leaving the database.
 */
export type ManagedUserRow = {
  id: string;
  name: string;
  email: string;
  roleId: string;
  roleNameEn: string;
  roleNameAr: string;
  region: User["region"];
  isActive: boolean;
  canSignIn: boolean;
  deactivatedAt: Date | null;
  createdAt: Date;
};

/** Structurally a `LookupRow`, so `bilingualName` renders it. */
export type RoleOption = { id: string; nameEn: string; nameAr: string };

const MANAGED_USER_COLUMNS = {
  id: users.id,
  name: users.name,
  email: users.email,
  roleId: users.roleId,
  roleNameEn: roles.nameEn,
  roleNameAr: roles.nameAr,
  region: users.region,
  isActive: users.isActive,
  canSignIn: sql<boolean>`${users.passwordHash} is not null`,
  deactivatedAt: users.deactivatedAt,
  createdAt: users.createdAt,
};

/**
 * Every role, for the user form's `<select>`.
 *
 * Role *names* are data here, not logic: this returns them for display and the
 * form posts back an id. Nothing in this module branches on a name `[07 A5 C1]`.
 */
export async function listRoles(): Promise<RoleOption[]> {
  return db
    .select({ id: roles.id, nameEn: roles.nameEn, nameAr: roles.nameAr })
    .from(roles)
    .orderBy(asc(roles.nameEn));
}

/**
 * The flag every user-management read and write asks for, in one place.
 *
 * The reads are gated too, and throw rather than returning an empty list: a
 * mis-wired screen must not be indistinguishable from an empty database, and a
 * thrown key is something `verify:phase11` can assert.
 */
function requireManageUsers(session: AuthSession): void {
  if (!can(session, "canManageUsers")) {
    throw new RuleError("team.errors.manageUsersOnly");
  }
}

export type ManagedUserListOptions = {
  q?: string;
  page?: number;
  /** Default `"active"`. Inactive users are history, not gone `[04 C2]`. */
  status?: "active" | "inactive" | "all";
};

/**
 * The user list `[19]`. Unlike a record list there is no per-row visibility
 * question — user management is all-or-nothing on `can_manage_users`, so no
 * filter from this module is composed in.
 */
export async function listUsers(
  session: AuthSession,
  options: ManagedUserListOptions = {},
): Promise<{ rows: ManagedUserRow[]; total: number; page: number }> {
  requireManageUsers(session);

  const page = Math.max(1, options.page ?? 1);
  const status = options.status ?? "active";
  const trimmed = options.q?.trim();

  const where = and(
    status === "all" ? undefined : eq(users.isActive, status === "active"),
    trimmed
      ? or(
          ilike(users.name, `%${trimmed}%`),
          ilike(users.email, `%${trimmed}%`),
        )
      : undefined,
  );

  const rows = await db
    .select(MANAGED_USER_COLUMNS)
    .from(users)
    .innerJoin(roles, eq(users.roleId, roles.id))
    .where(where)
    .orderBy(asc(users.name))
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE);

  // Same WHERE, so the count can never disagree with the page.
  const [totals] = await db
    .select({ total: count() })
    .from(users)
    .innerJoin(roles, eq(users.roleId, roles.id))
    .where(where);

  return { rows, total: totals?.total ?? 0, page };
}

/** One user for the management screens. `null` = no such user (→ `notFound`). */
export async function getManagedUser(
  session: AuthSession,
  userId: string,
): Promise<ManagedUserRow | null> {
  requireManageUsers(session);
  const [row] = await db
    .select(MANAGED_USER_COLUMNS)
    .from(users)
    .innerJoin(roles, eq(users.roleId, roles.id))
    .where(eq(users.id, userId))
    .limit(1);
  return row ?? null;
}

/**
 * `users_email_key` is unique. Checking first turns a collision into a field
 * message; the insert/update still catches the race, because a check-then-write
 * is not atomic.
 */
async function assertEmailFree(email: string, exceptUserId?: string) {
  const [clash] = await db
    .select({ id: users.id })
    .from(users)
    .where(
      exceptUserId
        ? and(eq(users.email, email), ne(users.id, exceptUserId))
        : eq(users.email, email),
    )
    .limit(1);
  if (clash) throw new RuleError("team.errors.emailTaken", "email");
}

/** The FK would refuse anyway — this refuses against the field instead. */
async function assertRoleExists(roleId: string) {
  const [role] = await db
    .select({ id: roles.id })
    .from(roles)
    .where(eq(roles.id, roleId))
    .limit(1);
  if (!role) throw new RuleError("team.errors.roleUnknown", "roleId");
}

export type NewUserInput = {
  name: string;
  email: string;
  roleId: string;
  /** Omitted = the account exists but cannot log in yet. */
  password?: string;
  region?: User["region"];
  cityId?: string | null;
};

/** Create a user. There is no self-registration anywhere in FACET `[11 §1]`. */
export async function createUser(
  session: AuthSession,
  input: NewUserInput,
): Promise<User> {
  requireManageUsers(session);

  const email = input.email.trim().toLowerCase();
  if (input.password && input.password.length < MIN_PASSWORD_LENGTH) {
    throw new RuleError("team.errors.passwordTooShort", "password");
  }
  await assertRoleExists(input.roleId);
  await assertEmailFree(email);

  const passwordHash = input.password
    ? await hashPassword(input.password)
    : null;

  return withAudit(session.actor, async (tx, log) => {
    const [created] = await tx
      .insert(users)
      .values({
        name: input.name,
        email,
        roleId: input.roleId,
        region: input.region ?? null,
        cityId: input.cityId ?? null,
        passwordHash,
      })
      .returning();
    const safe = { ...created, passwordHash: undefined };
    log({
      action: "user.created",
      entityType: "user",
      entityId: created.id,
      after: safe,
    });
    return created;
  });
}

export type UserUpdateInput = {
  name: string;
  /**
   * Editable `[19 §6]`. It is the login identity — `11 §5` leaves no password
   * reset UI, so a typo at creation would otherwise be unrecoverable.
   */
  email: string;
  roleId: string;
  region: User["region"];
};

/**
 * Edit a user's name, email, role and region `[19 §6]`.
 *
 * A no-op save writes no audit row: only changed keys are compared and logged,
 * the shape `updateProject` already uses. `is_active` is not editable here —
 * that is `deactivateUser` / `reactivateUser`, which also own the session
 * consequences.
 */
export async function updateUser(
  session: AuthSession,
  userId: string,
  input: UserUpdateInput,
): Promise<User> {
  requireManageUsers(session);

  const email = input.email.trim().toLowerCase();
  await assertRoleExists(input.roleId);
  await assertEmailFree(email, userId);

  return withAudit(session.actor, async (tx, log) => {
    const [before] = await tx
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!before) throw new RuleError("team.errors.userNotFound");

    const next = {
      name: input.name,
      email,
      roleId: input.roleId,
      region: input.region ?? null,
    };
    const changed = (Object.keys(next) as (keyof typeof next)[]).filter(
      (key) => before[key] !== next[key],
    );
    if (changed.length === 0) return before;

    const [after] = await tx
      .update(users)
      .set(next)
      .where(eq(users.id, userId))
      .returning();

    log({
      action: "user.updated",
      entityType: "user",
      entityId: userId,
      before: Object.fromEntries(changed.map((key) => [key, before[key]])),
      after: Object.fromEntries(changed.map((key) => [key, after[key]])),
    });
    return after;
  });
}

/**
 * Deactivate — never delete `[04 C2]`. Every session belonging to the user,
 * and every session currently impersonating them, dies in the same
 * transaction as the flag flip.
 */
export async function deactivateUser(
  session: AuthSession,
  userId: string,
): Promise<void> {
  requireManageUsers(session);

  // `19 §5` — the actor would lose their own session mid-request, and if they
  // hold the only active `can_manage_users` nobody could reactivate them:
  // `12 §7` forbids deleting the row and starting again.
  if (userId === session.user.id) {
    throw new RuleError("team.errors.cannotDeactivateSelf");
  }

  await withAudit(session.actor, async (tx, log) => {
    const [before] = await tx
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!before) throw new RuleError("team.errors.userNotFound");
    if (!before.isActive) return; // already deactivated — idempotent

    const [after] = await tx
      .update(users)
      .set({ isActive: false, deactivatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();

    await tx.delete(sessions).where(eq(sessions.userId, userId));
    await tx
      .update(sessions)
      .set({ actingAsUserId: null })
      .where(eq(sessions.actingAsUserId, userId));

    log({
      action: "user.deactivated",
      entityType: "user",
      entityId: userId,
      before: { isActive: before.isActive, deactivatedAt: before.deactivatedAt },
      after: { isActive: after.isActive, deactivatedAt: after.deactivatedAt },
    });
  });
}

/**
 * The inverse of `deactivateUser` `[19 §7]`.
 *
 * **It restores no session.** Deactivation destroyed them; the person logs in
 * again, which is the only thing that should mint a session row. `getSession`
 * re-reads `is_active` on every request, so nothing else is needed to let them
 * back in.
 *
 * `deactivated_at` is cleared: `is_active` is the state, and the audit log is
 * what preserves that a break happened.
 */
export async function reactivateUser(
  session: AuthSession,
  userId: string,
): Promise<void> {
  requireManageUsers(session);

  await withAudit(session.actor, async (tx, log) => {
    const [before] = await tx
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!before) throw new RuleError("team.errors.userNotFound");
    if (before.isActive) return; // already active — idempotent

    const [after] = await tx
      .update(users)
      .set({ isActive: true, deactivatedAt: null })
      .where(eq(users.id, userId))
      .returning();

    log({
      action: "user.reactivated",
      entityType: "user",
      entityId: userId,
      before: { isActive: before.isActive, deactivatedAt: before.deactivatedAt },
      after: { isActive: after.isActive, deactivatedAt: after.deactivatedAt },
    });
  });
}

/* ------------------------------------------------------------------ *
 * Impersonation `[07 A5, A6]`
 * ------------------------------------------------------------------ */

/**
 * Begin acting as another user. Gated on the REAL identity's
 * `can_impersonate` — an impersonated identity can never chain onward.
 */
export async function startImpersonation(
  session: AuthSession,
  targetUserId: string,
): Promise<void> {
  if (!session.realUser.role.canImpersonate) {
    throw new Error("Permission denied: canImpersonate");
  }
  if (session.isImpersonating) {
    throw new Error("Already impersonating — stop first");
  }
  if (targetUserId === session.realUser.id) {
    throw new Error("Cannot impersonate yourself");
  }
  const target = await loadUserWithRole(targetUserId);
  if (!target || !target.isActive) {
    throw new Error("Impersonation target not found or inactive");
  }
  const token = await getSessionToken();
  if (!token) throw new Error("No session token");

  await withAudit(
    { actorUserId: session.realUser.id, actingAsUserId: targetUserId },
    async (tx, log) => {
      await tx
        .update(sessions)
        .set({ actingAsUserId: targetUserId })
        .where(eq(sessions.sessionToken, token));
      log({
        action: "impersonation.started",
        entityType: "user",
        entityId: targetUserId,
      });
    },
  );
}

/** End impersonation on the current session. No-op when not impersonating. */
export async function stopImpersonation(session: AuthSession): Promise<void> {
  if (!session.isImpersonating) return;
  const token = await getSessionToken();
  if (!token) return;

  await withAudit(session.actor, async (tx, log) => {
    await tx
      .update(sessions)
      .set({ actingAsUserId: null })
      .where(eq(sessions.sessionToken, token));
    log({
      action: "impersonation.stopped",
      entityType: "user",
      entityId: session.user.id,
    });
  });
}
