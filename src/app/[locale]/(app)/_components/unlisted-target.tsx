"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { emptyFormState, type FormState } from "@/lib/validation";

import { Disclosure, rejected } from "./disclosure";

type Action = (state: FormState, formData: FormData) => Promise<FormState>;

/**
 * The set-target control for **someone not listed** on the Team tab — `D39`'s
 * row set needs a company or a target to show a row, so the person is chosen
 * here instead of bound at a row (session 53, `D49`).
 *
 * `TargetRow`'s shape with a native `<select>` in front of it `D20`: no client
 * state, no hidden-input bridge, the fields in the markup whether the
 * disclosure is open or shut, and a rejected POST reopens it. The people are
 * a prop — a client component may not import a data module (`CLAUDE.md`).
 * `data-act` is `verify:routes`' handle and must be unique on the page.
 */
export function UnlistedTargetForm({
  action,
  period,
  people,
}: {
  action: Action;
  period: string;
  people: { id: string; name: string }[];
}) {
  const t = useTranslations();
  const [state, formAction, pending] = useActionState(action, emptyFormState);
  const error =
    state.error ?? state.fieldErrors?.sqm ?? state.fieldErrors?.userId;

  return (
    <Disclosure
      label={t("today.team.notListed")}
      open={rejected(state)}
      act="target-unlisted"
    >
      <form
        action={formAction}
        data-act="set-target-unlisted"
        className="flex flex-wrap items-center gap-2"
      >
        <input type="hidden" name="period" value={period} />
        <select
          name="userId"
          required
          defaultValue=""
          aria-label={t("today.team.notListedPerson")}
          className="border-line bg-surface-2 h-8 min-h-11 rounded-md border px-2 text-base md:min-h-0 md:text-sm"
        >
          <option value="" disabled>
            {t("today.team.notListedChoose")}
          </option>
          {people.map((person) => (
            <option key={person.id} value={person.id}>
              {person.name}
            </option>
          ))}
        </select>
        <Input
          name="sqm"
          type="number"
          inputMode="decimal"
          min="0"
          step="0.0001"
          dir="ltr"
          className="h-8 w-32 text-start"
          aria-label={t("targets.fields.targetSqm")}
          aria-invalid={!!error || undefined}
        />
        <Button type="submit" size="xs" variant="outline" disabled={pending}>
          {pending ? t("common.saving") : t("targets.actions.setTarget")}
        </Button>
        {error ? (
          <span role="alert" className="text-destructive text-start text-xs">
            {t(error)}
          </span>
        ) : null}
      </form>
    </Disclosure>
  );
}
