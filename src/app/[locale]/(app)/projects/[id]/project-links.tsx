"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import { RecordRow } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import type { ProjectCompanyRow } from "@/lib/projects";
import { emptyFormState } from "@/lib/validation";

import { addProjectCompanyAction, removeProjectCompanyAction } from "../actions";

import type { CompanyOption } from "../project-companies-field";

/**
 * The participants on a project detail page, plus one form to add another.
 *
 * A participant carries no role label `S25` and no buyer flag `S26`, so a row
 * is a name, what that company has dispatched, and removal. **The number is
 * read, never set** — who bought is derived from dispatches, so there is
 * nothing on a row for a rep to tick and the only act left is taking the
 * participant off the project `S27`.
 *
 * `mayEdit` false is the `S76` reader: the participants and their dispatched
 * square metres are exactly what that reader came for, and neither the add form
 * nor a remove button is rendered for them `D51`. Both actions refuse in the
 * data layer regardless `S109`.
 */
export function ProjectLinks({
  projectId,
  links,
  companies,
  mayEdit,
}: {
  projectId: string;
  links: ProjectCompanyRow[];
  companies: CompanyOption[];
  mayEdit: boolean;
}) {
  const t = useTranslations();

  // Only companies not already linked can be added.
  const linkedIds = new Set(links.map((link) => link.companyId));
  const addable = companies.filter((company) => !linkedIds.has(company.id));

  return (
    <div className="flex flex-col gap-4">
      {links.length === 0 ? (
        <p className="text-muted-foreground text-start text-sm">
          {t("projects.detail.noCompanies")}
        </p>
      ) : (
        <ul className="flex flex-col">
          {links.map((link) => (
            <LinkRow
              key={link.id}
              projectId={projectId}
              link={link}
              canRemove={mayEdit && links.length > 1}
            />
          ))}
        </ul>
      )}

      {mayEdit && addable.length > 0 ? (
        <AddLinkForm
          projectId={projectId}
          companies={addable}
        />
      ) : null}
    </div>
  );
}

/**
 * One participant. A fragment of `<li>`s rather than a single one, because the
 * removal error needs somewhere to go and `RecordRow` has no error slot — it
 * follows as a sibling row instead of growing one.
 */
function LinkRow({
  projectId,
  link,
  canRemove,
}: {
  projectId: string;
  link: ProjectCompanyRow;
  canRemove: boolean;
}) {
  const t = useTranslations();
  const [removeState, removeAction, removing] = useActionState(
    removeProjectCompanyAction.bind(null, projectId, link.id),
    emptyFormState,
  );

  // **`!== null`, never truthiness.** `"0.0000"` is a real figure and `null`
  // is no dispatch at all `S26`; a falsy test cannot tell them apart and would
  // hide the very number the row exists to show.
  const dispatched = link.dispatchedSqm !== null;

  return (
    <>
      <RecordRow
        // Seeing a project shows which companies are on it — a project without
        // them is meaningless `[07 A9]` — but it does not grant access to the
        // company record itself `[04 Q7]`. Not viewable means no link.
        href={link.viewable ? `/companies/${link.companyId}` : undefined}
        // One name field since `S12`, so it may hold either script `D62`.
        // `data-participant` is a DOM handle, like `Fact`'s `name`: the derived
        // figure `S26` is what `S74`'s write-back must produce, and
        // `verify:routes` cannot assert it by reading a translated name.
        title={
          <span dir="auto" data-participant={link.companyId}>
            {link.companyName}
          </span>
        }
        meta={
          [
            link.viewable ? null : t("projects.detail.hiddenCompany"),
            dispatched ? t("projects.detail.dispatched") : null,
          ]
            .filter(Boolean)
            .join(" · ") || undefined
        }
        // `RecordRow` renders this mono and tabular `D11`. Absent, not zero:
        // a participant with no dispatch shows nothing `S26`.
        when={
          dispatched ? (
            <span data-dispatched={link.companyId}>
              {link.dispatchedSqm} {t("common.sqm")}
            </span>
          ) : undefined
        }
        action={
          canRemove ? (
            <form action={removeAction}>
              <Button type="submit" size="xs" variant="ghost" disabled={removing}>
                {t("projects.detail.removeCompany")}
              </Button>
            </form>
          ) : undefined
        }
      />
      {removeState.error ? (
        <li role="alert" className="text-destructive pb-2.5 text-start text-xs">
          {t(removeState.error)}
        </li>
      ) : null}
    </>
  );
}

function AddLinkForm({
  projectId,
  companies,
}: {
  projectId: string;
  companies: CompanyOption[];
}) {
  const t = useTranslations();
  const [state, action, pending] = useActionState(
    addProjectCompanyAction.bind(null, projectId),
    emptyFormState,
  );

  return (
    <form
      action={action}
      className="flex flex-wrap items-end gap-2 border-t pt-4"
    >
      <select
        name="companyId"
        required
        defaultValue=""
        aria-label={t("projects.detail.company")}
        className="border-input bg-background h-8 rounded-md border ps-3 pe-8 text-start text-sm"
      >
        <option value="">{t("projects.detail.addCompany")}</option>
        {companies.map((company) => (
          <option key={company.id} value={company.id}>
            {company.name}
          </option>
        ))}
      </select>
      <Button type="submit" size="xs" disabled={pending}>
        {pending ? t("common.saving") : t("common.add")}
      </Button>
      {state.error ? (
        <p role="alert" className="text-destructive w-full text-start text-xs">
          {t(state.error)}
        </p>
      ) : null}
    </form>
  );
}
