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

import { and, eq, exists, isNull, or, sql, type SQL } from "drizzle-orm";
import { QueryBuilder, type AnyPgColumn } from "drizzle-orm/pg-core";
import { getLocale } from "next-intl/server";

import { auth, getSessionToken } from "@/auth";
import { db } from "@/db";
import {
  companies,
  companyReps,
  contacts,
  projects,
  quotationThreads,
  recordShares,
  roles,
  sessions,
  users,
} from "@/db/schema";
import { redirect } from "@/i18n/navigation";
import { withAudit, type AuditActor } from "@/lib/audit";
import { hashPassword } from "@/lib/passwords";

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

/** Record kinds whose visibility is answerable today (others arrive with
 *  their feature phases and must be added HERE, nowhere else). */
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

/** `requireSession` plus a flag check. Throws on denial — server actions
 *  surface this as a failure, never as silent success. */
export async function requirePermission(
  flag: PermissionFlag,
): Promise<AuthSession> {
  const session = await requireSession();
  if (!can(session, flag)) {
    throw new Error(`Permission denied: ${flag}`);
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

/* ------------------------------------------------------------------ *
 * User management — gated on `can_manage_users`, audited by the data layer
 * ------------------------------------------------------------------ */

export type NewUserInput = {
  name: string;
  email: string;
  roleId: string;
  /** Omitted = the account exists but cannot log in yet. */
  password?: string;
  region?: User["region"];
  cityId?: string | null;
};

/** Create a user. There is no self-registration anywhere in FACET. */
export async function createUser(
  session: AuthSession,
  input: NewUserInput,
): Promise<User> {
  if (!can(session, "canManageUsers")) {
    throw new Error("Permission denied: canManageUsers");
  }
  const email = input.email.trim().toLowerCase();
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

/**
 * Deactivate — never delete `[04 C2]`. Every session belonging to the user,
 * and every session currently impersonating them, dies in the same
 * transaction as the flag flip.
 */
export async function deactivateUser(
  session: AuthSession,
  userId: string,
): Promise<void> {
  if (!can(session, "canManageUsers")) {
    throw new Error("Permission denied: canManageUsers");
  }
  await withAudit(session.actor, async (tx, log) => {
    const [before] = await tx
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!before) throw new Error("User not found");
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
