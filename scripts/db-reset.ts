/**
 * Throw the local database away and rebuild it from scratch.
 * `npm run db:reset`.
 *
 * The chain is: `docker compose down -v` · `docker compose up -d` · wait for
 * the `db` healthcheck · `db:migrate` · `db:seed` · `bootstrap:admin`.
 *
 * **Why this exists.** Nothing in FACET deletes `[12 §7]`, and the verify
 * scripts are held to the same rule — `verify:slice2`, `verify:slice3`,
 * `verify:phase9`, `verify:phase11` and `verify:phase10a` all leave their rows
 * behind on purpose. That is deliberate, and it is also why three of them
 * create their own reps per run: achievement, coverage and the daily view are
 * whole-database totals, so re-using the shared fixture accounts made one run
 * count the previous run's square metres. Dropping the volume is therefore the
 * only way to get a clean database, and it was being retyped from memory as
 * six commands.
 *
 * **It refuses to run unless NODE_ENV is exactly "development"** — the same
 * guard, and the same reasoning, as `scripts/dev-fixtures.ts` `[15 §7]`:
 * `.dockerignore` excludes `.env*` so a developer's NODE_ENV never reaches the
 * image, and `docker-compose.yml` sets NODE_ENV=production on the app
 * container as a real environment variable, which `process.loadEnvFile` cannot
 * override. Refusing only when NODE_ENV=production is set is the weaker half
 * of the rule: it passes in every shell that has not been told otherwise.
 *
 * **And it confirms.** That guard is enough for `dev:fixtures`, whose worst
 * case is a few test accounts on the wrong machine. It is not enough here:
 * `down -v` destroys `facet-db-data` irreversibly, and the office PC's `.env`
 * is copied from the same `.env.example` — so NODE_ENV alone cannot tell the
 * two machines apart. On a terminal it asks for the database name to be typed
 * back; with no terminal it requires `--yes`, so a scripted run has to say so.
 *
 * Everything it needs is checked *before* anything is destroyed. Discovering
 * that BOOTSTRAP_ADMIN_PASSWORD is missing after the volume is gone leaves no
 * way in, and those lines are commented out in `.env.example` precisely
 * because `bootstrap:admin` tells you to remove them once it has run.
 *
 * `docker compose up -d` starts the app container too, as written. On a
 * checkout that has never built it, that is a full image build — and the build
 * downloads fonts, so it needs the internet. Use `docker compose up -d db`
 * beforehand if you only ever run the app on the host.
 */

process.loadEnvFile(".env");

import { spawnSync } from "node:child_process";
import { createInterface } from "node:readline/promises";

/** `start_period` is 30s and the healthcheck retries five times at 10s. */
const HEALTH_TIMEOUT_MS = 180_000;
const HEALTH_POLL_MS = 2_000;

/**
 * Checked before the volume is dropped, not after. Each is consumed by a later
 * step of the chain, and each failure is unrecoverable once the data is gone.
 */
const REQUIRED_ENV = [
  // docker compose interpolates these into the db service.
  "POSTGRES_USER",
  "POSTGRES_PASSWORD",
  "POSTGRES_DB",
  // drizzle-kit migrate, and every db:* script.
  "DATABASE_URL",
  // bootstrap:admin — the last step, and the one that leaves a way in.
  "BOOTSTRAP_ADMIN_NAME",
  "BOOTSTRAP_ADMIN_EMAIL",
  "BOOTSTRAP_ADMIN_PASSWORD",
] as const;

/**
 * Each step is one shell command string rather than a command plus an args
 * array: `shell: true` is needed because npm is `npm.cmd` on Windows and this
 * is a Windows host (`docs/03-stack.md`), and Node 24 deprecates passing both
 * (DEP0190) — which would print a warning above every step of the chain.
 * Nothing here interpolates user input.
 */
function run(command: string): void {
  console.log(`\n→ ${command}`);
  const result = spawnSync(command, { stdio: "inherit", shell: true });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`${command} failed (exit ${result.status ?? "signal"}).`);
  }
}

function capture(command: string): string {
  const result = spawnSync(command, { encoding: "utf8", shell: true });
  return result.status === 0 ? result.stdout.trim() : "";
}

/**
 * Poll the container's own healthcheck rather than guessing at a sleep.
 * `pg_isready` inside the container is the only thing that knows when the
 * initdb pass a fresh volume triggers has finished.
 */
async function waitForDatabase(): Promise<void> {
  console.log("\n→ Waiting for the db healthcheck");
  const deadline = Date.now() + HEALTH_TIMEOUT_MS;
  let lastStatus = "";

  while (Date.now() < deadline) {
    const containerId = capture("docker compose ps -q db");
    if (containerId) {
      const status = capture(
        `docker inspect -f "{{.State.Health.Status}}" ${containerId}`,
      );
      if (status === "healthy") {
        console.log("  healthy");
        return;
      }
      if (status && status !== lastStatus) {
        console.log(`  ${status}…`);
        lastStatus = status;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, HEALTH_POLL_MS));
  }

  throw new Error(
    `The db container did not become healthy within ${HEALTH_TIMEOUT_MS / 1000}s ` +
      `(last status: ${lastStatus || "unknown"}). Check \`docker compose logs db\`.`,
  );
}

/**
 * `--yes` skips the prompt, and is *required* when there is no terminal — a
 * script that pipes this command has to state its intent rather than inherit
 * it from a missing stdin.
 */
async function confirm(databaseName: string): Promise<boolean> {
  if (process.argv.includes("--yes")) {
    return true;
  }
  if (!process.stdin.isTTY) {
    console.error(
      "db:reset destroys the facet-db-data volume and needs confirmation.\n" +
        "  There is no terminal to ask on — pass --yes to confirm:\n" +
        "    npm run db:reset -- --yes",
    );
    return false;
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await rl.question(
      `This DESTROYS the local database volume. Every row goes, including\n` +
        `anything the verify scripts left behind, and it cannot be undone.\n` +
        `Type the database name (${databaseName}) to continue: `,
    );
    return answer.trim() === databaseName;
  } finally {
    rl.close();
  }
}

async function main(): Promise<void> {
  // This script deletes a database volume. It must never be runnable anywhere
  // but a developer's machine `[15 §7]`.
  if (process.env.NODE_ENV !== "development") {
    console.error(
      "db:reset refuses to run outside development.\n" +
        `  NODE_ENV is ${process.env.NODE_ENV ?? "unset"}, and must be "development".\n` +
        "  Add NODE_ENV=development to .env (it is excluded from the Docker image).",
    );
    process.exit(1);
  }

  const missing = REQUIRED_ENV.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    console.error(
      `Missing ${missing.join(", ")} in .env.\n` +
        "  Checked before anything is destroyed, because the chain ends in\n" +
        "  bootstrap:admin — a reset that cannot create the first super admin\n" +
        "  leaves a database with no way in. The BOOTSTRAP_ADMIN_* lines are\n" +
        "  commented out in .env.example (bootstrap:admin asks you to remove\n" +
        "  them once it has run); put them back for the reset.",
    );
    process.exit(1);
  }

  if (!(await confirm(process.env.POSTGRES_DB as string))) {
    console.error("Cancelled — nothing was touched.");
    process.exit(1);
  }

  run("docker compose down -v");
  run("docker compose up -d");
  await waitForDatabase();
  run("npm run db:migrate");
  run("npm run db:seed");
  run("npm run bootstrap:admin");
}

main()
  .then(() => {
    console.log(
      "\nReset complete. `npm run dev:fixtures` next if you need the test\n" +
        "accounts the verify scripts drive.",
    );
  })
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
