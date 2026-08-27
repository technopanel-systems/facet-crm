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
    // `data-field` and `data-required` are what `verify:routes` §23 reads: the
    // screen's own declaration of which fields its action needs, in a DOM
    // marker rather than a translated label `D20`. Nothing else in the HTML
    // carries it — a control may render without `required`, and a field the
    // action needs may render with no control at all, which is the case §23
    // exists to catch.
    <div
      className="flex flex-col gap-1.5"
      data-field={name}
      data-required={required ? "" : undefined}
    >
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
 * **There is no exception any more** `D20`. The city was one — a searchable
 * `Combobox` for roughly two hundred rows `[15 §5]` — and under the rewritten
 * rule it was enablement rather than an enhancement: scripts off, it rendered
 * a button and an empty hidden input, so a Saudi company could not be
 * registered at all `S15`. It is a native `<select>` grouped by region now,
 * in `components/city-field`. Every list on these forms belongs here.
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
