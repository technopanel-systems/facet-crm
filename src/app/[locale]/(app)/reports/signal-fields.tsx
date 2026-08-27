"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
 * The reference input appears only for the four signals that invite one, and
 * that is a **form** concern: every signal may carry a reference in the
 * database. The checkbox posts repeated `signals` values, read with
 * `formData.getAll`, and the reference travels in a per-signal field name so
 * the two cannot fall out of order — the trap `18` hit when split percentages
 * were matched by submission order.
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
  const [checked, setChecked] = useState<Set<string>>(
    new Set(selected.map((row) => row.signal)),
  );

  const toggle = (signal: string, on: boolean) => {
    setChecked((previous) => {
      const next = new Set(previous);
      if (on) next.add(signal);
      else next.delete(signal);
      return next;
    });
  };

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-start text-sm font-medium">
        {t("reports.fields.signals")}
      </legend>
      <p className="text-muted-foreground text-start text-xs">
        {t("reports.detail.signalsHint")}
      </p>

      <ul className="flex flex-col divide-y">
        {signals.map((signal) => {
          const on = checked.has(signal);
          const takesReference = signalsWithReference.includes(signal);
          return (
            <li key={signal} className="flex flex-col gap-2 py-2.5">
              <div className="flex min-h-11 items-center gap-3">
                <Checkbox
                  id={`signal-${signal}`}
                  name="signals"
                  value={signal}
                  defaultChecked={on}
                  onChange={(event) => toggle(signal, event.target.checked)}
                />
                <Label htmlFor={`signal-${signal}`} className="text-start">
                  {t(`enums.reportSignal.${signal}`)}
                </Label>
              </div>
              {takesReference && on ? (
                <Input
                  name={`signalReference.${signal}`}
                  defaultValue={held.get(signal) ?? ""}
                  placeholder={t(`reports.signalReference.${signal}`)}
                  className="h-11 text-start text-base"
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
  );
}
