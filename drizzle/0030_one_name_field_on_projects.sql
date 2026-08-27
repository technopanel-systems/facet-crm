-- 0030 — S26, S12: one name field on projects.
--
-- SPEC §16 has asked since before the projects slice: "Companies and contacts
-- have one name field (S12, S19). Projects still have two, and no rule says
-- why. Same reasoning appears to apply. Decide before the projects slice." The
-- projects slice shipped without it and WORKFLOW §5 carried the row. The
-- founder has decided: one field, written in whichever language the rep
-- prefers, exactly as a company works.
--
-- 0009 is the precedent and this follows it: RENAME rather than drop-and-add,
-- because the generated ADD COLUMN "name" text NOT NULL would discard every
-- existing name and fail outright against a non-empty table.
--
-- **The one difference from 0009, and it was chosen rather than inherited.**
-- 0009 dropped name_ar outright: 2 of 90 companies carried a distinct Arabic
-- name and both were a verify script's. Here the proportion is inverted.
-- Pre-flight, run against the development database on 27 Aug 2026:
--
--   select count(*), count(name_ar),
--          count(*) filter (where name_ar is not null
--                             and btrim(name_ar) <> btrim(name_en))
--     from projects;
--   -- 50 projects | 49 with an Arabic name | 49 of them distinct
--
-- All 50 are seeded test data and nothing needs preserving, so either column
-- could win. **The Arabic one does**, because the dataset is what the screens
-- are judged against: 121 Arabic company names beside 50 English project names
-- is not a picture of this business, and a demo that reads wrong is a demo that
-- teaches the wrong thing. Where a project has no Arabic name — 1 of 50 — the
-- English one stays, which is the rule S12 already states: one field, either
-- script.
--
-- **name_normalized cannot be left alone, and that is the whole difficulty.**
-- 0009 could skip it: the column was already normalizeName(name_en) and the
-- rename left that correct. Here the value changes with the name, and
-- normalizeName (src/lib/normalize.ts) is NFKC, lowercase, Arabic diacritic and
-- tatweel removal, four letter-form folds, Arabic-Indic digit mapping, NFD,
-- combining-mark removal, a non-alphanumeric class and a whitespace collapse.
--
-- The expression below is that function translated, not approximated —
-- Postgres 17 has normalize() for both NFKC and NFD, so no step is dropped.
-- **Proven, not asserted**: every one of the 50 name_en values, all 49 name_ar
-- values and all 126 company names were folded by both this SQL and
-- normalizeName() and compared row for row. 0 mismatches on 99 project values
-- and 0 on 126 company names. The same run confirmed name_normalized already
-- equals normalizeName(name_en) for every row, which is 0009's premise holding
-- here too.
--
-- The character class is written with literal characters rather than an
-- E-string. No migration in this directory has ever used one, this file is
-- UTF-8, and the TS source writes the same two ranges literally. The three
-- backslash escapes that remain are plain SQL string text, which Postgres's
-- regex engine reads itself — they are not string escapes and need no E.
--
-- The final fallback in normalizeName — return the trimmed lowercase original
-- when folding leaves nothing — is the CASE below. No row needs it today; it is
-- here because the function has it, and a translation that drops a branch is
-- not a translation.
--
-- Order: rename first so the UPDATE and the fold both read one column, the
-- value and its key move together in one statement, and name_ar is dropped
-- last. A fresh database runs all three against no rows.
ALTER TABLE "projects" RENAME COLUMN "name_en" TO "name";--> statement-breakpoint
UPDATE "projects"
   SET "name" = "name_ar",
       "name_normalized" = case
         when btrim(regexp_replace(regexp_replace(regexp_replace(
                normalize(translate(lower(normalize("name_ar", NFKC)),
                                    'آأإٱةىؤئ٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹ًٌٍَُِّْٰـ', 'ااااهيوي01234567890123456789'), NFD),
                '[\u0300-\u036F]', '', 'g'),
                '[^a-z0-9؀-ۿ ]+', ' ', 'g'),
                '\s+', ' ', 'g')) = ''
         then lower(btrim("name_ar"))
         else btrim(regexp_replace(regexp_replace(regexp_replace(
                normalize(translate(lower(normalize("name_ar", NFKC)),
                                    'آأإٱةىؤئ٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹ًٌٍَُِّْٰـ', 'ااااهيوي01234567890123456789'), NFD),
                '[\u0300-\u036F]', '', 'g'),
                '[^a-z0-9؀-ۿ ]+', ' ', 'g'),
                '\s+', ' ', 'g'))
       end
 WHERE "name_ar" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" DROP COLUMN "name_ar";
