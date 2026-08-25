/**
 * Exact decimal arithmetic — the one implementation `[16 §1]`, `[18 §5]`.
 *
 * `numeric` columns arrive as strings and leave as strings. Everything in
 * between is scaled `bigint`, so no money or square-metre figure is ever a
 * float. The scales are the ones the schema declares: SQM(14,4), MONEY(14,2),
 * percentages(5,2).
 *
 * This module exists because three features now need the same engine —
 * quotation money `[16 §1]`, credit apportionment `[18 §5]` and achievement
 * `[04 C1]`. Two implementations of the number the business is measured on is
 * the failure this prevents; `src/lib/quotations.ts` imports from here rather
 * than keeping its own copy.
 *
 * **`formatSqm` and `percentOf` are display, and they live here on purpose.**
 * A summary figure rounds to whole square metres `D32`, and doing that as
 * scaled `bigint` beside the arithmetic that produced it is what keeps the
 * rule above true — a formatter written elsewhere would reach for
 * `Number(value)` and put the figure the business is measured on through a
 * float. They take and return strings and read no locale, so the line below
 * still holds.
 *
 * This module reaches nothing: no database, no session, no translations. That
 * is deliberate — it is pure arithmetic and `scripts/verify-slice3.ts` asserts
 * it as a pure function with no fixtures at all.
 */

/** Money. `numeric(14,2)`. */
export const MONEY_SCALE = 2;
/** Square metres and dimensions. `numeric(14,4)`. */
export const SQM_SCALE = 4;
/** Percentages — VAT rate, credit share. `numeric(5,2)`. */
export const PERCENT_SCALE = 2;

// `BigInt(0)` rather than `0n`, throughout: `tsconfig.json` targets ES2017 and
// bigint *literals* need ES2020. The calls are equivalent and cost nothing;
// they are here so nobody has to change the whole app's compile target to read
// this file. Do not "tidy" them back to `0n` without bumping that target.
export const ZERO = BigInt(0);
const ONE = BigInt(1);

export const pow10 = (exponent: number): bigint =>
  BigInt(10) ** BigInt(exponent);

/** `"86.3040"` at scale 4 → `863040`. Inputs come from columns already at or
 *  below their declared scale, so nothing is silently truncated here. */
export function toScaled(value: string, scale: number): bigint {
  const negative = value.startsWith("-");
  const body = negative ? value.slice(1) : value;
  const [whole, fraction = ""] = body.split(".");
  const padded = `${fraction}${"0".repeat(scale)}`.slice(0, scale);
  const magnitude = BigInt(whole || "0") * pow10(scale) + BigInt(padded || "0");
  return negative ? -magnitude : magnitude;
}

/** `863040` at scale 4 → `"86.3040"`. */
export function fromScaled(value: bigint, scale: number): string {
  const negative = value < ZERO;
  const magnitude = negative ? -value : value;
  const divisor = pow10(scale);
  const whole = magnitude / divisor;
  const fraction = (magnitude % divisor).toString().padStart(scale, "0");
  const sign = negative ? "-" : "";
  return scale === 0 ? `${sign}${whole}` : `${sign}${whole}.${fraction}`;
}

/**
 * A **summary** square-metre figure as whole metres, grouped — `D11`, `D32`.
 *
 * `674.8080` → `675`, `800.0000` → `800`, `5800.0000` → `5,800`. Half-up, on
 * scaled `bigint` through `divideRounded`, so the module's own rule holds: no
 * square-metre figure is ever a float.
 *
 * **A sum or a target rounds; a line does not.** A quotation or dispatch line's
 * `sqm` and its `quantity × width × length` factors keep their four decimals —
 * a document line reconciles against what SMAC issued `S5`, and `2.9768`
 * becoming `3` breaks that. Form inputs stay raw for the same reason.
 *
 * **`Intl.NumberFormat` is deliberately not used.** Under `ar` it renders
 * Arabic-Indic digits, which is not what `D11`'s mono tabular treatment or the
 * `dir="ltr"` wrappers around every figure assume. The separator is a literal
 * comma and the digits are ASCII, in both locales.
 *
 * `null` never reaches here: `targetSqm: null` means *not measured*, never
 * zero `[07 D1]`, so a caller keeps its own `?? dash`.
 */
export function formatSqm(value: string): string {
  return formatWholeSqm(roundSqm(value));
}

/**
 * The same display, for a figure a caller has already rounded — a difference
 * between two whole-metre figures, or a part derived so that the parts add up
 * to the total shown beside them. Rounding each part independently can gain or
 * lose a metre against their own sum, which is `divideEqually`'s argument in
 * `[18 §5]` applied to display rather than to credit.
 */
export function formatWholeSqm(whole: bigint): string {
  const negative = whole < ZERO;
  const digits = (negative ? -whole : whole).toString();
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return negative ? `-${grouped}` : grouped;
}

/**
 * Whole square metres, half-up — the same rounding `formatSqm` displays, as a
 * number rather than a string so a caller can subtract two figures that are
 * actually on screen. `D32`'s pace gap is 675 − 655, never 674.808 − 654.545.
 */
export function roundSqm(value: string): bigint {
  return divideRounded(toScaled(value, SQM_SCALE), pow10(SQM_SCALE));
}

/**
 * `value` as a whole-number percentage of `of`, half-up and never a float.
 *
 * Both are decimal strings at `scale`; pass `0` for two plain integers. **The
 * one definition** of the percentage `D32`'s panel and `/targets` both show — a
 * second one is how an achieved figure and the percentage beside it end up
 * disagreeing. Returns `0` when `of` is zero or negative, which is the only
 * case a percentage cannot answer.
 */
export function percentOf(value: string, of: string, scale: number): number {
  const divisor = toScaled(of, scale);
  if (divisor <= ZERO) return 0;
  return Number(divideRounded(toScaled(value, scale) * BigInt(100), divisor));
}

/** Half-up, on the magnitude, sign restored. Bankers' rounding would be a
 *  surprise on an invoice a customer reads. */
export function divideRounded(numerator: bigint, denominator: bigint): bigint {
  const negative = numerator < ZERO !== denominator < ZERO;
  const n = numerator < ZERO ? -numerator : numerator;
  const d = denominator < ZERO ? -denominator : denominator;
  const two = BigInt(2);
  const quotient = (n * two + d) / (d * two);
  return negative ? -quotient : quotient;
}

/**
 * Divide `totalScaled` into `count` equal parts. **Σ result === totalScaled,
 * always** `[18 §5]`.
 *
 * This is NOT `divideRounded` applied `count` times. Independent half-up
 * rounding of n shares can gain or lose up to n/2 units, and `18 §5` is the
 * founder's answer that it must not: the sum of everyone's achieved square
 * metres has to equal the sum of everything dispatched, or a rep's target
 * quietly disagrees with what went out of the door.
 *
 * The leftover — at most `count - 1` units — goes to the **earliest rows**, one
 * unit each, so the same input always gives the same output. `100.0000` across
 * three reps is `33.3334 / 33.3333 / 33.3333`, and `100.00` percent across
 * three is `33.34 / 33.33 / 33.33`.
 *
 * Callers order the rows before calling; this function never reorders them.
 */
export function divideEqually(totalScaled: bigint, count: number): bigint[] {
  if (count <= 0) return [];
  const divisor = BigInt(count);
  const negative = totalScaled < ZERO;
  const magnitude = negative ? -totalScaled : totalScaled;

  const base = magnitude / divisor;
  const leftover = magnitude % divisor; // 0 <= leftover < count

  return Array.from({ length: count }, (_unused, index) => {
    const share = BigInt(index) < leftover ? base + ONE : base;
    return negative ? -share : share;
  });
}
