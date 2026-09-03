"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { emptyFormState, type FormState } from "@/lib/validation";

type Action = (state: FormState, formData: FormData) => Promise<FormState>;
type Named = { id: string; name: string };

/**
 * `S22`'s three outcomes as three forms, each with its own `useActionState`
 * so a refused one cannot blank another — `DormancyPanel`'s shape. Native
 * radios for *who continues* `D20`; the other two carry their outcome as a
 * hidden field and need nothing typed. **Shared is explained on its face**:
 * the founder's correction is the one sentence a manager must read before
 * pressing it.
 */
export function ResolveForms({
  action,
  a,
  b,
}: {
  action: Action;
  a: Named;
  b: Named;
}) {
  const t = useTranslations();
  return (
    <Card data-slot="duplicate-decide">
      <CardHeader>
        <CardTitle className="text-start text-sm">
          {t("duplicates.decide.title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="grid items-start gap-6 lg:grid-cols-3">
        <FalseAlarm action={action} />
        <OneContinues action={action} a={a} b={b} />
        <Shared action={action} />
      </CardContent>
    </Card>
  );
}

function FalseAlarm({ action }: { action: Action }) {
  const t = useTranslations();
  const [state, formAction, pending] = useActionState(action, emptyFormState);
  return (
    <form action={formAction} data-act="false-alarm" className="flex flex-col gap-2 text-start">
      <input type="hidden" name="resolution" value="false_flag" />
      <p className="text-sm font-medium">{t("duplicates.decide.falseAlarm")}</p>
      <p className="text-muted-foreground text-[12.5px]">
        {t("duplicates.decide.falseAlarmHint")}
      </p>
      {state.error ? (
        <p role="alert" className="text-destructive text-sm">
          {t(state.error)}
        </p>
      ) : null}
      <div>
        <Button type="submit" size="sm" variant="outline" disabled={pending}>
          {pending ? t("common.saving") : t("duplicates.decide.falseAlarmButton")}
        </Button>
      </div>
    </form>
  );
}

function OneContinues({
  action,
  a,
  b,
}: {
  action: Action;
  a: Named;
  b: Named;
}) {
  const t = useTranslations();
  const [state, formAction, pending] = useActionState(action, emptyFormState);
  return (
    <form action={formAction} data-act="one-continues" className="flex flex-col gap-2 text-start">
      <input type="hidden" name="resolution" value="who_continues" />
      <p className="text-sm font-medium">{t("duplicates.decide.continues")}</p>
      <p className="text-muted-foreground text-[12.5px]">
        {t("duplicates.decide.continuesHint")}
      </p>
      <FormField
        label={t("duplicates.decide.pick")}
        name="survivorId"
        required
        error={state.fieldErrors?.survivorId ?? state.error}
      >
        <div className="flex flex-col gap-1.5">
          {[a, b].map((side) => (
            <label key={side.id} className="flex min-h-11 items-center gap-2 text-sm md:min-h-0">
              <input
                type="radio"
                name="survivorId"
                value={side.id}
                required
                defaultChecked={state.values?.survivorId === side.id}
                className="size-4"
              />
              <span dir="auto">{side.name}</span>
            </label>
          ))}
        </div>
      </FormField>
      <div>
        <Button type="submit" size="sm" variant="outline" disabled={pending}>
          {pending ? t("common.saving") : t("duplicates.decide.continuesButton")}
        </Button>
      </div>
    </form>
  );
}

function Shared({ action }: { action: Action }) {
  const t = useTranslations();
  const [state, formAction, pending] = useActionState(action, emptyFormState);
  return (
    <form action={formAction} data-act="shared" className="flex flex-col gap-2 text-start">
      <input type="hidden" name="resolution" value="shared" />
      <p className="text-sm font-medium">{t("duplicates.decide.shared")}</p>
      <p className="text-muted-foreground text-[12.5px]">
        {t("duplicates.decide.sharedHint")}
      </p>
      {state.error ? (
        <p role="alert" className="text-destructive text-sm">
          {t(state.error)}
        </p>
      ) : null}
      <div>
        <Button type="submit" size="sm" variant="outline" disabled={pending}>
          {pending ? t("common.saving") : t("duplicates.decide.sharedButton")}
        </Button>
      </div>
    </form>
  );
}
