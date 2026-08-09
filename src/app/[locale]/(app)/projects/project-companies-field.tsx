"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export type CompanyOption = {
  id: string;
  nameEn: string;
  nameAr: string | null;
};

/**
 * The company links chosen while creating a project.
 *
 * A project requires at least one company `[07 A9]`, so the field starts with
 * one row and refuses to drop below one.
 *
 * The buyer is a **radio group with a "none" option**, not a checkbox per row.
 * `12 §6` says zero or one buyer, and a radio group is that rule: the invalid
 * two-buyer state is unreachable in the UI, so the server's check and the
 * partial unique index are backstops rather than the thing users hit.
 */
export function ProjectCompaniesField({
  companies,
  locale,
  error,
}: {
  companies: CompanyOption[];
  locale: string;
  error?: string;
}) {
  const t = useTranslations();
  const [rowCount, setRowCount] = useState(1);
  const rows = Array.from({ length: rowCount }, (_, index) => index);

  const optionName = (company: CompanyOption) =>
    locale === "ar" ? company.nameAr || company.nameEn : company.nameEn;

  const selectClasses = cn(
    "border-input bg-background text-foreground h-9 w-full rounded-md border",
    "ps-3 pe-8 text-start text-sm shadow-xs outline-none",
    "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
    "disabled:cursor-not-allowed disabled:opacity-50",
  );

  return (
    <fieldset className="flex flex-col gap-3 rounded-lg border p-4">
      <legend className="px-1 text-sm font-medium">
        {t("projects.detail.companies")}
      </legend>

      {companies.length === 0 ? (
        <p className="text-muted-foreground text-start text-sm">
          {t("common.noOptions")}
        </p>
      ) : null}

      <div className="flex flex-col gap-3">
        {rows.map((index) => (
          <div
            key={index}
            className="grid items-end gap-3 sm:grid-cols-[2fr_2fr_auto]"
          >
            <div className="flex flex-col gap-1.5">
              <Label
                htmlFor={`companyId-${index}`}
                className="text-muted-foreground text-start text-xs"
              >
                {t("projects.detail.company")}
              </Label>
              <select
                id={`companyId-${index}`}
                name="companyId"
                required={index === 0}
                disabled={companies.length === 0}
                defaultValue=""
                className={selectClasses}
              >
                <option value="">{t("common.none")}</option>
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {optionName(company)}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label
                htmlFor={`role-${index}`}
                className="text-muted-foreground text-start text-xs"
              >
                {t("projects.detail.role")}
              </Label>
              {/* Free text `[12 §5]` — two contractors may compete on one
                  project, and a fixed vocabulary would force a false choice. */}
              <Input
                id={`role-${index}`}
                name="role"
                defaultValue=""
                placeholder={t("projects.detail.rolePlaceholder")}
                className="text-start"
              />
            </div>

            <label className="flex h-9 items-center gap-2 text-sm">
              <input
                type="radio"
                name="buyerIndex"
                value={String(index)}
                className="size-4"
              />
              <span>{t("projects.detail.buyer")}</span>
            </label>
          </div>
        ))}
      </div>

      {error ? (
        <p role="alert" className="text-destructive text-start text-xs">
          {t(error)}
        </p>
      ) : null}

      <div className="flex items-center gap-2">
        <Button
          type="button"
          size="xs"
          variant="outline"
          onClick={() => setRowCount((count) => count + 1)}
          disabled={companies.length === 0}
        >
          {t("projects.detail.addCompany")}
        </Button>
        {rowCount > 1 ? (
          <Button
            type="button"
            size="xs"
            variant="ghost"
            onClick={() => setRowCount((count) => Math.max(1, count - 1))}
          >
            {t("common.remove")}
          </Button>
        ) : null}
        <label className="text-muted-foreground ms-auto flex items-center gap-2 text-xs">
          <input type="radio" name="buyerIndex" value="" defaultChecked className="size-3.5" />
          {t("projects.detail.noBuyer")}
        </label>
      </div>
    </fieldset>
  );
}
