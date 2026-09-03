"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import { FormField, SelectField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { emptyFormState, type FormState } from "@/lib/validation";

type Action = (state: FormState, formData: FormData) => Promise<FormState>;

/**
 * `S94`'s two forms, each with its own `useActionState` so a rejected
 * holiday cannot blank the leave form. Native date fields, native select
 * `D20` — nothing here needs a script to submit. A raw `yyyy-mm-dd` in a
 * control is a reference and keeps `dir="ltr"` `D73`.
 */
/**
 * Two forms on one page, so each field carries its own name — `leaveStartsOn`
 * beside `holidayStartsOn` — and `FormField`'s `name` is the control's own,
 * which is what `verify:routes` §23 pairs against the action's declaration
 * `D20`. The action reads the names by kind.
 */
function RangeFields({
  state,
  prefix,
}: {
  state: FormState;
  prefix: "leave" | "holiday";
}) {
  const t = useTranslations();
  const startsOn = `${prefix}StartsOn`;
  const endsOn = `${prefix}EndsOn`;
  const label = `${prefix}Label`;
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField
          label={t("calendar.fields.from")}
          name={startsOn}
          required
          error={state.fieldErrors?.startsOn}
        >
          <Input
            id={startsOn}
            name={startsOn}
            type="date"
            required
            dir="ltr"
            defaultValue={state.values?.[startsOn] ?? ""}
          />
        </FormField>
        <FormField
          label={t("calendar.fields.to")}
          name={endsOn}
          required
          error={state.fieldErrors?.endsOn}
        >
          <Input
            id={endsOn}
            name={endsOn}
            type="date"
            required
            dir="ltr"
            defaultValue={state.values?.[endsOn] ?? ""}
          />
        </FormField>
      </div>
      <FormField
        label={t("calendar.fields.label")}
        name={label}
        required
        error={state.fieldErrors?.label ?? state.error}
      >
        {/* A stored value in either script `D62`. */}
        <Input
          id={label}
          name={label}
          required
          maxLength={120}
          dir="auto"
          defaultValue={state.values?.[label] ?? ""}
        />
      </FormField>
    </>
  );
}

export function LeaveForm({
  action,
  people,
  selfId,
}: {
  action: Action;
  /** Empty for a reader who may enter only their own leave `D53`. */
  people: { id: string; name: string }[];
  selfId: string;
}) {
  const t = useTranslations();
  const [state, formAction, pending] = useActionState(action, emptyFormState);

  return (
    <form action={formAction} data-act="add-leave" className="flex flex-col gap-3">
      <input type="hidden" name="kind" value="leave" />
      {people.length > 0 ? (
        <FormField
          label={t("calendar.fields.who")}
          name="leave-userId"
          error={state.fieldErrors?.userId}
        >
          <SelectField
            name="userId"
            defaultValue={state.values?.userId ?? selfId}
            placeholder={t("common.none")}
            required
            invalid={Boolean(state.fieldErrors?.userId)}
          >
            {people.map((person) => (
              <option key={person.id} value={person.id} dir="auto">
                {person.name}
              </option>
            ))}
          </SelectField>
        </FormField>
      ) : null}
      <RangeFields state={state} prefix="leave" />
      <div>
        <Button type="submit" size="sm" variant="outline" disabled={pending}>
          {pending ? t("common.saving") : t("calendar.leave.add")}
        </Button>
      </div>
    </form>
  );
}

export function HolidayForm({ action }: { action: Action }) {
  const t = useTranslations();
  const [state, formAction, pending] = useActionState(action, emptyFormState);

  return (
    <form action={formAction} data-act="add-holiday" className="flex flex-col gap-3">
      <input type="hidden" name="kind" value="public_holiday" />
      <RangeFields state={state} prefix="holiday" />
      <div>
        <Button type="submit" size="sm" variant="outline" disabled={pending}>
          {pending ? t("common.saving") : t("calendar.holiday.add")}
        </Button>
      </div>
    </form>
  );
}

export function RemoveButton({
  action,
}: {
  action: (state: FormState) => Promise<FormState>;
}) {
  const t = useTranslations();
  const [state, formAction, pending] = useActionState(action, emptyFormState);

  return (
    <form action={formAction} data-act="remove-range" className="inline">
      <Button type="submit" size="xs" variant="ghost" disabled={pending}>
        {pending ? t("common.saving") : t("calendar.remove")}
      </Button>
      {state.error ? (
        <span className="text-destructive ms-2 text-[12.5px]">
          {t(state.error)}
        </span>
      ) : null}
    </form>
  );
}
