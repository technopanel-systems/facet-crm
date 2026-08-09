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
 * English name of the same company `[04 B3]` — needs transliteration, which no
 * document specifies, and is recorded as open in `14 §6`.
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

/**
 * The value to store in `name_normalized`.
 *
 * `name_en` is the `NOT NULL` column and therefore the source of truth. The
 * Arabic name is deliberately not concatenated in: the column is single-valued
 * and indexed for equality and prefix matching, and gluing a second name onto
 * it would weaken both halves. A rep who works in Arabic types Arabic into
 * `name_en`, which the folding above handles.
 *
 * Phase 10 can compare `normalizeName(nameAr)` at query time if it wants dual
 * matching — that needs no schema change.
 */
export function normalizedNameFor(input: { nameEn: string }): string {
  return normalizeName(input.nameEn);
}
