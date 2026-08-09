"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

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
  onChange,
  children,
}: {
  name: string;
  defaultValue?: string | null;
  placeholder: string;
  disabled?: boolean;
  invalid?: boolean;
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
      onChange={onChange ? (event) => onChange(event.target.value) : undefined}
      aria-invalid={invalid || undefined}
      aria-describedby={invalid ? `${name}-error` : undefined}
      className={cn(
        "border-input bg-background text-foreground h-9 w-full rounded-md border",
        "ps-3 pe-8 text-start text-sm shadow-xs outline-none",
        "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
        "aria-invalid:border-destructive aria-invalid:ring-destructive/20",
        "disabled:cursor-not-allowed disabled:opacity-50",
      )}
    >
      <option value="">{placeholder}</option>
      {children}
    </select>
  );
}
