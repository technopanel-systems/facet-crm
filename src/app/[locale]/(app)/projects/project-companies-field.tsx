"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export type CompanyOption = {
  id: string;
  /** One field, English or Arabic `S12`. */
  name: string;
};

/**
 * The participants chosen while creating a project.
 *
 * A project keeps at least one participant `S27`, so the field starts with one
 * row and refuses to drop below one. A participant carries no role label `S25`
 * and no buyer flag `S26`, so a row is a company and nothing else — it stays a
 * repeater because a project involves several companies `S24`, not because a
 * row is complicated.
 *
 * **Nothing here says who bought.** That is derived from dispatches `S26`, and
 * nothing has been dispatched against a project being created.
 */
export function ProjectCompaniesField({
  companies,
  error,
}: {
  companies: CompanyOption[];
  error?: string;
}) {
  const t = useTranslations();
  const [rowCount, setRowCount] = useState(1);
  const rows = Array.from({ length: rowCount }, (_, index) => index);

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
          <div key={index} className="flex flex-col gap-1.5">
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
                  {company.name}
                </option>
              ))}
            </select>
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
      </div>
    </fieldset>
  );
}
