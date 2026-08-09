"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
 * The company links on a project detail page: one small form per row, plus one
 * to add.
 *
 * Separate forms rather than one big one, because each row is an independent
 * act with its own audit entry — editing a role and removing a company are
 * different things and should not travel together.
 */
export function ProjectLinks({
  projectId,
  links,
  companies,
  locale,
}: {
  projectId: string;
  links: ProjectCompanyRow[];
  companies: CompanyOption[];
  locale: string;
}) {
  const t = useTranslations();

  const optionName = (company: CompanyOption) =>
    locale === "ar" ? company.nameAr || company.nameEn : company.nameEn;

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
                locale={locale}
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
          optionName={optionName}
        />
      ) : null}
    </div>
  );
}

function LinkRow({
  projectId,
  link,
  locale,
  canRemove,
}: {
  projectId: string;
  link: ProjectCompanyRow;
  locale: string;
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

  const name =
    locale === "ar"
      ? link.companyNameAr || link.companyNameEn
      : link.companyNameEn;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {/* Seeing a project shows which companies are on it — a project
            without them is meaningless `[07 A9]` — but it does not grant
            access to the company record itself `[04 Q7]`. Not viewable means
            the name renders as plain text. */}
        {link.viewable ? (
          <Link
            href={`/companies/${link.companyId}`}
            className="text-start text-sm font-medium hover:underline"
          >
            {name}
          </Link>
        ) : (
          <span
            className="text-start text-sm font-medium"
            title={t("projects.detail.hiddenCompany")}
          >
            {name}
            <span className="text-muted-foreground ms-2 text-xs font-normal">
              ({t("projects.detail.hiddenCompany")})
            </span>
          </span>
        )}
        {link.isBuyer ? <Badge>{t("projects.detail.buyer")}</Badge> : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <form action={updateAction} className="flex flex-wrap items-center gap-2">
          <Input
            name="role"
            defaultValue={link.role ?? ""}
            placeholder={t("projects.detail.rolePlaceholder")}
            aria-label={t("projects.detail.role")}
            className="h-8 max-w-xs text-start"
          />
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
  optionName,
}: {
  projectId: string;
  companies: CompanyOption[];
  optionName: (company: CompanyOption) => string;
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
            {optionName(company)}
          </option>
        ))}
      </select>
      <Input
        name="role"
        placeholder={t("projects.detail.rolePlaceholder")}
        aria-label={t("projects.detail.role")}
        className="h-8 max-w-xs text-start"
      />
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
