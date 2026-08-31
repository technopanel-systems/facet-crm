"use client";
import { formatMoney } from "@/lib/decimal";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { emptyFormState, type FormState } from "@/lib/validation";

import {
  addQuotationLineAction,
  addServiceLineAction,
  removeQuotationLineAction,
  removeServiceLineAction,
  updateQuotationLineAction,
  updateServiceLineAction,
} from "../actions";
import { Disclosure, rejected } from "../../_components/disclosure";
import { lineLabel, lineParts } from "../line-display";
import {
  LineFields,
  ServiceFields,
  selectClasses,
  type NamedOption,
  type ProductOptions,
} from "../line-fields";

/**
 * The live version's lines, edited one row at a time — the same shape as the
 * project detail page's company links, and for the same reason: each row is
 * its own form with its own action state, so one row's error cannot blank
 * another row's input.
 *
 * Editing is offered **only while the version is `requested`** `S61`. Once the
 * coordinator has issued it the document exists in SMAC, and a change is a new
 * version rather than an edit `S66`. The server enforces that; this only stops
 * offering it.
 *
 * **Every form here renders in the HTML** `D20`. Four of them — the two add
 * forms and the two per-row editors — used to be behind `useState`, so with
 * scripts off they were not merely inconvenient, they did not exist: a rep
 * could read a quotation and could not add a line to one. That is *enablement*,
 * which the rewritten `D20` makes a defect whatever it is called, and no amount
 * of it being the ordinary React idiom changes what the sentence asks — turn
 * scripts off, can the person still do the thing.
 *
 * **The disclosure is `<details>`, the browser's own.** It needs no script, it
 * costs no round trip, and every field inside it reaches the HTML, so
 * `verify:routes §23`'s operability scan sees all nine of a product line's
 * controls where before it saw nothing at all. The alternatives were a `?line=`
 * in the URL — a round trip to open an editor, and three links that must each
 * carry the timeline's `?page=` or throw it away `D59` — and rendering nine
 * fields per line unconditionally, which on an eight-line quotation is
 * seventy-two visible controls.
 *
 * **A rejected editor reopens itself.** `open` is bound to whether that form's
 * own state carries an error, so a scripts-off POST that comes back rejected
 * re-renders with the row expanded and the message showing, rather than folding
 * the error away where nobody would find it.
 *
 * **Every action is bound at the CALL SITE**, one level above the component
 * that calls `useActionState` — `WORKFLOW §5`. Bound inside that component, a
 * form answers no raw POST at all: the write lands and no response headers
 * follow. Measured on this build, 10s abort before and 111ms after, and
 * hoisting the `.bind()` to a `const` in the same component still hung, so what
 * matters is which component evaluates it. The four forms this file used to
 * keep their own `.bind()` inside were exempt only because they never reached
 * the HTML; making them render is what makes the binding load-bearing, so both
 * halves land together.
 */

export type LineRow = {
  id: string;
  supplierId: string;
  supplierNameEn: string;
  supplierNameAr: string;
  classId: string;
  classNameEn: string;
  classNameAr: string;
  fireRatingId: string;
  fireRatingNameEn: string;
  fireRatingNameAr: string;
  customColour: string | null;
  thicknessId: string;
  thicknessMm: string;
  widthM: string;
  lengthM: string;
  quantityPcs: string;
  sqm: string | null;
  unitPrice: string | null;
  lineTotal: string | null;
  vatAmount: string | null;
};

export type ServiceRow = {
  id: string;
  serviceTypeId: string;
  serviceNameEn: string;
  serviceNameAr: string;
  quantity: string;
  unit: string;
  unitPrice: string | null;
  quotationLineId: string | null;
  lineTotal: string | null;
};

/** Bound by the caller; reads no form data. */
type PlainAction = () => Promise<FormState>;
/** Bound by the caller; reads the fields the editor posts. */
type FieldAction = (state: FormState, formData: FormData) => Promise<FormState>;

function Money({ value, sar }: { value: string | null; sar: string }) {
  if (!value) return <span className="text-muted-foreground">—</span>;
  // `dir="auto"`, not `"ltr"`: the currency is a translated word, so the run
  // resolves off it and reads figure-first in both scripts (`A2-12`, `D73`).
  // Grouped for reading, decimals untouched (`A2-16`, `D11`).
  return (
    <span dir="auto">
      <span className="num">{formatMoney(value)}</span> {sar}
    </span>
  );
}

function RowError({ state }: { state: FormState }) {
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

function ProductLine({
  line,
  updateLine,
  removeLine,
  options,
  locale,
  editable,
}: {
  line: LineRow;
  /** Both already bound by `ThreadLines` — `WORKFLOW §5`. */
  updateLine: FieldAction;
  removeLine: PlainAction;
  options: ProductOptions;
  locale: string;
  editable: boolean;
}) {
  const t = useTranslations();
  const [updateState, update, updating] = useActionState(
    updateLine,
    emptyFormState,
  );
  const [removeState, remove, removing] = useActionState(
    removeLine,
    emptyFormState,
  );

  return (
    <div className="flex flex-col gap-3 border-t py-4 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        {/* Supplier, class, fire rating, thickness, colour — set out as words
            `S53`. This was one reassembled SMAC code until that rule. */}
        <p className="flex flex-wrap items-baseline gap-x-2 text-start text-sm font-medium">
          {lineParts(line, locale).map((part, index) => (
            <span key={part + index} dir="auto">
              {index > 0 ? (
                <span aria-hidden className="text-faint me-2 font-normal">
                  ·
                </span>
              ) : null}
              {part}
            </span>
          ))}
        </p>
        <p className="text-muted-foreground text-start text-xs" dir="ltr">
          <span className="num">{line.quantityPcs}</span> ×{" "}
          <span className="num">{line.widthM}</span> ×{" "}
          <span className="num">{line.lengthM}</span> ={" "}
          <span className="num">{line.sqm ?? "—"}</span> {t("common.sqm")}
        </p>
      </div>

      <div className="text-muted-foreground flex flex-wrap gap-x-6 gap-y-1 text-start text-xs">
        <span>
          {t("quotations.detail.unitPrice")}:{" "}
          <Money value={line.unitPrice} sar={t("common.sar")} />
        </span>
        <span>
          {t("quotations.detail.lineTotal")}:{" "}
          <Money value={line.lineTotal} sar={t("common.sar")} />
        </span>
        {/* No rate beside it: VAT is fixed at 15% and never editable `S57`,
            so the figure is the only thing that varies. */}
        <span>
          {t("quotations.detail.vatAmount")}:{" "}
          <Money value={line.vatAmount} sar={t("common.sar")} />
        </span>
      </div>

      {editable ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            {/* **`open:w-full` is layout rather than decoration**, and it is
                the caller's now that `Disclosure` is shared. Shut, the
                disclosure sits inline beside Remove; open, it claims the whole
                row so nine fields are not squeezed into a flex item beside a
                button, and Remove wraps beneath. `[open]` is a CSS selector,
                so the browser's own toggling keeps it true without React being
                told `D20`. */}
            <Disclosure
              label={t("common.edit")}
              open={rejected(updateState)}
              act="edit-line"
              className="open:w-full"
            >
              <form
                action={update}
                data-act="update-line"
                className="flex flex-col gap-3"
              >
                <LineFields
                  options={options}
                  locale={locale}
                  idPrefix={`line-${line.id}`}
                  defaults={line}
                  errors={updateState.fieldErrors ?? {}}
                />
                <RowError state={updateState} />
                <div>
                  <Button type="submit" size="xs" disabled={updating}>
                    {updating ? t("common.saving") : t("common.save")}
                  </Button>
                </div>
              </form>
            </Disclosure>
            <form action={remove} data-act="remove-line">
              <Button
                type="submit"
                size="xs"
                variant="ghost"
                disabled={removing}
              >
                {t("common.remove")}
              </Button>
            </form>
          </div>
          <RowError state={removeState} />
        </>
      ) : null}
    </div>
  );
}

function ServiceLine({
  service,
  updateService,
  removeService,
  services,
  lines,
  locale,
  editable,
}: {
  service: ServiceRow;
  /** Both already bound by `ThreadLines` — `WORKFLOW §5`. */
  updateService: FieldAction;
  removeService: PlainAction;
  services: NamedOption[];
  lines: LineRow[];
  locale: string;
  editable: boolean;
}) {
  const t = useTranslations();
  const [updateState, update, updating] = useActionState(
    updateService,
    emptyFormState,
  );
  const [removeState, remove, removing] = useActionState(
    removeService,
    emptyFormState,
  );

  const appliesTo = lines.find((line) => line.id === service.quotationLineId);

  return (
    <div className="flex flex-col gap-3 border-t py-4 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="text-start text-sm font-medium">
          {locale === "ar"
            ? service.serviceNameAr || service.serviceNameEn
            : service.serviceNameEn}
        </p>
        <p className="text-muted-foreground text-start text-xs" dir="ltr">
          <span className="num">{service.quantity}</span> {t("common.sqm")}
        </p>
      </div>

      <div className="text-muted-foreground flex flex-wrap gap-x-6 gap-y-1 text-start text-xs">
        <span>
          {t("quotations.detail.unitPrice")}:{" "}
          <Money value={service.unitPrice} sar={t("common.sar")} />
        </span>
        <span>
          {t("quotations.detail.lineTotal")}:{" "}
          <Money value={service.lineTotal} sar={t("common.sar")} />
        </span>
        <span>
          {t("quotations.detail.appliesTo")}:{" "}
          {appliesTo
            ? lineLabel(appliesTo, locale)
            : t("quotations.detail.wholeQuotation")}
        </span>
      </div>

      {editable ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Disclosure
              label={t("common.edit")}
              open={rejected(updateState)}
              act="edit-service"
              className="open:w-full"
            >
              <form
                action={update}
                data-act="update-service"
                className="flex flex-col gap-3"
              >
                <ServiceFields
                  services={services}
                  locale={locale}
                  idPrefix={`service-${service.id}`}
                  defaults={service}
                  errors={updateState.fieldErrors ?? {}}
                />
                <AppliesToField
                  id={`service-${service.id}-appliesTo`}
                  lines={lines}
                  locale={locale}
                  defaultValue={service.quotationLineId}
                />
                <RowError state={updateState} />
                <div>
                  <Button type="submit" size="xs" disabled={updating}>
                    {updating ? t("common.saving") : t("common.save")}
                  </Button>
                </div>
              </form>
            </Disclosure>
            <form action={remove} data-act="remove-service">
              <Button
                type="submit"
                size="xs"
                variant="ghost"
                disabled={removing}
              >
                {t("common.remove")}
              </Button>
            </form>
          </div>
          <RowError state={removeState} />
        </>
      ) : null}
    </div>
  );
}

/** A service may optionally name the product line it applies to `[08 D4]`. */
function AppliesToField({
  id,
  lines,
  locale,
  defaultValue,
}: {
  id: string;
  lines: LineRow[];
  locale: string;
  defaultValue?: string | null;
}) {
  const t = useTranslations();
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} className="text-muted-foreground text-start text-xs">
        {t("quotations.detail.appliesTo")}
      </Label>
      <select
        id={id}
        name="quotationLineId"
        defaultValue={defaultValue ?? ""}
        className={selectClasses}
      >
        <option value="">{t("quotations.detail.wholeQuotation")}</option>
        {lines.map((line) => (
          <option key={line.id} value={line.id}>
            {lineLabel(line, locale)}
          </option>
        ))}
      </select>
    </div>
  );
}

/** The add-a-product-line form, so its hook sits below the `.bind()`. */
function AddLineForm({
  add,
  options,
  locale,
}: {
  add: FieldAction;
  options: ProductOptions;
  locale: string;
}) {
  const t = useTranslations();
  const [state, action, pending] = useActionState(add, emptyFormState);

  return (
    <Disclosure
      label={t("quotations.detail.addLine")}
      open={rejected(state)}
      act="add-line-disclosure"
      className="open:w-full"
    >
      <form action={action} data-act="add-line" className="flex flex-col gap-3">
        <LineFields
          options={options}
          locale={locale}
          idPrefix="new-line"
          errors={state.fieldErrors ?? {}}
        />
        <RowError state={state} />
        <div>
          <Button type="submit" size="xs" disabled={pending}>
            {pending ? t("common.saving") : t("common.add")}
          </Button>
        </div>
      </form>
    </Disclosure>
  );
}

/** The add-a-service form, for `AddLineForm`'s reason. */
function AddServiceForm({
  add,
  services,
  lines,
  locale,
}: {
  add: FieldAction;
  services: NamedOption[];
  lines: LineRow[];
  locale: string;
}) {
  const t = useTranslations();
  const [state, action, pending] = useActionState(add, emptyFormState);

  return (
    <Disclosure
      label={t("quotations.detail.addService")}
      open={rejected(state)}
      act="add-service-disclosure"
      className="open:w-full"
    >
      <form
        action={action}
        data-act="add-service"
        className="flex flex-col gap-3"
      >
        <ServiceFields
          services={services}
          locale={locale}
          idPrefix="new-service"
          errors={state.fieldErrors ?? {}}
        />
        <AppliesToField id="new-service-appliesTo" lines={lines} locale={locale} />
        <RowError state={state} />
        <div>
          <Button type="submit" size="xs" disabled={pending}>
            {pending ? t("common.saving") : t("common.add")}
          </Button>
        </div>
      </form>
    </Disclosure>
  );
}

export function ThreadLines({
  threadId,
  lines,
  serviceLines,
  options,
  services,
  locale,
  editable,
}: {
  threadId: string;
  lines: LineRow[];
  serviceLines: ServiceRow[];
  options: ProductOptions;
  services: NamedOption[];
  locale: string;
  editable: boolean;
}) {
  const t = useTranslations();

  // **No `useActionState` here.** Every form below owns its own hook and
  // receives its action already bound — `WORKFLOW §5`'s hang, and
  // `ThreadActions` is the same shape for the same reason.

  const unpriced = lines.some((line) => !line.unitPrice);

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col">
        {lines.map((line) => (
          <ProductLine
            key={line.id}
            line={line}
            // Bound HERE, not in the row — `WORKFLOW §5`.
            updateLine={updateQuotationLineAction.bind(null, threadId, line.id)}
            removeLine={removeQuotationLineAction.bind(null, threadId, line.id)}
            options={options}
            locale={locale}
            editable={editable}
          />
        ))}

        {/* `S58` — a line with no price contributes nothing and the screen says
            so, rather than showing a total quietly missing a line. */}
        {unpriced ? (
          <p className="text-muted-foreground mt-3 text-start text-xs">
            {t("quotations.detail.unpricedLines")}
          </p>
        ) : null}

        {editable ? (
          <div className="mt-4 border-t pt-4">
            <AddLineForm
              add={addQuotationLineAction.bind(null, threadId)}
              options={options}
              locale={locale}
            />
          </div>
        ) : null}
      </section>

      <section className="flex flex-col">
        <h3 className="text-start text-sm font-medium">
          {t("quotations.detail.serviceLines")}
        </h3>

        {serviceLines.length === 0 ? (
          <p className="text-muted-foreground mt-2 text-start text-sm">
            {t("quotations.detail.noServiceLines")}
          </p>
        ) : (
          <div className="mt-2 flex flex-col">
            {serviceLines.map((service) => (
              <ServiceLine
                key={service.id}
                service={service}
                // Bound HERE, not in the row — `WORKFLOW §5`.
                updateService={updateServiceLineAction.bind(
                  null,
                  threadId,
                  service.id,
                )}
                removeService={removeServiceLineAction.bind(
                  null,
                  threadId,
                  service.id,
                )}
                services={services}
                lines={lines}
                locale={locale}
                editable={editable}
              />
            ))}
          </div>
        )}

        {/* **No `disabled` on the way in.** The add control used to be a button
            disabled when the lookup table was empty, which `D20`'s scan reads
            as a field nobody can reach; there are service types seeded, and a
            form the server would refuse is refused by the server `S109`. */}
        {editable && services.length > 0 ? (
          <div className="mt-4 border-t pt-4">
            <AddServiceForm
              add={addServiceLineAction.bind(null, threadId)}
              services={services}
              lines={lines}
              locale={locale}
            />
          </div>
        ) : null}
      </section>
    </div>
  );
}
