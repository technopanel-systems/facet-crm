# 03 — Stack Decisions

**Status:** Settled during planning. Do not re-litigate. If a decision looks
wrong, state the objection once in one paragraph and continue.

Each entry records the choice, the reason, and what it rules out.

---

## Hard constraints these decisions had to satisfy

1. **No new monthly subscriptions.** The company will not approve recurring
   cost. One-time hardware spend is also currently unavailable.
2. **Reps need access from outside the office** — site visits, phones, home.
3. **The builder is a semi-beginner developer** working with AI assistance.
   Simplicity beats sophistication; fewer moving parts beats more.
4. Roughly 14 users today, growing as departments come on.

---

## Infrastructure

### Application and database host: **company Windows PC (8 GB RAM)**

Runs PostgreSQL and the Next.js app in Docker, plus the Cloudflare Tunnel.

**Rejected — Synology DS925+ NAS:** only 4 GB RAM, of which DSM takes half, and
Active Backup for Business spikes hard during runs. The volume is also ~95%
full. Revisit if RAM is ever funded — moving there is a compose file and a
database restore, not a rewrite.

**Rejected — shared cPanel host:** 1 GB shared RAM, no root, MySQL only, no
PostgreSQL. Cannot run the app or the database.

### Public access: **Cloudflare Tunnel** → `crm.technopanel.com.sa`

Free. No ports opened on the router, no static IP needed.

- The **app** is publicly reachable through the tunnel.
- **Postgres, Docker and Windows admin are never exposed** — reachable only on
  the LAN or via VPN through the ER7206 router.
- Postgres binds to localhost; only the app container connects to it.

### Backups: **Synology NAS**

Two layers, both free with hardware already owned:

1. Nightly `pg_dump` written to a NAS shared folder
2. Active Backup for Business agent on the Windows PC — full machine recovery

**RAID is not a backup.** The mirrored drives protect against a dead disk, not
against a bad migration, ransomware, or the office flooding.

### cPanel host: **WordPress and backup target only**

Already paid for. Keeps serving the marketing site. May receive an off-site copy
of nightly dumps. Not a server role.

### Windows PC hardening (required before real users)

- BIOS: auto power-on after AC loss
- Windows Update: disable automatic restart
- Docker: `restart: always`, Docker Desktop starts on boot
- `.wslconfig` memory cap so WSL does not consume the whole machine
- On the UPS
- **Verify once:** pull the plug, confirm the system returns unattended

---

## Application stack

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js + TypeScript | TypeScript lets the AI catch its own mistakes |
| Database | PostgreSQL in Docker | One container, no vendor cliff |
| DB access | Drizzle | SQL-like, readable, portable |
| Auth | Auth.js | Admin-created users only |
| Authorization | **App code, one layer** | Not database RLS — see below |
| UI | Tailwind + shadcn/ui | Components copied into the repo and owned |
| Source control | GitHub | Private repos are genuinely free |
| DNS | Cloudflare | Already in use |

### Why not Supabase

1. **RLS was a primary cause of v1's mess.** `docs/00-legacy-findings.md`
   Section 3 documents RLS policies contradicting both the UI and the docs —
   three sources of truth for who may do what. One authorization file that can
   be read and tested is more manageable at this skill level.
2. **Supabase's value is the managed layer.** Self-hosting it means ten
   containers on 8 GB of RAM and losing the entire benefit.
3. **The free tier has a cliff.** Exceeding it forces payment or a panicked
   migration. Plain Postgres has no cliff.

**Accepted cost:** no Supabase dashboard for browsing tables (use any free
Postgres client), and auth must be wired manually.

### Why not Vercel

The free Hobby plan is licensed for **non-commercial use**. An internal company
CRM is commercial. Self-hosting removes the issue entirely.

---

## Data and storage

- **No file storage module in v1.** Attachments are expected to be minimal.
  Occasional files go on the PC disk with the path stored in the database, and
  are covered by the same backup.
- **But include an `attachments` table from the start** (record type, record id,
  path, uploaded by, date) even if nothing writes to it. Adding a table later is
  easy; retrofitting attachments across eight modules is not.
- **Nothing to migrate.** The Supabase data from v1 was randomly generated seed
  data. The system was never used in production. The v2 schema can be designed
  cleanly with no legacy accommodation.

---

## Scale reality check

At the high end — ~500 companies/month, ~10 quotations/day, plus activities and
notifications — expect roughly 150,000 rows and about 150 MB per year across all
modules. This is a small database. Do not over-engineer for scale. Design for
clarity and correctness instead.
