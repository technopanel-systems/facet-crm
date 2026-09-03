"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import { FormField, SelectField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { emptyFormState, type FormState } from "@/lib/validation";

import { Disclosure, rejected } from "../../_components/disclosure";

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
/**
 * **Four forms since session 54, on three flags and one membership.**
 * Re-inclusion for anyone who can see the company — withheld while a
 * request is with the manager, because *keep* is then the manager's ruling
 * `S105`; reassignment on `can_assign`; archiving on `can_approve_delete`
 * `S107`; and **the request** for a rep holding the company `S105` — a
 * disclosure, because it is the rare press on a page a rep opens daily, and
 * a required reason in a textarea, because *the reason is the point*.
 */
export function DormancyPanel({
  reincludeAction,
  reassignAction,
  archiveAction,
  requestAction,
  reps,
}: {
  reincludeAction?: Action;
  reassignAction?: Action;
  archiveAction?: Action;
  requestAction?: Action;
  reps: { id: string; name: string }[];
}) {
  return (
    <div className="flex flex-col gap-6">
      {reincludeAction ? <ReincludeForm action={reincludeAction} /> : null}
      {reassignAction ? (
        <ReassignForm action={reassignAction} reps={reps} />
      ) : null}
      {archiveAction ? <ArchiveForm action={archiveAction} /> : null}
      {requestAction ? <RemovalRequestForm action={requestAction} /> : null}
    </div>
  );
}

function RemovalRequestForm({ action }: { action: Action }) {
  const t = useTranslations();
  const [state, formAction, pending] = useActionState(action, emptyFormState);

  return (
    <Disclosure
      label={t("dormancy.request.open")}
      open={rejected(state)}
      act="removal-request-disclosure"
    >
      <form
        action={formAction}
        data-act="removal-request"
        className="flex max-w-xl flex-col gap-3"
      >
        <p className="text-muted-foreground text-start text-sm">
          {t("dormancy.request.hint")}
        </p>
        <FormField
          label={t("dormancy.request.reason")}
          name="reason"
          required
          error={state.fieldErrors?.reason ?? state.error}
        >
          {/* `dir="auto"` — a stored value in either script `D62`. */}
          <Textarea
            id="reason"
            name="reason"
            rows={3}
            required
            maxLength={500}
            dir="auto"
            defaultValue={state.values?.reason ?? ""}
          />
        </FormField>
        <div>
          <Button type="submit" size="sm" variant="outline" disabled={pending}>
            {pending ? t("common.saving") : t("dormancy.request.send")}
          </Button>
        </div>
      </form>
    </Disclosure>
  );
}

function ReincludeForm({ action }: { action: Action }) {
  const t = useTranslations();
  const [state, formAction, pending] = useActionState(action, emptyFormState);

  return (
    <form action={formAction} data-act="reinclude" className="flex flex-col gap-2">
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
    <form action={formAction} data-act="reassign" className="flex flex-col gap-2">
      <FormField
        label={t("dormancy.fields.toUser")}
        name="toUserId"
        error={state.fieldErrors?.toUserId ?? state.error}
      >
        <SelectField
          name="toUserId"
          defaultValue={state.values?.toUserId ?? ""}
          placeholder={t("common.none")}
          required
          invalid={Boolean(state.fieldErrors?.toUserId)}
        >
          {reps.map((rep) => (
            <option key={rep.id} value={rep.id} dir="auto">
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
    <form action={formAction} data-act="archive" className="flex flex-col gap-2">
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
