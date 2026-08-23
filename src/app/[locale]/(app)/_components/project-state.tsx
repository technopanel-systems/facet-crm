import { getTranslations } from "next-intl/server";

import { Badge } from "@/components/ui/badge";
import { projectState, type ProjectState } from "@/lib/projects";

/**
 * What a project's state is, said once, in the three places that say it.
 *
 * The list, the detail screen and the company page's projects card each used
 * to read `end_state` and decide for themselves. Since `S31` there is more
 * than one field behind the answer — a derived `won`, a stored `end_state` and
 * a stored `committed` — and three screens ranking them separately is how they
 * come to disagree. `projectState` in `src/lib/projects.ts` owns the
 * precedence; this owns how it looks.
 *
 * **`D2`: a status pill may sit beside the line that says whose move it is,
 * and is never that line itself.** This is the pill. The project's turn is the
 * turn panel's `[projects/[id]/page.tsx]`, and it stays the owner's while a
 * project is merely committed — committed is a state, not a move.
 *
 * **`D6`: colour describes how long something has waited, never how good the
 * outcome is.** So `won` gets no green pill, for exactly the reason `accepted`
 * does not: a green pill is the first place "a real event, not a good feeling"
 * gets lost. `lost` keeps the `destructive` variant it already had; whether a
 * status→colour map belongs here at all is a `D6` question this rule did not
 * open.
 */
export async function ProjectStateBadge({
  row,
}: {
  row: { won: boolean; endState: "lost" | null; committed: boolean };
}) {
  const t = await getTranslations();
  const state = projectState(row);

  if (state === "open") {
    return (
      <span className="text-muted-foreground">{t("projects.state.open")}</span>
    );
  }

  return (
    <Badge variant={state === "lost" ? "destructive" : "secondary"}>
      {t(`projects.state.${state}`)}
    </Badge>
  );
}

/**
 * The same answer as a message key, for a caller that already has `t`.
 *
 * Sync and pure, so it works inside a `.map()` — the company page's projects
 * card renders one per row and an async label there would need a second pass
 * over the list to await them all.
 */
export function projectStateKey(row: {
  won: boolean;
  endState: "lost" | null;
  committed: boolean;
}): `projects.state.${ProjectState}` {
  return `projects.state.${projectState(row)}`;
}

