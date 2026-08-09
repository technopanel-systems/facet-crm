/**
 * Environment access, in one place.
 *
 * Deliberately hand-rolled — the skeleton needs exactly one variable, and a
 * schema library would be a dependency earning nothing yet. Grow this into a
 * validated schema when auth and integrations arrive (phase 6+).
 */

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable ${name}. ` +
        `Copy .env.example to .env and fill it in.`,
    );
  }
  return value;
}

export const env = {
  get DATABASE_URL(): string {
    return required("DATABASE_URL");
  },
  get AUTH_SECRET(): string {
    return required("AUTH_SECRET");
  },
  NODE_ENV: process.env.NODE_ENV ?? "development",
};
