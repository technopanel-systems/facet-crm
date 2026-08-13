/**
 * Loss reasons — the nine values the founder named in `25 §5`, and no tenth.
 *
 * Flagging a project lost requires a reason, and the reasons feed a report to
 * management `[25 §5]`, `[25 §27]`. The list is data rather than an enum for a
 * stated reason: **the founder will collect real "other" entries and promote
 * or prune the list**, so a new reason has to be a row, never a migration.
 * That is also why `other` is here rather than implied — it is the intake, and
 * `projects.loss_reason` carries what was typed behind it.
 *
 * `code` is the stable identifier the application refers to, the way
 * `notification_types.key` is. Only one row changes what the form asks for —
 * `other` — and matching that on a display name would break the first time
 * someone edits the English text.
 *
 * The codes keep `25 §5`'s own wording rather than bending to the nearest
 * `report_signal` value. `25 §5` says the reasons take the same shape as
 * `20 §4`'s signals so they aggregate the same way; it does not say they are
 * the same list, and three of these have no signal at all. Renaming
 * "delivery time too long" to `lead_time_too_long` to match one would make the
 * seed disagree with the document it came from, for a resemblance no query
 * needs.
 *
 * Arabic names are translations of the founder's English list, not new
 * reasons — the list itself is exactly the nine in `25 §5`, in that order.
 */

import { OTHER_LOSS_REASON_CODE } from "@/lib/enums";

export const LOSS_REASON_SEED = [
  {
    code: "price_too_high",
    nameEn: "Price too high",
    nameAr: "السعر مرتفع",
  },
  {
    code: "lost_to_competitor",
    nameEn: "Lost to a competitor",
    nameAr: "خسارة أمام منافس",
  },
  {
    code: "colour_or_product_unavailable",
    nameEn: "Colour or product unavailable",
    nameAr: "اللون أو المنتج غير متوفر",
  },
  {
    code: "stock_shortage",
    nameEn: "Stock shortage",
    nameAr: "نقص في المخزون",
  },
  {
    code: "delivery_time_too_long",
    nameEn: "Delivery time too long",
    nameAr: "مدة التوريد طويلة",
  },
  {
    code: "specification_not_offered",
    nameEn: "Specification we do not offer",
    nameAr: "مواصفة لا نوفرها",
  },
  {
    code: "project_cancelled_or_postponed",
    nameEn: "Project cancelled or postponed",
    nameAr: "المشروع ملغى أو مؤجل",
  },
  {
    code: "customer_went_quiet",
    nameEn: "Customer went quiet",
    nameAr: "توقف العميل عن الرد",
  },
  {
    // The intake `[25 §5]`. The code lives in `@/lib/enums` rather than here
    // because `src/lib/projects.ts` branches on it and `src/` must never
    // import from `scripts/` — the same split `NOTIFICATION_TYPES` uses.
    code: OTHER_LOSS_REASON_CODE,
    nameEn: "Other",
    nameAr: "أخرى",
  },
] as const;
