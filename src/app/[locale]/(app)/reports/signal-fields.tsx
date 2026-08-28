"use client";

import { useTranslations } from "next-intl";

import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { Disclosure } from "../_components/disclosure";

export type SignalValue = { signal: string; reference: string | null };

/**
 * The signal multi-select `[20 §4]`.
 *
 * **A signal is not an outcome.** The outcome says what happened in the funnel;
 * a signal says what the customer told us that the business needs to know, and
 * both can be true at once — a customer can say a competitor is cheaper and
 * still buy. That is why this is a separate, optional list rather than more
 * values on the outcome select.
 *
 * The checkbox posts repeated `signals` values, read with `formData.getAll`,
 * and the reference travels in a per-signal field name so the two cannot fall
 * out of order — the trap `18` hit when split percentages were matched by
 * submission order. `createReportAction` reads a reference only for a signal
 * that posted, so a reference typed against a box later unticked is never read.
 *
 * ## Two things changed in `38c`, and the second was shipping on every device
 *
 * **It is behind a `Disclosure`** `D46`. Nine rows were ~530px of a ~1500px
 * form at 375 — a third of the screen for the one block most reports leave
 * empty — and the text box `S32` calls the point of the form started below the
 * fold. The summary carries the count, so a rep who has raised one sees it
 * without opening. **At every width, not below `md`:** a closed `<details>`
 * hides its non-summary children through a slot or `::details-content` and
 * author CSS cannot reliably re-show them, which `app-rail.tsx` records in the
 * same words. Closed-on-a-phone-open-on-a-laptop is not a thing a native
 * disclosure can be, and `D24` says the form archetype is built phone-first
 * anyway — the laptop reader is the same rep.
 *
 * **The reference input renders whether or not the box is ticked**, and is
 * revealed by `peer-checked` rather than by client state. It used to render on
 * `takesReference && on`, with `on` held in `useState`: **scripts off, a rep
 * could not record a competitor's name at all, on any device.** That is
 * enablement, which `D20` forbids, and it is the same cure `report-form.tsx`
 * already applies to `onHoldUntil` — *rendered always rather than revealed by
 * JavaScript*. `checkbox.tsx` already carries `peer`, `peer-checked:` compiles
 * to a general sibling combinator, and a field a native tick reveals needs no
 * bundle to reach.
 *
 * **`§23` could not have caught it**, and that is structural rather than a bad
 * assertion: the operability scan reads the HTML and names required fields with
 * no control, and a field gated on client state **is not in the markup at all**,
 * so its absence is indistinguishable from a form that never had it. The shape
 * is a `WORKFLOW §5` row of its own.
 *
 * This keeps `"use client"`: `Label` and `Input` both carry one, and the parent
 * form is a client component regardless. What it no longer keeps is **state** —
 * `useState`, `checked` and `toggle` are gone, and with them the only reason a
 * field's existence depended on a bundle.
 */
export function SignalFields({
  signals,
  signalsWithReference,
  selected,
  error,
}: {
  signals: readonly string[];
  signalsWithReference: readonly string[];
  selected: SignalValue[];
  error?: string;
}) {
  const t = useTranslations();
  const held = new Map(selected.map((row) => [row.signal, row.reference]));

  return (
    <Disclosure
      act="report-signals"
      // Open where there is something to see or something to fix. A rejected
      // form must not hide the field it was rejected for.
      open={selected.length > 0 || Boolean(error)}
      label={
        selected.length > 0
          ? t("reports.detail.signalsSummary", { count: selected.length })
          : t("reports.detail.signalsSummaryNone")
      }
    >
      {/* The `<legend>` is not redundant with the summary for a screen reader:
          the summary names the disclosure, the legend names the group the nine
          inputs belong to. It is `sr-only` because sighted readers have just
          read the same words on the control they pressed. */}
      <fieldset data-slot="report-signals-set" className="flex flex-col gap-2">
        <legend className="sr-only">{t("reports.fields.signals")}</legend>
        <p className="text-muted-foreground text-start text-xs">
          {t("reports.detail.signalsHint")}
        </p>

        <ul className="flex flex-col divide-y">
          {signals.map((signal) => {
            const takesReference = signalsWithReference.includes(signal);
            return (
              // A grid rather than nested rows, so the reference input is a
              // SIBLING of the checkbox — `peer-checked:` is a general sibling
              // combinator and cannot reach out of a wrapper.
              <li
                key={signal}
                data-signal={signal}
                className="grid grid-cols-[auto_1fr] items-center gap-x-3 py-1"
              >
                <Checkbox
                  id={`signal-${signal}`}
                  name="signals"
                  value={signal}
                  defaultChecked={held.has(signal)}
                />
                {/* `D74` — the rule exempts the box *because* the label is the
                    target a thumb lands on, and the label was its own text
                    height inside a 44px row: a thumb landing 12px high or low
                    hit nothing, nine times. The floor goes on the label itself
                    so the claim is true. Below `md` only — `D22`'s laptop
                    density stays. */}
                <Label
                  htmlFor={`signal-${signal}`}
                  className="text-start max-md:min-h-11"
                >
                  {t(`enums.reportSignal.${signal}`)}
                </Label>
                {takesReference ? (
                  <Input
                    name={`signalReference.${signal}`}
                    defaultValue={held.get(signal) ?? ""}
                    placeholder={t(`reports.signalReference.${signal}`)}
                    className="col-span-2 mb-2 hidden text-start peer-checked:block"
                  />
                ) : null}
              </li>
            );
          })}
        </ul>

        {error ? (
          <p role="alert" className="text-destructive text-start text-xs">
            {t(error)}
          </p>
        ) : null}
      </fieldset>
    </Disclosure>
  );
}
