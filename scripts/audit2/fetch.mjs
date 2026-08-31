/**
 * AUDIT 2 — fetch one page over HTTP as a fixture identity, print the HTML.
 *
 *   node scripts/audit2/fetch.mjs rep-a /en/companies
 *   node scripts/audit2/fetch.mjs manager /en --text     (tags stripped)
 *
 * Signs in the way `verify:routes` does — `/api/auth/csrf`, then the
 * credentials callback — and keeps one cookie jar per identity in a
 * module-scope map for the life of the process (each invocation signs in
 * afresh; the audit's read volume is small). Phase 3 of the audit uses this
 * as the RENDERED side of every figure cross-check; the records side comes
 * from raw SQL via `docker exec`, a different driver and a different query
 * author, so the two origins are independent and a disagreement names which
 * side moved.
 */

process.loadEnvFile(".env");

const BASE = process.env.AUDIT_BASE_URL ?? "http://127.0.0.1:3100";
const PASSWORD = process.env.DEV_FIXTURE_PASSWORD;

const [identity, path, flag] = process.argv.slice(2);
if (!identity || !path) {
  console.error("usage: node scripts/audit2/fetch.mjs <identity|anon> <path> [--text]");
  process.exit(1);
}

const jar = new Map();
function store(response) {
  for (const raw of response.headers.getSetCookie()) {
    const [pair] = raw.split(";");
    const eq = pair.indexOf("=");
    jar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
  }
}
const header = () => [...jar].map(([k, v]) => `${k}=${v}`).join("; ");

async function signIn(email) {
  const csrfResponse = await fetch(`${BASE}/api/auth/csrf`);
  store(csrfResponse);
  const { csrfToken } = await csrfResponse.json();
  const posted = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    redirect: "manual",
    headers: {
      cookie: header(),
      "content-type": "application/x-www-form-urlencoded",
      origin: BASE,
    },
    body: new URLSearchParams({ csrfToken, email, password: PASSWORD }),
  });
  store(posted);
  if (![302, 303].includes(posted.status)) {
    console.error(`sign-in as ${email}: unexpected ${posted.status}`);
    process.exit(1);
  }
}

if (identity !== "anon") {
  await signIn(`${identity}@example.test`);
}

const page = await fetch(`${BASE}${path}`, {
  headers: { cookie: header() },
  redirect: "follow",
});
const body = await page.text();
console.error(`# ${page.status} ${page.url}`);
if (flag === "--text") {
  console.log(
    body
      .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, "\n")
      .replace(/[ \t]+/g, " ")
      .replace(/\n\s*\n+/g, "\n")
      .trim(),
  );
} else {
  console.log(body);
}
