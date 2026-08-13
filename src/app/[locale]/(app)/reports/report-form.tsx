"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import {
  FormField,
  FormShell,
  SelectField,
} from "@/components/form-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Link } from "@/i18n/navigation";
import { emptyFormState, type FormState } from "@/lib/validation";
import { useActionState } from "react";

import { SignalFields, type SignalValue } from "./signal-fields";

type Action = (state: FormState, formData: FormData) => Promise<FormState>;

/**
 * Option types are re-declared here rather than imported from the data
 * modules: this is a client component, and a value import from `@/lib/...`
 * would bundle the Postgres driver for the browser — a failure only
 * `npm run build` catches.
 */
export type Option = { id: string; label: string; altLabel?: string };

export type ReportFormValues = {
  entryType: "interaction" | "field_note";
  companyId: string | null;
  contactId: string | null;
  projectId: string | null;
  channel: string | null;
  outcome: string | null;
  onHoldUntil: string | null;
  category: string | null;
  cityId: string | null;
  narrative: string;
  reportDate: string;
  signals: SignalValue[];
};

/**
 * The log form `[20 §12]` — three taps and a text box, and the one screen in
 * FACET that is phone-first. Reps log visits standing in a lobby.
 *
 * **The entry type is a URL parameter, not client state** — the same reasoning
 * `dispatches/new?mode=direct` follows. Only the project chips and the
 * signal list keep any state at all, and both work without it on the server.
 *
 * Touch sizing is local to this form: `h-11` controls and a large submit. There
 * is no global restyle, because no other screen was asked for one.
 */
export function ReportForm({
  action,
  values,
  entryType,
  companies,
  companyLabel,
  contacts,
  projects,
  cities,
  channels,
  outcomes,
  categories,
  signals,
  signalsWithReference,
  submitLabel,
  cancelHref,
  quotationHref,
}: {
  action: Action;
  values: ReportFormValues;
  entryType: "interaction" | "field_note";
  /** Empty when the company arrived in the URL and is shown as text instead. */
  companies: Option[];
  companyLabel: string | null;
  contacts: Option[];
  projects: Option[];
  cities: Option[];
  channels: readonly string[];
  outcomes: readonly string[];
  categories: readonly string[];
  signals: readonly string[];
  signalsWithReference: readonly string[];
  submitLabel: string;
  cancelHref: string;
  /** Where "ask for a quotation" goes; a quotation is raised on a project. */
  quotationHref: string;
}) {
  const t = useTranslations();
  const [state, formAction, pending] = useActionState(action, emptyFormState);
  const errors = state.fieldErrors ?? {};

  // Pre-selected when there is exactly one `[20 §2]`, and never required.
  const [projectId, setProjectId] = useState<string>(
    values.projectId ?? (projects.length === 1 ? projects[0].id : ""),
  );

  const touch = "h-11 text-base";
  const isInteraction = entryType === "interaction";

  return (
    <FormShell
      action={formAction}
      error={state.error}
      actions={
        <>
          <Button type="submit" size="lg" disabled={pending}>
            {pending ? t("common.saving") : submitLabel}
          </Button>
          <Button asChild type="button" size="lg" variant="ghost">
            <Link href={cancelHref}>{t("common.cancel")}</Link>
          </Button>
        </>
      }
    >
      <input type="hidden" name="entryType" value={entryType} />


      <p className="text-muted-foreground text-start text-sm">
        {isInteraction
          ? t("reports.detail.interactionHint")
          : t("reports.detail.fieldNoteHint")}
      </p>

      {isInteraction ? (
        <>
          {companyLabel ? (
            // Arrived from a company page: already known, so it is shown
            // rather than asked for. Three taps starts here.
            <FormField
              name="companyId"
              label={t("reports.fields.company")}
              error={errors.companyId}
            >
              <input
                type="hidden"
                name="companyId"
                value={values.companyId ?? ""}
              />
              <p className="text-start text-base font-medium">{companyLabel}</p>
            </FormField>
          ) : (
            <FormField
              name="companyId"
              label={t("reports.fields.company")}
              error={errors.companyId}
              required
            >
              <Combobox
                name="companyId"
                options={companies.map(
                  (company): ComboboxOption => ({
                    value: company.id,
                    label: company.label,
                    altLabel: company.altLabel,
                  }),
                )}
                defaultValue={state.values?.companyId ?? values.companyId}
                placeholder={t("reports.fields.companyPlaceholder")}
                searchPlaceholder={t("common.search")}
                emptyLabel={t("common.noMatches")}
                clearLabel={t("common.clear")}
                invalid={!!errors.companyId}
              />
            </FormField>
          )}

          <div className="grid gap-6 sm:grid-cols-2">
            <FormField
              name="channel"
              label={t("reports.fields.channel")}
              error={errors.channel}
              required
            >
              <SelectField
                name="channel"
                defaultValue={state.values?.channel ?? values.channel}
                placeholder={t("reports.fields.channelPlaceholder")}
                invalid={!!errors.channel}
              >
                {channels.map((channel) => (
                  <option key={channel} value={channel}>
                    {t(`enums.reportChannel.${channel}`)}
                  </option>
                ))}
              </SelectField>
            </FormField>

            <FormField
              name="outcome"
              label={t("reports.fields.outcome")}
              error={errors.outcome}
              required
            >
              <SelectField
                name="outcome"
                defaultValue={state.values?.outcome ?? values.outcome}
                placeholder={t("reports.fields.outcomePlaceholder")}
                invalid={!!errors.outcome}
              >
                {outcomes.map((outcome) => (
                  <option key={outcome} value={outcome}>
                    {t(`enums.reportOutcome.${outcome}`)}
                  </option>
                ))}
              </SelectField>
            </FormField>
          </div>

          {projects.length > 0 ? (
            <FormField
              name="projectId"
              label={t("reports.fields.project")}
              error={errors.projectId}
            >
              {/* Chips `[20 §2]`, as radios: `defaultChecked` needs no
                  JavaScript, posts one value, and stays large enough for a
                  thumb. Never required — most calls are about no project. */}
              <input type="hidden" name="projectId" value={projectId} />
              <div className="flex flex-wrap gap-2">
                <Chip
                  label={t("reports.fields.projectNone")}
                  selected={projectId === ""}
                  onSelect={() => setProjectId("")}
                />
                {projects.map((project) => (
                  <Chip
                    key={project.id}
                    label={project.label}
                    selected={projectId === project.id}
                    onSelect={() => setProjectId(project.id)}
                  />
                ))}
              </div>
            </FormField>
          ) : null}

          {contacts.length > 0 ? (
            <FormField
              name="contactId"
              label={t("reports.fields.contact")}
              error={errors.contactId}
            >
              <SelectField
                name="contactId"
                defaultValue={state.values?.contactId ?? values.contactId}
                placeholder={t("reports.fields.contactPlaceholder")}
                invalid={!!errors.contactId}
              >
                {contacts.map((contact) => (
                  <option key={contact.id} value={contact.id}>
                    {contact.label}
                  </option>
                ))}
              </SelectField>
            </FormField>
          ) : null}
        </>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2">
          <FormField
            name="category"
            label={t("reports.fields.category")}
            error={errors.category}
            required
          >
            <SelectField
              name="category"
              defaultValue={state.values?.category ?? values.category}
              placeholder={t("reports.fields.categoryPlaceholder")}
              invalid={!!errors.category}
            >
              {categories.map((category) => (
                <option key={category} value={category}>
                  {t(`enums.fieldNoteCategory.${category}`)}
                </option>
              ))}
            </SelectField>
          </FormField>

          <FormField
            name="cityId"
            label={t("reports.fields.city")}
            error={errors.cityId}
          >
            <Combobox
              name="cityId"
              options={cities.map(
                (city): ComboboxOption => ({
                  value: city.id,
                  label: city.label,
                  altLabel: city.altLabel,
                }),
              )}
              defaultValue={state.values?.cityId ?? values.cityId}
              placeholder={t("reports.fields.cityPlaceholder")}
              searchPlaceholder={t("common.searchCity")}
              emptyLabel={t("common.noMatches")}
              clearLabel={t("common.clear")}
              invalid={!!errors.cityId}
            />
          </FormField>
        </div>
      )}

      <FormField
        name="narrative"
        label={t("reports.fields.narrative")}
        error={errors.narrative}
        hint={t("reports.detail.narrativeAlways")}
        required
      >
        <Textarea
          id="narrative"
          name="narrative"
          rows={5}
          className="text-start text-base"
          placeholder={t("reports.fields.narrativePlaceholder")}
          defaultValue={state.values?.narrative ?? values.narrative}
          aria-invalid={!!errors.narrative || undefined}
        />
      </FormField>

      <SignalFields
        signals={signals}
        signalsWithReference={signalsWithReference}
        selected={values.signals}
        error={errors.signals}
      />

      <FormField
        name="reportDate"
        label={t("reports.fields.reportDate")}
        error={errors.reportDate}
        required
      >
        <Input
          id="reportDate"
          name="reportDate"
          type="date"
          dir="ltr"
          className={`text-start ${touch}`}
          defaultValue={state.values?.reportDate ?? values.reportDate}
          aria-invalid={!!errors.reportDate || undefined}
        />
      </FormField>

      {isInteraction ? (
        // Rendered always rather than revealed by JavaScript: the CHECK and
        // the `RuleError` are the gate, and the UI never is `[19 §3]`.
        <FormField
          name="onHoldUntil"
          label={t("reports.fields.onHoldUntil")}
          error={errors.onHoldUntil}
          hint={t("reports.detail.onHoldFieldHint")}
        >
          <Input
            id="onHoldUntil"
            name="onHoldUntil"
            type="date"
            dir="ltr"
            className={`text-start ${touch}`}
            defaultValue={state.values?.onHoldUntil ?? values.onHoldUntil ?? ""}
            aria-invalid={!!errors.onHoldUntil || undefined}
          />
        </FormField>
      ) : null}

      {isInteraction ? (
        <div className="flex flex-col gap-2 rounded-lg border border-dashed p-4">
          <p className="text-muted-foreground text-start text-xs">
            {t("reports.detail.raiseQuotationHint")}
          </p>
          <div>
            <Button asChild type="button" size="sm" variant="outline">
              <Link href={quotationHref}>
                {t("reports.detail.raiseQuotation")}
              </Link>
            </Button>
          </div>
        </div>
      ) : null}
    </FormShell>
  );
}

/** A project chip. Large enough for a thumb, and a `<button>` so the keyboard
 *  reaches it. */
function Chip({
  label,
  selected,
  onSelect,
}: {
  label: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button type="button" onClick={onSelect} className="min-h-11">
      <Badge
        variant={selected ? "default" : "outline"}
        className="min-h-11 px-4 text-sm"
      >
        {label}
      </Badge>
    </button>
  );
}
