/**
 * Verification scaffolding for team, user management and offboarding — NOT a
 * feature.
 *
 * `scripts/verify-slice3.ts` is the pattern this copies, for the reason
 * `CLAUDE.md` records: the throwaway script that verified the auth checklist
 * was deleted, so its results cannot be reproduced. This one is **kept** — and
 * section 6 below is the first automated half of that checklist, which
 * `CLAUDE.md` calls the highest-value test in the repo to write.
 *
 * It drives `src/lib/authz.ts` and `src/lib/team.ts` in process — no browser,
 * no HTTP — and checks the things that are otherwise only claimed:
 *
 *   1. `can_manage_users` is reachable, and the seed grants it to exactly the
 *      three roles `12 §3` names — and to nobody else.
 *   2. Every gate refuses, each with its own translation key.
 *   3. Creation: no self-registration, the hash never round-trips, and a
 *      duplicate email is a field message rather than a 500 `[11 §1]`.
 *   4. Edit, including the email `[19 §6]`, audited on changed keys only.
 *   5. Self-deactivation is refused `[19 §5]`.
 *   6. Deactivation kills a live session in the same transaction `[07 B7]`.
 *   7. Deactivation deletes nothing and is idempotent `[04 C2]`, `[12 §7]`.
 *   8. Reactivation restores the flag and restores NO session `[19 §7]`.
 *   9. Handover is shut while the account is active `[19 §3]`, and
 *      deactivating moves nothing `[07 B7]`.
 *  10. The book is exactly three buckets — contacts are not one `[14 §1]`,
 *      and `tasks` no longer is either `[26 §6]`.
 *  11. Reassignment bucket by bucket, including the partial-unique-index trap.
 *  12. Every reassignment refusal, and that a failure rolls back whole —
 *      including `S9`'s, which the picker itself is asserted against (AUDIT 1
 *      F8): only a rep, a desk rep, marketing or the coordinator may be
 *      handed a book, and no flag says so, so the test is a chosen proxy.
 *  13. A handover does not move past credit `[18 §1]`. The central claim.
 *  14. Visibility follows the move, in both directions `[04 Q7]`, `[11 §2]`.
 *  15. An impersonated identity loses the flag `[07 A6]`.
 *  16. Every write is audited `[07 E1]`.
 *
 * Usage: `npm run verify:phase11`
 *
 * That needs `NODE_ENV=development` in `.env`. `--env-file` is not optional and
 * cannot be replaced by the `process.loadEnvFile` call below: this script
 * reaches `@/lib/authz`, and `src/auth/index.ts` reads `AUTH_SECRET` at module
 * scope — before any statement in this file runs.
 *
 * **It refuses to run outside development** `[15 §7]`: it writes real rows.
 *
 * It needs a seeded database — `npm run db:seed` — and the fixture accounts:
 * `DEV_FIXTURE_PASSWORD=… npm run dev:fixtures`.
 *
 * **It creates its own users, and every email carries the run stamp.**
 * `users_email_key` is unique and creating users is this script's whole
 * subject, so a fixed address would collide on the second run.
 *
 * **There is no `tasks` bucket to exercise.** There was, until feature slice
 * 6 withdrew `25 §20` and dropped `tasks` with it `[26 §6]` — this script's
 * own task fixtures and bucket assertions were removed in the same slice.
 */

process.loadEnvFile(".env");

import { and, count, eq, inArray, isNull, like, sql } from "drizzle-orm";

import { closeDatabase, db } from "@/db";
import {
  auditLog,
  companies,
  companyReps,
  contacts,
  dispatches,
  projects,
  quotationThreads,
  roles,
  sessions,
  users,
} from "@/db/schema";
import {
  canViewRecord,
  createUser,
  deactivateUser,
  getManagedUser,
  listActiveUsers,
  listCompanyBookHolders,
  listRoles,
  listUsers,
  reactivateUser,
  updateUser,
  visibleCompaniesFilter,
  visibleProjectsFilter,
  type AuthSession,
  type Role,
  type User,
} from "@/lib/authz";
import { creditForDispatches } from "@/lib/credit-splits";
import { SAUDI_CODE } from "@/lib/enums";
import { listCountries } from "@/lib/lookups";
import { verifyPassword } from "@/lib/passwords";
import { achievementForPeriod, currentPeriod } from "@/lib/targets";
import {
  getHandoverBook,
  reassignHandover,
  type HandoverSelection,
} from "@/lib/team";

import { addDispatchLine } from "./dispatch-fixture";

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
 * on a typo in the function under test — which is exactly the defect this
 * phase fixes: these gates used to throw a raw English string.
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
    check(
      `${label} (${expectedKey})`,
      message === expectedKey,
      `threw ${message}`,
    );
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

const emptySelection: HandoverSelection = {
  membershipIds: [],
  projectIds: [],
  threadIds: [],
};

function only(part: Partial<HandoverSelection>): HandoverSelection {
  return { ...emptySelection, ...part };
}

/**
 * The run's stamp. **Module scope, so the `finally` at the foot of the file can
 * reach it** — every account this script writes is `${stamp}-…@example.test`,
 * which is what `endRunAccounts` below matches on.
 */
const stamp = `verify11-${Date.now()}`;

/**
 * Every account this run created, ended the way `S111` sanctions.
 *
 * `S111` forbids deleting a person — history must keep pointing at a real one —
 * and names deactivation as the end state instead. That is the whole of the
 * fix: `listActiveUsers` drops a deactivated account immediately, so the
 * mention picker on every comment box, the share recipient picker, the dispatch
 * rep picker and every achievement roster stop offering the accounts this run
 * invented. The rows stay; the people stop being offerable.
 *
 * **A direct `update`, not `deactivateUser`.** The data-layer writer would add
 * an audit row per account `S112` — thirty a pass, to fix a residue problem —
 * and this script already writes its users outside that path.
 */
async function endRunAccounts(): Promise<void> {
  const ended = await db
    .update(users)
    .set({ isActive: false, deactivatedAt: new Date() })
    .where(like(users.email, `${stamp}-%`))
    .returning({ id: users.id });
  console.log(
    `  --    ${ended.length} account(s) of this run deactivated [S111]`,
  );
}

async function main(): Promise<void> {
  if (process.env.NODE_ENV !== "development") {
    console.error(
      "verify-phase11 refuses to run outside development.\n" +
        `  NODE_ENV is ${process.env.NODE_ENV ?? "unset"}, and must be "development".`,
    );
    process.exit(1);
  }

  const manager = await sessionFor("manager@example.test");
  const rep = await sessionFor("rep-a@example.test");
  const coordinator = await sessionFor("coordinator@example.test");

  const seededRoles = await db.select().from(roles);
  const roleByName = new Map(seededRoles.map((role) => [role.nameEn, role]));
  const repRole = roleByName.get("Sales Rep");
  if (!repRole || seededRoles.length < 7) {
    console.error("Roles are not seeded. Run: npm run db:seed");
    process.exit(1);
  }

  const asSession = (user: User, role: Role): AuthSession => {
    const withRole = { ...user, role };
    return {
      user: withRole,
      realUser: withRole,
      isImpersonating: false,
      actor: { actorUserId: user.id, actingAsUserId: null },
    };
  };

  /* --- 1. The flag [11 §1], [12 §3] -------------------------------- */

  console.log("\n1. `can_manage_users` is seeded to exactly the right roles");

  for (const name of ["Super Admin", "Executive", "Sales Manager"]) {
    check(
      `${name} holds can_manage_users [12 §3]`,
      roleByName.get(name)?.canManageUsers === true,
      `got ${roleByName.get(name)?.canManageUsers}`,
    );
  }
  // The negative half matters more: a flag granted too widely is invisible.
  for (const name of ["Sales Coordinator", "Marketing", "Desk Rep", "Sales Rep"]) {
    check(
      `${name} does NOT hold can_manage_users [12 §2]`,
      roleByName.get(name)?.canManageUsers === false,
      `got ${roleByName.get(name)?.canManageUsers}`,
    );
  }
  check(
    "listRoles() returns every seeded role for the form",
    (await listRoles()).length === seededRoles.length,
  );

  /* --- 2. Every gate refuses, with its own key --------------------- */

  console.log("\n2. Every gate refuses a role without the flag");

  const deniedKey = "team.errors.manageUsersOnly";
  for (const [who, session] of [
    ["a rep", rep],
    ["the coordinator", coordinator],
  ] as const) {
    await refuses(`listUsers refuses ${who}`, deniedKey, () =>
      listUsers(session),
    );
    await refuses(`getManagedUser refuses ${who}`, deniedKey, () =>
      getManagedUser(session, rep.user.id),
    );
    await refuses(`createUser refuses ${who}`, deniedKey, () =>
      createUser(session, {
        name: "nope",
        email: `${stamp}-nope@example.test`,
        roleId: repRole.id,
      }),
    );
    await refuses(`updateUser refuses ${who}`, deniedKey, () =>
      updateUser(session, rep.user.id, {
        name: "nope",
        email: "nope@example.test",
        roleId: repRole.id,
        region: null,
      }),
    );
    await refuses(`deactivateUser refuses ${who}`, deniedKey, () =>
      deactivateUser(session, rep.user.id),
    );
    await refuses(`reactivateUser refuses ${who}`, deniedKey, () =>
      reactivateUser(session, rep.user.id),
    );
    await refuses(`getHandoverBook refuses ${who}`, deniedKey, () =>
      getHandoverBook(session, rep.user.id),
    );
    await refuses(`reassignHandover refuses ${who}`, deniedKey, () =>
      reassignHandover(session, rep.user.id, manager.user.id, emptySelection),
    );
  }

  /* --- 3. Creation [11 §1] ----------------------------------------- */

  console.log("\n3. Creation — the only way a user comes into being");

  const password = `${stamp}-secret`;
  const departingUser = await createUser(manager, {
    // Deliberately untidy, to prove the normalisation.
    email: `  ${stamp}-DEPARTING@Example.test  `,
    name: `${stamp} Departing`,
    roleId: repRole.id,
    region: "east",
    password,
  });
  const receiverUser = await createUser(manager, {
    email: `${stamp}-receiver@example.test`,
    name: `${stamp} Receiver`,
    roleId: repRole.id,
    region: "center",
    password,
  });
  const bystanderUser = await createUser(manager, {
    email: `${stamp}-bystander@example.test`,
    name: `${stamp} Bystander`,
    roleId: repRole.id,
    password,
  });

  const departing = asSession(departingUser, repRole);
  const receiver = asSession(receiverUser, repRole);
  const bystander = asSession(bystanderUser, repRole);

  check(
    "the email is trimmed and lower-cased",
    departingUser.email === `${stamp}-departing@example.test`.toLowerCase(),
    `got ${departingUser.email}`,
  );
  check(
    "the password is hashed, never stored as given",
    departingUser.passwordHash !== null &&
      departingUser.passwordHash !== password,
  );
  check(
    "and the hash verifies against the password",
    await verifyPassword(password, departingUser.passwordHash!),
  );
  check("region is stored as given", departingUser.region === "east");

  const noPassword = await createUser(manager, {
    email: `${stamp}-nologin@example.test`,
    name: `${stamp} No Login`,
    roleId: repRole.id,
  });
  check(
    "a user created without a password cannot log in [11 §1]",
    noPassword.passwordHash === null,
  );
  check(
    "and `canSignIn` reports that without selecting the hash",
    (await getManagedUser(manager, noPassword.id))?.canSignIn === false,
  );

  await refuses(
    "a duplicate email is a field message, not a Postgres error",
    "team.errors.emailTaken",
    () =>
      createUser(manager, {
        email: `${stamp}-DEPARTING@example.test`,
        name: "clash",
        roleId: repRole.id,
      }),
  );
  await refuses(
    "a short password is refused",
    "team.errors.passwordTooShort",
    () =>
      createUser(manager, {
        email: `${stamp}-short@example.test`,
        name: "short",
        roleId: repRole.id,
        password: "abc",
      }),
  );
  await refuses(
    "an unknown role is refused before the foreign key fires",
    "team.errors.roleUnknown",
    () =>
      createUser(manager, {
        email: `${stamp}-norole@example.test`,
        name: "no role",
        roleId: "00000000-0000-0000-0000-000000000000",
      }),
  );

  /* --- 4. Edit [19 §6] --------------------------------------------- */

  console.log("\n4. Edit — name, role, region and the email itself");

  const auditBefore = await auditCount(bystanderUser.id);
  const edited = await updateUser(manager, bystanderUser.id, {
    name: `${stamp} Bystander Renamed`,
    email: `  ${stamp}-BYSTANDER-NEW@Example.test `,
    roleId: repRole.id,
    region: "west",
  });
  check("the name changed", edited.name.endsWith("Renamed"));
  check(
    "the email changed, trimmed and lower-cased [19 §6]",
    edited.email === `${stamp}-bystander-new@example.test`,
    `got ${edited.email}`,
  );
  check("the region changed", edited.region === "west");
  check(
    "one audit row was written",
    (await auditCount(bystanderUser.id)) === auditBefore + 1,
  );

  const auditAfterEdit = await auditCount(bystanderUser.id);
  await updateUser(manager, bystanderUser.id, {
    name: edited.name,
    email: edited.email,
    roleId: edited.roleId,
    region: edited.region,
  });
  check(
    "a no-op save writes NO audit row",
    (await auditCount(bystanderUser.id)) === auditAfterEdit,
  );

  await refuses(
    "editing onto somebody else's email is refused",
    "team.errors.emailTaken",
    () =>
      updateUser(manager, bystanderUser.id, {
        name: edited.name,
        email: departingUser.email,
        roleId: repRole.id,
        region: null,
      }),
  );

  /* --- 5. Self-deactivation [19 §5] -------------------------------- */

  console.log("\n5. A user may not deactivate their own account [19 §5]");

  await refuses(
    "the actor cannot deactivate themselves",
    "team.errors.cannotDeactivateSelf",
    () => deactivateUser(manager, manager.user.id),
  );
  const [managerStill] = await db
    .select()
    .from(users)
    .where(eq(users.id, manager.user.id))
    .limit(1);
  check(
    "and they are still active afterwards",
    managerStill.isActive === true,
  );

  /* --- 6. Deactivation kills live sessions [07 B7], [11 §4.1] ------ */

  console.log(
    "\n6. *** Deactivation kills a live session, in the same transaction ***",
  );

  const victim = await createUser(manager, {
    email: `${stamp}-victim@example.test`,
    name: `${stamp} Victim`,
    roleId: repRole.id,
    password,
  });
  const victimToken = `${stamp}-token`;
  const spectatorToken = `${stamp}-spectator`;
  const expires = new Date(Date.now() + 86_400_000);
  await db.insert(sessions).values([
    { sessionToken: victimToken, userId: victim.id, expires },
    // Somebody else's session, currently impersonating the victim `[07 A6]`.
    {
      sessionToken: spectatorToken,
      userId: manager.user.id,
      expires,
      actingAsUserId: victim.id,
    },
  ]);
  check(
    "the victim has a live session before deactivation",
    (await sessionCount(victim.id)) === 1,
  );

  await deactivateUser(manager, victim.id);

  check(
    "every session belonging to the victim is gone",
    (await sessionCount(victim.id)) === 0,
    `got ${await sessionCount(victim.id)}`,
  );
  const [spectator] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.sessionToken, spectatorToken))
    .limit(1);
  check(
    "and a session impersonating them is released, not deleted [07 A6]",
    spectator !== undefined && spectator.actingAsUserId === null,
  );

  /* --- 7. Nothing is deleted [04 C2], [12 §7] ---------------------- */

  console.log("\n7. Deactivation deletes nothing, and repeats harmlessly");

  const [victimRow] = await db
    .select()
    .from(users)
    .where(eq(users.id, victim.id))
    .limit(1);
  check("the users row still exists [04 C2]", victimRow !== undefined);
  check("is_active is off", victimRow.isActive === false);
  check("deactivated_at is stamped", victimRow.deactivatedAt !== null);

  const auditBeforeRepeat = await auditCount(victim.id);
  await deactivateUser(manager, victim.id);
  check(
    "a second deactivation is a no-op and audits nothing",
    (await auditCount(victim.id)) === auditBeforeRepeat,
  );

  /* --- 8. Reactivation [19 §7] ------------------------------------- */

  console.log("\n8. Reactivation restores the flag — and no session");

  await reactivateUser(manager, victim.id);
  const [revived] = await db
    .select()
    .from(users)
    .where(eq(users.id, victim.id))
    .limit(1);
  check("is_active is back on", revived.isActive === true);
  check("deactivated_at is cleared [19 §7]", revived.deactivatedAt === null);
  check(
    "*** no session is resurrected — the person logs in again ***",
    (await sessionCount(victim.id)) === 0,
  );

  const auditBeforeIdempotent = await auditCount(victim.id);
  await reactivateUser(manager, victim.id);
  check(
    "a second reactivation is a no-op",
    (await auditCount(victim.id)) === auditBeforeIdempotent,
  );

  /* --- Fixtures: everything the departing rep holds ---------------- */

  console.log("\n   fixtures: a book of work for the departing rep");

  // `S13` makes the phone mandatory and `S23` matches companies on it, so every
  // fixture gets its own — from the run stamp plus a counter, because a shared
  // literal would make each run's companies duplicates of the last run's.
  // `S14` — all of them are Saudi, so `S15`'s city and region still apply.
  const saudiId = (await listCountries()).find(
    (row) => row.code === SAUDI_CODE,
  )!.id;
  let phoneSeq = 0;
  const nextPhone = () => `+9665${stamp.slice(-7)}${(phoneSeq += 1)}`;

  const [companyA] = await db
    .insert(companies)
    .values({
      name: `${stamp} Company A`,
      nameNormalized: `${stamp}-a`,
      phone: nextPhone(),
      countryId: saudiId,
      createdBy: departing.user.id,
    })
    .returning();
  const [companyShared] = await db
    .insert(companies)
    .values({
      name: `${stamp} Company Shared`,
      nameNormalized: `${stamp}-shared`,
      phone: nextPhone(),
      countryId: saudiId,
      createdBy: departing.user.id,
    })
    .returning();

  const [membershipA] = await db
    .insert(companyReps)
    .values({
      companyId: companyA.id,
      userId: departing.user.id,
      isPrimary: true,
      origin: "self_registered",
    })
    .returning();
  // The trap: the recipient ALREADY holds this one.
  const [membershipShared] = await db
    .insert(companyReps)
    .values({
      companyId: companyShared.id,
      userId: departing.user.id,
      isPrimary: true,
      origin: "self_registered",
    })
    .returning();
  // `origin: "assigned"` — `company_rep_origin` dropped `'shared'` in feature
  // slice 6, unused by real code and only ever written by fixtures `[26 §2]`.
  await db.insert(companyReps).values({
    companyId: companyShared.id,
    userId: receiver.user.id,
    isPrimary: false,
    origin: "assigned",
  });
  // A membership the departing rep ALREADY lost — history, and not in the
  // book: there is nothing left to hand over.
  const [companyPast] = await db
    .insert(companies)
    .values({
      name: `${stamp} Company Past`,
      nameNormalized: `${stamp}-past`,
      phone: nextPhone(),
      countryId: saudiId,
      createdBy: departing.user.id,
    })
    .returning();
  await db.insert(companyReps).values({
    companyId: companyPast.id,
    userId: departing.user.id,
    isPrimary: false,
    origin: "assigned",
    removedAt: new Date(),
  });

  // A contact on company A. `14 §1` — it follows the company and is NOT a
  // bucket of its own.
  await db.insert(contacts).values({
    companyId: companyA.id,
    name: `${stamp} Contact`,
    nameNormalized: `${stamp}-contact`,
    createdBy: departing.user.id,
  });

  const [project] = await db
    .insert(projects)
    .values({
      nameEn: `${stamp} Project`,
      nameNormalized: `${stamp}-p`,
      ownerUserId: departing.user.id,
      createdBy: departing.user.id,
    })
    .returning();
  const [otherProject] = await db
    .insert(projects)
    .values({
      nameEn: `${stamp} Other Project`,
      nameNormalized: `${stamp}-op`,
      ownerUserId: bystander.user.id,
      createdBy: bystander.user.id,
    })
    .returning();

  const [thread] = await db
    .insert(quotationThreads)
    .values({
      projectId: project.id,
      companyId: companyA.id,
      raisedByUserId: departing.user.id,
    })
    .returning();

  // A dispatch crediting the departing rep, for section 13.
  const period = currentPeriod();
  const [dispatch] = await db
    .insert(dispatches)
    .values({
      // `S130` `S119` `S70` — a hand-written dispatch names all three, as
      // every dispatch does. Riyadh and CT are the unconstrained pair
      // (`dispatches_stock_shipment`), and an APPROVED row must carry a
      // payment method or `dispatches_payment_method` refuses it `S73`.
      stock: "riyadh" as const,
      shipment: "ct" as const,
      paymentMethod: "bank_transfer_full" as const,
      companyId: companyA.id,
      userId: departing.user.id,
      dispatchDate: period,
      recordedByUserId: coordinator.user.id,
      // `S72` — a hand-written dispatch says which of the four states it is
      // in, and these fixtures all want the one that COUNTS: an approved
      // dispatch is the only thing that credits a target, and every figure
      // below reads it through `approvedDispatches()`. The three stamps move
      // together or the `dispatches_approval_stamps` CHECK refuses the row.
      status: "approved" as const,
      submittedAt: new Date(),
      approvedByUserId: coordinator.user.id,
      approvedAt: new Date(),
    })
    .returning();
  // `S116` — its one line, and the 42 m² every assertion below reads.
  await addDispatchLine(dispatch.id, "42.0000");

  /* --- 9. Handover is shut while active; deactivation moves nothing  */

  console.log(
    "\n9. *** Handover opens only after deactivation, and moves nothing by itself ***",
  );

  check(
    "the book is closed while the account is active [19 §3]",
    (await getHandoverBook(manager, departing.user.id)) === null,
  );
  await refuses(
    "and reassigning refuses for the same reason",
    "team.errors.userStillActive",
    () =>
      reassignHandover(manager, departing.user.id, receiver.user.id, {
        ...emptySelection,
        projectIds: [project.id],
      }),
  );

  await deactivateUser(manager, departing.user.id);

  // The central promise of `07 B7`: nothing moves automatically.
  const [afterDeactivation] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, project.id))
    .limit(1);
  check(
    "*** deactivation did NOT move the project [07 B7] ***",
    afterDeactivation.ownerUserId === departing.user.id,
  );
  const [threadAfter] = await db
    .select()
    .from(quotationThreads)
    .where(eq(quotationThreads.id, thread.id))
    .limit(1);
  check(
    "*** nor the quotation thread ***",
    threadAfter.raisedByUserId === departing.user.id,
  );
  check(
    "*** nor the company membership ***",
    (await liveMembership(companyA.id, departing.user.id)) !== undefined,
  );

  /* --- 10. The book is exactly three buckets ------------------------ */

  console.log("\n10. The handover book lists all of it, and nothing else");

  const book = (await getHandoverBook(manager, departing.user.id))!;
  check("the book opens once deactivated", book !== null);
  check(
    "two live company memberships",
    book.companies.length === 2,
    `got ${book.companies.length}`,
  );
  check(
    "an already-removed membership is NOT listed — nothing left to hand over",
    !book.companies.some((row) => row.companyId === companyPast.id),
    `got ${book.companies.map((row) => row.name).join(", ")}`,
  );
  check(
    "the owned project is listed, the bystander's is not",
    book.projects.length === 1 && book.projects[0].id === project.id,
    `got ${book.projects.map((p) => p.nameEn).join(", ")}`,
  );
  check(
    "the raised thread is listed",
    book.quotationThreads.length === 1 &&
      book.quotationThreads[0].id === thread.id,
  );
  check("the book is not empty", book.isEmpty === false);
  // `14 §1` — a contact has no owner and follows its company, so there is no
  // contacts bucket to list. Asserted as the absence of a key, same as the
  // `tasks` bucket `26 §6` removed.
  check(
    "there is no contacts bucket [14 §1]",
    !("contacts" in book),
  );
  check("there is no tasks bucket [26 §6]", !("tasks" in book));
  void otherProject;

  /* --- 11. Reassignment, bucket by bucket -------------------------- */

  console.log("\n11. Reassignment moves each bucket, correctly");

  const outcome = await reassignHandover(
    manager,
    departing.user.id,
    receiver.user.id,
    {
      membershipIds: [membershipA.id, membershipShared.id],
      projectIds: [project.id],
      threadIds: [thread.id],
    },
  );

  const [projectMoved] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, project.id))
    .limit(1);
  check(
    "the project owner moved [07 A8]",
    projectMoved.ownerUserId === receiver.user.id,
  );

  const [threadMoved] = await db
    .select()
    .from(quotationThreads)
    .where(eq(quotationThreads.id, thread.id))
    .limit(1);
  check(
    "the thread's raiser moved [19 §1]",
    threadMoved.raisedByUserId === receiver.user.id,
  );

  const [oldMembership] = await db
    .select()
    .from(companyReps)
    .where(eq(companyReps.id, membershipA.id))
    .limit(1);
  check(
    "the departing membership is KEPT with removed_at set [12 §7]",
    oldMembership !== undefined && oldMembership.removedAt !== null,
  );
  const newMembership = await liveMembership(companyA.id, receiver.user.id);
  check(
    "a new membership exists for the recipient",
    newMembership !== undefined,
  );
  check(
    "it carries origin 'assigned' [07 B3]",
    newMembership?.origin === "assigned",
  );
  check(
    "and it carries the primary flag across [S18]",
    newMembership?.isPrimary === true,
  );

  console.log(
    "\n    *** the partial unique index: the recipient was already a member ***",
  );
  check(
    "companiesAlreadyMember counted the shared company",
    outcome.companiesAlreadyMember === 1,
    `got ${outcome.companiesAlreadyMember}`,
  );
  check(
    "companiesMoved counted only the other one",
    outcome.companiesMoved === 1,
    `got ${outcome.companiesMoved}`,
  );
  const [sharedLive] = await db
    .select({ total: count() })
    .from(companyReps)
    .where(
      and(
        eq(companyReps.companyId, companyShared.id),
        eq(companyReps.userId, receiver.user.id),
        isNull(companyReps.removedAt),
      ),
    );
  check(
    "*** the recipient still has EXACTLY ONE live row on it ***",
    sharedLive.total === 1,
    `got ${sharedLive.total}`,
  );
  check(
    "and the departing rep's row on it was removed",
    (await liveMembership(companyShared.id, departing.user.id)) === undefined,
  );
  // *** The branch `S18` closes. *** The fixture is built so the departing rep
  // is primary on the shared company and the recipient is NOT — the one shape
  // where "no row to add" used to mean "and no primary either". Nothing here
  // inserted a row, so primacy had to move onto the row that stayed.
  check(
    "*** and THAT row is now primary — the company keeps exactly one *** [S18]",
    (await liveMembership(companyShared.id, receiver.user.id))?.isPrimary ===
      true,
    "the recipient's surviving row is not primary",
  );

  const emptyBook = (await getHandoverBook(manager, departing.user.id))!;
  check(
    "the book is empty once everything is handed over",
    emptyBook.isEmpty === true,
  );

  /* --- 12. Reassignment refusals ----------------------------------- */

  console.log("\n12. The handover write refuses, each for its own reason");

  // A second departing rep, to refuse against without disturbing the first.
  const strandedUser = await createUser(manager, {
    email: `${stamp}-stranded@example.test`,
    name: `${stamp} Stranded`,
    roleId: repRole.id,
    password,
  });
  const [strandedProject] = await db
    .insert(projects)
    .values({
      nameEn: `${stamp} Stranded Project`,
      nameNormalized: `${stamp}-sp`,
      ownerUserId: strandedUser.id,
      createdBy: strandedUser.id,
    })
    .returning();
  const [strandedCompany] = await db
    .insert(companies)
    .values({
      name: `${stamp} Stranded Company`,
      nameNormalized: `${stamp}-sc`,
      phone: nextPhone(),
      countryId: saudiId,
      createdBy: strandedUser.id,
    })
    .returning();
  const [strandedMembership] = await db
    .insert(companyReps)
    .values({
      companyId: strandedCompany.id,
      userId: strandedUser.id,
      isPrimary: true,
      origin: "self_registered",
    })
    .returning();
  await deactivateUser(manager, strandedUser.id);

  await refuses(
    "an empty selection is refused",
    "team.errors.nothingSelected",
    () =>
      reassignHandover(
        manager,
        strandedUser.id,
        receiver.user.id,
        emptySelection,
      ),
  );
  await refuses(
    "handing to yourself is refused",
    "team.errors.recipientIsSource",
    () =>
      reassignHandover(
        manager,
        strandedUser.id,
        strandedUser.id,
        only({ projectIds: [strandedProject.id] }),
      ),
  );
  await refuses(
    "handing to a deactivated colleague is refused [04 C2]",
    "team.errors.recipientInactive",
    () =>
      reassignHandover(
        manager,
        strandedUser.id,
        departing.user.id,
        only({ projectIds: [strandedProject.id] }),
      ),
  );
  // The **picker** behind that refusal, asserted directly: the route walk only
  // checks the handover gate, so an empty directory would render an empty
  // select and pass. `S9`'s four roles are offered; the three elevated ones
  // are not, and the wider directory the other pickers still read proves the
  // narrowing removed somebody rather than returning the same list.
  const offered = await listCompanyBookHolders();
  const everyone = await listActiveUsers();
  const offeredIds = new Set(offered.map((person) => person.id));
  check(
    "the handover picker offers a rep [S9]",
    offeredIds.has(receiver.user.id),
  );
  check(
    "*** and offers no role that may not hold a book *** [S9]",
    !offeredIds.has(manager.user.id),
    `${manager.user.id} is offered`,
  );
  check(
    "…and it is narrower than the directory the other pickers read [S9]",
    offered.length > 0 && offered.length < everyone.length,
    `${offered.length} offered of ${everyone.length} active`,
  );

  // `S9` — active is not the whole of it. The manager fixture is a Sales
  // Manager, so `sees_all_reps` is true and they are above the book rather
  // than a place to put one. AUDIT 1 F8: the code used to accept anybody
  // active, so a whole book could land on an executive or a super admin.
  await refuses(
    "*** handing to a role that may not hold a book is refused *** [S9]",
    "team.errors.recipientNotAHolder",
    () =>
      reassignHandover(
        manager,
        strandedUser.id,
        manager.user.id,
        only({ projectIds: [strandedProject.id] }),
      ),
  );
  await refuses(
    "an item the source does not hold is refused",
    "team.errors.itemNotHeld",
    () =>
      reassignHandover(manager, strandedUser.id, receiver.user.id, {
        ...emptySelection,
        // The membership IS held; the project is somebody else's. The whole
        // call must fail, not half-apply.
        projectIds: [otherProject.id],
        membershipIds: [strandedMembership.id],
      }),
  );
  const [strandedMembershipAfter] = await db
    .select()
    .from(companyReps)
    .where(eq(companyReps.id, strandedMembership.id))
    .limit(1);
  check(
    "*** and the valid half of that call rolled back with it ***",
    strandedMembershipAfter.removedAt === null,
    `got removedAt=${strandedMembershipAfter.removedAt}`,
  );

  /* --- 13. Past credit is untouched [18 §1] ------------------------ */

  console.log(
    "\n13. *** A handover does not move a square metre of past credit [18 §1] ***",
  );

  // Asserted against `creditForDispatches` rather than the achievement report,
  // because that report lists only ACTIVE people — a deactivated rep drops out
  // of it by design, which would mask the very thing under test.
  // `S116` — the square metres are the lines' sum, not a column, so the row is
  // read with the same derivation every reader uses.
  const [dispatchNow] = await db
    .select({
      id: dispatches.id,
      userId: dispatches.userId,
      dispatchDate: dispatches.dispatchDate,
      // Both tables named outright, never interpolated: a Drizzle column in a
      // SELECT-list template loses its qualifier when the outer query joins
      // nothing, and this subquery then answers `0.0000` for every row without
      // raising anything. It did, once, and this check is what caught it.
      sqm: sql<string>`(
        select coalesce(sum(dl.sqm), 0)::numeric(14, 4)
        from dispatch_lines dl
        where dl.dispatch_id = dispatches.id
      )`,
    })
    .from(dispatches)
    .where(eq(dispatches.id, dispatch.id))
    .limit(1);
  check(
    "the dispatch still names the departing rep [18 §1]",
    dispatchNow.userId === departing.user.id,
  );

  const credits = await creditForDispatches([
    {
      id: dispatchNow.id,
      userId: dispatchNow.userId,
      userName: departingUser.name,
      sqm: dispatchNow.sqm,
      dispatchDate: dispatchNow.dispatchDate,
      projectId: project.id,
    },
  ]);
  const shares = credits.get(dispatchNow.id)!.shares;
  check(
    "*** the departing rep still holds all 42 m² of it ***",
    shares.length === 1 &&
      shares[0].userId === departing.user.id &&
      shares[0].sqm === "42.0000",
    `got ${JSON.stringify(shares)}`,
  );

  const achievement = await achievementForPeriod(manager, period);
  const receiverRow = achievement.find(
    (row) => row.userId === receiver.user.id,
  );
  check(
    "and the recipient gained none of it, despite owning the project now",
    receiverRow === undefined || receiverRow.achievedSqm === "0.0000",
    `got ${receiverRow?.achievedSqm}`,
  );

  /* --- 14. Visibility follows the move [04 Q7], [11 §2] ------------ */

  console.log("\n14. Visibility follows the work, in both directions");

  check(
    "the recipient can now open the project",
    await canViewRecord(receiver, "project", project.id),
  );
  check(
    "*** the departing rep no longer can ***",
    !(await canViewRecord(departing, "project", project.id)),
  );
  check(
    "the recipient sees the thread through the project [11 §2]",
    await canViewRecord(receiver, "quotation_thread", thread.id),
  );

  // The same answer, from the list filter rather than the single-record check.
  const departingProjects = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.id, project.id), visibleProjectsFilter(departing)));
  check(
    "and the list filter agrees — one rule, not two",
    departingProjects.length === 0,
  );
  const departingCompanies = await db
    .select({ id: companies.id })
    .from(companies)
    .where(
      and(eq(companies.id, companyA.id), visibleCompaniesFilter(departing)),
    );
  check(
    "the departing rep no longer sees the handed-over company",
    departingCompanies.length === 0,
  );

  /* --- 15. Impersonation [07 A6] ----------------------------------- */

  console.log("\n15. An impersonated identity is the one that is gated");

  const impersonating: AuthSession = {
    user: receiver.user, // effective identity — a rep
    realUser: manager.user, // the person at the keyboard — holds the flag
    isImpersonating: true,
    actor: {
      actorUserId: manager.user.id,
      actingAsUserId: receiver.user.id,
    },
  };
  await refuses(
    "a manager impersonating a rep loses can_manage_users [07 A6]",
    deniedKey,
    () => listUsers(impersonating),
  );

  /* --- 16. Every write is audited [07 E1] -------------------------- */

  console.log("\n16. Every write is audited");

  /*
   * Scoped to THIS RUN'S OWN RECORDS — the third version of this check, and
   * the one that stops it failing on rows FACET writes correctly.
   *
   * The first scanned the whole audit log over a ten-minute window, and failed
   * on `verify:slice2`'s expiry sweep, which audited under a null actor ON
   * PURPOSE so that whoever opened a list was not recorded as having expired a
   * quotation. That sweep is gone with `S67`, but the lesson is not: a
   * whole-log scan fails on any legitimate null-actor write. The second kept
   * the window and filtered to a list of
   * action names — and failed again, on `dev:fixtures`, which creates its four
   * users under a null actor, correctly, because nobody is signed in during a
   * seed, and `user.created` was on the list.
   *
   * Both were asserting something FACET does not claim. A window says WHEN a
   * row was written; an action name says WHAT it did. Neither says WHOSE it
   * is. So this resolves the run's own records from the stamp every fixture
   * already carries, and asks only about audit rows anchored to them: no
   * window, no action list, and nothing another process writes can enter the
   * set. Threads and memberships carry no name of their own, so they are
   * reached through the project and the company that do — which also catches
   * the membership rows the handover CREATES, whose ids the script never sees.
   */
  const stamped = `${stamp}%`;
  const [ownUsers, ownCompanies, ownProjects] = await Promise.all([
    db.select({ id: users.id }).from(users).where(like(users.email, stamped)),
    db
      .select({ id: companies.id })
      .from(companies)
      .where(like(companies.nameNormalized, stamped)),
    db
      .select({ id: projects.id })
      .from(projects)
      .where(like(projects.nameNormalized, stamped)),
  ]);
  const companyIds = ownCompanies.map((row) => row.id);
  const projectIds = ownProjects.map((row) => row.id);
  const [ownThreads, ownMemberships] = await Promise.all([
    db
      .select({ id: quotationThreads.id })
      .from(quotationThreads)
      .where(inArray(quotationThreads.projectId, projectIds)),
    db
      .select({ id: companyReps.id })
      .from(companyReps)
      .where(inArray(companyReps.companyId, companyIds)),
  ]);
  const ownIds = [
    ...ownUsers,
    ...ownCompanies,
    ...ownProjects,
    ...ownThreads,
    ...ownMemberships,
  ].map((row) => row.id);
  // If the stamp ever stops reaching the fixtures this must fail loudly rather
  // than pass over an empty set.
  check("this run's own records were found", ownIds.length > 0);

  const entries = await db
    .select({ action: auditLog.action, actor: auditLog.actorUserId })
    .from(auditLog)
    .where(inArray(auditLog.entityId, ownIds));
  const actions = new Set(entries.map((row) => row.action));
  const OWNED = [
    "user.created",
    "user.updated",
    "user.deactivated",
    "user.reactivated",
    "company_rep.removed",
    "company_rep.added",
    "project.reassigned",
    "quotation_thread.reassigned",
    "user.handover",
  ];
  for (const action of OWNED) {
    check(`\`${action}\` was audited`, actions.has(action));
  }
  check(
    "every audit row on this run's own records names an actor",
    entries.every((row) => row.actor !== null),
  );
  console.log(`        actions seen: ${[...actions].sort().join(", ")}`);

  // Nothing is cleaned up: FACET does not delete history `[12 §7]`, and this
  // script does not get an exception. Every row it writes is prefixed with the
  // run's timestamp so a development database stays readable.
  //
  // Stated rather than papered over: this script stops at the data layer. The
  // handover form's own field reading has no standing check here, exactly as
  // for slices 2 and 3.
}

async function auditCount(entityId: string): Promise<number> {
  const [row] = await db
    .select({ total: count() })
    .from(auditLog)
    .where(eq(auditLog.entityId, entityId));
  return row?.total ?? 0;
}

async function sessionCount(userId: string): Promise<number> {
  const [row] = await db
    .select({ total: count() })
    .from(sessions)
    .where(eq(sessions.userId, userId));
  return row?.total ?? 0;
}

async function liveMembership(companyId: string, userId: string) {
  const [row] = await db
    .select()
    .from(companyReps)
    .where(
      and(
        eq(companyReps.companyId, companyId),
        eq(companyReps.userId, userId),
        isNull(companyReps.removedAt),
      ),
    )
    .limit(1);
  return row;
}

main()
  .then(() => {
    console.log(
      failures === 0 ? "\nAll checks passed." : `\n${failures} CHECK(S) FAILED.`,
    );
  })
  .catch((error) => {
    console.error(error);
    failures += 1;
  })
  .finally(async () => {
    // **In a `finally`, so a failing assertion still cleans up after
    // itself.** A script that died halfway is exactly how 196 live
    // accounts accumulated `[S111]`.
    await endRunAccounts();
    await closeDatabase();
    process.exit(failures === 0 ? 0 : 1);
  });
