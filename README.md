# FACET

Internal operations platform for **Technopanel**. Sales CRM first, then
production, warehouse and marketing.

It does **not** cover finance, invoicing or tax — those stay in SMAC, the
existing ERP.

Project rules are in [CLAUDE.md](CLAUDE.md); the decisions behind them are in
[docs/](docs/). `docs/03-stack.md` is the settled technical record.

---

## Stack

Next.js 16 (App Router) · TypeScript · PostgreSQL 17 · Drizzle · Tailwind v4 ·
shadcn/ui · next-intl (en/ar with RTL) · Docker

---

## First run

Requires Docker Desktop, and Node 24 if you want to develop outside the
container.

```bash
cp .env.example .env      # then edit POSTGRES_PASSWORD
docker compose up --build -d
```

Open <http://localhost:3000>. It redirects to `/en` and shows application and
database status. `/ar` shows the same page mirrored right-to-left.

Check it from the command line:

```bash
curl http://localhost:3000/api/health
# {"ok":true,"app":"up","db":"up","checkedAt":"..."}
```

Returns **503** with `"db":"down"` when PostgreSQL is unreachable.

> The Docker build downloads fonts from Google Fonts, so the **build** needs
> internet access. The running container does not.

---

## Two ways to run

| | Command | Use for |
|---|---|---|
| **Container** | `docker compose up --build -d` | What actually runs on the office PC. Verify here before deploying. |
| **Host** | `docker compose up -d db` then `npm install && npm run dev` | Day-to-day work. Hot reload, same database. |

Both talk to the same PostgreSQL. `DATABASE_URL` in `.env` points at
`localhost` for host-side work; `docker-compose.yml` overrides it to the `db`
service for the container. You never need to edit it when switching.

Other commands:

```bash
npm run lint         # ESLint
npm run typecheck    # tsc --noEmit
npm run build        # production build
```

> **Next.js 16 differs from Next 13–15 in ways that catch out both people and
> AI assistants** — `params` is a Promise, `middleware.ts` is now `proxy.ts`.
> Version-correct docs ship with the package at `node_modules/next/dist/docs/`.
> Read those rather than trusting memory or an older tutorial.
>
> `next dev` wants to append a note about this to `CLAUDE.md` on every start.
> That is disabled with `agentRules: false` in `next.config.ts`, because
> `CLAUDE.md` is a hand-written rules file, not a generated one.

---

## Database

No tables yet — schema is phase 5 (`docs/05-roadmap.md`). `src/db/schema.ts` is
deliberately empty.

```bash
npm run db:generate   # write a migration from schema.ts changes
npm run db:migrate    # apply pending migrations
npm run db:studio     # browse data
npm run db:push       # push schema without a migration — local scratch only
```

Migrations under `drizzle/` **are committed**. They are the record of how
production reached its current shape. Never use `db:push` against the office
PC's database.

---

## Bilingual and RTL

Every user-facing string goes through the translation layer from the first
screen (`docs/07-phase4-answers.md` E3). Retrofitting this means touching every
file, so there is no "add it later".

- Strings live in [messages/en.json](messages/en.json) and
  [messages/ar.json](messages/ar.json). Both files must carry the same key tree.
- Never hardcode a user-facing string in a component. Use `useTranslations` in
  client components, `getTranslations` in server components.
- Import `Link`, `redirect`, `usePathname` and `useRouter` from
  [src/i18n/navigation.ts](src/i18n/navigation.ts) — **not** from `next/link` or
  `next/navigation`. The raw versions drop the locale prefix.
- Adding a locale means editing [src/i18n/routing.ts](src/i18n/routing.ts) and
  adding a messages file. Nothing else.

**Layout rule — use logical Tailwind utilities, never physical ones:**

| Use | Not |
|---|---|
| `ms-*` `me-*` | `ml-*` `mr-*` |
| `ps-*` `pe-*` | `pl-*` `pr-*` |
| `text-start` `text-end` | `text-left` `text-right` |
| `start-*` `end-*` | `left-*` `right-*` |
| `border-s` `border-e` | `border-l` `border-r` |

Logical utilities flip automatically from `<html dir>`, so Arabic needs no
`rtl:` variants. A physical utility is a layout bug in Arabic — check `/ar`
before considering a screen done.

Radix components get direction from `DirectionProvider` in the locale layout,
which handles keyboard and popover behaviour that CSS alone does not.

---

## Deployment notes

Runs on a company Windows PC behind a Cloudflare Tunnel. Per `docs/03-stack.md`:

- **PostgreSQL is bound to `127.0.0.1`** in `docker-compose.yml`. Only the app
  container and local tools reach it. Never publish it as `5432:5432`.
- Only the app is public, through the tunnel. `cloudflared` is configured on
  the Windows host, not in this compose file.
- Both services are `restart: always`, so `docker compose up -d` once is enough.

Before real users, on the host machine:

- [ ] BIOS: power on automatically after AC loss
- [ ] Windows Update: no automatic restart
- [ ] Docker Desktop: start on boot
- [ ] `.wslconfig` memory cap so WSL cannot take the whole 8 GB
- [ ] Machine on the UPS
- [ ] Nightly `pg_dump` to the Synology NAS, plus Active Backup for Business
- [ ] **Pull the plug and confirm it comes back unattended**

RAID is not a backup.

---

## Known advisory

`npm audit` reports a moderate esbuild advisory reached through `drizzle-kit`.
It affects esbuild's development server only, `drizzle-kit` is a
devDependency, and it is not present in the production image. `npm audit fix
--force` would downgrade drizzle-kit to 0.18.1, which is a breaking change.
Left as is deliberately; revisit when drizzle-kit updates its dependency.
