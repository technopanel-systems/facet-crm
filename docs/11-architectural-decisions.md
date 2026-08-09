# 11 — Architectural Decisions (Phase 6, auth and authorization)

Records the three decisions taken while building the auth and authorization
layer, and the fragile machinery that layer sits on.

**Status:** Sections 1–3 are marked **[founder]** — they were decided by the
founder during the phase 6 build session (2026-08-09, commits
`da2cfc5..3628028`) and were until now recorded only in that session's plan.
This document is where they become user truth. Section 4 is **[observed]** —
facts about the code and its dependencies, not decisions.

**Authority:** user truth, alongside `07-phase4-answers.md`. Where this
document extends `09` or `10`, this is the later statement and wins.

---

## 1. `can_manage_users` — a ninth permission flag **[founder]**

**Decision.** `roles` carries a ninth boolean, `can_manage_users`. It is held
by **Super Admin** and **Sales Manager**, and by nobody else in the seed. It
gates user creation and deactivation
([authz.ts:289](src/lib/authz.ts#L289), [authz.ts:329](src/lib/authz.ts#L329)).
There is no self-registration anywhere in FACET; a user exists only because a
holder of this flag created them, or because the one-off bootstrap script did.

**Context — why the flag exists at all.** `07 C1` lists eight flags and ends
with "and so on"; `09 §15.1` records the flag list as explicitly **OPEN**.
Phase 6 had to build user creation and deactivation, and every gate in this
system must be a flag — `can(session, flag)`, never a role name. Without a
ninth flag the only way to gate user management would have been to hardcode
"Super Admin" somewhere, which is the exact failure CLAUDE.md forbids.

**Context — why Sales Manager holds it.** `07 A5` gives the sales manager
"approves shares, assignments, deletes, duplicate resolution, **offboarding**".
Offboarding is deactivation. A manager who can offboard but cannot onboard
would send every new hire through the founder.

**Context — why Executive does not.** `07 A5` defines the executive as
"monitoring, changing targets, seeing everything. **No operational data
entry**." Creating users is data entry. The executive-versus-super-admin
boundary is still open `[07 F4]`, so the narrower reading of the written note
was taken rather than the more convenient one. If the founder later wants
executives to manage users, it is one seed value, no code.

---

## 2. Project visibility carries the quotation threads raised on it **[founder]**

**Decision.** A user who can see a project can see the quotation threads raised
on that project — whether they own the project or hold an explicit share of it.
This sits alongside the two existing routes: the rep who raised the thread, and
an explicit share of the thread itself
([authz.ts:255-270](src/lib/authz.ts#L255-L270)).

**Context — the rule it extends.** `04 Q7` and `07 B2` settle that sharing is
**per record**: "sometimes a project and its quotation, sometimes a company —
never everything at once". `09` reads that strictly, and the code honours it:
seeing a company does **not** expose its projects, and company membership is
deliberately never consulted when answering project visibility.

**Context — why the strict reading broke.** Under a purely per-record rule, the
owner of a project could not see a quotation raised on their own project unless
somebody remembered to share the thread back to them. Quotation threads are not
always raised by the project owner — the coordinator issues versions against
the rep's project `[10 §4]`. The rep would lose sight of their own deal for
want of a share click, and the first workaround anyone reaches for is sharing
everything with everyone, which destroys the visibility model entirely.

**Scope — deliberately one step, deliberately asymmetric.** Project → its
threads cascades. Company → its projects does **not**, and this decision does
not weaken that. The asymmetry is the point: a company is a directory entry
many people may legitimately see, while a project is a deal with an owner, and
a quotation is part of that deal rather than a separate secret.

---

## 3. Unique index `roles_name_en_key` **[founder-approved]**

**Decision.** `roles.name_en` carries a unique index
([schema.ts:230](src/db/schema.ts#L230)). The role seed is an upsert on that
target ([seed-roles.ts:19](scripts/seed-roles.ts#L19)).

**Context.** The seed must be idempotent — `bootstrap-admin` runs `seedRoles()`
on every invocation, and the seed will be re-run whenever the flag matrix
changes. Without a unique key, `onConflictDoUpdate` has no target: re-running
would insert a second "Sales Manager" and existing users would keep pointing at
the stale row while new ones got the fresh one. That is a silent
permissions-drift bug, and it would surface as "the manager lost a permission
we definitely granted".

**Why the name and not the id.** Ids are UUIDs generated per database. The dev
machine, the company PC and any restored backup all hold different ids for the
same role, so a seed cannot key on id. `name_en` is the only stable natural key
the table has.

**Cost, accepted.** English role names are now unique, and renaming a role is a
data migration rather than an edit. Role names are configuration, not user
data, so this is cheap. It does **not** weaken "roles are flags, never names":
`name_en` is read in exactly two places — the seed, and the bootstrap script's
lookup of the super admin role via `SUPER_ADMIN_NAME_EN`. The authorization
module still never learns a role name.

---

## 4. Known fragilities / technical debt **[observed]**

### 4.1 The `jwt.encode` bridge — highest risk in the codebase

**Where.** [src/auth/index.ts:105-122](src/auth/index.ts#L105-L122), with the
`callbacks.jwt` half at [index.ts:94-99](src/auth/index.ts#L94-L99).

**What FACET needs.** Database sessions, not JWTs. Three requirements force
this and none of them are negotiable:

- Deactivation revokes access **immediately** `[07 B7]`. A JWT cannot be
  revoked; a deactivated user would keep working until the token expired.
- Impersonation state lives on the session row `[07 A5, A6]` — the server must
  be able to start and stop it, and a cookie the server cannot rewrite makes
  that impossible.
- The authorization module re-reads `users.is_active` and the role flags on
  every request. Claims baked into a token at login would go stale.

**Obstacle 1 — `@auth/core` refuses an explicit `strategy: "database"` next to
a Credentials provider.** Its config assertion rejects the combination outright
("credentials requires JWT"). The guard inspects only the **explicitly written**
value, and with an adapter present `@auth/core` already defaults to
`"database"`. So the config sets `session.maxAge` and deliberately omits
`strategy` ([index.ts:48-55](src/auth/index.ts#L48-L55)). **That omission is
load-bearing.** It reads like an oversight; writing the line out "to be
explicit" breaks login at startup.

**Obstacle 2 — credentials sign-ins never create a session row.** Even on the
database default, `@auth/core` routes credentials logins through its JWT
machinery, so the adapter is never asked to create a session. The bridge closes
that gap:

1. `callbacks.jwt` stamps `token.credentials = true` on credentials logins.
2. `jwt.encode` intercepts exactly those tokens, calls `adapter.createSession`
   with a fresh UUID, and returns that UUID **as the cookie value** — so the
   cookie carries a database session token, not a JWT. Everything else falls
   through to the stock encoder.
3. Every later `auth()` resolves the cookie through
   `adapter.getSessionAndUser`; `signOut()` deletes the row.

**Why this is high-risk on upgrade.** Both obstacles are undocumented internal
behaviour of a pre-release library, not a public contract:

| Package | Version at phase 6 |
|---|---|
| `next-auth` | `5.0.0-beta.32` |
| `@auth/core` | `0.41.3` |
| `@auth/drizzle-adapter` | `1.11.3` |
| `next` | `16.3.0` |

`next-auth` v5 is **beta** — semver protects nothing here. Any of these can
change: the assertion may start rejecting the *default* strategy too, the
credentials path may stop calling `jwt.encode`, or `encode` may be handed a
different parameter shape.

**Failure is silent.** If the bridge stops firing, login still succeeds, a
cookie is still set, and every screen still renders — because a valid JWT is a
perfectly good session as far as Auth.js is concerned. What disappears is
everything built on the session row: deactivation stops taking effect,
impersonation has nowhere to store state, and sessions become unrevocable. No
error is logged. Nobody notices until a departed employee is still logged in.

**Regression checklist — run after any upgrade of `next-auth`, `@auth/core`,
`@auth/drizzle-adapter` or `next`:**

1. Log in. A row exists in `sessions` whose `session_token` equals the
   `authjs.session-token` cookie value.
2. That cookie value is a **UUID**, not a dotted `xxxxx.yyyyy.zzzzz` JWE.
3. Deactivate the logged-in user from another session — their next request
   redirects to `/login`.
4. Start impersonation: `sessions.acting_as_user_id` is set and the banner
   shows. Stop it: the column clears.
5. Sign out: the row is gone.

**This checklist is manual.** There is no test harness in the repo as of phase
6, and automating these five steps is the single highest-value test to write.
That is the debt.

**Escape hatch — OPEN, not chosen.** If a future version makes the bridge
impossible, the fallback is a first-party session: own cookie, own `sessions`
reads, keeping Auth.js only for password verification. The authorization module
already funnels every session read through `getSession`, so the blast radius is
`src/auth/index.ts` plus `getSessionToken`.

### 4.2 Cookie names are hardcoded

`getSessionToken` ([index.ts:142-149](src/auth/index.ts#L142-L149)) looks for
`__Secure-authjs.session-token`, then `authjs.session-token`. If Auth.js renames
its cookies or a custom prefix is ever configured, this returns `null` and every
request looks logged out — while `auth()` itself still works, which makes the
symptom confusing. Same upgrade checklist covers it (step 1 fails).

### 4.3 `getSession` costs two to three queries per request

`auth()` resolves the session through the adapter, then `getSession` re-reads
the same row joined to `users` and `roles` because it needs the flags and the
impersonation column; impersonation adds a third read. Correct and cheap enough
at this scale — recorded so it is a known cost rather than a surprise.

---

## 5. Not settled here

- Desk rep — whether the role exists and its flags `[07 F3]`, `[10 §13.2]`. The
  seed has six roles; desk rep is deliberately absent.
- Executive versus super admin boundary `[07 F4]`. §1 above took the narrow
  reading; the boundary itself is still open.
- Password reset / change UI. Passwords are set at creation or by re-running
  the bootstrap script. No self-service flow exists.
