import { drizzle } from "drizzle-orm/postgres-js";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { env } from "@/env";
import * as schema from "./schema";

// The connection is created on first use, never at import time.
//
// `next build` imports every route module to collect page data, and there is no
// DATABASE_URL during a Docker build. Connecting at module scope would fail the
// build. Creating it lazily also means a page that never touches the database
// never opens a connection.
//
// Next.js hot-reloads modules in development, which would otherwise open a new
// pool on every edit, so the client is cached on globalThis.
const globalForDb = globalThis as unknown as {
  __facetSql?: ReturnType<typeof postgres>;
};

function getSql() {
  if (!globalForDb.__facetSql) {
    globalForDb.__facetSql = postgres(env.DATABASE_URL, {
      max: 10,
      // A dead database surfaces through the health check instead of hanging
      // the request until the platform times it out.
      connect_timeout: 10,
    });
  }
  return globalForDb.__facetSql;
}

/**
 * Drizzle client. A proxy so that importing it is free — the connection is
 * opened by the first actual query, not by the import.
 */
export const db = new Proxy({} as PostgresJsDatabase<typeof schema>, {
  get(_target, prop, receiver) {
    const instance = drizzle(getSql(), { schema });
    return Reflect.get(instance, prop, receiver);
  },
});

/** True when the database answers a trivial query. Used by /api/health. */
export async function checkDatabase(): Promise<boolean> {
  try {
    await getSql()`select 1`;
    return true;
  } catch {
    return false;
  }
}

/**
 * Ends the pool. For standalone scripts (seed, bootstrap) — postgres-js keeps
 * the process alive otherwise. The app itself never calls this.
 */
export async function closeDatabase(): Promise<void> {
  await globalForDb.__facetSql?.end();
  globalForDb.__facetSql = undefined;
}
