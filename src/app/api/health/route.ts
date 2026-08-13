import { NextResponse } from "next/server";

import { checkDatabase } from "@/db";

// Must hit the database on every request, never a cached result.
export const dynamic = "force-dynamic";

/**
 * When this server process loaded, not when it was asked.
 *
 * Module scope, so it is stamped once at boot and never again. Two readers:
 * whoever wants uptime, and **`verify:routes`, which refuses to run against a
 * server that booted before the build it is meant to be driving** — the whole
 * of a verification round can otherwise be measured against a stale process
 * still holding the port `[23]`.
 */
const BOOTED_AT = new Date().toISOString();

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
      bootedAt: BOOTED_AT,
      checkedAt: new Date().toISOString(),
    },
    { status: dbUp ? 200 : 503 },
  );
}
