"use client";

import { useActionState, useState } from "react";
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
 * Editing is offered **only while the version is `requested`**. Once the
 * coordinator has issued it the document exists in SMAC, and a change is a new
 * version rather than an edit `[07 C2]`. The server enforces that; this only
 * stops offering it.
 */

export type LineRow = {
  id: string;
  supplierId: string;
  classId: string;
  fireRatingId: string;
  colourId: string | null;
  customColour: string | null;
  thicknessId: string;
  widthM: string;
  lengthM: string;
  quantityPcs: string;
  sqm: string | null;
  unitPrice: string | null;
  lineTotal: string | null;
  vatRate: string | null;
  vatAmount: string | null;
  displayName: string;
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

function Money({ value, sar }: { value: string | null; sar: string }) {
  if (!value) return <span className="text-muted-foreground">—</span>;
  return (
    <span dir="ltr">
      {value} {sar}
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
  threadId,
  line,
  options,
  locale,
  editable,
}: {
  threadId: string;
  line: LineRow;
  options: ProductOptions;
  locale: string;
  editable: boolean;
}) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const [updateState, update, updating] = useActionState(
    updateQuotationLineAction.bind(null, threadId, line.id),
    emptyFormState,
  );
  const [removeState, remove, removing] = useActionState(
    removeQuotationLineAction.bind(null, threadId, line.id),
    emptyFormState,
  );

  return (
    <div className="flex flex-col gap-3 border-t py-4 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="text-start text-sm font-medium" dir="ltr">
          {line.displayName}
        </p>
        <p className="text-muted-foreground text-start text-xs" dir="ltr">
          {line.quantityPcs} × {line.widthM} × {line.lengthM} ={" "}
          {line.sqm ?? "—"} {t("common.sqm")}
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
        <span>
          {t("quotations.detail.vatAmount")}
          {line.vatRate ? ` (${line.vatRate}%)` : ""}:{" "}
          <Money value={line.vatAmount} sar={t("common.sar")} />
        </span>
      </div>

      {editable ? (
        <>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="xs"
              variant="ghost"
              aria-expanded={open}
              onClick={() => setOpen((value) => !value)}
            >
              {t("common.edit")}
            </Button>
            <form action={remove}>
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

          {open ? (
            <form action={update} className="flex flex-col gap-3">
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
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function ServiceLine({
  threadId,
  service,
  services,
  lines,
  locale,
  editable,
}: {
  threadId: string;
  service: ServiceRow;
  services: NamedOption[];
  lines: LineRow[];
  locale: string;
  editable: boolean;
}) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const [updateState, update, updating] = useActionState(
    updateServiceLineAction.bind(null, threadId, service.id),
    emptyFormState,
  );
  const [removeState, remove, removing] = useActionState(
    removeServiceLineAction.bind(null, threadId, service.id),
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
          {service.quantity} {t("common.sqm")}
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
          {appliesTo ? appliesTo.displayName : t("quotations.detail.wholeQuotation")}
        </span>
      </div>

      {editable ? (
        <>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="xs"
              variant="ghost"
              aria-expanded={open}
              onClick={() => setOpen((value) => !value)}
            >
              {t("common.edit")}
            </Button>
            <form action={remove}>
              <Button type="submit" size="xs" variant="ghost" disabled={removing}>
                {t("common.remove")}
              </Button>
            </form>
          </div>
          <RowError state={removeState} />

          {open ? (
            <form action={update} className="flex flex-col gap-3">
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
                defaultValue={service.quotationLineId}
              />
              <RowError state={updateState} />
              <div>
                <Button type="submit" size="xs" disabled={updating}>
                  {updating ? t("common.saving") : t("common.save")}
                </Button>
              </div>
            </form>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

/** A service may optionally name the product line it applies to `[08 D4]`. */
function AppliesToField({
  id,
  lines,
  defaultValue,
}: {
  id: string;
  lines: LineRow[];
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
            {line.displayName}
          </option>
        ))}
      </select>
    </div>
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
  const [addingLine, setAddingLine] = useState(false);
  const [addingService, setAddingService] = useState(false);
  const [addLineState, addLine, addingLinePending] = useActionState(
    addQuotationLineAction.bind(null, threadId),
    emptyFormState,
  );
  const [addServiceState, addService, addingServicePending] = useActionState(
    addServiceLineAction.bind(null, threadId),
    emptyFormState,
  );

  const unpriced = lines.some((line) => !line.unitPrice);

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col">
        {lines.map((line) => (
          <ProductLine
            key={line.id}
            threadId={threadId}
            line={line}
            options={options}
            locale={locale}
            editable={editable}
          />
        ))}

        {unpriced ? (
          <p className="text-muted-foreground mt-3 text-start text-xs">
            {t("quotations.detail.unpricedLines")}
          </p>
        ) : null}

        {editable ? (
          <div className="mt-4 border-t pt-4">
            {addingLine ? (
              <form action={addLine} className="flex flex-col gap-3">
                <LineFields
                  options={options}
                  locale={locale}
                  idPrefix="new-line"
                  errors={addLineState.fieldErrors ?? {}}
                />
                <RowError state={addLineState} />
                <div className="flex items-center gap-2">
                  <Button type="submit" size="xs" disabled={addingLinePending}>
                    {addingLinePending ? t("common.saving") : t("common.add")}
                  </Button>
                  <Button
                    type="button"
                    size="xs"
                    variant="ghost"
                    onClick={() => setAddingLine(false)}
                  >
                    {t("common.cancel")}
                  </Button>
                </div>
              </form>
            ) : (
              <Button
                type="button"
                size="xs"
                variant="outline"
                onClick={() => setAddingLine(true)}
              >
                {t("quotations.detail.addLine")}
              </Button>
            )}
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
                threadId={threadId}
                service={service}
                services={services}
                lines={lines}
                locale={locale}
                editable={editable}
              />
            ))}
          </div>
        )}

        {editable ? (
          <div className="mt-4 border-t pt-4">
            {addingService ? (
              <form action={addService} className="flex flex-col gap-3">
                <ServiceFields
                  services={services}
                  locale={locale}
                  idPrefix="new-service"
                  errors={addServiceState.fieldErrors ?? {}}
                />
                <AppliesToField id="new-service-appliesTo" lines={lines} />
                <RowError state={addServiceState} />
                <div className="flex items-center gap-2">
                  <Button
                    type="submit"
                    size="xs"
                    disabled={addingServicePending}
                  >
                    {addingServicePending ? t("common.saving") : t("common.add")}
                  </Button>
                  <Button
                    type="button"
                    size="xs"
                    variant="ghost"
                    onClick={() => setAddingService(false)}
                  >
                    {t("common.cancel")}
                  </Button>
                </div>
              </form>
            ) : (
              <Button
                type="button"
                size="xs"
                variant="outline"
                disabled={services.length === 0}
                onClick={() => setAddingService(true)}
              >
                {t("quotations.detail.addService")}
              </Button>
            )}
          </div>
        ) : null}
      </section>
    </div>
  );
}
