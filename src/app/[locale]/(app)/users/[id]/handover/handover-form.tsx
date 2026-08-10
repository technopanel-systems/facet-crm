"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import { SelectField } from "@/components/form-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { emptyFormState, type FormState } from "@/lib/validation";

/**
 * The handover screen's one form.
 *
 * **Bulk and one-at-a-time are the same control** `[07 B7]` — tick many rows or
 * tick one. There is no "select all": it would need JavaScript, and this form
 * submits without any. Nested per-row forms are not possible in HTML anyway.
 *
 * Every prop type is re-declared here rather than imported from `@/lib/team`:
 * a client component that imports a data module ships the Postgres driver to
 * the browser, and only `npm run build` catches it.
 */

type Bucket = {
  /** The form field each checked row posts under. */
  name: "membershipIds" | "projectIds" | "threadIds" | "taskIds";
  title: string;
  empty: string;
  rows: { id: string; label: string; note?: string; badge?: string }[];
};

type Colleague = { id: string; name: string };

export function HandoverForm({
  action,
  buckets,
  colleagues,
  isEmpty,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  buckets: Bucket[];
  colleagues: Colleague[];
  isEmpty: boolean;
}) {
  const t = useTranslations();
  const [state, formAction, pending] = useActionState(action, emptyFormState);
  const errors = state.fieldErrors ?? {};

  if (isEmpty) {
    return (
      <p className="text-muted-foreground rounded-lg border border-dashed p-8 text-center text-sm">
        {t("team.handover.nothing")}
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-6">
      {state.error ? (
        <p role="alert" className="text-destructive text-start text-sm">
          {t(state.error)}
        </p>
      ) : null}

      {buckets.map((bucket) => (
        <Card key={bucket.name}>
          <CardHeader>
            <CardTitle>{bucket.title}</CardTitle>
          </CardHeader>
          <CardContent>
            {bucket.rows.length === 0 ? (
              <p className="text-muted-foreground text-start text-sm">
                {bucket.empty}
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {bucket.rows.map((row) => (
                  <li key={row.id} className="flex items-center gap-2">
                    <Checkbox
                      id={`${bucket.name}-${row.id}`}
                      name={bucket.name}
                      value={row.id}
                    />
                    <label
                      htmlFor={`${bucket.name}-${row.id}`}
                      className="flex flex-wrap items-center gap-2 text-start text-sm"
                    >
                      <span>{row.label}</span>
                      {row.badge ? (
                        <Badge variant="outline">{row.badge}</Badge>
                      ) : null}
                      {row.note ? (
                        <span className="text-muted-foreground text-xs">
                          {row.note}
                        </span>
                      ) : null}
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      ))}

      <div className="flex flex-col gap-3 rounded-lg border p-4">
        <label
          htmlFor="toUserId"
          className="text-start text-sm font-medium"
        >
          {t("team.handover.reassignTo")}
        </label>
        <SelectField
          name="toUserId"
          placeholder={t("team.handover.reassignToPlaceholder")}
          invalid={Boolean(errors.toUserId)}
        >
          {colleagues.map((colleague) => (
            <option key={colleague.id} value={colleague.id}>
              {colleague.name}
            </option>
          ))}
        </SelectField>
        {errors.toUserId ? (
          <p
            id="toUserId-error"
            role="alert"
            className="text-destructive text-start text-xs"
          >
            {t(errors.toUserId)}
          </p>
        ) : null}
        <p className="text-muted-foreground text-start text-xs">
          {t("team.handover.reassignHint")}
        </p>
        <div>
          <Button type="submit" disabled={pending}>
            {pending ? t("common.saving") : t("team.handover.reassign")}
          </Button>
        </div>
      </div>
    </form>
  );
}
