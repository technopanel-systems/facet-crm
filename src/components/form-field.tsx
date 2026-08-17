"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";

import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * The form archetype `[22 §3]`: single column, labels above controls, errors
 * under the control, **actions in a footer bar**.
 *
 * `CardFooter` already renders as `border-t bg-muted/50` — the footer bar the
 * archetype asks for, built and used by nothing until now.
 *
 * **The measure is NOT here.** It belongs on the page wrapper, because
 * `PageHeader` is a sibling of the form on all thirteen form pages: capping
 * the card alone would leave the title at one edge of a 1320px column and its
 * action ~1250px away, over a 672px form.
 *
 * `wide` is the stated exception `[22 §3]`: quotation lines, report signals
 * and handover buckets are repeating rows — a table-shaped input rather than a
 * field stack — so they keep the content column and their row grids. Only
 * their actions move to the footer.
 */
export function FormShell({
  action,
  error,
  actions,
  wide,
  children,
}: {
  action: (formData: FormData) => void;
  /** A whole-form error key from the server action, never text `[07 E3]`. */
  error?: string;
  actions: ReactNode;
  wide?: boolean;
  children: ReactNode;
}) {
  const t = useTranslations();

  return (
    <form action={action} data-slot="form-shell">
      <Card>
        <CardContent
          className={cn("flex flex-col", wide ? "gap-6" : "gap-5")}
        >
          {error ? (
            <p role="alert" className="text-destructive text-start text-sm">
              {t(error)}
            </p>
          ) : null}
          {children}
        </CardContent>
        <CardFooter className="gap-2">{actions}</CardFooter>
      </Card>
    </form>
  );
}

/**
 * Label + control + error, for the hand-rolled forms.
 *
 * `error` is a **translation key**, never text — the server action returns
 * keys `[07 E3]` and this is where `t()` is finally called.
 */
export function FormField({
  name,
  label,
  error,
  hint,
  required,
  children,
}: {
  name: string;
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
}) {
  const t = useTranslations();

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={name} className="text-start">
        {label}
        {required ? (
          <span aria-hidden className="text-destructive">
            *
          </span>
        ) : null}
      </Label>
      {children}
      {hint && !error ? (
        <p className="text-muted-foreground text-start text-xs">{hint}</p>
      ) : null}
      {error ? (
        <p
          id={`${name}-error`}
          role="alert"
          className="text-destructive text-start text-xs"
        >
          {t(error)}
        </p>
      ) : null}
    </div>
  );
}

/**
 * A native `<select>` rather than the Radix one, deliberately.
 *
 * These forms post to server actions as plain HTML, so a native control needs
 * no hidden-input bridge, no client state, and no JavaScript to submit. The
 * browser also handles RTL popup placement for free. Radix `Select` can
 * replace this later without touching a single action.
 *
 * **One field is now an exception: the city** `[15 §5]`. A list of roughly two
 * hundred cities is unusable as a plain dropdown, so it uses
 * `components/ui/combobox`. That reversal is scoped to that control — every
 * short list on these forms still belongs here, and the reasoning above is
 * unchanged for them.
 */
export function SelectField({
  name,
  defaultValue,
  placeholder,
  disabled,
  invalid,
  required,
  onChange,
  children,
}: {
  name: string;
  defaultValue?: string | null;
  placeholder: string;
  disabled?: boolean;
  invalid?: boolean;
  /** The native attribute, which makes the browser refuse the placeholder
   *  option — its value is `""`. Off by default: most selects here are
   *  genuinely optional. The server still validates; this only saves the rep a
   *  round trip. */
  required?: boolean;
  /** For the rare field that reveals another one. The select stays
   *  uncontrolled, so `defaultValue` still wins after a rejected submit. */
  onChange?: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <select
      id={name}
      name={name}
      defaultValue={defaultValue ?? ""}
      disabled={disabled}
      required={required}
      onChange={onChange ? (event) => onChange(event.target.value) : undefined}
      aria-invalid={invalid || undefined}
      aria-describedby={invalid ? `${name}-error` : undefined}
      className={cn(
        "border-input bg-background text-foreground h-8 w-full rounded-lg border",
        "ps-3 pe-8 text-start text-sm shadow-xs outline-none",
        "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-3",
        "aria-invalid:border-destructive aria-invalid:ring-destructive/20",
        "disabled:cursor-not-allowed disabled:opacity-50",
      )}
    >
      <option value="">{placeholder}</option>
      {children}
    </select>
  );
}
