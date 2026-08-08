import { NextResponse } from "next/server";

import { checkDatabase } from "@/db";

// Must hit the database on every request, never a cached result.
export const dynamic = "force-dynamic";

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
      checkedAt: new Date().toISOString(),
    },
    { status: dbUp ? 200 : 503 },
  );
}
