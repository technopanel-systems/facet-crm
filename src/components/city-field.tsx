"use client";

import { useLocale, useTranslations } from "next-intl";

import { SelectField } from "@/components/form-field";
// A value import, like `SAUDI_CODE` in the company form: `lib/enums` is plain
// constants. Importing `lib/lookups` here would pull the Postgres driver into
// the browser bundle — the `import type` below is erased and pulls in nothing.
import { REGIONS } from "@/lib/enums";
import type { CityRow } from "@/lib/lookups";

/**
 * The city picker `S15` — a native `<select>`, grouped by region.
 *
 * **This replaces the `Combobox`**, which was the one control `D20` ever named
 * as a real JavaScript exception and which the rewritten rule reclassifies as
 * enablement: scripts off, it rendered a trigger button and an EMPTY hidden
 * input, and `S15` makes a city mandatory for a Saudi company — so a Saudi
 * company could not be registered at all. Not a degraded screen, a broken one.
 *
 * **Why the grouping is not an invention.** `S15` already derives a record's
 * region FROM its city, so the group is a relationship the data has rather
 * than a new one: 171 cities fall into five groups of 26-48, which is the same
 * reduction a two-step region-then-city form would buy, without the GET round
 * trip mid-form that a scripts-off two-step needs.
 *
 * **What was lost and is recorded rather than quietly dropped** (`WORKFLOW §5`):
 * `[15 §5]`'s cross-language search. A rep typing *Riyadh* no longer finds
 * الرياض, and a rep typing الرياض no longer finds *Riyadh*. Native type-ahead
 * still finds a city by its name in the language the interface is in. The
 * search may return, but only as an enhancement OVER this control `D20`.
 */
export function CityField({
  name,
  cities,
  defaultValue,
  placeholder,
  required,
  disabled,
  invalid,
  onChange,
}: {
  name: string;
  cities: CityRow[];
  defaultValue?: string | null;
  /** The empty option's label. For a required field the browser refuses it. */
  placeholder: string;
  required?: boolean;
  disabled?: boolean;
  invalid?: boolean;
  /** For the region display the city drives `S15`. */
  onChange?: (value: string) => void;
}) {
  const t = useTranslations();
  // Read rather than passed: three forms render this and the interface
  // language is not one of their decisions.
  const locale = useLocale();

  const cityName = (city: CityRow) =>
    locale === "ar" ? city.nameAr || city.nameEn : city.nameEn;

  // Ordered by what the reader can SEE. `listCities()` orders by `name_en`, so
  // an Arabic session was reading a list sorted by an invisible key.
  const grouped = REGIONS.map((region) => ({
    region,
    rows: cities
      .filter((city) => city.region === region)
      .sort((a, b) => cityName(a).localeCompare(cityName(b), locale)),
  })).filter((group) => group.rows.length > 0);

  return (
    <SelectField
      name={name}
      defaultValue={defaultValue}
      placeholder={placeholder}
      required={required}
      disabled={disabled}
      invalid={invalid}
      onChange={onChange}
    >
      {grouped.map((group) => (
        <optgroup key={group.region} label={t(`enums.region.${group.region}`)}>
          {group.rows.map((city) => (
            <option key={city.id} value={city.id}>
              {cityName(city)}
            </option>
          ))}
        </optgroup>
      ))}
    </SelectField>
  );
}
