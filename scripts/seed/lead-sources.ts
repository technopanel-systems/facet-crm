/**
 * Lead sources `[15 §1]` — where a lead came from.
 *
 * `repSelectable: false` restricts a value to holders of `can_assign`
 * `[15 §2]`. Marketing is the only one today: it means the lead arrived from
 * the marketing team, so a rep choosing it by hand would be recording
 * something that did not happen.
 *
 * A source added here later is selectable unless it says otherwise — that is
 * what the column's `true` default is for.
 *
 * **Two channels joined the six in session 52, on the founder's word** `S17`:
 * an online or WhatsApp inquiry, and a consultant or architect specifying
 * Technopanel. Both were flagged when lead source became mandatory — a
 * mandatory field with a channel missing makes reps pick wrong, and the
 * *where business comes from* chart then lies quietly. The second matters
 * most to him: an architect specifying the panels is a different kind of win
 * from a rep walking in, and he wants to know how often it happens. Named as
 * channels, in the style of the six; a rename is a seed edit and a re-run,
 * never a migration. The 261 pre-rule blanks are untouched by this.
 */

export const LEAD_SOURCE_SEED = [
  { nameEn: "Field visit", nameAr: "زيارة ميدانية", repSelectable: true },
  { nameEn: "Direct contact", nameAr: "اتصال مباشر", repSelectable: true },
  { nameEn: "Referral", nameAr: "ترشيح", repSelectable: true },
  { nameEn: "Exhibition", nameAr: "معرض", repSelectable: true },
  { nameEn: "Marketing", nameAr: "تسويق", repSelectable: false },
  { nameEn: "Online or WhatsApp", nameAr: "إنترنت أو واتساب", repSelectable: true },
  {
    nameEn: "Consultant or architect",
    nameAr: "استشاري أو مهندس معماري",
    repSelectable: true,
  },
  { nameEn: "Other", nameAr: "أخرى", repSelectable: true },
] as const;
