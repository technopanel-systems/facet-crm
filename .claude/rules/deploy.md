---
paths:
  - "docker-compose.yml"
  - "Dockerfile"
  - ".env.example"
---

# Deployment surface rules

**For:** the files that decide what the office PC exposes. **Prevents:** the
LAN bypass and the silent insecure cookie. **Safe to remove when:** the
deployment stops being a tunnel in front of a single PC.

- **Every published port is loopback-bound** — `"127.0.0.1:PORT:PORT"`,
  hook-enforced (H9). A bare `"PORT:PORT"` binds `0.0.0.0` and answers on
  the office Wi-Fi, and Cloudflare Access protects the tunnel, NOT the
  port — measured, not supposed (S44-2).

- **`PUBLIC_URL` decides whether the session cookie is `Secure`, and
  forgetting it is silent** (S44-3): with `AUTH_URL` resolving http the
  login works, screens render, and the token crosses the tunnel without the
  flag. `.env.example` carries the line; the README's pre-pilot checklist
  carries the check.

- **A database dump is exactly as sensitive as the database** — every row
  and every password hash. `BACKUP_DIR` needs the database's access control;
  no script prints `POSTGRES_PASSWORD` or takes it on a command line.
  `pg_dump` runs inside the `db` container so the client always matches the
  server.

- The tunnel ingress must name `http://localhost:3000` — the loopback
  binding breaks an ingress that names the machine's IP (the one way that
  hardening can break the office PC; README checklist).
