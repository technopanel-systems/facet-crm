"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import { FormField, FormShell } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Link } from "@/i18n/navigation";
import { emptyFormState, type FormState } from "@/lib/validation";

import type { MentionOption } from "../../../_components/comment-composer";

type Action = (state: FormState, formData: FormData) => Promise<FormState>;

/**
 * Correcting a comment `[25 §12]` — editable by the author, never deleted.
 *
 * There is no delete button and there must not be one: `12 §7` is intact, the
 * schema has no `deleted_at`, and the data layer offers no path. The audit log
 * holds the before and the after, so a correction is recoverable in the one
 * place corrections are meant to be read from.
 */
export function CommentForm({
  action,
  body,
  people,
  tagged,
  maxLength,
  cancelHref,
}: {
  action: Action;
  body: string;
  people: MentionOption[];
  tagged: string[];
  maxLength: number;
  cancelHref: string;
}) {
  const t = useTranslations();
  const [state, submit, pending] = useActionState(action, emptyFormState);
  const errors = state.fieldErrors ?? {};
  const held = new Set(tagged);

  return (
    <FormShell
      action={submit}
      error={state.error}
      actions={
        <>
          <Button type="submit" disabled={pending}>
            {pending ? t("common.saving") : t("common.save")}
          </Button>
          <Button asChild type="button" variant="ghost">
            <Link href={cancelHref}>{t("common.cancel")}</Link>
          </Button>
        </>
      }
    >
      <FormField
        name="body"
        label={t("comments.fields.body")}
        error={errors.body}
        required
      >
        <Textarea
          id="body"
          name="body"
          rows={5}
          required
          maxLength={maxLength}
          defaultValue={state.values?.body ?? body}
          className="text-start"
          aria-invalid={!!errors.body || undefined}
        />
      </FormField>

      {people.length > 0 ? (
        <fieldset className="flex flex-col gap-1.5">
          <legend className="text-start text-sm font-medium">
            {t("comments.tag")}
          </legend>
          {/* The set is REWRITTEN by an edit, not added to — the schema settled
              that beside the table, following how `20 §9` rewrites a report's
              signals. Only a person newly ticked is notified; unticking one
              does not un-send a notification that was true when it was sent. */}
          <p className="text-muted-foreground text-start text-xs">
            {t("comments.detail.tagEditHint")}
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {people.map((person) => (
              <div key={person.id} className="flex items-center gap-2">
                <Checkbox
                  id={`mention-${person.id}`}
                  name="mentions"
                  value={person.id}
                  defaultChecked={held.has(person.id)}
                />
                <Label
                  htmlFor={`mention-${person.id}`}
                  className="text-start text-sm font-normal"
                >
                  {person.name}
                </Label>
              </div>
            ))}
          </div>
        </fieldset>
      ) : null}
    </FormShell>
  );
}
