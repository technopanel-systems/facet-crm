"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SelectField } from "@/components/form-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Link } from "@/i18n/navigation";
import { PAYMENT_METHODS } from "@/lib/enums";
import { emptyFormState, type FormState } from "@/lib/validation";

import {
  approveDispatchRequestAction,
  cancelDispatchAction,
  refuseDispatchRequestAction,
  reviveDispatchRequestAction,
  setDispatchSmacNumberAction,
  submitDispatchRequestAction,
} from "../actions";

/**
 * The five acts of `S72` that live on a request, and who may perform each.
 *
 * | state | the rep who raised it | the coordinator |
 * |---|---|---|
 * | `draft` | edit `S125`, submit | — |
 * | `submitted` | — | edit `S125` `S62`, approve, refuse `S124` |
 * | `approved` | — | write the SMAC number `S121`, cancel `S73` |
 * | `refused` | — | revive `S122` |
 * | `cancelled` | — | — |
 *
 * The last row is why this component returns `null` for a cancelled dispatch:
 * nothing is offered to anybody, and rendering an empty panel would say there
 * is something to do here.
 *
 * **An unavailable act is not rendered** `D53` — never a disabled control and
 * never a message. Every action re-checks its rule on the server `S109`, so
 * what is here is a courtesy rather than the gate.
 *
 * **Approval is still final** `S73`: writing the SMAC number is not an edit and
 * changes no figure. *A dispatch is approved, then numbered*, and the number is
 * explicitly not a condition of the approval — so it is its own control here,
 * never a field on the approve form.
 *
 * **Cancelling is not an edit either, and there is no un-approve** `S73`. *If
 * something is wrong afterwards the dispatch is cancelled, never un-approved*,
 * and *a new dispatch is raised instead* — so the row's last state offers
 * nothing to anybody, which is why `cancelled` has an empty column above and no
 * branch below.
 *
 * **There is no approve on the list**, deliberately, and it is a rule rather
 * than a layout choice: `S72` says the coordinator *checks it* and approves it,
 * and a button on a row lets her approve without opening it. What would let a
 * row say which requests need a second look is `S120`'s difference flag, which
 * is unbuilt — so nothing here invents a substitute signal.
 */

type PlainAction = () => Promise<FormState>;
type ReasonAction = (
  state: FormState,
  formData: FormData,
) => Promise<FormState>;

function Feedback({ state }: { state: FormState }) {
  const t = useTranslations();
  const message =
    state.error ?? Object.values(state.fieldErrors ?? {})[0] ?? null;
  if (!message) return null;
  return (
    <p role="alert" className="text-destructive text-start text-xs">
      {t(message)}
    </p>
  );
}

/** A one-button act with no fields — submit, approve, revive. */
function PlainButton({
  action,
  label,
  name,
  variant = "outline",
}: {
  action: PlainAction;
  label: string;
  /** A DOM handle for `verify:routes`, which may not read a translated
   *  string to tell two forms apart (`CLAUDE.md`). */
  name: string;
  variant?: "outline" | "destructive" | "default";
}) {
  const t = useTranslations();
  const [state, submit, pending] = useActionState(action, emptyFormState);
  return (
    <form action={submit} className="flex flex-col gap-2" data-act={name}>
      <div>
        <Button type="submit" size="sm" variant={variant} disabled={pending}>
          {pending ? t("common.saving") : label}
        </Button>
      </div>
      <Feedback state={state} />
    </form>
  );
}

/**
 * `S124` — the refusal, with its reason.
 *
 * **A child component, and that is load-bearing rather than tidiness.** Every
 * form in this app whose `useActionState` is created in the component that
 * renders it answers a no-JavaScript POST; the three that hoist it to a parent
 * which renders the form conditionally never send response headers at all —
 * `confirmPaymentAction` and the two participant forms (`WORKFLOW §5`), whose
 * cause was still open. Written as a parent-owned hook this form reproduced it
 * exactly, including on the empty-reason path that writes nothing, which rules
 * out the standing "the panel is unmounted by its own success" explanation.
 * Written this way it answers in milliseconds.
 */
function RefuseForm({ action }: { action: ReasonAction }) {
  const t = useTranslations();
  const [state, refuse, pending] = useActionState(action, emptyFormState);
  return (
    <form action={refuse} className="flex flex-col gap-2" data-act="refuse">
      <Label htmlFor="reason" className="text-start text-sm font-medium">
        {t("dispatches.fields.refusalReason")}
      </Label>
      <Textarea
        id="reason"
        name="reason"
        rows={2}
        dir="auto"
        className="text-start"
        placeholder={t("dispatches.fields.refusalReasonPlaceholder")}
        required
      />
      <div>
        <Button
          type="submit"
          size="sm"
          variant="destructive"
          disabled={pending}
        >
          {pending ? t("common.saving") : t("dispatches.actions.refuse")}
        </Button>
      </div>
      <Feedback state={state} />
    </form>
  );
}

/**
 * `S73` — **approval carries the payment method**, and that is what makes
 * *a dispatch cannot be approved without a payment method* unbreakable rather
 * than merely checked: there is no path to `approved` that does not pass
 * through this form.
 *
 * **A child component owning its own `useActionState`**, for `RefuseForm`'s
 * reason and with more at stake: this action writes. Every form in this app
 * whose hook is created in the component that renders it answers a
 * no-JavaScript POST; the three that hoist it to a parent rendering the form
 * conditionally never send response headers at all (`WORKFLOW §5`).
 *
 * **The rep never sees this.** `S70` puts the method in the coordinator's head
 * — *because she is the one who confirms it with finance* — so it is not a
 * field on the request form and not one on the edit form either.
 *
 * The note is optional `S71`; the select is `required`, and the action refuses
 * the placeholder again, and `dispatches_payment_method` refuses it a third
 * time at the database.
 */
function ApproveForm({ action }: { action: ReasonAction }) {
  const t = useTranslations();
  const [state, approve, pending] = useActionState(action, emptyFormState);
  return (
    <form action={approve} className="flex flex-col gap-2" data-act="approve">
      <Label htmlFor="paymentMethod" className="text-start text-sm font-medium">
        {t("dispatches.fields.paymentMethod")}
      </Label>
      {/* A native `<select>` `D20`, and `SelectField`'s rather than a second
          one: six fixed values, no client state, and the browser places the
          RTL popup itself. `required` makes it refuse the placeholder; the
          action refuses it again `S109` and the CHECK a third time `S73`. */}
      <SelectField
        name="paymentMethod"
        placeholder={t("common.none")}
        required
      >
        {PAYMENT_METHODS.map((method) => (
          <option key={method} value={method}>
            {t(`enums.paymentMethod.${method}`)}
          </option>
        ))}
      </SelectField>

      <Label htmlFor="paymentNote" className="text-start text-sm font-medium">
        {t("dispatches.fields.paymentNote")}
      </Label>
      {/* `S71` — *an optional note carries anything the list does not*. It may
          hold either script `D62`. */}
      <Input
        id="paymentNote"
        name="paymentNote"
        dir="auto"
        className="text-start"
        placeholder={t("dispatches.fields.paymentNotePlaceholder")}
      />

      <div>
        <Button type="submit" size="sm" variant="default" disabled={pending}>
          {pending ? t("common.saving") : t("dispatches.actions.approve")}
        </Button>
      </div>
      <Feedback state={state} />
    </form>
  );
}

/**
 * `S73` — **the cancellation, with its reason.**
 *
 * A child component owning its own `useActionState`, for `RefuseForm`'s
 * reason, and destructive rather than outline because it is the one act here
 * that takes square metres out of somebody's month `S85` and un-wins a project
 * `S31`. That is a property of the ACT, not of the record's state: `D6` keeps
 * colour for elapsed time, and the cancelled dispatch itself carries none — see
 * the card on the detail screen and its plain `outline` status badge.
 *
 * The reason is required here, again in the action, and a third time by
 * `dispatches_cancellation_reason` at the database. It is what `S128` carries
 * to the rep and to anyone whose credit it takes back `S80`, so a cancellation
 * without one is the hole the rule exists to close.
 */
function CancelForm({ action }: { action: ReasonAction }) {
  const t = useTranslations();
  const [state, cancel, pending] = useActionState(action, emptyFormState);
  return (
    <form action={cancel} className="flex flex-col gap-2" data-act="cancel">
      <Label htmlFor="reason" className="text-start text-sm font-medium">
        {t("dispatches.fields.cancellationReason")}
      </Label>
      <Textarea
        id="reason"
        name="reason"
        rows={2}
        dir="auto"
        className="text-start"
        placeholder={t("dispatches.fields.cancellationReasonPlaceholder")}
        required
      />
      <div>
        <Button
          type="submit"
          size="sm"
          variant="destructive"
          disabled={pending}
        >
          {pending ? t("common.saving") : t("dispatches.actions.cancel")}
        </Button>
      </div>
      <Feedback state={state} />
    </form>
  );
}

/**
 * `S121` — **the SMAC dispatch number**, written after approval.
 *
 * *It is not a condition of approval; a dispatch is approved, then numbered.*
 * So this is a control on an approved dispatch rather than a field on the
 * approve form, and nothing anywhere waits on it: an approved dispatch with no
 * number credits its target exactly as one with a number does `S72`.
 *
 * Rendered for the coordinator whether or not one is already written — *usually
 * at once* is not always, and a mistyped number `S5` is hers to correct. The
 * unique index refuses a collision and `setDispatchSmacNumber` turns it into a
 * message under the field.
 */
function SmacNumberForm({
  action,
  current,
}: {
  action: ReasonAction;
  current: string | null;
}) {
  const t = useTranslations();
  const [state, save, pending] = useActionState(action, emptyFormState);
  return (
    <form action={save} className="flex flex-col gap-2" data-act="smac-number">
      <Label
        htmlFor="smacDispatchNumber"
        className="text-start text-sm font-medium"
      >
        {t("dispatches.fields.smacDispatchNumber")}
      </Label>
      {/* A reference, so `dir="ltr"` and `num` — LTR content inside Arabic. */}
      <Input
        id="smacDispatchNumber"
        name="smacDispatchNumber"
        dir="ltr"
        defaultValue={current ?? ""}
        className="num text-start"
        placeholder={t("dispatches.fields.smacDispatchNumberPlaceholder")}
        required
      />
      <div>
        <Button type="submit" size="sm" variant="outline" disabled={pending}>
          {pending ? t("common.saving") : t("common.save")}
        </Button>
      </div>
      <Feedback state={state} />
    </form>
  );
}

export function RequestActions({
  dispatchId,
  status,
  isRaiser,
  isCoordinator,
  smacDispatchNumber,
}: {
  dispatchId: string;
  status: "draft" | "submitted" | "approved" | "refused" | "cancelled";
  /** `S125` — who raised it, which is who edits it while it is a draft. */
  isRaiser: boolean;
  /** Presentation only — every action re-checks the flag on the server. */
  isCoordinator: boolean;
  /** `S121` — what is written, so the field opens on it rather than empty. */
  smacDispatchNumber: string | null;
}) {
  const t = useTranslations();

  const canEdit =
    (status === "draft" && isRaiser) ||
    (status === "submitted" && isCoordinator);

  // `S121` — an approved dispatch is not editable `S73`, and this is not an
  // edit: the number is written after approval and gates nothing.
  const canNumber = status === "approved" && isCoordinator;

  // `S73` — *approval is final*, so the only thing left to do with an approved
  // dispatch that has gone wrong is cancel it. The founder's decision on who:
  // the coordinator, the same flag as approve, refuse, revive and the number.
  const canCancel = status === "approved" && isCoordinator;

  // A refused request offers nothing to anyone but the coordinator who may
  // revive it `S122`. Rendering an empty panel would say there is something to
  // do here.
  if (
    !canEdit &&
    !canNumber &&
    !canCancel &&
    !(status === "refused" && isCoordinator)
  ) {
    return null;
  }

  return (
    <Card data-slot="request-actions">
      <CardHeader>
        <CardTitle className="text-start">
          {t("dispatches.detail.actions")}
        </CardTitle>
        <CardDescription className="text-start">
          {status === "submitted"
            ? t("dispatches.detail.actionsCoordinator")
            : status === "refused"
              ? t("dispatches.detail.actionsRefused")
              : status === "approved"
                ? t("dispatches.detail.actionsApproved")
                : t("dispatches.detail.actionsDraft")}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {canEdit ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href={`/dispatches/${dispatchId}/edit`}>
                {t("dispatches.actions.edit")}
              </Link>
            </Button>
            {/* `S72` — the rep hands it over, and after that it is not theirs to
              edit `S125`. The hint says so before the click, not after. */}
            {status === "draft" && isRaiser ? (
              <PlainButton
                action={submitDispatchRequestAction.bind(null, dispatchId)}
                name="submit"
                variant="default"
                label={t("dispatches.actions.submit")}
              />
            ) : null}
          </div>
        ) : null}

        {status === "draft" && isRaiser ? (
          <p className="text-muted-foreground text-start text-xs">
            {t("dispatches.detail.submitHint")}
          </p>
        ) : null}

        {status === "submitted" && isCoordinator ? (
          <>
            {/* `S73` — the approval carries the payment method, so it is a
                form rather than the bare button it was. */}
            <ApproveForm
              action={approveDispatchRequestAction.bind(null, dispatchId)}
            />

            {/* `S124` — a refusal carries a reason, and `S122` archives the
                request with it. Its own component, for the reason written
                above `RefuseForm`. */}
            <RefuseForm
              action={refuseDispatchRequestAction.bind(null, dispatchId)}
            />
          </>
        ) : null}

        {/* `S121` — approved, then numbered. */}
        {canNumber ? (
          <SmacNumberForm
            action={setDispatchSmacNumberAction.bind(null, dispatchId)}
            current={smacDispatchNumber}
          />
        ) : null}

        {/* `S73` — the only act on an approved dispatch that changes a figure,
            and the last one it will ever take: a cancellation is never revived
            and a new dispatch is raised instead. The hint says so before the
            click, as the submit hint does. */}
        {canCancel ? (
          <>
            <CancelForm action={cancelDispatchAction.bind(null, dispatchId)} />
            <p className="text-muted-foreground text-start text-xs">
              {t("dispatches.detail.cancelHint")}
            </p>
          </>
        ) : null}

        {status === "refused" && isCoordinator ? (
          <>
            <PlainButton
              action={reviveDispatchRequestAction.bind(null, dispatchId)}
              name="revive"
              label={t("dispatches.actions.revive")}
            />
            <p className="text-muted-foreground text-start text-xs">
              {t("dispatches.detail.reviveHint")}
            </p>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
