"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import type { ProjectCompanyRow } from "@/lib/projects";
import { emptyFormState } from "@/lib/validation";

import {
  addProjectCompanyAction,
  removeProjectCompanyAction,
  updateProjectCompanyAction,
} from "../actions";

import type { CompanyOption } from "../project-companies-field";

/**
 * The participants on a project detail page: one small form per row, plus one
 * to add.
 *
 * Separate forms rather than one big one, because each row is an independent
 * act with its own audit entry — naming the buyer `S26` and taking a
 * participant off the project `S27` are different things and should not travel
 * together. A participant carries no role label `S25`, so the row is a name,
 * the buyer flag, and removal.
 */
export function ProjectLinks({
  projectId,
  links,
  companies,
}: {
  projectId: string;
  links: ProjectCompanyRow[];
  companies: CompanyOption[];
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
        <ul className="flex flex-col divide-y">
          {links.map((link) => (
            <li key={link.id} className="py-3 first:pt-0 last:pb-0">
              <LinkRow
                projectId={projectId}
                link={link}
                canRemove={links.length > 1}
              />
            </li>
          ))}
        </ul>
      )}

      {addable.length > 0 ? (
        <AddLinkForm
          projectId={projectId}
          companies={addable}
        />
      ) : null}
    </div>
  );
}

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
  const [updateState, updateAction, updating] = useActionState(
    updateProjectCompanyAction.bind(null, projectId, link.id),
    emptyFormState,
  );
  const [removeState, removeAction, removing] = useActionState(
    removeProjectCompanyAction.bind(null, projectId, link.id),
    emptyFormState,
  );

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {/* Seeing a project shows which companies are on it — a project
            without them is meaningless `[07 A9]` — but it does not grant
            access to the company record itself `[04 Q7]`. Not viewable means
            the name renders as plain text. */}
        {/* One name field since `S12`, so it may hold either script and takes
            `dir="auto"` `D62`. */}
        {link.viewable ? (
          <Link
            href={`/companies/${link.companyId}`}
            dir="auto"
            className="text-start text-sm font-medium hover:underline"
          >
            {link.companyName}
          </Link>
        ) : (
          <span
            dir="auto"
            className="text-start text-sm font-medium"
            title={t("projects.detail.hiddenCompany")}
          >
            {link.companyName}
            <span className="text-muted-foreground ms-2 text-xs font-normal">
              ({t("projects.detail.hiddenCompany")})
            </span>
          </span>
        )}
        {link.isBuyer ? <Badge>{t("projects.detail.buyer")}</Badge> : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <form action={updateAction} className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs">
            <input
              type="checkbox"
              name="isBuyer"
              defaultChecked={link.isBuyer}
              className="size-3.5"
            />
            {t("projects.detail.buyer")}
          </label>
          <Button type="submit" size="xs" variant="secondary" disabled={updating}>
            {updating ? t("common.saving") : t("common.save")}
          </Button>
        </form>

        {canRemove ? (
          <form action={removeAction}>
            <Button type="submit" size="xs" variant="ghost" disabled={removing}>
              {t("projects.detail.removeCompany")}
            </Button>
          </form>
        ) : null}
      </div>

      {updateState.error ? (
        <p role="alert" className="text-destructive text-start text-xs">
          {t(updateState.error)}
        </p>
      ) : null}
      {removeState.error ? (
        <p role="alert" className="text-destructive text-start text-xs">
          {t(removeState.error)}
        </p>
      ) : null}
    </div>
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
      <label className="flex h-8 items-center gap-1.5 text-xs">
        <input type="checkbox" name="isBuyer" className="size-3.5" />
        {t("projects.detail.buyer")}
      </label>
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
