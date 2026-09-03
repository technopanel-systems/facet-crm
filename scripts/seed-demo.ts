/**
 * A realistic demo dataset — `npm run seed:demo`. **NOT a feature.**
 *
 * It clears the record tables and rebuilds them, so the founder can re-run it
 * whenever the screens have filled with verify residue. There is no production
 * data anywhere (`WORKFLOW §7`), so clearing is the honest thing to do; the
 * accounts and the lookups survive, because destroying the login you use to
 * look at the result is not a rebuild.
 *
 * ── THE RULE THIS FILE EXISTS TO KEEP ─────────────────────────────────────
 *
 * **Every record is created the way a person would create it** — through the
 * real writer in `src/lib`, with a real `AuthSession`, in the real order, and
 * with the real authorisation. Nothing here INSERTs a row into a state the
 * application cannot itself reach. `CLAUDE.md` names the opposite as one of
 * v1's two failure modes, and a demo dataset that repeated it would be worse
 * than none: every screen would look right and nothing would be true.
 *
 * There is exactly one thing this file does that a writer does not, and it is
 * declared in `seed/demo/clock.ts` rather than hidden here: after each day's
 * batch of acts it **moves that batch's clocks backwards**. `created_at` and
 * the audit rows beside it default to `now()`, and three of the six
 * `FOLLOW_UP_KINDS` are derived from exactly those columns, so a dataset with
 * every clock at today has an empty Slipping section and every day count
 * reading zero. Moving a timestamp back reaches no state an act could not
 * reach — the same sequence run 120 days ago produces these rows with these
 * timestamps. `SHIFTED` and `NOT_SHIFTED` in that file name every column on
 * both sides of the line.
 *
 * ── WHAT IT REFUSES ───────────────────────────────────────────────────────
 *
 * `NODE_ENV` must be exactly `development`, the same guard and the same
 * reasoning as `dev-fixtures.ts` and `db-reset.ts` `[15 §7]`. And
 * `DEV_FIXTURE_PASSWORD` must be set: these are real, loginable accounts, and
 * a default baked into the repository would be a known credential on every
 * checkout.
 *
 * Usage:
 *   npm run seed:demo
 *
 * It needs a migrated, seeded database — `npm run db:migrate && npm run db:seed`
 * — and one existing user holding `can_manage_users`, because `S10` says a
 * user exists because such a holder created them and this script is not
 * allowed to be the exception. `npm run bootstrap:admin` is that user.
 */

process.loadEnvFile(".env");

import { and, eq, sql } from "drizzle-orm";

import { closeDatabase, db } from "@/db";
import { leadSources, lossReasons, roles, users } from "@/db/schema";
import { withAudit } from "@/lib/audit";
import type { AuthSession } from "@/lib/authz";
import { createUser, updateUser } from "@/lib/authz";
import { addComment } from "@/lib/comments";
import { createCompany } from "@/lib/companies";
import { createContact } from "@/lib/contacts";
import { setCreditSplit } from "@/lib/credit-splits";
import {
  approveDispatchRequest,
  cancelDispatch,
  refuseDispatchRequest,
  requestDispatch,
  reviveDispatchRequest,
  setDispatchSmacNumber,
  submitDispatchRequest,
  updateDispatchRequest,
  type DispatchLineInput,
} from "@/lib/dispatches";
import {
  FIELD_NOTE_CATEGORIES,
  REPORT_CHANNELS,
  REPORT_OUTCOMES,
  REPORT_SIGNALS,
  SAUDI_CODE,
} from "@/lib/enums";
import { setNextFollowUp } from "@/lib/follow-ups";
import {
  listCities,
  listCompanyCategories,
  listCountries,
  listProductClasses,
  listProductFireRatings,
  listProductSuppliers,
  listProductThicknesses,
  listServiceTypes,
} from "@/lib/lookups";
import { hashPassword } from "@/lib/passwords";
import { createProject, updateProject, type ProjectInput } from "@/lib/projects";
import {
  acceptThread,
  addQuotationLine,
  addServiceLine,
  cancelThread,
  createQuotationThread,
  createRevision,
  issueVersion,
  rejectThread,
  returnForEdit,
  type QuotationLineInput,
} from "@/lib/quotations";
import { createReport } from "@/lib/reports";
import { grantShare } from "@/lib/sharing";
import { periodStart, setCompanyTarget, setTarget } from "@/lib/targets";

import {
  COMMENTS,
  FOLLOW_UPS,
  REPORTS,
  SHARES,
  COMPANY_TARGETS,
  TARGETS,
} from "./seed/demo/activity";
import {
  assertColumnsExist,
  mark,
  queryRows,
  shiftFollowUpDate,
  shiftSince,
} from "./seed/demo/clock";
import { COMPANIES } from "./seed/demo/companies";
import { preflight } from "./seed/demo/preflight";
import { PEOPLE, type PersonKey } from "./seed/demo/people";
import { DISPATCHES, PROJECTS, THREADS } from "./seed/demo/plan";

/* ================================================================== *
 * Guards `[15 §7]`
 * ================================================================== */

function requireDevelopment(): string {
  if (process.env.NODE_ENV !== "development") {
    console.error(
      "seed:demo refuses to run outside development.\n" +
        `  NODE_ENV is ${process.env.NODE_ENV ?? "unset"}, and must be "development".\n` +
        "  Add NODE_ENV=development to .env (it is excluded from the Docker image).",
    );
    process.exit(1);
  }
  const password = process.env.DEV_FIXTURE_PASSWORD;
  if (!password || password.length < 8) {
    console.error(
      "Set DEV_FIXTURE_PASSWORD (8+ characters) in .env — these are real,\n" +
        "loginable accounts and the password is never baked into the repository.",
    );
    process.exit(1);
  }
  return password;
}

/* ================================================================== *
 * Dates. A day is a Riyadh calendar day, as everywhere else in FACET.
 * ================================================================== */

const RIYADH = "Asia/Riyadh";

/** `YYYY-MM-DD`, `daysAgo` days before today in Riyadh. Negative is ahead. */
function day(daysAgo: number): string {
  const at = new Date(Date.now() - daysAgo * 86_400_000);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: RIYADH,
    dateStyle: "short",
  }).format(at);
}

/** The first day of the month `back` months before this one, `YYYY-MM-01`. */
function monthsBack(back: number): string {
  const [year, month] = day(0).split("-").map(Number);
  const index = year * 12 + (month - 1) - back;
  return periodStart(
    `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`,
  );
}

/* ================================================================== *
 * A deterministic generator, so two runs produce the same dataset and
 * a diff between them is a real change rather than the dice.
 * ================================================================== */

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

/** A fixed seed: two runs of this script produce the same dataset, so a diff
 *  between them is a real change rather than the dice. */
const rng = mulberry32(0x5ac3d1);

/* ================================================================== *
 * The timeline. Acts are pushed in logical order and run oldest-first;
 * every batch's clocks are moved back by that batch's own day.
 * ================================================================== */

type Act = { at: number; label: string; run: () => Promise<void> };

const timeline: Act[] = [];
/** Records whose `next_follow_up_at` moves with the batch — see `clock.ts`. */
const dateShifts: {
  at: number;
  table: "companies" | "projects" | "quotation_threads";
  id: string;
}[] = [];

function on(at: number, label: string, run: () => Promise<void>): void {
  if (at < 0) throw new Error(`${label}: an act cannot happen in the future`);
  timeline.push({ at, label, run });
}

async function runTimeline(): Promise<void> {
  const days = [...new Set(timeline.map((a) => a.at))].sort((a, b) => b - a);
  let done = 0;
  for (const at of days) {
    const batch = timeline.filter((a) => a.at === at);
    const since = await mark();
    for (const act of batch) {
      try {
        await act.run();
      } catch (error) {
        throw new Error(
          `day -${at} · ${act.label}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }
    await shiftSince(since, at);
    for (const shift of dateShifts.filter((s) => s.at === at)) {
      await shiftFollowUpDate(shift.table, shift.id, at);
    }
    done += batch.length;
    process.stdout.write(
      `\r  day -${String(at).padStart(3)}  ${done}/${timeline.length} acts   `,
    );
  }
  process.stdout.write("\n");
}

/* ================================================================== *
 * Clearing `WORKFLOW §7`
 * ================================================================== */

/**
 * Every table that holds a record somebody made. **`users` is not here**, and
 * neither are the lookups, the settings or the notification types: the first
 * would destroy the login the founder is about to look at the result with, and
 * the rest are the vocabulary the writers below read.
 */
const RECORD_TABLES = [
  "audit_log",
  "notifications",
  "comment_mentions",
  "comments",
  "rep_report_signals",
  "rep_reports",
  "dispatch_lines",
  "dispatches",
  "quotation_service_lines",
  "quotation_lines",
  "quotation_versions",
  "quotation_threads",
  "company_removal_requests",
  "project_credit_splits",
  "record_shares",
  "project_companies",
  "projects",
  "contacts",
  "company_dormancy_reviews",
  "company_reps",
  "companies",
  "duplicate_flags",
  "non_duplicates",
  "targets",
  "company_targets",
  "attachments",
] as const;

async function clearRecords(): Promise<void> {
  await db.execute(
    sql`truncate table ${sql.join(
      RECORD_TABLES.map((t) => sql.identifier(t)),
      sql`, `,
    )} restart identity cascade`,
  );
}

/**
 * The fixture accounts and fixture ROLES the verify scripts left behind.
 *
 * Truncating the record tables is not enough on its own: three of the ten
 * verify scripts create their own reps per run — deliberately, because
 * achievement and coverage are whole-database totals and re-using the shared
 * accounts made one run count the previous run's square metres
 * (`db-reset.ts`) — and `verify-sharing` creates a **role** per run as well.
 * Left alone they were 607 users and 40 roles by the time this script was
 * written, which is 615 rows on `/users` and 47 options in the role picker.
 * A dataset meant to be judged by eye cannot leave that there.
 *
 * **The test is the domain, not the shape of the name.** `.test` is a
 * reserved TLD that resolves nowhere, so an address in it is a fixture by
 * construction; the founder's own `@technopanel.com.sa` account is untouched,
 * and so are the eight in `people.ts`. A role goes only if it is not one of
 * `ROLE_SEED`'s seven **and** nobody is left holding it.
 *
 * `S111` says accounts deactivate and never delete, and that rule is about
 * the application: history must keep pointing at a real person. Nothing here
 * has any history left to point at — it was truncated a moment ago — and
 * `WORKFLOW §7` is explicit that every row in every database is a fixture or
 * verify residue. `sessions` and `accounts` go with their user, because
 * neither cascades.
 */
const SEEDED_ROLES = [
  "Super Admin",
  "Executive",
  "Sales Manager",
  "Sales Coordinator",
  "Marketing",
  "Desk Rep",
  "Sales Rep",
];

async function clearFixtureAccounts(): Promise<void> {
  const keep = sql.join(
    PEOPLE.map((p) => sql`${p.email}`),
    sql`, `,
  );
  const doomed = sql`select id from users
                     where email like '%@example.test'
                       and email not in (${keep})`;

  await db.execute(sql`delete from sessions where user_id in (${doomed})`);
  await db.execute(sql`delete from accounts where user_id in (${doomed})`);
  const users = queryRows<{ id: string }>(
    await db.execute(sql`delete from users where id in (${doomed}) returning id`),
  );

  const seeded = sql.join(
    SEEDED_ROLES.map((name) => sql`${name}`),
    sql`, `,
  );
  const roles = queryRows<{ id: string }>(
    await db.execute(
      sql`delete from roles r
          where r.name_en not in (${seeded})
            and not exists (select 1 from users u where u.role_id = r.id)
          returning r.id`,
    ),
  );

  console.log(
    `  removed ${users.length} fixture account(s) and ${roles.length} fixture role(s)`,
  );
}

/* ================================================================== *
 * The eight accounts `S10` — created by a `can_manage_users` holder
 * ================================================================== */

const sessions = new Map<PersonKey, AuthSession>();

function sessionRow(user: typeof users.$inferSelect, role: typeof roles.$inferSelect): AuthSession {
  const shaped = { ...user, role };
  return {
    user: shaped,
    realUser: shaped,
    isImpersonating: false,
    actor: { actorUserId: shaped.id, actingAsUserId: null },
  };
}

async function sessionFor(email: string): Promise<AuthSession> {
  const [row] = await db
    .select({ user: users, role: roles })
    .from(users)
    .innerJoin(roles, eq(users.roleId, roles.id))
    .where(eq(users.email, email))
    .limit(1);
  if (!row) throw new Error(`No user ${email}`);
  return sessionRow(row.user, row.role);
}

/**
 * Somebody who already holds `can_manage_users`, to create the eight with.
 *
 * `S10` — *a user exists because a `can_manage_users` holder created them* —
 * and this script is not allowed to be the one exception to it. On a fresh
 * database that holder is `bootstrap:admin`'s super admin.
 */
async function creatorSession(): Promise<AuthSession> {
  const [row] = await db
    .select({ user: users, role: roles })
    .from(users)
    .innerJoin(roles, eq(users.roleId, roles.id))
    .where(and(eq(users.isActive, true), eq(roles.canManageUsers, true)))
    .limit(1);
  if (!row) {
    throw new Error(
      "No active user holds can_manage_users, and `S10` says a user exists\n" +
        "  because such a holder created them. Run: npm run bootstrap:admin",
    );
  }
  return sessionRow(row.user, row.role);
}

async function ensurePeople(password: string): Promise<void> {
  const creator = await creatorSession();
  const roleIds = new Map(
    (await db.select({ id: roles.id, nameEn: roles.nameEn }).from(roles)).map(
      (r) => [r.nameEn, r.id],
    ),
  );
  const hash = await hashPassword(password);

  for (const person of PEOPLE) {
    const roleId = roleIds.get(person.role);
    if (!roleId) throw new Error(`Role "${person.role}" missing — npm run db:seed`);

    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, person.email))
      .limit(1);

    if (existing) {
      // Name, role and region through the real writer; the password through
      // the same audited raw update `dev-fixtures.ts` uses, because `S11`'s
      // reset is `[BUILD]` and there is no writer for it yet.
      await updateUser(creator, existing.id, {
        name: person.name,
        email: person.email,
        roleId,
        region: person.region,
      });
      await withAudit(creator.actor, async (tx, log) => {
        await tx
          .update(users)
          .set({ passwordHash: hash })
          .where(eq(users.id, existing.id));
        log({
          action: "user.password_reset",
          entityType: "user",
          entityId: existing.id,
          after: { email: person.email },
        });
      });
    } else {
      await createUser(creator, {
        name: person.name,
        email: person.email,
        roleId,
        password,
        region: person.region ?? undefined,
      });
    }
    sessions.set(person.key, await sessionFor(person.email));
  }
}

function who(key: PersonKey): AuthSession {
  const session = sessions.get(key);
  if (!session) throw new Error(`No session for ${key}`);
  return session;
}

/* ================================================================== *
 * The vocabulary the writers read
 * ================================================================== */

type Lookups = {
  cityId: Map<string, string>;
  countryId: Map<string, string>;
  categoryId: Map<string, string>;
  sourceId: Map<string, string>;
  lossReasonId: Map<string, string>;
  suppliers: string[];
  classes: string[];
  fireRatings: string[];
  thicknesses: { id: string; standard: boolean }[];
  services: string[];
};

async function loadLookups(): Promise<Lookups> {
  const [
    cities,
    countries,
    categories,
    sources,
    reasons,
    suppliers,
    classes,
    fireRatings,
    thicknesses,
    services,
  ] = await Promise.all([
    listCities(),
    listCountries(),
    listCompanyCategories(),
    db.select({ id: leadSources.id, nameEn: leadSources.nameEn }).from(leadSources),
    db.select({ id: lossReasons.id, code: lossReasons.code }).from(lossReasons),
    listProductSuppliers(),
    listProductClasses(),
    listProductFireRatings(),
    listProductThicknesses(),
    listServiceTypes(),
  ]);

  return {
    cityId: new Map(cities.map((c) => [c.nameEn, c.id])),
    countryId: new Map(countries.map((c) => [c.code, c.id])),
    categoryId: new Map(categories.map((c) => [c.nameEn, c.id])),
    sourceId: new Map(sources.map((s) => [s.nameEn, s.id])),
    lossReasonId: new Map(reasons.map((r) => [r.code, r.id])),
    suppliers: suppliers.map((s) => s.id),
    classes: classes.map((c) => c.id),
    fireRatings: fireRatings.map((f) => f.id),
    thicknesses: thicknesses.map((t) => ({ id: t.id, standard: t.isStandard })),
    services: services.map((s) => s.id),
  };
}

function need<T>(map: Map<string, T>, key: string, what: string): T {
  const value = map.get(key);
  if (value === undefined) {
    throw new Error(`No ${what} named "${key}" — is the lookup seed current?`);
  }
  return value;
}

/* ================================================================== *
 * Product lines `S53` `S55` `S56`
 * ================================================================== */

/** Real sheet sizes. Square metres are generated from them, never typed. */
const SHEETS: readonly [width: string, length: string][] = [
  ["1.2400", "5.8000"],
  ["1.2400", "4.0000"],
  ["1.5000", "5.8000"],
  ["1.2400", "3.2000"],
];

/** `S54` — free text: a plain SMAC code as readily as a RAL or Pantone. */
const COLOURS = [
  "168",
  "172",
  "306",
  "9006",
  "RAL 9016",
  "RAL 7016",
  "RAL 9005",
  "PANTONE 877C",
  "بني خشبي",
  "شمبين",
];

function lines(
  look: Lookups,
  count: number,
  totalSqm: number,
  unpriced: boolean,
): QuotationLineInput[] {
  const out: QuotationLineInput[] = [];
  for (let i = 0; i < count; i += 1) {
    const [widthM, lengthM] = SHEETS[Math.floor(rng() * SHEETS.length)];
    const share = totalSqm / count;
    const pcs = Math.max(1, Math.round(share / (Number(widthM) * Number(lengthM))));
    // 4 mm is the standard `[17 §3]`; the rest are the exception, not the rule.
    const thickness =
      rng() < 0.82
        ? look.thicknesses.find((t) => t.standard)!
        : look.thicknesses[Math.floor(rng() * look.thicknesses.length)];
    out.push({
      supplierId: look.suppliers[Math.floor(rng() * look.suppliers.length)],
      classId: look.classes[Math.floor(rng() * look.classes.length)],
      fireRatingId: look.fireRatings[Math.floor(rng() * look.fireRatings.length)],
      customColour: COLOURS[Math.floor(rng() * COLOURS.length)],
      thicknessId: thickness.id,
      widthM,
      lengthM,
      quantityPcs: String(pcs),
      // `S58` — a line with no price contributes nothing, and the screen says
      // so. Exactly one thread carries one, and it is never dispatched: `S116`
      // makes the rep price it first, which is a different screen's job.
      unitPrice:
        unpriced && i === count - 1
          ? null
          : (90 + Math.floor(rng() * 75) + 0.5 * Math.round(rng())).toFixed(2),
    });
  }
  return out;
}

/** A quotation line as a dispatch line — every one priced `S116`. */
function asDispatchLines(source: QuotationLineInput[]): DispatchLineInput[] {
  return source.map((line) => ({
    supplierId: line.supplierId,
    classId: line.classId,
    fireRatingId: line.fireRatingId,
    customColour: line.customColour ?? "168",
    thicknessId: line.thicknessId,
    widthM: line.widthM,
    lengthM: line.lengthM,
    quantityPcs: line.quantityPcs,
    unitPrice: line.unitPrice ?? "110.00",
  }));
}

/**
 * The same lines with one of them changed — `S120`'s difference.
 *
 * The colour and the quantity both move, because *any difference flags it* and
 * a demo that only ever changed the price would leave the colour half of that
 * sentence unexercised.
 */
function edited(source: DispatchLineInput[]): DispatchLineInput[] {
  const out = source.map((line) => ({ ...line }));
  const at = Math.floor(rng() * out.length);
  out[at] = {
    ...out[at],
    quantityPcs: String(Math.max(1, Number(out[at].quantityPcs) - 2)),
    customColour: out[at].customColour === "168" ? "172" : "168",
  };
  return out;
}

/* ================================================================== *
 * The world the acts build up
 * ================================================================== */

const companyId = new Map<string, string>();
const contactId = new Map<string, string>();
const projectId = new Map<string, string>();
const threadId = new Map<string, string>();
const dispatchId = new Map<string, string>();
/** A thread's lines, so a dispatch can match them exactly `S120`. */
const threadLines = new Map<string, QuotationLineInput[]>();
const threadOwner = new Map<string, PersonKey>();

const ownerOf = new Map(COMPANIES.map((c) => [c.name, c.owner]));
const projectRow = new Map(PROJECTS.map((p) => [p.key, p]));
const threadRow = new Map(THREADS.map((t) => [t.key, t]));

function id<T>(map: Map<string, T>, key: string, what: string): T {
  const value = map.get(key);
  if (value === undefined) throw new Error(`${what} "${key}" was never created`);
  return value;
}

/* ================================================================== *
 * Building the timeline
 * ================================================================== */

function planCompanies(look: Lookups): void {
  for (const row of COMPANIES) {
    on(row.age, `company ${row.name}`, async () => {
      const session = who(row.owner);
      const country = row.country ?? SAUDI_CODE;
      const created = await createCompany(session, {
        name: row.name,
        phone: row.phone,
        countryId: need(look.countryId, country, "country"),
        categoryId: need(look.categoryId, row.category, "company category"),
        cityId: row.city ? need(look.cityId, row.city, "city") : null,
        // `S17` — the pre-rule world. Lead source became mandatory at
        // creation only after the real data existed: in the founder's
        // database 261 of 382 companies carry none. A company registered
        // before the rule — older than 45 days here, 76 of 121 rows, the
        // real share — seeds BLANK; the row's own `source` is what the rep
        // would have picked, kept in the dataset for the day the founder
        // decides what to do with the blanks (SPEC §16). New companies
        // arrive filled, which is exactly how the founder described the
        // not-recorded bar aging out. This is also what gives
        // `verify:routes` §13's stay-blank half a permanent subject.
        leadSourceId:
          row.age > 45 ? null : need(look.sourceId, row.source, "lead source"),
        notes: row.note ?? null,
      });
      companyId.set(row.name, created.id);

      if (row.contact) {
        // Name and phone only — no email, which is what the real data has
        // `S19`. `S20` gives a contact no owner of its own.
        const contact = await createContact(session, {
          companyId: created.id,
          name: row.contact.name,
          phone: row.contact.phone,
          email: null,
          position: null,
          notes: null,
        });
        contactId.set(row.name, contact.id);
      }
    });
  }
}

/** The five things a rep sets `S29`, as `updateProject` wants them. */
function projectInput(
  look: Lookups,
  key: string,
  overrides: Partial<ProjectInput> = {},
): ProjectInput {
  const row = id(projectRow, key, "project");
  return {
    name: row.name,
    sqmExpected: row.sqmExpected,
    cityId: row.city ? need(look.cityId, row.city, "city") : null,
    endState: null,
    lostReasonId: null,
    lossReason: null,
    inProduction: false,
    committed: false,
    ...overrides,
  };
}

function planProjects(look: Lookups): void {
  for (const row of PROJECTS) {
    on(row.age, `project ${row.key}`, async () => {
      const created = await createProject(
        who(row.owner),
        projectInput(look, row.key),
        row.companies.map((name) => ({
          companyId: id(companyId, name, "company"),
        })),
      );
      projectId.set(row.key, created.id);
    });

    // The rep's own labels, set later than the project — which is when a rep
    // actually sets them. Each one is an `updateProject`, so the audit log
    // says who marked it and when.
    if (row.inProduction !== undefined) {
      on(row.inProduction, `project ${row.key} in production`, async () => {
        await updateProject(
          who(row.owner),
          id(projectId, row.key, "project"),
          projectInput(look, row.key, {
            inProduction: true,
            committed: row.committed !== undefined,
          }),
        );
      });
    }
    if (row.committed !== undefined) {
      on(row.committed, `project ${row.key} committed`, async () => {
        await updateProject(
          who(row.owner),
          id(projectId, row.key, "project"),
          projectInput(look, row.key, {
            committed: true,
            inProduction:
              row.inProduction !== undefined && row.inProduction >= row.committed!,
          }),
        );
      });
    }
    if (row.lost) {
      const lost = row.lost;
      on(lost.day, `project ${row.key} lost`, async () => {
        await updateProject(
          who(row.owner),
          id(projectId, row.key, "project"),
          projectInput(look, row.key, {
            endState: "lost",
            lostReasonId: need(look.lossReasonId, lost.code, "loss reason"),
            lossReason: lost.detail ?? null,
            inProduction: row.inProduction !== undefined,
            committed: row.committed !== undefined,
          }),
        );
      });
    }
  }
}

function planThreads(look: Lookups): void {
  for (const row of THREADS) {
    const owner = ownerOf.get(row.company);
    if (!owner) throw new Error(`${row.key}: no company "${row.company}"`);
    threadOwner.set(row.key, owner);
    const coordinator = who("nouf");

    on(row.raised, `thread ${row.key} raised`, async () => {
      const built = lines(look, row.lines, row.sqm, row.unpriced ?? false);
      // The first line is added afterwards on a couple of threads, so the
      // `addQuotationLine` path a rep uses after raising is exercised too.
      const upfront =
        row.lines > 2 && row.key === "T07" ? built.slice(0, -1) : built;
      const created = await createQuotationThread(
        who(owner),
        {
          projectId: id(projectId, row.project, "project"),
          companyId: id(companyId, row.company, "company"),
          contactId: row.contact ? (contactId.get(row.company) ?? null) : null,
        },
        { stock: row.stock },
        upfront,
        [],
      );
      threadId.set(row.key, created.id);
      threadLines.set(row.key, built);

      if (upfront.length !== built.length) {
        await addQuotationLine(who(owner), created.id, built[built.length - 1]);
      }
      for (let i = 0; i < (row.services ?? 0); i += 1) {
        await addServiceLine(who(owner), created.id, {
          serviceTypeId: look.services[i % look.services.length],
          quantity: String(20 + Math.floor(rng() * 60)),
          unitPrice: (18 + Math.floor(rng() * 20)).toFixed(2),
          quotationLineId: null,
        });
      }
    });

    if (row.returned !== undefined) {
      on(row.returned, `thread ${row.key} returned`, async () => {
        await returnForEdit(
          coordinator,
          id(threadId, row.key, "thread"),
          "الكمية في السطر الثاني ما تطابق المخطط، عدلها وأعد الإرسال",
        );
      });
    }
    for (const at of row.revisions ?? []) {
      on(at, `thread ${row.key} revised`, async () => {
        // `[07 C2]` — which route produced it. The coordinator editing
        // directly is her own act, so it is her session as well as her origin.
        const byCoordinator = row.revisedBy === "coordinator";
        await createRevision(
          byCoordinator ? coordinator : who(owner),
          id(threadId, row.key, "thread"),
          byCoordinator ? "coordinator_direct_edit" : "rep_change_request",
        );
      });
    }
    if (row.issued !== undefined) {
      on(row.issued, `thread ${row.key} issued`, async () => {
        // `S63` — the coordinator builds the real quotation in SMAC and types
        // the number back. A human typed it, so it can be wrong `S5`: one in
        // six is left `unverified`.
        await issueVersion(coordinator, id(threadId, row.key, "thread"), {
          smacReference: `Q-${9000 + Number(row.key.slice(1)) * 7}`,
          verification: rng() < 0.83 ? "verified" : "unverified",
        });
      });
    }
    if (row.accepted !== undefined) {
      on(row.accepted, `thread ${row.key} accepted`, async () => {
        await acceptThread(coordinator, id(threadId, row.key, "thread"));
      });
    }
    if (row.rejected !== undefined) {
      on(row.rejected, `thread ${row.key} rejected`, async () => {
        await rejectThread(
          coordinator,
          id(threadId, row.key, "thread"),
          "العميل اعتمد مورد ثاني، أبلغنا رسمياً بإلغاء الطلب",
        );
      });
    }
    if (row.cancelled !== undefined) {
      on(row.cancelled, `thread ${row.key} cancelled`, async () => {
        await cancelThread(
          coordinator,
          id(threadId, row.key, "thread"),
          "المشروع تأجل من طرف المالك، ألغينا العرض بطلب من العميل",
        );
      });
    }
  }
}

function planDispatches(look: Lookups): void {
  for (const row of DISPATCHES) {
    const company = row.thread
      ? id(threadRow, row.thread, "thread").company
      : row.company!;
    const owner = ownerOf.get(company);
    if (!owner) throw new Error(`${row.key}: no company "${company}"`);
    const coordinator = who("nouf");

    on(row.requested, `dispatch ${row.key} raised`, async () => {
      const source = row.thread
        ? asDispatchLines(id(threadLines, row.thread, "thread lines"))
        : asDispatchLines(lines(look, row.lines ?? 1, row.sqm ?? 200, false));
      const created = await requestDispatch(who(owner), {
        lines: source,
        dispatchDate: day(row.date),
        quotationThreadId: row.thread
          ? id(threadId, row.thread, "thread")
          : null,
        companyId: row.thread ? null : id(companyId, company, "company"),
        userId: null,
        // `S74` — never named here. A linked request takes the quotation's
        // project and a free entry `S75` has none; the picker that used to put
        // one on this call went with `S50`'s null case.
        projectId: null,
        stock: row.stock,
        shipment: row.shipment,
        cargoDestination: row.cargo ?? null,
      });
      dispatchId.set(row.key, created.id);
    });

    if (row.editedByRep !== undefined) {
      on(row.editedByRep, `dispatch ${row.key} edited by the rep`, async () => {
        const source = row.thread
          ? asDispatchLines(id(threadLines, row.thread, "thread lines"))
          : asDispatchLines(lines(look, row.lines ?? 1, row.sqm ?? 200, false));
        await updateDispatchRequest(
          who(owner),
          id(dispatchId, row.key, "dispatch"),
          {
            lines: edited(source),
            dispatchDate: day(row.date),
            projectId: null,
            stock: row.stock,
            shipment: row.shipment,
            cargoDestination: row.cargo ?? null,
          },
        );
      });
    }

    if (row.submitted !== undefined) {
      on(row.submitted, `dispatch ${row.key} submitted`, async () => {
        await submitDispatchRequest(
          who(owner),
          id(dispatchId, row.key, "dispatch"),
        );
      });
    }

    if (row.editedByCoord !== undefined) {
      on(
        row.editedByCoord,
        `dispatch ${row.key} edited by the coordinator`,
        async () => {
          const source = row.thread
            ? asDispatchLines(id(threadLines, row.thread, "thread lines"))
            : asDispatchLines(lines(look, row.lines ?? 1, row.sqm ?? 200, false));
          await updateDispatchRequest(
            coordinator,
            id(dispatchId, row.key, "dispatch"),
            {
              lines: edited(source),
              dispatchDate: day(row.date),
              projectId: null,
              stock: row.stock,
              shipment: row.shipment,
              cargoDestination: row.cargo ?? null,
            },
          );
        },
      );
    }

    if (row.approved !== undefined) {
      on(row.approved, `dispatch ${row.key} approved`, async () => {
        await approveDispatchRequest(
          coordinator,
          id(dispatchId, row.key, "dispatch"),
          { method: row.payment ?? "on_delivery", note: row.paymentNote ?? null },
        );
        // `S121` — approved, then numbered. Not a condition of approval, and
        // one of them is left without a number because that is a real state.
        if (row.smac) {
          await setDispatchSmacNumber(
            coordinator,
            id(dispatchId, row.key, "dispatch"),
            row.smac,
          );
        }
      });
    }

    if (row.refused !== undefined) {
      on(row.refused, `dispatch ${row.key} refused`, async () => {
        await refuseDispatchRequest(
          coordinator,
          id(dispatchId, row.key, "dispatch"),
          "الكمية أكبر من المتوفر في المخزن، راجع الرصيد وأعد الطلب",
        );
      });
    }
    if (row.revived !== undefined) {
      on(row.revived, `dispatch ${row.key} revived`, async () => {
        await reviveDispatchRequest(
          coordinator,
          id(dispatchId, row.key, "dispatch"),
        );
      });
    }
    if (row.cancelled !== undefined) {
      on(row.cancelled, `dispatch ${row.key} cancelled`, async () => {
        await cancelDispatch(
          coordinator,
          id(dispatchId, row.key, "dispatch"),
          "المالية رفضت الدفعة بعد الاعتماد، ألغينا الصرف بالكامل",
        );
      });
    }
  }
}

function planReports(look: Lookups): void {
  for (const [index, row] of REPORTS.entries()) {
    on(row.day, `report ${index}`, async () => {
      await createReport(who(row.by), {
        entryType: row.company ? "interaction" : "field_note",
        reportDate: day(row.day),
        narrative: row.text,
        companyId: row.company ? id(companyId, row.company, "company") : null,
        contactId:
          row.company && row.contact
            ? (contactId.get(row.company) ?? null)
            : null,
        projectId: row.project ? id(projectId, row.project, "project") : null,
        channel: row.channel ?? null,
        outcome: row.outcome ?? null,
        // `S37` — on hold requires a date, and until it passes that company
        // raises nothing.
        onHoldUntil:
          row.onHoldInDays !== undefined ? day(-row.onHoldInDays) : null,
        category: row.category ?? null,
        cityId: row.city ? need(look.cityId, row.city, "city") : null,
        signals: (row.signals ?? []).map((s) => ({
          signal: s.signal,
          reference: s.reference ?? null,
        })),
      });
    });
  }
}

function planActivity(): void {
  for (const row of TARGETS) {
    on(row.day, `target ${row.user} -${row.period}m`, async () => {
      await setTarget(
        who(row.by),
        who(row.user).user.id,
        monthsBack(row.period),
        row.sqm,
      );
    });
  }

  /* `S136` — one figure a month, set independently of the rows above. The
     current month is set twice, so the supersession `S84` is exercised rather
     than assumed: 6,000 is in force and 5,500 must appear on no screen. */
  for (const row of COMPANY_TARGETS) {
    on(row.day, `company target -${row.period}m`, async () => {
      await setCompanyTarget(who(row.by), monthsBack(row.period), row.sqm);
    });
  }

  for (const row of SHARES) {
    on(row.day, `share ${row.type} ${row.target}`, async () => {
      const target =
        row.type === "company"
          ? id(companyId, row.target, "company")
          : row.type === "project"
            ? id(projectId, row.target, "project")
            : id(threadId, row.target, "thread");
      // `S96` — manager-initiated, and it lives only in the manager's view.
      await grantShare(who("abdulrahman"), row.type, target, who(row.to).user.id);
    });
  }

  for (const row of COMMENTS) {
    on(row.day, `comment on ${row.target}`, async () => {
      await addComment(who(row.by), {
        recordType: row.on,
        recordId:
          row.on === "project"
            ? id(projectId, row.target, "project")
            : id(threadId, row.target, "thread"),
        body: row.body,
        mentions: [],
      });
    });
  }

  for (const row of FOLLOW_UPS) {
    // A date the rep picks, always today or later — `setNextFollowUp` refuses
    // a past one. An arrived entry is set far enough ahead that its own
    // batch's shift lands it where the diary wants it.
    const ahead = row.arrived !== undefined ? row.setOn - row.arrived : row.future!;
    if (ahead < 0) throw new Error(`follow-up on ${row.target}: set in the past`);
    on(row.setOn, `follow-up on ${row.target}`, async () => {
      const target =
        row.on === "company"
          ? id(companyId, row.target, "company")
          : row.on === "project"
            ? id(projectId, row.target, "project")
            : id(threadId, row.target, "thread");
      await setNextFollowUp(who(row.by), row.on, target, day(-ahead));
      if (row.arrived !== undefined) {
        dateShifts.push({
          at: row.setOn,
          table:
            row.on === "company"
              ? "companies"
              : row.on === "project"
                ? "projects"
                : "quotation_threads",
          id: target,
        });
      }
    });
  }

  // `S79` — shared credit, and it is rare. One row, on a project with no
  // dispatch, so it is visible on the screen without moving a figure that
  // `S78`'s 100% already answers.
  on(0, "credit split on P08", async () => {
    await setCreditSplit(who("abdulrahman"), id(projectId, "P08", "project"), {
      userIds: [who("faisal").user.id, who("saad").user.id],
      effectiveFrom: day(0),
    });
  });
}

/* ================================================================== *
 * What came out
 * ================================================================== */

async function countOf(table: string): Promise<number> {
  const rows = queryRows<{ n: number }>(
    await db.execute(sql`select count(*)::int as n from ${sql.identifier(table)}`),
  );
  return Number(rows[0]?.n ?? 0);
}

async function report(): Promise<void> {
  const rows: [string, number][] = [
    ["users", await countOf("users")],
    ["roles", await countOf("roles")],
    ["companies", await countOf("companies")],
    ["  · with a contact", await countOf("contacts")],
    ["  · company_reps", await countOf("company_reps")],
    ["projects", await countOf("projects")],
    ["  · participants", await countOf("project_companies")],
    ["quotation threads", await countOf("quotation_threads")],
    ["  · versions", await countOf("quotation_versions")],
    ["  · product lines", await countOf("quotation_lines")],
    ["  · service lines", await countOf("quotation_service_lines")],
    ["dispatches", await countOf("dispatches")],
    ["  · lines", await countOf("dispatch_lines")],
    ["reports", await countOf("rep_reports")],
    ["  · signals", await countOf("rep_report_signals")],
    ["comments", await countOf("comments")],
    ["targets", await countOf("targets")],
    ["company targets", await countOf("company_targets")],
    ["shares", await countOf("record_shares")],
    ["credit splits", await countOf("project_credit_splits")],
    ["notifications", await countOf("notifications")],
    ["audit rows", await countOf("audit_log")],
  ];
  console.log("\nRows:");
  for (const [label, n] of rows) {
    console.log(`  ${label.padEnd(22)} ${String(n).padStart(5)}`);
  }

  const breakdown = async (table: string, column: string) => {
    const out = queryRows<{ k: string | null; n: number }>(
      await db.execute(
        sql`select ${sql.identifier(column)}::text as k, count(*)::int as n
            from ${sql.identifier(table)}
            group by 1 order by 1`,
      ),
    );
    return out.map((r) => `${r.k ?? "—"}:${r.n}`).join("  ");
  };

  console.log("\nStates:");
  console.log(`  dispatch status      ${await breakdown("dispatches", "status")}`);
  console.log(`  version status       ${await breakdown("quotation_versions", "status")}`);
  console.log(`  thread end state     ${await breakdown("quotation_threads", "end_state")}`);
  console.log(`  payment method       ${await breakdown("dispatches", "payment_method")}`);
  console.log(`  shipment             ${await breakdown("dispatches", "shipment")}`);
  console.log(`  stock                ${await breakdown("dispatches", "stock")}`);
  console.log(`  company region       ${await breakdown("companies", "region")}`);
  console.log(`  report outcome       ${await breakdown("rep_reports", "outcome")}`);
  console.log(`  report channel       ${await breakdown("rep_reports", "channel")}`);
  console.log(`  field note category  ${await breakdown("rep_reports", "category")}`);
  console.log(`  report signal        ${await breakdown("rep_report_signals", "signal")}`);

  const books = queryRows<{ name: string; n: number }>(
    await db.execute(
      sql`select u.name, count(*)::int as n
          from company_reps cr join users u on u.id = cr.user_id
          where cr.removed_at is null and cr.is_primary
          group by 1 order by n desc`,
    ),
  );
  console.log("\nBooks (primary rep `S18`):");
  for (const row of books) {
    console.log(`  ${row.name.padEnd(26)} ${String(row.n).padStart(4)}`);
  }
}

/**
 * The coverage the dataset claims, asserted rather than commented.
 *
 * A demo dataset whose whole purpose is that every state a screen can draw
 * has a row behind it must say out loud when one does not — otherwise the
 * missing state reads as a broken screen the first time somebody looks.
 */
async function assertCoverage(): Promise<void> {
  const gaps: string[] = [];

  const present = async (table: string, column: string) => {
    const rows = queryRows<{ k: string }>(
      await db.execute(
        sql`select distinct ${sql.identifier(column)}::text as k
            from ${sql.identifier(table)}
            where ${sql.identifier(column)} is not null`,
      ),
    );
    return new Set(rows.map((r) => r.k));
  };

  const check = async (
    label: string,
    table: string,
    column: string,
    wanted: readonly string[],
  ) => {
    const have = await present(table, column);
    for (const value of wanted) {
      if (!have.has(value)) gaps.push(`${label}: ${value}`);
    }
  };

  await check("report channel", "rep_reports", "channel", REPORT_CHANNELS);
  await check("report outcome", "rep_reports", "outcome", REPORT_OUTCOMES);
  await check("field note category", "rep_reports", "category", FIELD_NOTE_CATEGORIES);
  await check("report signal", "rep_report_signals", "signal", REPORT_SIGNALS);
  await check("dispatch status", "dispatches", "status", [
    "draft",
    "submitted",
    "approved",
    "refused",
    "cancelled",
  ]);
  await check("version status", "quotation_versions", "status", [
    "requested",
    "issued",
    "superseded",
  ]);
  await check("thread end state", "quotation_threads", "end_state", [
    "accepted",
    "rejected",
    "cancelled",
  ]);
  await check("payment method", "dispatches", "payment_method", [
    "on_delivery",
    "card_in_office",
    "cash_in_office",
    "bank_transfer_full",
    "bank_transfer_downpayment",
    "handled_by_finance",
  ]);
  await check("shipment", "dispatches", "shipment", ["ct", "tt", "cargo"]);
  await check("stock", "dispatches", "stock", ["riyadh", "malham", "south", "dammam"]);
  await check("region", "companies", "region", [
    "center",
    "north",
    "south",
    "east",
    "west",
  ]);

  if (gaps.length > 0) {
    console.log("\nNot produced by any act in this dataset:");
    for (const gap of gaps) console.log(`  · ${gap}`);
  } else {
    console.log("\nEvery enum value this dataset set out to cover has a row.");
  }
}

/* ================================================================== *
 * Run
 * ================================================================== */

async function main(): Promise<void> {
  const password = requireDevelopment();

  console.log("Checking the clock's column lists against the schema…");
  await assertColumnsExist();

  console.log("Checking the plan holds together…");
  preflight();

  console.log("Clearing the record tables (`WORKFLOW §7` — nothing is production)…");
  await clearRecords();

  console.log("The fixture accounts and roles the verify scripts left…");
  await clearFixtureAccounts();

  console.log("The eight accounts…");
  await ensurePeople(password);

  const look = await loadLookups();

  planCompanies(look);
  planProjects(look);
  planThreads(look);
  planDispatches(look);
  planReports(look);
  planActivity();

  console.log(`Replaying ${timeline.length} acts through the real writers…`);
  await runTimeline();

  await report();
  await assertCoverage();
}

main()
  .then(async () => {
    console.log("\nseed:demo complete.");
    await closeDatabase();
  })
  .catch(async (error) => {
    console.error("\n" + (error instanceof Error ? error.message : String(error)));
    await closeDatabase();
    process.exit(1);
  });
