/**
 * Auth.js configuration — credentials sign-in over database sessions.
 *
 * Auth.js does not create database session rows for the Credentials provider
 * on its own: credentials sign-ins are routed through the JWT machinery even
 * when `session.strategy` is `"database"`. The bridge below is the documented
 * recipe for closing that gap while staying inside Auth.js:
 *
 *  1. `callbacks.jwt` marks tokens that came from a credentials sign-in.
 *  2. `jwt.encode` intercepts exactly those tokens, creates a real session
 *     row via the adapter, and returns the raw session token — so the cookie
 *     carries a database session token, not a JWT.
 *  3. Every later `auth()` call resolves the cookie through
 *     `adapter.getSessionAndUser`, and `signOut()` deletes the row.
 *
 * This block is load-bearing. Removing the `jwt.encode` override silently
 * turns logins into JWTs that no session-invalidation logic can revoke.
 *
 * Sign-in policy: no self-registration anywhere. Users exist only when
 * created by a holder of `can_manage_users` (or the one-off bootstrap
 * script). `authorize` answers every failure identically so the login form
 * cannot be used to probe which emails exist or which accounts are disabled.
 */

import { eq } from "drizzle-orm";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { encode as defaultEncode } from "next-auth/jwt";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { cookies } from "next/headers";

import { db } from "@/db";
import { accounts, sessions, users, verificationTokens } from "@/db/schema";
import { env } from "@/env";
import { verifyPassword } from "@/lib/passwords";

const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

const adapter = DrizzleAdapter(db, {
  usersTable: users,
  accountsTable: accounts,
  sessionsTable: sessions,
  verificationTokensTable: verificationTokens,
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter,
  session: {
    strategy: "database",
    maxAge: SESSION_MAX_AGE_SECONDS,
  },
  // Self-hosted behind the Cloudflare Tunnel — the Host header is trusted
  // because Cloudflare terminates the public edge [03].
  trustHost: true,
  secret: env.AUTH_SECRET,
  // Fallback only. Real unauthenticated redirects are locale-aware and issued
  // by the protected layout through the authorization module.
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: {
        email: {},
        password: {},
      },
      async authorize(credentials) {
        const email =
          typeof credentials?.email === "string"
            ? credentials.email.trim().toLowerCase()
            : "";
        const password =
          typeof credentials?.password === "string" ? credentials.password : "";
        if (!email || !password) return null;

        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.email, email))
          .limit(1);

        // One generic failure for every case — unknown email, deactivated
        // account, no password set, wrong password. No enumeration.
        if (!user || !user.isActive || !user.passwordHash) return null;
        if (!(await verifyPassword(password, user.passwordHash))) return null;

        return { id: user.id, name: user.name, email: user.email };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account }) {
      if (account?.provider === "credentials") {
        token.credentials = true;
      }
      return token;
    },
    async session({ session, user }) {
      session.user.id = user.id;
      return session;
    },
  },
  jwt: {
    async encode(params) {
      if ((params.token as { credentials?: boolean } | null)?.credentials) {
        const userId = params.token?.sub;
        if (!userId) {
          throw new Error("Credentials sign-in produced no user id");
        }
        const sessionToken = crypto.randomUUID();
        await adapter.createSession!({
          sessionToken,
          userId,
          expires: new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000),
        });
        return sessionToken;
      }
      return defaultEncode(params);
    },
  },
});

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
    };
  }
}

/**
 * The raw database session token from the request's cookie.
 *
 * Exported for the authorization module ONLY — it needs the token to read and
 * mutate the session row (impersonation state, invalidation). No other code
 * may touch sessions; permission questions go through `src/lib/authz`.
 */
export async function getSessionToken(): Promise<string | null> {
  const store = await cookies();
  return (
    store.get("__Secure-authjs.session-token")?.value ??
    store.get("authjs.session-token")?.value ??
    null
  );
}
