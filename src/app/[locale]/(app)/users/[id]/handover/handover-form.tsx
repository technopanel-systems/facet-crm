"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import { FormShell, SelectField } from "@/components/form-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Link } from "@/i18n/navigation";
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
  name: "membershipIds" | "projectIds" | "threadIds";
  title: string;
  empty: string;
  rows: { id: string; label: string; note?: string; badge?: string }[];
};

type Colleague = { id: string; name: string };

export function HandoverForm({
  action,
  userId,
  buckets,
  colleagues,
  isEmpty,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  /** Where Cancel goes back to. */
  userId: string;
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
    // `wide`: the buckets are repeating rows of checkboxes, which is a
    // table-shaped input rather than a field stack `[22 §3]`.
    <FormShell
      action={formAction}
      error={state.error}
      wide
      actions={
        <>
          <Button type="submit" disabled={pending}>
            {pending ? t("common.saving") : t("team.handover.reassign")}
          </Button>
          {/* This form had no way out at all. A screen that only commits is
              the one place a mis-click cannot be taken back. */}
          <Button asChild type="button" variant="ghost">
            <Link href={`/users/${userId}`}>{t("common.cancel")}</Link>
          </Button>
        </>
      }
    >
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
          required
        >
          {colleagues.map((colleague) => (
            <option key={colleague.id} value={colleague.id} dir="auto">
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
      </div>
    </FormShell>
  );
}
