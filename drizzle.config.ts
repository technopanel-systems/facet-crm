import { defineConfig } from "drizzle-kit";

// drizzle-kit does not read .env itself. process.loadEnvFile is built into
// Node 20.12+, so this needs no dependency.
try {
  process.loadEnvFile(".env");
} catch {
  // No .env file — fall back to whatever is already in the environment.
}

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set. Copy .env.example to .env first.");
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: process.env.DATABASE_URL },
  // Migrations are reviewed before they run. Never let drizzle-kit decide.
  strict: true,
  verbose: true,
});
