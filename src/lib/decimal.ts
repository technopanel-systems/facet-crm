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
