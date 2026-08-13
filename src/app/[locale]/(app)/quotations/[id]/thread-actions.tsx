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
  extendValidityAction,
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

/** A one-button action with no fields — accept, reject, return, revise. */
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
  const [extendState, extend, extending] = useActionState(
    extendValidityAction.bind(null, threadId),
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
  // coordinator editing directly, or the rep asking for a change. When the
  // quotation has expired it is `07 C7`'s "revise" instead.
  const reviseOrigin =
    endState === "expired"
      ? "expiry_revision"
      : isCoordinator
        ? "coordinator_direct_edit"
        : "rep_change_request";

  // Expired is not final — `07 C7` offers extend or revise. Everything else is.
  const open = !endState || endState === "expired";

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
          {open ? (
            <Panel
              title={t("quotations.actions.accept")}
              hint={t("quotations.actions.acceptHint")}
            >
              <div className="flex flex-wrap items-center gap-2">
                <PlainButton
                  action={acceptThreadAction.bind(null, threadId)}
                  label={t("quotations.actions.accept")}
                />
                <PlainButton
                  action={rejectThreadAction.bind(null, threadId)}
                  label={t("quotations.actions.reject")}
                  variant="destructive"
                />
              </div>
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

        {open ? (
          <Panel
            title={t("quotations.actions.extend")}
            hint={t("quotations.actions.extendHint")}
          >
            <form action={extend} className="flex flex-col gap-2">
              <div className="flex flex-wrap items-end gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label
                    htmlFor="validUntil"
                    className="text-muted-foreground text-start text-xs"
                  >
                    {t("quotations.fields.validUntil")}
                  </Label>
                  <Input
                    id="validUntil"
                    name="validUntil"
                    type="date"
                    dir="ltr"
                    required
                    className="text-start"
                  />
                </div>
                <Button type="submit" size="sm" variant="outline" disabled={extending}>
                  {extending ? t("common.saving") : t("common.confirm")}
                </Button>
              </div>
              <Feedback state={extendState} />
            </form>
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
