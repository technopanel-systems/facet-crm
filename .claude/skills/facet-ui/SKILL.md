---
name: facet-ui
description: FACET's screen conventions — translation keys, RTL logical utilities, the server-page shape, server actions and FormState, native selects, list search and pagination. Use for any work under src/app or src/components: building, editing or reviewing a page, form, table, detail screen or React component, and before calling a screen done.
---

# FACET UI conventions

Established across slices 1–3 and holding across all 22 pages. Follow them;
they are not preferences. Doc citations like `[15 §5]` point at `docs/`.

## Non-negotiable

**Every user-facing string goes through the translation layer** (EN + AR).
No English in a `.tsx` or `.ts` file. `useTranslations` in client components,
`getTranslations` in server components. Keys live in `messages/en.json` and
`messages/ar.json` with the same tree — `npm run check:messages` enforces it.

**Logical Tailwind utilities only.** This is the convention that rots fastest.

| Use | Never |
|---|---|
| `ms-*` `me-*` | `ml-*` `mr-*` |
| `ps-*` `pe-*` | `pl-*` `pr-*` |
| `text-start` `text-end` | `text-left` `text-right` |
| `start-*` `end-*` | `left-*` `right-*` |
| `border-s` `border-e` | `border-l` `border-r` |

They flip from `<html dir>`, so Arabic needs no `rtl:` variants. Radix gets
direction from `DirectionProvider` in the locale layout.

**Import navigation from `@/i18n/navigation`** — `Link`, `redirect`,
`usePathname`, `useRouter`. The `next/*` versions drop the locale prefix.

**A client component must never import a value from `@/lib/*` data modules.**
It bundles the Postgres driver for the browser. `next dev` and `typecheck`
both tolerate it; only `npm run build` catches it. Re-declare option types in
the client file (see `dispatch-form.tsx`).

## The page shape

Every page under `src/app/[locale]/(app)/`:

```tsx
export const dynamic = "force-dynamic";   // all 22 pages carry this

export default async function ThingPage({ params, searchParams }: {
  params: Promise<{ locale: string; id: string }>;      // Next 16: Promises
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const session = await requireSession();
  const t = await getTranslations();

  const thing = await getThing(session, id);
  if (!thing) notFound();   // hidden and non-existent must look identical
  ...
  return <main className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-8">
```

`max-w-6xl` for lists, `max-w-4xl` for forms and detail screens.

**Permission shapes.** A screen the role may not use returns `notFound()`, not
a message — a 404 must not confirm that a record or capability exists. An
action a role may not perform is simply not rendered:
`can(session, "canDispatch") ? <Button…/> : undefined`. The data layer
re-checks either way; the UI never is the gate.

**Structure.** Beside each section: `page.tsx`, `new/page.tsx`,
`[id]/page.tsx`, `[id]/edit/page.tsx`, `actions.ts` (server actions),
`thing-form.tsx` (the `"use client"` form). New top-level section → add it to
`GROUPS` in `src/components/app-rail.tsx` — but the rail is deliberately six
items in two groups `[22 §7]`, so most new screens belong inside an existing
section rather than beside it.

## Building blocks

- `PageHeader` — title, optional description, optional far-side action.
- `DetailRow` — a labelled value inside a `<dl>`; renders the em dash rather
  than collapsing when null.
- `SearchForm` / `ListPagination` from `(app)/_components/list-controls` —
  every list uses both. `PAGE_SIZE` there is kept in step with the data
  modules.
- **Numbers use the `num` utility** `[22 §2]` — mono with tabular figures,
  for every quantity, square metre, money value, reference, date, count and
  percentage. It is one class, not `font-mono tabular-nums`.
- `Card` · `Table` · `Badge` from `@/components/ui`. Tables sit inside
  `<div className="overflow-x-auto rounded-lg border">`, every `TableHead`
  and `TableCell` carries `text-start`.
- Empty list: `<p className="text-muted-foreground rounded-lg border
  border-dashed p-8 text-center text-sm">`, with a different key when a
  search filtered it away.

## Forms

`FormField` (label + control + error) and `SelectField` from
`@/components/form-field`.

- **A native `<select>`, deliberately.** No hidden-input bridge, no client
  state, no JavaScript to submit, and the browser places the RTL popup.
- **`Combobox` is the one documented exception** `[15 §5]` — the ~200-item
  city list. Do not reach for it for a short list.
- The form is `"use client"` with `useActionState(action, emptyFormState)`;
  the submit button shows `t("common.saving")` while `pending`.
- **Errors are translation keys, never text.** The action returns keys; the
  form calls `t(key)`. `state.values` re-fills a rejected form.
- **Filters and search are GET forms in the URL**, not client state — a
  search is then shareable, survives reload and needs no JavaScript. The
  dispatch form's linked/direct mode follows this too.

Server actions in `actions.ts`:

```ts
"use server";
export async function doThingAction(_previous: FormState, formData: FormData) {
  const session = await requireSession();   // an action is its own POST
  const fields = readFields(formData);      // shape only; accumulates errors
  const sqm = fields.decimal("sqm", { required: true, min: 0, maxScale: 4 });
  if (!fields.ok || !sqm) return fields.state;
  try { … } catch (error) { return ruleErrorState(error, fields.values); }
  revalidatePath("/things");
  redirect({ href: `/things/${id}`, locale });   // from @/i18n/navigation
  throw new Error("unreachable");
}
```

No layout wraps a server action, so the session gate cannot be inherited.
Shape validation belongs here; business invariants belong in the data layer
and arrive as `RuleError` — also a key.

## Numbers, dates, names

- Wrap LTR content in Arabic with `dir="ltr"`: references, decimals, dates,
  percentages, m². Used in 81 places; keep it up.
- Decimals stay **strings** end to end — never `Number()` a square-metre or
  money value.
- Dates: `format.dateTime(new Date(`${value}T00:00:00Z`), { dateStyle:
  "medium", timeZone: "UTC" })` from `getFormatter()`. A `date` column is a
  calendar day in Riyadh, not an instant.
- Bilingual records render through `bilingualName(row, locale)`.

## Before calling a screen done

1. `npm run typecheck` · `npm run lint` · `npm run build` ·
   `npm run check:messages`. **`build` is not optional** — it is the only one
   that catches a client component importing a data module.
2. Grep for physical utilities (currently zero in `src`):
   `ml-|mr-|pl-|pr-|text-left|text-right|border-l-|border-r-`
3. Open `/ar` and look at it.
4. Client-side interaction is untested in this repo (`CLAUDE.md`, verification
   debt). Asserting on rendered markup proves little: next-intl ships the
   whole catalogue to every page, so grep for a DOM marker like
   `name="smacReference"`, never for a translated string.
