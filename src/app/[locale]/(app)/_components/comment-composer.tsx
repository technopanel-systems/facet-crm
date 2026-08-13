"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { emptyFormState, type FormState } from "@/lib/validation";

/**
 * The comment box `[25 §9]` — what colleagues say to each other about a record.
 *
 * **It is deliberately plain.** `25 §15` says FACET does not replace verbal talk
 * or office work: the system records outcomes, it does not try to become the
 * conversation. So there is no typing indicator, no read receipt, no reply
 * threading and no emoji bar. A box, the people to tell, and a button.
 *
 * **Tagging is a chip row, not `@` in the text** `[25 §11]`. There is no
 * autocomplete primitive in FACET — `Combobox` is the documented exception for
 * the ~200-item city list `[15 §5]` — and without one a rep typing `@Rawan`
 * must guess the exact stored spelling, in a company where names are recorded
 * in two scripts and more than one person is called Mohammed. A checkbox is
 * native, needs no JavaScript to submit, and the browser places it correctly in
 * RTL. It posts repeated `mentions` values, read with `formData.getAll`, which
 * is `signal-fields.tsx`'s shape.
 *
 * The option type is re-declared here rather than imported: a client component
 * that value-imports a `@/lib` data module bundles the Postgres driver for the
 * browser, and only `npm run build` catches it.
 */
export type MentionOption = { id: string; name: string };

type Action = (state: FormState, formData: FormData) => Promise<FormState>;

export function CommentComposer({
  action,
  people,
  maxLength,
}: {
  action: Action;
  /** Colleagues who may be tagged. Self is filtered out by the caller. */
  people: MentionOption[];
  maxLength: number;
}) {
  const t = useTranslations();
  const [state, submit, pending] = useActionState(action, emptyFormState);
  const errors = state.fieldErrors ?? {};
  const rejected = Boolean(state.error || errors.body);

  // **Uncontrolled, deliberately.** React resets an uncontrolled form once its
  // action resolves, which is exactly what a posted comment wants: an empty box
  // under the comment that just appeared. A REJECTED one must not lose what was
  // typed — the only way to fail here is to write more than the cap, and
  // throwing that away would be worse than the error — so the box is remounted
  // against `state.values`, which `readFields` filled with what arrived.
  const bodyKey = rejected ? "refill" : "fresh";

  return (
    <form
      action={submit}
      data-slot="comment-composer"
      className="border-line flex flex-col gap-2 border-t pt-4"
    >
      <Label htmlFor="body" className="text-start text-sm font-medium">
        {t("comments.new")}
      </Label>
      <Textarea
        key={bodyKey}
        id="body"
        name="body"
        rows={3}
        required
        maxLength={maxLength}
        defaultValue={rejected ? (state.values?.body ?? "") : ""}
        placeholder={t("comments.placeholder")}
        className="text-start"
        aria-invalid={!!errors.body || undefined}
      />

      {people.length > 0 ? (
        <fieldset className="flex flex-col gap-1.5">
          <legend className="text-faint text-start text-[11.5px]">
            {t("comments.tag")}
          </legend>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {people.map((person) => (
              <div key={person.id} className="flex items-center gap-2">
                <Checkbox
                  id={`mention-${person.id}`}
                  name="mentions"
                  value={person.id}
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

      <div>
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? t("common.saving") : t("comments.post")}
        </Button>
      </div>

      {state.error || errors.body ? (
        <p role="alert" className="text-destructive text-start text-xs">
          {t(state.error ?? errors.body)}
        </p>
      ) : null}
    </form>
  );
}
