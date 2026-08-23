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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Link } from "@/i18n/navigation";
import { emptyFormState, type FormState } from "@/lib/validation";

import {
  approveDispatchRequestAction,
  refuseDispatchRequestAction,
  reviveDispatchRequestAction,
  submitDispatchRequestAction,
} from "../actions";

/**
 * The five acts of `S72` that live on a request, and who may perform each.
 *
 * | state | the rep who raised it | the coordinator |
 * |---|---|---|
 * | `draft` | edit `S125`, submit | — |
 * | `submitted` | — | edit `S125` `S62`, approve, refuse `S124` |
 * | `approved` | — | — (approval is final `S73`) |
 * | `refused` | — | revive `S122` |
 *
 * **An unavailable act is not rendered** `D53` — never a disabled control and
 * never a message. Every action re-checks its rule on the server `S109`, so
 * what is here is a courtesy rather than the gate.
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

export function RequestActions({
  dispatchId,
  status,
  isRaiser,
  isCoordinator,
}: {
  dispatchId: string;
  status: "draft" | "submitted" | "approved" | "refused";
  /** `S125` — who raised it, which is who edits it while it is a draft. */
  isRaiser: boolean;
  /** Presentation only — every action re-checks the flag on the server. */
  isCoordinator: boolean;
}) {
  const t = useTranslations();

  const canEdit =
    (status === "draft" && isRaiser) ||
    (status === "submitted" && isCoordinator);

  // Approved is final `S73`, and a refused request offers nothing to anyone but
  // the coordinator who may revive it `S122`. Rendering an empty panel would
  // say there is something to do here.
  if (!canEdit && !(status === "refused" && isCoordinator)) return null;

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
            <PlainButton
              action={approveDispatchRequestAction.bind(null, dispatchId)}
              name="approve"
              variant="default"
              label={t("dispatches.actions.approve")}
            />

            {/* `S124` — a refusal carries a reason, and `S122` archives the
                request with it. Its own component, for the reason written
                above `RefuseForm`. */}
            <RefuseForm
              action={refuseDispatchRequestAction.bind(null, dispatchId)}
            />
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
