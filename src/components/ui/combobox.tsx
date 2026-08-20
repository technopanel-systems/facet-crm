"use client";

import { useMemo, useRef, useState } from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { Popover } from "radix-ui";

import { normalizeName } from "@/lib/normalize";
import { cn } from "@/lib/utils";

/**
 * A searchable single-select, for lookups too long to be a `<select>`.
 *
 * **This is the documented exception to `14`'s native-select rule**, and it
 * exists for exactly one field: the city list runs to roughly two hundred rows
 * `[15 §3]`, and `15 §5` reverses that decision for this control only.
 * Everything else keeps `SelectField` — see the note there.
 *
 * Two things make it safe to drop into forms that post to server actions:
 *
 *  - **The value travels in a hidden input.** The action still receives plain
 *    form data under the same field name, so not one server action changed.
 *  - **`defaultValue` behaves like the native control's.** A rejected submit
 *    re-renders with what the user chose, because the state is seeded from it.
 *
 * The cost, recorded in `15 §5` rather than discovered later: unlike the
 * native select, this needs JavaScript.
 *
 * Search matches **both** names whatever the interface language, folded
 * through `normalizeName` — the same function `name_normalized` uses — so
 * "jeddah", "Jedda" and "جدة" all find جدة, and Arabic diacritics do not
 * decide whether a rep finds a city.
 */

export type ComboboxOption = {
  value: string;
  /** What the user sees and what is matched first. */
  label: string;
  /** The other language's name. Matched too, never displayed. */
  altLabel?: string;
  /** Shown after the label, greyed — context, not a match target. */
  hint?: string;
};

export function Combobox({
  name,
  options,
  defaultValue,
  placeholder,
  searchPlaceholder,
  emptyLabel,
  clearLabel,
  disabled,
  invalid,
  onChange,
}: {
  name: string;
  options: ComboboxOption[];
  defaultValue?: string | null;
  /** Shown on the trigger when nothing is chosen. */
  placeholder: string;
  searchPlaceholder: string;
  /** Shown when the query matches nothing. */
  emptyLabel: string;
  /**
   * The "no value" entry — the field is nullable, like the native version.
   *
   * **Omitted for a required field**, which then offers no way back to empty,
   * the way a required `<select>` has no empty `<option>`. The company form's
   * city is the one that omits it `S15`.
   */
  clearLabel?: string;
  disabled?: boolean;
  invalid?: boolean;
  /** For a field that drives another one — the region display `[15 §4]`. */
  onChange?: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(defaultValue ?? "");
  const [query, setQuery] = useState("");
  // Which row the keyboard is on. Reset whenever the query changes, so Enter
  // always takes the first match rather than a stale row.
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const selected = options.find((option) => option.value === value);

  const matches = useMemo(() => {
    const folded = normalizeName(query);
    if (!folded) return options;
    return options.filter(
      (option) =>
        normalizeName(option.label).includes(folded) ||
        (option.altLabel && normalizeName(option.altLabel).includes(folded)),
    );
  }, [options, query]);

  function choose(next: string) {
    setValue(next);
    onChange?.(next);
    setOpen(false);
    setQuery("");
    setActive(0);
  }

  // The clear row occupies index 0 when it exists, so every match sits one
  // lower. `offset` is that shift, and it is the only difference between the
  // required and nullable renderings.
  const clearable = clearLabel !== undefined;
  const offset = clearable ? 1 : 0;

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      // +1 for the clear row, when there is one: it sits above the matches and
      // is selectable, so it shifts every index below it. Without a
      // `clearLabel` there is no such row and the matches start at 0.
      const count = matches.length + (clearable ? 1 : 0);
      if (count === 0) return;
      const next = (active + step + count) % count;
      setActive(next);
      listRef.current
        ?.querySelector(`[data-index="${next}"]`)
        ?.scrollIntoView({ block: "nearest" });
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault(); // never submit the form from inside the popup
      if (clearable && active === 0) choose("");
      else if (matches[active - offset]) choose(matches[active - offset].value);
    }
  }

  const rowClass = (index: number) =>
    cn(
      "flex w-full cursor-default items-center gap-2 rounded-sm px-2 py-1.5",
      "text-start text-sm outline-none",
      index === active && "bg-accent text-accent-foreground",
    );

  return (
    <>
      {/* What the server action actually reads. */}
      <input type="hidden" name={name} value={value} />

      <Popover.Root
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (next) {
            setQuery("");
            setActive(0);
          }
        }}
      >
        <Popover.Trigger
          id={name}
          type="button"
          disabled={disabled}
          aria-invalid={invalid || undefined}
          aria-describedby={invalid ? `${name}-error` : undefined}
          className={cn(
            "border-input bg-background text-foreground flex h-9 w-full items-center",
            "justify-between gap-2 rounded-md border ps-3 pe-2 text-start text-sm",
            "shadow-xs outline-none",
            "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
            "aria-invalid:border-destructive aria-invalid:ring-destructive/20",
            "disabled:cursor-not-allowed disabled:opacity-50",
          )}
        >
          <span className={cn("truncate", !selected && "text-muted-foreground")}>
            {selected ? selected.label : placeholder}
          </span>
          <ChevronsUpDown aria-hidden className="size-4 shrink-0 opacity-50" />
        </Popover.Trigger>

        <Popover.Portal>
          <Popover.Content
            align="start"
            sideOffset={4}
            className={cn(
              "bg-popover text-popover-foreground z-50 w-(--radix-popover-trigger-width)",
              "rounded-md border p-1 shadow-md outline-none",
            )}
            // Keep focus in the search box; the list is driven from there.
            onOpenAutoFocus={(event) => {
              event.preventDefault();
              searchRef.current?.focus();
            }}
          >
            <div className="flex items-center gap-2 border-b px-2 pb-1.5">
              <Search aria-hidden className="size-4 shrink-0 opacity-50" />
              <input
                ref={searchRef}
                type="text"
                role="combobox"
                aria-expanded
                aria-controls={`${name}-listbox`}
                aria-activedescendant={`${name}-option-${active}`}
                autoComplete="off"
                value={query}
                placeholder={searchPlaceholder}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setActive(0);
                }}
                onKeyDown={onKeyDown}
                className={cn(
                  "text-foreground placeholder:text-muted-foreground h-8 w-full",
                  "bg-transparent text-start text-sm outline-none",
                )}
              />
            </div>

            <div
              ref={listRef}
              id={`${name}-listbox`}
              role="listbox"
              className="max-h-64 overflow-y-auto py-1"
            >
              {/* The nullable field's "no value" row, mirroring the native
                  select's empty <option>. A required field renders none. */}
              {clearable ? (
                <div
                  id={`${name}-option-0`}
                  role="option"
                  aria-selected={value === ""}
                  data-index={0}
                  onClick={() => choose("")}
                  onMouseEnter={() => setActive(0)}
                  className={rowClass(0)}
                >
                  <Check
                    aria-hidden
                    className={cn(
                      "size-4 shrink-0",
                      value !== "" && "opacity-0",
                    )}
                  />
                  <span className="text-muted-foreground truncate">
                    {clearLabel}
                  </span>
                </div>
              ) : null}

              {matches.map((option, index) => (
                <div
                  key={option.value}
                  id={`${name}-option-${index + offset}`}
                  role="option"
                  aria-selected={option.value === value}
                  data-index={index + offset}
                  onClick={() => choose(option.value)}
                  onMouseEnter={() => setActive(index + offset)}
                  className={rowClass(index + offset)}
                >
                  <Check
                    aria-hidden
                    className={cn(
                      "size-4 shrink-0",
                      option.value !== value && "opacity-0",
                    )}
                  />
                  <span className="truncate">{option.label}</span>
                  {option.hint ? (
                    <span className="text-muted-foreground ms-auto shrink-0 text-xs">
                      {option.hint}
                    </span>
                  ) : null}
                </div>
              ))}

              {matches.length === 0 ? (
                <p className="text-muted-foreground px-2 py-3 text-start text-sm">
                  {emptyLabel}
                </p>
              ) : null}
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </>
  );
}
