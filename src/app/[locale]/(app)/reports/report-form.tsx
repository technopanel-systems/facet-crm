"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import {
  FormField,
  FormShell,
  SelectField,
} from "@/components/form-field";
import { CityField } from "@/components/city-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Link } from "@/i18n/navigation";
import type { CityRow } from "@/lib/lookups";
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
 * `dispatches/new?mode=direct` follows. Only the project chips keep any state
 * at all, and they work without it on the server.
 *
 * ## The order is `S32`'s sentence, in order — `38c`
 *
 * *"Three taps and a text box."* The narrative was **sixth**, under nine
 * checkboxes' worth of optional context, so at 375 the thing a rep opens this
 * form to write started below the fold. It is now **third**: company, channel ·
 * outcome, the box. Everything after it is optional or prefilled — project,
 * contact, the two dates, and `D46`'s optional signals behind a disclosure.
 *
 * `onHoldUntil` moved up with the date rather than sitting last. `S37` makes it
 * a consequence of the outcome, and it was five fields away from the select
 * that requires it.
 *
 * **`D46` listed *"…optional signals, the note"* and the code has never shipped
 * that order** — the note has been before the signals since the form was built.
 * The rule now records what ships rather than the reverse.
 *
 * ## Touch sizing is `D74`'s, not this file's — `38c`
 *
 * This form was the product's own source for the 44px number, and it was the
 * last place still doing it the old way: a local `touch = "h-11 text-base"`
 * pinned both dates to 44px **at every width**, overriding `Input`'s own
 * `h-8 max-md:min-h-11` and taking `D22`'s 32px laptop control with it. `D74`
 * says *`min-height` and `min-width`, never `height`* — and now says out loud
 * that the ban reaches the call site. The constant is deleted; every control
 * here inherits its component's floor.
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
  cities: CityRow[];
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

      {/* ── The three taps ──────────────────────────────────────────────── */}

      {isInteraction ? (
        companyLabel ? (
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
            {/* A native `<select>` `D20`. It was a `Combobox` — an
                UNDECLARED use `AD19`: the exception `[15 §5]` recorded was
                the ~200-item city list, never a company picker, and no `D`
                rule was ever behind this one. `WORKFLOW §5` row 269 settled
                the shape on the raise form at ~126 rows and this is the same
                list. Required `reports.ts` — an interaction is about a
                company — so the browser refuses the placeholder. */}
            <SelectField
              name="companyId"
              defaultValue={state.values?.companyId ?? values.companyId}
              placeholder={t("reports.fields.companyPlaceholder")}
              required
              invalid={!!errors.companyId}
            >
              {companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.label}
                </option>
              ))}
            </SelectField>
          </FormField>
        )
      ) : null}

      {isInteraction ? (
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
            {/* Never required — `S33` allows a field note with no city. The
                placeholder IS the empty option. */}
            <CityField
              name="cityId"
              cities={cities}
              defaultValue={state.values?.cityId ?? values.cityId}
              placeholder={t("reports.fields.cityPlaceholder")}
              invalid={!!errors.cityId}
            />
          </FormField>
        </div>
      )}

      {/* ── The text box `S32` ──────────────────────────────────────────── */}

      <FormField
        name="narrative"
        label={t("reports.fields.narrative")}
        error={errors.narrative}
        hint={t("reports.detail.narrativeAlways")}
        required
      >
        {/* No `text-base` here: `Textarea` carries `text-base md:text-sm` on
            its own base, and repeating the first half locally pinned 16px on
            the laptop too. `D74`'s note on the 16px step is about the phone,
            and the component already owns it. */}
        <Textarea
          id="narrative"
          name="narrative"
          rows={5}
          className="text-start"
          placeholder={t("reports.fields.narrativePlaceholder")}
          defaultValue={state.values?.narrative ?? values.narrative}
          aria-invalid={!!errors.narrative || undefined}
        />
      </FormField>

      {/* ── Optional context, in the order a rep reaches for it ─────────── */}

      {isInteraction && projects.length > 0 ? (
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

      {isInteraction && contacts.length > 0 ? (
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

      {/* The two dates together: `S37` makes the park a consequence of the
          outcome, and it used to sit five fields away from the select that
          requires it. The on-hold field is rendered always rather than
          revealed by JavaScript — the CHECK and the `RuleError` are the gate,
          and the UI never is `[19 §3]`. */}
      <div className="grid gap-6 sm:grid-cols-2">
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
            className="text-start"
            defaultValue={state.values?.reportDate ?? values.reportDate}
            aria-invalid={!!errors.reportDate || undefined}
          />
        </FormField>

        {isInteraction ? (
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
              className="text-start"
              defaultValue={
                state.values?.onHoldUntil ?? values.onHoldUntil ?? ""
              }
              aria-invalid={!!errors.onHoldUntil || undefined}
            />
          </FormField>
        ) : null}
      </div>

      <SignalFields
        signals={signals}
        signalsWithReference={signalsWithReference}
        selected={values.signals}
        error={errors.signals}
      />

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
 *  reaches it. `max-md:` rather than bare: `D74` is a phone floor and `D22`'s
 *  laptop density is deliberate. */
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
    <button type="button" onClick={onSelect} className="max-md:min-h-11">
      <Badge
        variant={selected ? "default" : "outline"}
        className="px-4 text-sm max-md:min-h-11"
      >
        {label}
      </Badge>
    </button>
  );
}
