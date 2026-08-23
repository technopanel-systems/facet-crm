"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SMAC_VERIFICATIONS } from "@/lib/enums";
import { emptyFormState, type FormState } from "@/lib/validation";

import {
  acceptThreadAction,
  cancelThreadAction,
  confirmPaymentAction,
  createRevisionAction,
  issueVersionAction,
  markAcceptedForProcessingAction,
  rejectThreadAction,
  returnForEditAction,
} from "../actions";
import { selectClasses } from "../line-fields";

/**
 * The state panels: everything that moves a quotation along the chain.
 *
 * Two groups, labelled by who does what rather than by which button is where.
 * The coordinator's group is rendered only for a holder of
 * `can_approve_quotation` — but that is presentation. Every one of these
 * actions re-checks the flag on the server, so hiding a button is a courtesy,
 * not the rule.
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

function Panel({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 border-t py-4 first:border-t-0 first:pt-0">
      <p className="text-start text-sm font-medium">{title}</p>
      {hint ? (
        <p className="text-muted-foreground text-start text-xs">{hint}</p>
      ) : null}
      {children}
    </div>
  );
}

/** A one-button action with no fields — accept, revise. */
function PlainButton({
  action,
  label,
  variant = "outline",
}: {
  action: PlainAction;
  label: string;
  variant?: "outline" | "destructive" | "default";
}) {
  const t = useTranslations();
  const [state, submit, pending] = useActionState(action, emptyFormState);
  return (
    <form action={submit} className="flex flex-col gap-2">
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
 * `S62` `S128` — an act that ends the rep's work, with the reason it requires.
 *
 * **A child component owning its own `useActionState`, and that is
 * load-bearing.** Every form in this app whose hook is created in the component
 * that renders it answers a no-JavaScript POST; the ones that hoist it to a
 * parent rendering the form conditionally never send response headers at all
 * (`WORKFLOW §5`). `RefuseForm` on the dispatch screen is the same shape for
 * the same reason, and `S72`'s slice measured it rather than assuming.
 *
 * The two forms above this — cancel and return — keep their parent-owned hooks.
 * Changing them is `WORKFLOW §5`'s own session, not this one's.
 */
function ReasonForm({
  action,
  act,
  field,
  label,
  submitLabel,
}: {
  action: ReasonAction;
  /** A DOM handle for `verify:routes`, which may not read a translated
   *  string to tell two forms apart (`CLAUDE.md`). Separate from `field`:
   *  they were one prop and the walk looked for the act while the markup
   *  carried the field name. */
  act: string;
  /** What the action reads out of the FormData. */
  field: string;
  label: string;
  submitLabel: string;
}) {
  const t = useTranslations();
  const [state, submit, pending] = useActionState(action, emptyFormState);
  return (
    <form action={submit} className="flex flex-col gap-2" data-act={act}>
      <Label htmlFor={field} className="text-start text-sm font-medium">
        {label}
      </Label>
      <Textarea
        id={field}
        name={field}
        rows={2}
        dir="auto"
        required
        className="text-start"
      />
      <div>
        <Button type="submit" size="sm" variant="destructive" disabled={pending}>
          {pending ? t("common.saving") : submitLabel}
        </Button>
      </div>
      <Feedback state={state} />
    </form>
  );
}

export function ThreadActions({
  threadId,
  isCoordinator,
  liveStatus,
  endState,
  nextVersionNumber,
  paymentConfirmed,
  acceptedForProcessing,
}: {
  threadId: string;
  /** Presentation only — every action re-checks the flag on the server. */
  isCoordinator: boolean;
  liveStatus: "requested" | "issued" | "superseded";
  endState: string | null;
  nextVersionNumber: number;
  paymentConfirmed: boolean;
  acceptedForProcessing: boolean;
}) {
  const t = useTranslations();

  const [issueState, issue, issuing] = useActionState(
    issueVersionAction.bind(null, threadId),
    emptyFormState,
  );
  const [cancelState, cancel, cancelling] = useActionState(
    cancelThreadAction.bind(null, threadId),
    emptyFormState,
  );
  const [paymentState, confirm, confirming] = useActionState(
    confirmPaymentAction.bind(null, threadId),
    emptyFormState,
  );
  const [returnState, returnEdit, returning] = useActionState(
    returnForEditAction.bind(null, threadId),
    emptyFormState,
  );

  // A revision's origin says which route produced it `[07 C2]`: the
  // coordinator editing directly, or the rep asking for a change. There was a
  // third, `expiry_revision`, chosen when the version was past its validity
  // date. `S67` took the date out of FACET, so there is nothing left to read
  // and the two real routes are the whole vocabulary.
  const reviseOrigin = isCoordinator
    ? "coordinator_direct_edit"
    : "rep_change_request";

  const open = !endState;

  return (
    <div className="flex flex-col gap-6">
      {isCoordinator ? (
        <section className="flex flex-col">
          <h3 className="text-start text-sm font-semibold">
            {t("quotations.actions.coordinator")}
          </h3>

          {open && liveStatus === "requested" ? (
            <Panel
              title={t("quotations.actions.issue")}
              hint={t("quotations.actions.issueHint", {
                number: nextVersionNumber - 1,
              })}
            >
              <form action={issue} className="flex flex-col gap-2">
                <div className="grid gap-3 sm:grid-cols-[2fr_1fr_auto] sm:items-end">
                  <div className="flex flex-col gap-1.5">
                    <Label
                      htmlFor="smacReference"
                      className="text-muted-foreground text-start text-xs"
                    >
                      {t("quotations.fields.reference")}
                    </Label>
                    <Input
                      id="smacReference"
                      name="smacReference"
                      dir="ltr"
                      required
                      placeholder="9592"
                      className="text-start"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label
                      htmlFor="verification"
                      className="text-muted-foreground text-start text-xs"
                    >
                      {t("quotations.fields.verification")}
                    </Label>
                    {/* Typed by a human, so it can be wrong `[04 A2]`. */}
                    <select
                      id="verification"
                      name="verification"
                      defaultValue="unverified"
                      className={selectClasses}
                    >
                      {SMAC_VERIFICATIONS.map((value) => (
                        <option key={value} value={value}>
                          {t(`enums.smacVerification.${value}`)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <Button type="submit" size="sm" disabled={issuing}>
                    {issuing ? t("common.saving") : t("common.confirm")}
                  </Button>
                </div>
                <Feedback state={issueState} />
              </form>
            </Panel>
          ) : null}

          {open && liveStatus === "requested" ? (
            <Panel
              title={t("quotations.actions.returnForEdit")}
              hint={t("quotations.actions.returnForEditHint")}
            >
              <form action={returnEdit} className="flex flex-col gap-2">
                {/* Required `[25 §13]` — the reason IS the return. It becomes a
                    comment on the thread rather than a field of its own, so the
                    rep reads what to fix where the conversation already is. */}
                <Textarea
                  id="reason"
                  name="reason"
                  rows={2}
                  required
                  className="text-start"
                />
                <div>
                  <Button
                    type="submit"
                    size="sm"
                    variant="outline"
                    disabled={returning}
                  >
                    {returning
                      ? t("common.saving")
                      : t("quotations.actions.returnForEdit")}
                  </Button>
                </div>
                <Feedback state={returnState} />
              </form>
            </Panel>
          ) : null}

          {/* Internal approval, not the customer's commitment `[16 §5]` — the
              hint says so, because this is the button people will read as
              "won". */}
          {/* Internal approval takes no reason: an acceptance ends nobody's
              work. */}
          {open ? (
            <Panel
              title={t("quotations.actions.accept")}
              hint={t("quotations.actions.acceptHint")}
            >
              <PlainButton
                action={acceptThreadAction.bind(null, threadId)}
                label={t("quotations.actions.accept")}
              />
            </Panel>
          ) : null}

          {/* `S62` `S128` — **rejection now carries a reason**, so it is its
              own panel rather than a bare button beside accept. It had none at
              all: no field, no column, nothing but an audit row, so a rep whose
              quotation was rejected was never told and could not find out.
              The reason becomes a comment on the thread and reaches them. */}
          {open ? (
            <Panel
              title={t("quotations.actions.reject")}
              hint={t("quotations.actions.rejectHint")}
            >
              <ReasonForm
                action={rejectThreadAction.bind(null, threadId)}
                act="reject"
                field="rejectionReason"
                label={t("quotations.fields.rejectionReason")}
                submitLabel={t("quotations.actions.reject")}
              />
            </Panel>
          ) : null}

          {open ? (
            <Panel
              title={t("quotations.actions.cancel")}
              hint={t("quotations.actions.cancelHint")}
            >
              <form action={cancel} className="flex flex-col gap-2">
                {/* Required `[10 §8]` — it kills a signed quotation, and the
                    reason is what makes the audit entry worth reading. */}
                <Textarea
                  id="cancellationReason"
                  name="cancellationReason"
                  rows={2}
                  required
                  className="text-start"
                />
                <div>
                  <Button
                    type="submit"
                    size="sm"
                    variant="destructive"
                    disabled={cancelling}
                  >
                    {cancelling ? t("common.saving") : t("quotations.actions.cancel")}
                  </Button>
                </div>
                <Feedback state={cancelState} />
              </form>
            </Panel>
          ) : null}
        </section>
      ) : null}

      <section className="flex flex-col">
        <h3 className="text-start text-sm font-semibold">
          {t("quotations.actions.rep")}
        </h3>

        {open ? (
          <Panel
            title={t("quotations.actions.revise")}
            hint={t("quotations.actions.reviseHint", {
              number: nextVersionNumber,
            })}
          >
            <PlainButton
              action={createRevisionAction.bind(null, threadId, reviseOrigin)}
              label={t("quotations.actions.revise")}
            />
          </Panel>
        ) : null}

        {/* The rep's tick, with a date, because the rep receives the payment
            `[07 C3]`. This — with acceptance for processing — is where the
            customer actually commits `[16 §5]`. */}
        {!paymentConfirmed && endState !== "cancelled" && endState !== "rejected" ? (
          <Panel
            title={t("quotations.actions.confirmPayment")}
            hint={t("quotations.actions.confirmPaymentHint")}
          >
            <form action={confirm} className="flex flex-col gap-2">
              <div className="flex flex-wrap items-end gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label
                    htmlFor="confirmedOn"
                    className="text-muted-foreground text-start text-xs"
                  >
                    {t("common.date")}
                  </Label>
                  <Input
                    id="confirmedOn"
                    name="confirmedOn"
                    type="date"
                    dir="ltr"
                    required
                    className="text-start"
                  />
                </div>
                <Button type="submit" size="sm" disabled={confirming}>
                  {confirming ? t("common.saving") : t("common.confirm")}
                </Button>
              </div>
              <Feedback state={paymentState} />
            </form>
          </Panel>
        ) : null}

        {paymentConfirmed && !acceptedForProcessing ? (
          <Panel
            title={t("quotations.actions.markAccepted")}
            hint={t("quotations.actions.markAcceptedHint")}
          >
            <PlainButton
              action={markAcceptedForProcessingAction.bind(null, threadId)}
              label={t("quotations.actions.markAccepted")}
              variant="default"
            />
          </Panel>
        ) : null}
      </section>
    </div>
  );
}
