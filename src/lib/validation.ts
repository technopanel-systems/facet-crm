/**
 * Form reading and validation for server actions.
 *
 * Deliberately hand-rolled, not a schema library. `src/env.ts` already records
 * the reasoning: a dependency has to earn its place, and these rules are few
 * and dull. Adding one needs founder sign-off (`CLAUDE.md`).
 *
 * The one rule that matters here: **an error is a translation key, never
 * display text**, following `LoginState` in the login action. The action
 * returns keys; the form calls `t(key)`. Nothing user-facing is written in
 * English inside a `.ts` file `[07 E3]`.
 *
 * Why validation lives beside the actions rather than in the data modules:
 * shape ("is this a number") is a form concern, while business invariants
 * ("a project needs a company") belong to the data layer, where they hold for
 * every caller. Both report the same way — a key.
 */

/** Keyed by the input's `name` attribute. Values are translation keys. */
export type FieldErrors = Record<string, string>;

export type FormState = {
  fieldErrors?: FieldErrors;
  /** A whole-form failure, e.g. `projects.errors.atLeastOneCompany`. */
  error?: string;
  /** What the user typed, so a rejected form re-renders filled in. */
  values?: Record<string, string>;
};

export const emptyFormState: FormState = {};

type TextOptions = { required?: boolean; max?: number };

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * A one-pass reader over `FormData` that **accumulates** errors instead of
 * throwing, so one submit reports every bad field rather than the first.
 *
 * Every getter returns `null` for absent or invalid input; check `.ok` before
 * using the values. A field that failed still records what the user typed, so
 * the re-rendered form does not silently empty itself.
 */
export function readFields(formData: FormData) {
  const errors: FieldErrors = {};
  const values: Record<string, string> = {};

  function fail(name: string, key: string): null {
    errors[name] = key;
    return null;
  }

  function raw(name: string): string {
    const value = formData.get(name);
    const trimmed = typeof value === "string" ? value.trim() : "";
    if (trimmed) values[name] = trimmed;
    return trimmed;
  }

  return {
    /** Trimmed text. Empty is `null`, which is what a nullable column wants. */
    text(name: string, options: TextOptions = {}): string | null {
      const value = raw(name);
      if (!value) {
        return options.required ? fail(name, "validation.required") : null;
      }
      if (options.max && value.length > options.max) {
        return fail(name, "validation.tooLong");
      }
      return value;
    },

    /**
     * A uuid from a `<select>` or a hidden field. Shape only — whether the id
     * exists, and whether this user may reference it, is the data layer's
     * job and cannot be answered here.
     */
    uuid(name: string, options: { required?: boolean } = {}): string | null {
      const value = raw(name);
      if (!value) {
        return options.required ? fail(name, "validation.required") : null;
      }
      return UUID.test(value) ? value : fail(name, "validation.invalid");
    },

    /** Membership of a closed set — a pg enum rendered as a `<select>`. */
    option<T extends string>(
      name: string,
      allowed: readonly T[],
      options: { required?: boolean } = {},
    ): T | null {
      const value = raw(name);
      if (!value) {
        return options.required ? fail(name, "validation.required") : null;
      }
      return (allowed as readonly string[]).includes(value)
        ? (value as T)
        : fail(name, "validation.invalidOption");
    },

    /**
     * A `numeric` column, kept as a **string** all the way to the database —
     * which is what Drizzle wants back and what avoids a float rounding a
     * square-metre figure the business will later be measured on.
     */
    decimal(
      name: string,
      options: { required?: boolean; min?: number; maxScale?: number } = {},
    ): string | null {
      const value = raw(name);
      if (!value) {
        return options.required ? fail(name, "validation.required") : null;
      }
      if (!/^-?\d+(\.\d+)?$/.test(value)) {
        return fail(name, "validation.notANumber");
      }
      const numeric = Number(value);
      if (!Number.isFinite(numeric)) return fail(name, "validation.notANumber");
      if (options.min !== undefined && numeric < options.min) {
        return fail(name, "validation.negative");
      }
      const scale = value.split(".")[1]?.length ?? 0;
      if (options.maxScale !== undefined && scale > options.maxScale) {
        return fail(name, "validation.tooManyDecimals");
      }
      return value;
    },

    /**
     * A `date` column, kept as the `YYYY-MM-DD` string Drizzle wants — no
     * `Date` object, so no timezone gets to reinterpret a calendar day. The
     * app's timezone is fixed at Asia/Riyadh, and a validity date is a day in
     * Riyadh, not an instant.
     *
     * Shape and calendar validity only: `2026-02-30` is rejected because
     * `Date.parse` normalises it to March, which would silently store a day
     * the user did not type.
     */
    date(name: string, options: { required?: boolean } = {}): string | null {
      const value = raw(name);
      if (!value) {
        return options.required ? fail(name, "validation.required") : null;
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return fail(name, "validation.notADate");
      }
      // `Date.UTC` round-trip: a normalised day means the input was not real.
      const [year, month, day] = value.split("-").map(Number);
      const parsed = new Date(Date.UTC(year, month - 1, day));
      if (
        parsed.getUTCFullYear() !== year ||
        parsed.getUTCMonth() !== month - 1 ||
        parsed.getUTCDate() !== day
      ) {
        return fail(name, "validation.notADate");
      }
      return value;
    },

    /** An unchecked checkbox submits nothing at all — absence is `false`. */
    checkbox(name: string): boolean {
      return formData.get(name) !== null;
    },

    /** Repeated inputs, for the project's company-link rows. */
    list(name: string): string[] {
      return formData
        .getAll(name)
        .map((entry) => (typeof entry === "string" ? entry.trim() : ""));
    },

    fail(name: string, key: string): void {
      errors[name] = key;
    },

    get errors(): FieldErrors {
      return errors;
    },
    get values(): Record<string, string> {
      return values;
    },
    get ok(): boolean {
      return Object.keys(errors).length === 0;
    },
    /** The rejected-submit return value, in one place. */
    get state(): FormState {
      return { fieldErrors: errors, values };
    },
  };
}

/**
 * The data layer's way of reporting a broken business invariant.
 *
 * `message` is a translation key. Actions catch this and return it as
 * `FormState.error`; anything else that escapes is a real fault and should
 * surface as a 500 rather than be dressed up as a validation message.
 */
export class RuleError extends Error {
  /** When set, the message belongs against one field rather than the form. */
  readonly field?: string;

  constructor(translationKey: string, field?: string) {
    super(translationKey);
    this.name = "RuleError";
    this.field = field;
  }
}

/** Map a thrown `RuleError` onto the form state; rethrow anything else. */
export function ruleErrorState(
  error: unknown,
  values?: Record<string, string>,
): FormState {
  if (error instanceof RuleError) {
    return error.field
      ? { fieldErrors: { [error.field]: error.message }, values }
      : { error: error.message, values };
  }
  throw error;
}
