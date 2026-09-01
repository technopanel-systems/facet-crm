---
paths:
  - "package.json"
  - "package-lock.json"
  - "src/auth/**"
---

# The auth bridge — silent failure on upgrade

**For:** any change to the auth family. **Prevents:** revocation silently
dying while login keeps working. **Safe to remove when:** the session bridge
(the `jwt.encode` override minting database sessions) is replaced by a
mechanism whose failure is loud.

After ANY upgrade of `next-auth`, `@auth/core`, `@auth/drizzle-adapter` or
`next`, **re-run `verify:routes` §30** — it signs in over HTTP, reads the
`sessions` row its cookie names, and re-requests after a deactivation.

The failure is **silent**: if the `jwt.encode` override stops minting a
database session, login still works, screens still render, and sessions
stop being revocable — a sacked employee stays signed in. `verify:phase11`
§6 cannot see it because it inserts the very row it then watches disappear;
§30 is the only check that drives the real bridge.

`next-auth` is pinned at a beta (`5.0.0-beta.32`) deliberately; treat any
bump as the event this rule exists for.
