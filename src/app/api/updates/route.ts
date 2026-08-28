import { NextResponse, type NextRequest } from "next/server";

import { getSession, type AuthSession } from "@/lib/authz";
import { measuredPeople } from "@/lib/daily-activity";
import { asDispatchStatus, countDispatchesSince } from "@/lib/dispatches";
import { countProjectsSince } from "@/lib/projects";
import { countQuotationThreadsSince } from "@/lib/quotations";
import { countStreamSince, parseStreamFilters } from "@/lib/timeline";

// Never a cached count, and never a cached count in the tunnel either — see
// the `Cache-Control` on every answer below.
export const dynamic = "force-dynamic";

/**
 * **The** count route `D72` — one route, not one per screen.
 *
 * *"The screen's scope and the moment it was rendered go out; a count comes
 * back, resolved in SQL by the same query the screen ran. No second definition
 * of new."* That is this file, and the way it keeps the promise is that it
 * writes **no predicate of its own**: every handler below calls a
 * `count…Since` that shares its `where` builder with the list function its
 * screen already ran, so the two cannot answer about different rows.
 *
 * **What *new* means, once.** A row the screen's own query returns whose
 * movement stamp is after `since`, where the stamp is what the list already
 * orders by — `lastMovedAt` on a dispatch, the thread or its live version on a
 * quotation, `projectMovement().movedAt` on a project, `event.at` in the
 * stream.
 *
 * **It lives outside `(app)` on purpose.** No layout wraps it, so it pays no
 * rail, no `shellCounts()` and no bell: the whole point of polling instead of
 * reloading is that this costs one aggregate rather than a page. `/api` is
 * already excluded from `proxy.ts`'s matcher, so it carries no locale prefix
 * and answers no HTML.
 *
 * **`getSession()`, never `requireSession()`.** That one redirects, and a
 * `fetch` following a 307 to `/login` would hand the script an HTML body to
 * parse as JSON — a silent failure on the very path that exists to be quiet.
 * A 401 is the honest answer and the script treats it as "no line".
 *
 * Every handler re-derives visibility through the data layer's own filters, so
 * this is scoped exactly as its screen is and adds no authorization surface
 * `S109`.
 */

/** What each screen names itself. One per data module, never one per screen. */
const SCOPES = ["quotations", "dispatches", "projects", "stream"] as const;
type Scope = (typeof SCOPES)[number];

function isScope(value: string | null): value is Scope {
  return (SCOPES as readonly string[]).includes(value ?? "");
}

/** `"1"` and nothing else, matching how the screens write their own flags. */
function flag(params: URLSearchParams, name: string): boolean | undefined {
  return params.get(name) === "1" ? true : undefined;
}

function text(params: URLSearchParams, name: string): string | undefined {
  return params.get(name) ?? undefined;
}

async function countFor(
  scope: Scope,
  session: AuthSession,
  params: URLSearchParams,
  since: Date,
): Promise<number> {
  switch (scope) {
    case "quotations":
      return countQuotationThreadsSince(
        session,
        {
          q: text(params, "q"),
          projectId: text(params, "projectId"),
          companyId: text(params, "companyId"),
          awaitingIssue: flag(params, "awaitingIssue"),
        },
        since,
      );
    case "dispatches":
      return countDispatchesSince(
        session,
        {
          q: text(params, "q"),
          userId: text(params, "userId"),
          companyId: text(params, "companyId"),
          threadId: text(params, "threadId"),
          direct: flag(params, "direct"),
          // `asDispatchStatus` is the module's own guard, so an invented
          // `?status=` narrows to nothing here exactly as it does on the list.
          status: asDispatchStatus(text(params, "status")),
          from: text(params, "from"),
          to: text(params, "to"),
        },
        since,
      );
    case "projects":
      return countProjectsSince(
        session,
        {
          q: text(params, "q"),
          companyId: text(params, "companyId"),
          onBoard: flag(params, "onBoard"),
        },
        since,
      );
    case "stream": {
      const { filters, who } = parseStreamFilters({
        q: text(params, "q"),
        kind: text(params, "kind"),
        outcome: text(params, "outcome"),
        signal: text(params, "signal"),
        from: text(params, "from"),
        to: text(params, "to"),
      });
      // **The roster check the screen makes, made here too.** `/activity`
      // drops a `?who=` naming nobody it may measure, so an unknown id reads
      // as no filter rather than as an empty stream; asking for the single row
      // costs one indexed read and only when somebody is filtering by person.
      const named =
        who && (await measuredPeople(session, who)).length === 1
          ? [who]
          : undefined;
      return countStreamSince(session, { ...filters, who: named }, since);
    }
  }
}

/** No body, and never cached — by the browser or by the tunnel. */
function fail(status: number): NextResponse {
  return new NextResponse(null, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const params = request.nextUrl.searchParams;

  const scope = params.get("scope");
  if (!isScope(scope)) return fail(400);

  const raw = params.get("since");
  const since = raw ? new Date(raw) : null;
  if (!since || Number.isNaN(since.getTime())) return fail(400);

  const session = await getSession();
  if (!session) return fail(401);

  const count = await countFor(scope, session, params, since);

  return NextResponse.json({ count }, { headers: { "Cache-Control": "no-store" } });
}
