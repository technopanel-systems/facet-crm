/**
 * Contacts — the data layer `09 §3.3`.
 *
 * A contact belongs to exactly one company `[07 A2]`; a person who moves gets
 * a new record at the new company and the old one stays for history. There is
 * no move operation here for that reason — moving a contact would erase the
 * history the rule exists to keep.
 *
 * A contact has no owner of its own. It follows its company `[14 §1]`, which
 * is what `visibleContactsFilter` expresses.
 */

import { and, count, desc, eq, ilike, or, type SQL } from "drizzle-orm";

import { db } from "@/db";
import { companies, contacts, users } from "@/db/schema";
import { withAudit } from "@/lib/audit";
import {
  canViewRecord,
  visibleContactsFilter,
  type AuthSession,
} from "@/lib/authz";
import { normalizeName } from "@/lib/normalize";
import { RuleError } from "@/lib/validation";

export type Contact = typeof contacts.$inferSelect;

export type ContactInput = {
  companyId: string;
  /** One field, English or Arabic `S19`. */
  name: string;
  phone: string | null;
  email: string | null;
  position: string | null;
  notes: string | null;
};

export type ContactListRow = {
  id: string;
  /** One field, English or Arabic `S19`. */
  name: string;
  phone: string | null;
  email: string | null;
  position: string | null;
  companyId: string;
  companyName: string;
  createdAt: Date;
};

const PAGE_SIZE = 25;

function searchFilter(query: string | undefined): SQL | undefined {
  const trimmed = query?.trim();
  if (!trimmed) return undefined;
  return or(
    ilike(contacts.nameNormalized, `%${normalizeName(trimmed)}%`),
    ilike(contacts.phone, `%${trimmed}%`),
  );
}

/**
 * Contacts this identity may see, optionally narrowed to one company.
 *
 * `companyId` narrows; it never widens. The visibility filter is always
 * applied, so passing a company the caller cannot see returns nothing rather
 * than that company's contacts.
 */
export async function listContacts(
  session: AuthSession,
  options: { companyId?: string; q?: string; page?: number } = {},
): Promise<{ rows: ContactListRow[]; total: number; page: number }> {
  const page = Math.max(1, options.page ?? 1);
  const where = and(
    visibleContactsFilter(session),
    searchFilter(options.q),
    options.companyId ? eq(contacts.companyId, options.companyId) : undefined,
  );

  const rows = await db
    .select({
      id: contacts.id,
      name: contacts.name,
      phone: contacts.phone,
      email: contacts.email,
      position: contacts.position,
      companyId: contacts.companyId,
      companyName: companies.name,
      createdAt: contacts.createdAt,
    })
    .from(contacts)
    .innerJoin(companies, eq(contacts.companyId, companies.id))
    .where(where)
    .orderBy(desc(contacts.createdAt))
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE);

  const [totals] = await db
    .select({ total: count() })
    .from(contacts)
    .where(where);

  return { rows, total: totals?.total ?? 0, page };
}

export type ContactDetail = Contact & {
  companyName: string;
  createdByName: string | null;
};

export async function getContact(
  session: AuthSession,
  id: string,
): Promise<ContactDetail | null> {
  const [row] = await db
    .select({
      contact: contacts,
      companyName: companies.name,
      createdByName: users.name,
    })
    .from(contacts)
    .innerJoin(companies, eq(contacts.companyId, companies.id))
    .leftJoin(users, eq(contacts.createdBy, users.id))
    .where(and(eq(contacts.id, id), visibleContactsFilter(session)))
    .limit(1);

  if (!row) return null;
  return {
    ...row.contact,
    companyName: row.companyName,
    createdByName: row.createdByName,
  };
}

/**
 * The company id arrives from a `<select>` the user controls, so it is checked
 * against what they may actually see before anything is written. Without this,
 * a hand-crafted POST could attach a contact to somebody else's company — and
 * because contacts follow their company, that would also hand the attacker a
 * readable record inside it.
 */
async function assertCompanyUsable(
  session: AuthSession,
  companyId: string,
): Promise<void> {
  if (!(await canViewRecord(session, "company", companyId))) {
    throw new RuleError("contacts.errors.companyNotVisible", "companyId");
  }
}

export async function createContact(
  session: AuthSession,
  input: ContactInput,
): Promise<Contact> {
  await assertCompanyUsable(session, input.companyId);

  return withAudit(session.actor, async (tx, log) => {
    const [contact] = await tx
      .insert(contacts)
      .values({
        ...input,
        nameNormalized: normalizeName(input.name),
        createdBy: session.user.id,
      })
      .returning();

    log({
      action: "contact.created",
      entityType: "contact",
      entityId: contact.id,
      after: contact,
    });
    return contact;
  });
}

const EDITABLE = [
  "companyId",
  "name",
  "phone",
  "email",
  "position",
  "notes",
] as const;

export async function updateContact(
  session: AuthSession,
  id: string,
  input: ContactInput,
): Promise<Contact> {
  if (!(await canViewRecord(session, "contact", id))) {
    throw new RuleError("contacts.errors.notFound");
  }
  // Re-checked because the form can change it: moving a contact to a company
  // the user cannot see would move the contact out of their own sight, and
  // into someone else's records.
  await assertCompanyUsable(session, input.companyId);

  return withAudit(session.actor, async (tx, log) => {
    const [before] = await tx
      .select()
      .from(contacts)
      .where(eq(contacts.id, id))
      .limit(1);
    if (!before) throw new RuleError("contacts.errors.notFound");

    const changed = EDITABLE.filter((key) => before[key] !== input[key]);
    if (changed.length === 0) return before;

    const [after] = await tx
      .update(contacts)
      .set({ ...input, nameNormalized: normalizeName(input.name) })
      .where(eq(contacts.id, id))
      .returning();

    log({
      action: "contact.updated",
      entityType: "contact",
      entityId: id,
      before: Object.fromEntries(changed.map((key) => [key, before[key]])),
      after: Object.fromEntries(changed.map((key) => [key, after[key]])),
    });
    return after;
  });
}
