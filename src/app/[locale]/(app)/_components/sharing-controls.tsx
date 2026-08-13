"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import { FormField, SelectField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { emptyFormState, type FormState } from "@/lib/validation";

/**
 * The grant form and the revoke controls `[07 B1]`, `[25 §30]`.
 *
 * **Each form carries its own `useActionState`**, so a rejected grant cannot
 * blank a revoke and one row's refusal does not disturb another's — the shape
 * `DormancyPanel`, `TargetRow` and the quotation line editors all use.
 *
 * **A native `<select>` for the person**, deliberately: no hidden-input bridge,
 * no client state, nothing to submit with JavaScript, and the browser places
 * the RTL popup. `15 §5`'s `Combobox` exception is for the ~200-item city list
 * and colleagues are a short list.
 *
 * Both option types are re-declared here rather than imported. A client
 * component that value-imports a `@/lib` data module bundles the Postgres
 * driver for the browser, and only `npm run build` catches it.
 */
export type ShareRow = {
  id: string;
  sharedWithName: string;
  /** Null when the granter's account has since been renamed away or removed. */
  sharedByName: string | null;
  /** Pre-formatted by the server component — a date needs the request locale. */
  grantedOn: string;
  /**
   * Bound to this row's id **on the server**, and absent without `can_share`.
   *
   * It is per row rather than one action plus a hidden id because only a server
   * action may cross this boundary: a `(id) => action.bind(null, id)` closure
   * passed down from the server component is a plain function, which React
   * refuses to serialise. Binding server-side also means the id the action acts
   * on is never a form field, so it cannot be edited in the page.
   */
  revokeAction?: Action;
};

export type ShareableUser = { id: string; name: string };

type Action = (state: FormState, formData: FormData) => Promise<FormState>;

export function SharingControls({
  shares,
  people,
  grantAction,
}: {
  shares: ShareRow[];
  /** Empty when the viewer may not grant — the form is then not rendered. */
  people: ShareableUser[];
  /** Absent without `can_share`: an action a role may not perform is not shown. */
  grantAction?: Action;
}) {
  const t = useTranslations();

  return (
    <div className="flex flex-col gap-4">
      {shares.length === 0 ? (
        <p className="text-muted-foreground text-start text-sm">
          {t("sharing.detail.none")}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {shares.map((share) => (
            <ShareEntry key={share.id} share={share} />
          ))}
        </ul>
      )}

      {grantAction ? (
        <GrantForm action={grantAction} people={people} />
      ) : null}

      {/* `14 §2` — a share is working access. The manager should know he is
          handing over edit rather than a read, and this is the only place the
          system ever says so. */}
      {grantAction ? (
        <p className="text-muted-foreground text-start text-xs">
          {t("sharing.detail.hint")}
        </p>
      ) : null}
    </div>
  );
}

function ShareEntry({ share }: { share: ShareRow }) {
  const t = useTranslations();

  return (
    <li
      data-slot="share-row"
      className="flex flex-wrap items-center justify-between gap-2 text-start text-sm"
    >
      <span className="flex flex-col">
        <span className="font-medium">{share.sharedWithName}</span>
        <span className="text-muted-foreground text-xs">
          {share.sharedByName
            ? t("sharing.detail.by", {
                name: share.sharedByName,
                date: share.grantedOn,
              })
            : t("sharing.detail.byUnknown", { date: share.grantedOn })}
        </span>
      </span>
      {share.revokeAction ? <RevokeForm action={share.revokeAction} /> : null}
    </li>
  );
}

function RevokeForm({ action }: { action: Action }) {
  const t = useTranslations();
  const [state, submit, pending] = useActionState(action, emptyFormState);

  return (
    <form action={submit} className="flex flex-col items-end gap-1">
      <Button type="submit" size="xs" variant="outline" disabled={pending}>
        {pending ? t("common.saving") : t("sharing.actions.revoke")}
      </Button>
      {state.error ? (
        <p role="alert" className="text-destructive text-end text-xs">
          {t(state.error)}
        </p>
      ) : null}
    </form>
  );
}

function GrantForm({
  action,
  people,
}: {
  action: Action;
  people: ShareableUser[];
}) {
  const t = useTranslations();
  const [state, submit, pending] = useActionState(action, emptyFormState);

  // Everyone active already holds it. Saying so beats an empty dropdown that
  // looks broken — and it is reachable, since the picker drops whoever already
  // has a live share.
  if (people.length === 0) {
    return (
      <p className="text-muted-foreground border-line border-t pt-4 text-start text-xs">
        {t("sharing.errors.noneAvailable")}
      </p>
    );
  }

  return (
    <form
      action={submit}
      data-slot="sharing-grant"
      className="border-line flex flex-col gap-2 border-t pt-4"
    >
      <FormField
        label={t("sharing.fields.sharedWith")}
        name="sharedWithUserId"
        error={state.fieldErrors?.sharedWithUserId ?? state.error}
      >
        <SelectField
          name="sharedWithUserId"
          defaultValue={state.values?.sharedWithUserId ?? ""}
          placeholder={t("common.none")}
          invalid={Boolean(state.fieldErrors?.sharedWithUserId)}
        >
          {people.map((person) => (
            <option key={person.id} value={person.id}>
              {person.name}
            </option>
          ))}
        </SelectField>
      </FormField>
      <div>
        <Button type="submit" size="sm" variant="outline" disabled={pending}>
          {pending ? t("common.saving") : t("sharing.actions.grant")}
        </Button>
      </div>
    </form>
  );
}
