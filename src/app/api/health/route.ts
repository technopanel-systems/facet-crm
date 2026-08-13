import { NextResponse } from "next/server";

import { checkDatabase } from "@/db";

// Must hit the database on every request, never a cached result.
export const dynamic = "force-dynamic";

/**
 * When this server PROCESS started, not when this module was first evaluated.
 *
 * Two readers: whoever wants uptime, and **`verify:routes`, which refuses to
 * run against a server that booted before the build it is meant to be driving**
 * — the whole of a verification round can otherwise be measured against a stale
 * process still holding the port `[23]`.
 *
 * **It was `const BOOTED_AT = new Date()` at module scope, and that was wrong.**
 * The comment claimed it was "stamped once at boot"; a route module is
 * evaluated **lazily, on the first request that reaches it**, so the stamp was
 * really "when somebody first asked for /api/health". A days-old server that had
 * never been probed therefore reported itself as seconds old, and section 0
 * waved it through — which is exactly what happened during feature slice 2:
 * `npm run start` lost the port to a stale process with `EADDRINUSE`, and 389
 * checks passed against the wrong build before the untranslated-key scan caught
 * it. The guard could not catch the thing it exists to catch.
 *
 * `process.uptime()` is the process's real age, so it is correct no matter when
 * this module happens to load.
 */
function bootedAt(): string {
  return new Date(Date.now() - process.uptime() * 1000).toISOString();
}

/**
 * Liveness + database reachability. Used by Docker's healthcheck and by
 * whoever is standing in front of the office PC wondering if it came back up.
 */
export async function GET() {
  const dbUp = await checkDatabase();

  return NextResponse.json(
    {
      ok: dbUp,
      app: "up",
      db: dbUp ? "up" : "down",
      bootedAt: bootedAt(),
      checkedAt: new Date().toISOString(),
    },
    { status: dbUp ? 200 : 503 },
  );
}
