/**
 * `name_normalized` — the comparison form of a company, contact or project
 * name `[07 E3]`, `[09 §1]`.
 *
 * The algorithm is implementation detail, not schema (`09 §1` says so
 * explicitly), so it lives here and can change without a migration.
 *
 * It is deliberately conservative: it removes **writing-system noise only** —
 * case, Arabic diacritics, letter-form variants, Latin accents, punctuation,
 * stray whitespace. It does NOT strip legal forms ("Co", "Ltd", "شركة",
 * "مؤسسة"). No document defines that list, and a guessed one would silently
 * collapse "Al Rajhi Contracting" and "Al Rajhi Trading" into near-neighbours
 * at exactly the moment a rep is trusting the duplicate check.
 *
 * Duplicate **detection** itself is Phase 10 `[07 B6]`. This only prepares the
 * key it will compare. Cross-script matching — an Arabic name against the
 * English name of the same company — is no longer the problem it was designed
 * to be: `S23` makes phone the primary matching key, precisely because `S12`
 * and `S19` leave one name field that already holds either script.
 */

/** Arabic diacritics: fathatan..sukun, plus the superscript alef. */
const ARABIC_DIACRITICS = /[ً-ْٰ]/g;
/** Tatweel — a pure typographic stretch, never meaningful. */
const TATWEEL = /ـ/g;
/** Alef with madda / hamza above / hamza below / wasla → bare alef. */
const ALEF_VARIANTS = /[آأإٱ]/g;
/** Combining marks left behind by NFD, for Latin accents. */
const COMBINING_MARKS = /[̀-ͯ]/g;
/** Anything that is not a Latin letter, digit, Arabic letter or space. */
const NON_ALPHANUMERIC = /[^a-z0-9؀-ۿ ]+/g;

/** Arabic-Indic and Eastern Arabic-Indic digits, in ASCII order. */
const ARABIC_DIGITS = /[٠-٩۰-۹]/g;

function asciiDigit(character: string): string {
  const code = character.codePointAt(0)!;
  const base = code >= 0x06f0 ? 0x06f0 : 0x0660;
  return String(code - base);
}

/**
 * Fold one name into its comparison form.
 *
 * Never returns an empty string for a non-blank input: a name written entirely
 * in characters this function strips (say, only punctuation) falls back to the
 * trimmed lowercase original, because `name_normalized` is `NOT NULL` and a
 * silent empty key would match every other empty key. A genuinely blank name
 * is rejected earlier, by the required-field check in `src/lib/validation.ts`.
 */
export function normalizeName(value: string): string {
  const folded = value
    // NFKC first: Arabic presentation forms and full-width Latin collapse to
    // their standard code points, so later rules see one shape per letter.
    .normalize("NFKC")
    .toLowerCase()
    .replace(ARABIC_DIACRITICS, "")
    .replace(TATWEEL, "")
    .replace(ALEF_VARIANTS, "ا")
    .replace(/ة/g, "ه") // ta marbuta → ha
    .replace(/ى/g, "ي") // alef maqsura → ya
    .replace(/ؤ/g, "و") // waw with hamza → waw
    .replace(/ئ/g, "ي") // ya with hamza → ya
    .replace(ARABIC_DIGITS, asciiDigit)
    // NFD then strip combining marks: café → cafe. Runs after the Arabic
    // rules so it only ever sees Latin leftovers.
    .normalize("NFD")
    .replace(COMBINING_MARKS, "")
    .replace(NON_ALPHANUMERIC, " ")
    .replace(/\s+/g, " ")
    .trim();

  return folded || value.trim().toLowerCase();
}

/*
 * There is no `normalizedNameFor` wrapper. It existed to say which half of a
 * bilingual pair fed `name_normalized`; since `S12` and `S19` a company or
 * contact has one name and there is nothing to choose. Callers fold that name
 * with `normalizeName` directly.
 */
