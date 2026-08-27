"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import { FormField, SelectField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { emptyFormState, type FormState } from "@/lib/validation";

type Action = (state: FormState, formData: FormData) => Promise<FormState>;

/**
 * `07 E6`'s three routes, as three separate forms.
 *
 * Each carries its own `useActionState`, so a rejected archive cannot blank the
 * reassign control — the same reasoning as `TargetRow` and the quotation line
 * editors.
 *
 * **Only what the viewer may do is rendered** `[21 §6]`: the owning rep gets
 * re-inclusion, and reassignment and archiving appear only with `can_assign`.
 * The data layer re-checks either way; this is presentation, never the gate.
 *
 * A native `<select>` for the recipient, deliberately `D20`. `[15 §5]`'s city
 * exception is gone with the control that held it; every picker is native.
 */
/**
 * **The hint is gone** `D70`.
 *
 * It read *"This company has gone quiet. Keep it, hand it to somebody else, or
 * take it out of scope"* — three options, to a rep who is offered exactly one:
 * the other two render only for `can_assign` `[21 §6]`. And the sentence it
 * was really carrying is *what happens next*, which `D24` puts in the turn
 * panel at the top of the page, where it now is.
 */
export function DormancyPanel({
  reincludeAction,
  reassignAction,
  archiveAction,
  reps,
}: {
  reincludeAction: Action;
  reassignAction?: Action;
  archiveAction?: Action;
  reps: { id: string; name: string }[];
}) {
  return (
    <div className="flex flex-col gap-6">
      <ReincludeForm action={reincludeAction} />
      {reassignAction ? (
        <ReassignForm action={reassignAction} reps={reps} />
      ) : null}
      {archiveAction ? <ArchiveForm action={archiveAction} /> : null}
    </div>
  );
}

function ReincludeForm({ action }: { action: Action }) {
  const t = useTranslations();
  const [state, formAction, pending] = useActionState(action, emptyFormState);

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <FormField
        label={t("dormancy.fields.note")}
        name="reincludeNote"
        error={state.fieldErrors?.note ?? state.error}
      >
        <Input
          id="reincludeNote"
          name="note"
          maxLength={500}
          className="text-start"
          defaultValue={state.values?.note ?? ""}
        />
      </FormField>
      <div>
        <Button type="submit" size="sm" variant="outline" disabled={pending}>
          {pending ? t("common.saving") : t("dormancy.actions.reinclude")}
        </Button>
      </div>
    </form>
  );
}

function ReassignForm({
  action,
  reps,
}: {
  action: Action;
  reps: { id: string; name: string }[];
}) {
  const t = useTranslations();
  const [state, formAction, pending] = useActionState(action, emptyFormState);

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <FormField
        label={t("dormancy.fields.toUser")}
        name="toUserId"
        error={state.fieldErrors?.toUserId ?? state.error}
      >
        <SelectField
          name="toUserId"
          defaultValue={state.values?.toUserId ?? ""}
          placeholder={t("common.none")}
          invalid={Boolean(state.fieldErrors?.toUserId)}
        >
          {reps.map((rep) => (
            <option key={rep.id} value={rep.id}>
              {rep.name}
            </option>
          ))}
        </SelectField>
      </FormField>
      <div>
        <Button type="submit" size="sm" variant="outline" disabled={pending}>
          {pending ? t("common.saving") : t("dormancy.actions.reassign")}
        </Button>
      </div>
    </form>
  );
}

function ArchiveForm({ action }: { action: Action }) {
  const t = useTranslations();
  const [state, formAction, pending] = useActionState(action, emptyFormState);

  return (
    <form action={formAction} className="flex flex-col gap-2">
      {/* A written reason is required, for the reason `10 §8` requires one on a
          cancellation: it is the field that makes the audit entry readable. */}
      <FormField
        label={t("dormancy.fields.reason")}
        name="archiveNote"
        error={state.fieldErrors?.note ?? state.error}
      >
        <Input
          id="archiveNote"
          name="note"
          required
          maxLength={500}
          className="text-start"
          defaultValue={state.values?.note ?? ""}
        />
      </FormField>
      <div>
        <Button
          type="submit"
          size="sm"
          variant="destructive"
          disabled={pending}
        >
          {pending ? t("common.saving") : t("dormancy.actions.archive")}
        </Button>
      </div>
    </form>
  );
}
