"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";

import {
  FormField,
  FormShell,
  SelectField,
} from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "@/i18n/navigation";
import {
  SHIPMENT_METHODS,
  STOCKS,
  type ShipmentMethod,
  type Stock,
} from "@/lib/enums";
import { emptyFormState, type FormState } from "@/lib/validation";

import {
  LineFields,
  type LineDefaults,
  type ProductOptions,
} from "../quotations/line-fields";

type Action = (state: FormState, formData: FormData) => Promise<FormState>;

/**
 * Option types are re-declared here rather than imported from the data
 * modules: this is a client component, and a value import from `@/lib/...`
 * would bundle the Postgres driver for the browser — a failure only
 * `npm run build` catches.
 */
export type ThreadOption = {
  id: string;
  label: string;
  companyLabel: string;
  raisedByName: string;
  quotedSqm: string | null;
  dispatchedSqm: string;
  /** `S74` — the quotation's own project, already translated. Null when it
   *  has none `S50`, which is what puts the picker on this form. */
  projectLabel: string | null;
  /**
   * `S118` — the quotation's own stock, offered as the **default** for the
   * dispatch's `S130`. A default and nothing more: *a dispatch may draw from a
   * different stock*, so the select stays a select.
   */
  stock: Stock;
  /**
   * `S116` — the issued version's lines `S126`, which is what *"arrives
   * pre-filled with its lines"* means on a screen. An unpriced quotation line
   * `S58` arrives with an empty price, which is the box the rep must fill.
   */
  lines: LineDefaults[];
};

export type CompanyOption = { id: string; label: string };
export type RepOption = { id: string; name: string };
export type ProjectOption = { id: string; label: string };

/**
 * `S130` and `S119`'s three fields, rendered identically by the request form
 * and the edit form.
 *
 * **One component rather than two copies**, for the reason `assertShipment`
 * exists in the data layer: the raise and the edit write the same three
 * columns, and a second copy of the layout drifts.
 *
 * **The CT rule is a hint, not a filtered list.** *South or Dammam stock is
 * CT* `S119`, and the shipment select still offers all three: removing options
 * when the stock changes would silently rewrite a choice the rep had already
 * made, and the browser gives no way to say why an option vanished. The hint
 * states the rule before the click and the data layer refuses it against the
 * field after — `assertShipment` and `dispatches_stock_shipment`.
 *
 * **The destination appears only for Cargo**, which is the one place this
 * needs client state. Rendering it always and dropping what it holds on a CT
 * dispatch is exactly the project form's region defect (`AUDIT 1 F3`): the
 * value vanished with no error at all. Here the field is not offered, and if a
 * hand-made POST sends one anyway the server refuses rather than discards.
 */
function ShipmentFields({
  stock,
  shipment,
  cargoDestination,
  errors,
}: {
  stock: Stock | "";
  shipment: ShipmentMethod | "";
  cargoDestination: string;
  errors: Record<string, string>;
}) {
  const t = useTranslations();
  // The only new client state on this screen. `stock` needs none: nothing
  // renders differently for it, because the CT rule is a hint.
  const [chosen, setChosen] = useState<string>(shipment);

  return (
    <>
      {/* `S130` — the dispatch's own stock, which may differ from its
          quotation's `S118`. A fixed list of four, so a native `<select>`
          `D20`; the city combobox exception is scoped to two hundred items. */}
      <FormField
        name="stock"
        label={t("dispatches.fields.stock")}
        error={errors.stock}
        hint={t("dispatches.detail.stockHint")}
        required
      >
        <SelectField
          name="stock"
          defaultValue={stock}
          placeholder={t("common.none")}
          required
          invalid={Boolean(errors.stock)}
        >
          {STOCKS.map((value) => (
            <option key={value} value={value}>
              {t(`enums.stock.${value}`)}
            </option>
          ))}
        </SelectField>
      </FormField>

      {/* `S119` — CT, TT or Cargo, chosen by the rep when requesting. */}
      <FormField
        name="shipment"
        label={t("dispatches.fields.shipment")}
        error={errors.shipment}
        hint={t("dispatches.detail.shipmentHint")}
        required
      >
        <SelectField
          name="shipment"
          defaultValue={shipment}
          onChange={setChosen}
          placeholder={t("common.none")}
          required
          invalid={Boolean(errors.shipment)}
        >
          {SHIPMENT_METHODS.map((value) => (
            <option key={value} value={value}>
              {t(`enums.shipmentMethod.${value}`)}
            </option>
          ))}
        </SelectField>
      </FormField>

      {/* `S119` — *Cargo carries a destination note*, and it is optional. */}
      {chosen === "cargo" ? (
        <FormField
          name="cargoDestination"
          label={t("dispatches.fields.cargoDestination")}
          error={errors.cargoDestination}
          hint={t("dispatches.detail.cargoDestinationHint")}
        >
          <Input
            id="cargoDestination"
            name="cargoDestination"
            defaultValue={cargoDestination}
            // A place name may be written in either script `D62`.
            dir="auto"
            className="text-start"
            aria-invalid={Boolean(errors.cargoDestination) || undefined}
          />
        </FormField>
      ) : null}
    </>
  );
}

/**
 * Recording a dispatch. Two modes, and the difference between them is the
 * whole of `07 C6`.
 *
 * **The mode is a URL parameter, not client state.** The direct mode needs to
 * search for a company, and a search that lives in the URL is shareable,
 * survives a reload and needs no JavaScript — the same reasoning `SearchForm`
 * already follows. Only the submit path is a client action.
 *
 * **The project and the LINES follow the chosen quotation** `S74` `S116`,
 * which is the one thing here that IS client state: the quotation carrying a
 * project shows it and offers nothing to change, the quotation with none `S50`
 * shows a picker, and the rows fill with the issued version's lines. The server
 * decides the project either way — it derives it from the thread and refuses a
 * disagreeing one — so that half only spares the coordinator a field they may
 * not answer.
 *
 * **The three routes of `S75` are two entry points here.** Keeping the
 * prefilled rows is *exactly as a quotation*; changing, adding or removing one
 * is *from a quotation, with edits*; the direct mode starts on one empty row
 * and is *a free entry*. Nothing marks which happened, and nothing should:
 * `S120` flags a dispatch whose VALUES differ from its quotation, not one
 * somebody typed in.
 *
 * Each thread's lines travel with its option rather than through a second
 * navigation — the same client state the project field already uses. The row
 * count follows the chosen quotation, so `linesKey` re-mounts the rows when it
 * changes: React would otherwise keep the previous quotation's typed values in
 * inputs that are now describing a different one.
 */
export function DispatchForm({
  action,
  mode,
  threads,
  companies,
  reps,
  canNameRep,
  projects,
  products,
  locale,
  companyQuery,
  today,
}: {
  action: Action;
  mode: "linked" | "direct";
  threads: ThreadOption[];
  companies: CompanyOption[];
  reps: RepOption[];
  /**
   * `S108` — whether to ask who the dispatch credits at all. A rep raising
   * their own request is not asked: the system knows who they are, and the
   * server derives it. Only a `can_dispatch` holder may name somebody else,
   * which is `S123`'s *"created for a rep by the coordinator"*.
   *
   * Presentation only. `requestDispatch` refuses a named rep from anyone
   * without the flag, so this hides a field rather than being the rule.
   */
  canNameRep: boolean;
  projects: ProjectOption[];
  products: ProductOptions;
  locale: string;
  companyQuery: string;
  today: string;
}) {
  const t = useTranslations();
  const [state, formAction, pending] = useActionState(action, emptyFormState);
  const errors = state.fieldErrors ?? {};
  const [threadId, setThreadId] = useState(
    state.values?.quotationThreadId ?? "",
  );
  const thread = threads.find((row) => row.id === threadId);

  // `S116` — the chosen quotation's lines, or one empty row to type into.
  // `rowCount` is state rather than a derived length because both directions
  // are real: *a dispatch may add a product the quotation never had*, and a
  // partial dispatch may carry fewer lines than were quoted `[04 quantities]`.
  // It is reset where the quotation is chosen, which is the only place the
  // right number is known.
  const prefilled = mode === "linked" && thread ? thread.lines : [];
  const [rowCount, setRowCount] = useState(Math.max(1, prefilled.length));
  const lineDefaults = Array.from(
    { length: rowCount },
    (_, index): LineDefaults | undefined => prefilled[index],
  );
  // Re-mounts the rows when the quotation changes: React would otherwise keep
  // the previous quotation's values in inputs now describing a different one.
  const linesKey = `${mode}-${threadId}`;

  return (
    <FormShell
      action={formAction}
      error={state.error}
      wide
      actions={
        <>
          <Button type="submit" disabled={pending}>
            {/* `S72` — the act is a REQUEST. Nothing has gone out yet, and the
                button that said "record" said the opposite. */}
            {pending ? t("common.saving") : t("dispatches.actions.request")}
          </Button>
          <Button asChild type="button" variant="ghost">
            <Link href="/dispatches">{t("common.cancel")}</Link>
          </Button>
        </>
      }
    >
      {mode === "linked" ? (
        <>
          <FormField
            name="quotationThreadId"
            label={t("dispatches.fields.quotation")}
            error={errors.quotationThreadId}
            hint={t("dispatches.detail.derivedHint")}
            required
          >
            {/* Uncontrolled, like every other `SelectField`: the state only
                decides which project field appears, so `defaultValue` still
                wins after a rejected submit. */}
            <SelectField
              name="quotationThreadId"
              defaultValue={threadId}
              onChange={(value) => {
                setThreadId(value);
                // `S116` — the new quotation's lines replace the old rows.
                const picked = threads.find((row) => row.id === value);
                setRowCount(Math.max(1, picked?.lines.length ?? 1));
              }}
              placeholder={t("dispatches.fields.quotationPlaceholder")}
              invalid={!!errors.quotationThreadId}
            >
              {threads.map((row) => (
                <option
                  key={row.id}
                  value={row.id}
                  // A DOM handle for `verify:routes`, which may not read a
                  // translated label to tell the two branches apart.
                  data-project={row.projectLabel === null ? "" : "set"}
                >
                  {row.label}
                </option>
              ))}
            </SelectField>
          </FormField>

          {/* `S74` — the project is shown, not chosen, when the quotation has
              one. No input: the server takes it from the quotation, so a field
              here would be a value the coordinator could only get wrong. */}
          {thread && thread.projectLabel !== null ? (
            <FormField
              name="project"
              label={t("dispatches.fields.project")}
              hint={t("dispatches.detail.projectFromQuotation")}
            >
              {/* The label above points at this, and a project name may
                  hold either script `D62`. */}
              <p id="project" dir="auto" className="text-sm font-medium">
                {thread.projectLabel}
              </p>
            </FormField>
          ) : null}

          {/* `S74` — and chosen when it has none `S50`. The hint says the
              second half of the rule out loud, because writing the project
              back onto the quotation is a consequence a coordinator should
              not discover afterwards. */}
          {thread && thread.projectLabel === null ? (
            <FormField
              name="projectId"
              label={t("dispatches.fields.project")}
              error={errors.projectId}
              hint={t("dispatches.detail.projectWriteBack")}
              required
            >
              <SelectField
                name="projectId"
                placeholder={t("dispatches.fields.projectPlaceholder")}
                invalid={!!errors.projectId}
              >
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.label}
                  </option>
                ))}
              </SelectField>
            </FormField>
          ) : null}
        </>
      ) : (
        <>
          <FormField
            name="companyId"
            label={t("dispatches.fields.company")}
            error={errors.companyId}
            hint={t("dispatches.detail.companySearchHint")}
            required
          >
            <SelectField
              name="companyId"
              placeholder={
                companyQuery.length < 2
                  ? t("dispatches.fields.companySearchFirst")
                  : t("dispatches.fields.companyPlaceholder")
              }
              disabled={companies.length === 0}
              invalid={!!errors.companyId}
            >
              {companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.label}
                </option>
              ))}
            </SelectField>
          </FormField>

          {/* `S108` — asked only of someone who may name another rep. */}
          {canNameRep ? (
            <FormField
              name="userId"
              label={t("dispatches.fields.rep")}
              error={errors.userId}
              hint={t("dispatches.detail.repForHint")}
              required
            >
              <SelectField
                name="userId"
                placeholder={t("dispatches.fields.repPlaceholder")}
                invalid={!!errors.userId}
              >
                {reps.map((rep) => (
                  <option key={rep.id} value={rep.id}>
                    {rep.name}
                  </option>
                ))}
              </SelectField>
            </FormField>
          ) : null}
        </>
      )}

      {/* `S130` `S119` — the rep's three choices, and the stock defaults to the
          quotation's `S118` on the linked route. `linesKey` re-mounts them for
          the lines' own reason: React would otherwise keep the previous
          quotation's stock in a select now describing a different one. */}
      <ShipmentFields
        key={`shipment-${linesKey}`}
        stock={(state.values?.stock as Stock) ?? thread?.stock ?? ""}
        shipment={(state.values?.shipment as ShipmentMethod) ?? ""}
        cargoDestination={state.values?.cargoDestination ?? ""}
        errors={errors}
      />

      {/* `S116` — what actually went out. **There is no square-metre field**:
          the figure is the lines' own, generated by the database, so a box to
          type it into would be a second number that could disagree with them.
          `D63`'s repeating row, and `LineFields` is the one that shipped on
          quotation lines rather than a second shape — `S116` says outright
          that a dispatch line IS a quotation line's shape. No service rows:
          a dispatch never carries one. */}
      <fieldset className="flex flex-col gap-4 rounded-lg border p-4">
        <legend className="px-1 text-sm font-medium">
          {t("dispatches.detail.lines")}
        </legend>

        {products.suppliers.length === 0 ? (
          <p role="alert" className="text-destructive text-start text-sm">
            {t("quotations.errors.noSuppliers")}
          </p>
        ) : null}

        <p className="text-muted-foreground text-start text-sm">
          {mode === "linked" && thread
            ? t("dispatches.detail.linesPrefilled")
            : t("dispatches.detail.linesTyped")}
        </p>

        {lineDefaults.map((defaults, index) => (
          <div
            key={`${linesKey}-${index}`}
            className="border-t pt-4 first:border-t-0 first:pt-0"
          >
            <LineFields
              options={products}
              locale={locale}
              idPrefix={`line-${index}`}
              defaults={defaults}
              errors={errors}
            />
          </div>
        ))}

        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="xs"
            variant="outline"
            onClick={() => setRowCount((count) => count + 1)}
          >
            {t("dispatches.detail.addLine")}
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

      <FormField
        name="dispatchDate"
        label={t("dispatches.fields.dispatchDate")}
        error={errors.dispatchDate}
        required
      >
        <Input
          id="dispatchDate"
          name="dispatchDate"
          type="date"
          dir="ltr"
          className="text-start"
          defaultValue={state.values?.dispatchDate ?? today}
          aria-invalid={!!errors.dispatchDate || undefined}
        />
      </FormField>
    </FormShell>
  );
}

/**
 * Editing a request `S125` `S62` — the rep's while it is a draft, the
 * coordinator's once it is submitted.
 *
 * **A separate component rather than a third mode on `DispatchForm`.** The two
 * screens ask different questions: raising one chooses a quotation and what it
 * carries, editing one changes what is already there and cannot change which
 * quotation it is against — `S122` says a request nobody wants is refused, not
 * repointed. Branching the request form three ways to express that would have
 * hidden the difference rather than stating it.
 *
 * What is missing here is the point: no quotation picker, no company, no rep.
 * They are shown as facts on the screen above and cannot be edited.
 */
export function DispatchEditForm({
  action,
  lines,
  dispatchDate,
  stock,
  shipment,
  cargoDestination,
  projectLabel,
  chooseProject,
  projectId,
  projects,
  products,
  locale,
  dispatchId,
}: {
  action: Action;
  /** `S116` — the request's lines as they stand, to be kept or changed. */
  lines: LineDefaults[];
  dispatchDate: string;
  /** `S130` `S119` — as they stand, to be kept or changed. Not defaults from
   *  a quotation: this request already has its own. */
  stock: Stock;
  shipment: ShipmentMethod;
  cargoDestination: string | null;
  /** `S74` — the project it names, when there is one to show. */
  projectLabel: string | null;
  /**
   * `S74` — whether the project is a CHOICE here. True only when the request is
   * against a quotation that has none of its own `S50`: then whoever is editing
   * picks, from the projects they hold, and the write-back happens at approval.
   */
  chooseProject: boolean;
  projectId: string | null;
  projects: ProjectOption[];
  products: ProductOptions;
  locale: string;
  dispatchId: string;
}) {
  const t = useTranslations();
  const [state, formAction, pending] = useActionState(action, emptyFormState);
  const errors = state.fieldErrors ?? {};
  // Both directions are real: a line may be added — *a dispatch may add a
  // product the quotation never had* `S116` — and one may be dropped.
  const [rowCount, setRowCount] = useState(Math.max(1, lines.length));
  const lineDefaults = Array.from(
    { length: rowCount },
    (_, index): LineDefaults | undefined => lines[index],
  );

  return (
    <FormShell
      action={formAction}
      error={state.error}
      wide
      actions={
        <>
          <Button type="submit" disabled={pending}>
            {pending ? t("common.saving") : t("common.save")}
          </Button>
          <Button asChild type="button" variant="ghost">
            <Link href={`/dispatches/${dispatchId}`}>{t("common.cancel")}</Link>
          </Button>
        </>
      }
    >
      {/* `S74` — shown when the quotation carries one, chosen when it does not
          `S50`. Never both, and never neither on a linked request. */}
      {projectLabel !== null && !chooseProject ? (
        <FormField
          name="project"
          label={t("dispatches.fields.project")}
          hint={t("dispatches.detail.projectFromQuotation")}
        >
          <p id="project" dir="auto" className="text-sm font-medium">
            {projectLabel}
          </p>
        </FormField>
      ) : null}

      {chooseProject ? (
        <FormField
          name="projectId"
          label={t("dispatches.fields.project")}
          error={errors.projectId}
          hint={t("dispatches.detail.projectWriteBack")}
          required
        >
          <SelectField
            name="projectId"
            defaultValue={state.values?.projectId ?? projectId ?? ""}
            placeholder={t("dispatches.fields.projectPlaceholder")}
            invalid={!!errors.projectId}
          >
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.label}
              </option>
            ))}
          </SelectField>
        </FormField>
      ) : null}

      {/* `S130` `S119` — *the coordinator may change it until approval*, and
          so may the rep while it is theirs `S125`. The same component the
          request form renders, so the two cannot disagree about the fields. */}
      <ShipmentFields
        stock={(state.values?.stock as Stock) ?? stock}
        shipment={(state.values?.shipment as ShipmentMethod) ?? shipment}
        cargoDestination={state.values?.cargoDestination ?? cargoDestination ?? ""}
        errors={errors}
      />

      {/* `S116` — the same rows the request form writes, so an edit and a
          raise cannot disagree about what a dispatch line is. No square-metre
          field: the figure is generated from these. */}
      <fieldset className="flex flex-col gap-4 rounded-lg border p-4">
        <legend className="px-1 text-sm font-medium">
          {t("dispatches.detail.lines")}
        </legend>

        <p className="text-muted-foreground text-start text-sm">
          {t("dispatches.detail.linesEdit")}
        </p>

        {lineDefaults.map((defaults, index) => (
          <div
            key={`edit-${index}`}
            className="border-t pt-4 first:border-t-0 first:pt-0"
          >
            <LineFields
              options={products}
              locale={locale}
              idPrefix={`line-${index}`}
              defaults={defaults}
              errors={errors}
            />
          </div>
        ))}

        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="xs"
            variant="outline"
            onClick={() => setRowCount((count) => count + 1)}
          >
            {t("dispatches.detail.addLine")}
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

      <FormField
        name="dispatchDate"
        label={t("dispatches.fields.dispatchDate")}
        error={errors.dispatchDate}
        required
      >
        <Input
          id="dispatchDate"
          name="dispatchDate"
          type="date"
          dir="ltr"
          className="text-start"
          defaultValue={state.values?.dispatchDate ?? dispatchDate}
          aria-invalid={!!errors.dispatchDate || undefined}
        />
      </FormField>
    </FormShell>
  );
}
