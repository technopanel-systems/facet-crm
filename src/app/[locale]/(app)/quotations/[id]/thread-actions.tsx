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
  createRevisionAction,
  issueVersionAction,
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
 * An act that ends somebody's work, with the reason it requires — `S62` `S128`
 * for rejection, `[10 §8]` for cancellation, `[25 §13]` for a return to the rep.
 *
 * **The action arrives already bound, and that is load-bearing.** A form whose
 * `.bind()` is evaluated by the component that calls `useActionState` never
 * answers a no-JavaScript POST: the write lands and no response headers follow
 * (`WORKFLOW §5`). Bound one level up, at the call site, the same form answers
 * in milliseconds. Measured on this build, not assumed — and measured against
 * the other candidate too: hoisting the `.bind()` to a `const` inside the
 * hook's own component still hung, so what matters is which component
 * evaluates it, not whether the expression sits inside the hook call.
 *
 * Cancellation and the return to the rep were each their own copy of this
 * markup with a parent-owned hook. Both are this component now: one form, three
 * callers, and the two that were hand-rolled gain the `dir="auto"` `D62` wants
 * on a field that may hold either script.
 */
function ReasonForm({
  action,
  act,
  field,
  label,
  submitLabel,
  variant = "destructive",
}: {
  action: ReasonAction;
  /** A DOM handle for `verify:routes`, which may not read a translated
   *  string to tell two forms apart (`CLAUDE.md`). Separate from `field`:
   *  they were one prop and the walk looked for the act while the markup
   *  carried the field name. */
  act: string;
  /** What the action reads out of the FormData. */
  field: string;
  /** Omitted where the panel title is the only heading the field ever had. */
  label?: string;
  submitLabel: string;
  /** Returning for edit is not a destructive act; rejecting and cancelling are. */
  variant?: "destructive" | "outline";
}) {
  const t = useTranslations();
  const [state, submit, pending] = useActionState(action, emptyFormState);
  return (
    <form action={submit} className="flex flex-col gap-2" data-act={act}>
      {label ? (
        <Label htmlFor={field} className="text-start text-sm font-medium">
          {label}
        </Label>
      ) : null}
      <Textarea
        id={field}
        name={field}
        rows={2}
        dir="auto"
        required
        className="text-start"
      />
      <div>
        <Button type="submit" size="sm" variant={variant} disabled={pending}>
          {pending ? t("common.saving") : submitLabel}
        </Button>
      </div>
      <Feedback state={state} />
    </form>
  );
}

/**
 * `S126` — the coordinator issues the version, naming what SMAC called it.
 *
 * Its own component for `ReasonForm`'s reason: the action is bound by the
 * caller, one level above the hook (`WORKFLOW §5`).
 */
function IssueForm({ action }: { action: ReasonAction }) {
  const t = useTranslations();
  const [state, submit, pending] = useActionState(action, emptyFormState);
  return (
    <form action={submit} className="flex flex-col gap-2" data-act="issue">
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
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? t("common.saving") : t("common.confirm")}
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
}: {
  threadId: string;
  /** Presentation only — every action re-checks the flag on the server. */
  isCoordinator: boolean;
  liveStatus: "requested" | "issued" | "superseded";
  endState: string | null;
  nextVersionNumber: number;
}) {
  const t = useTranslations();

  // **No `useActionState` here.** Every form below owns its own hook and
  // receives its action already bound — `WORKFLOW §5`'s hang, measured on this
  // build: the four hooks this component used to hold answered no raw POST at
  // all, and the two that were already children answered in milliseconds on
  // the very same page.

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
              <IssueForm action={issueVersionAction.bind(null, threadId)} />
            </Panel>
          ) : null}

          {open && liveStatus === "requested" ? (
            <Panel
              title={t("quotations.actions.returnForEdit")}
              hint={t("quotations.actions.returnForEditHint")}
            >
              {/* Required `[25 §13]` — the reason IS the return. It becomes a
                  comment on the thread rather than a field of its own, so the
                  rep reads what to fix where the conversation already is. */}
              <ReasonForm
                action={returnForEditAction.bind(null, threadId)}
                act="return"
                field="reason"
                submitLabel={t("quotations.actions.returnForEdit")}
                variant="outline"
              />
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
              {/* Required `[10 §8]` — it kills a signed quotation, and the
                  reason is what makes the audit entry worth reading. */}
              <ReasonForm
                action={cancelThreadAction.bind(null, threadId)}
                act="cancel"
                field="cancellationReason"
                submitLabel={t("quotations.actions.cancel")}
              />
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
      </section>
    </div>
  );
}
