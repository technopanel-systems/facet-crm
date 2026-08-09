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
 */

export const LEAD_SOURCE_SEED = [
  { nameEn: "Field visit", nameAr: "زيارة ميدانية", repSelectable: true },
  { nameEn: "Direct contact", nameAr: "اتصال مباشر", repSelectable: true },
  { nameEn: "Referral", nameAr: "ترشيح", repSelectable: true },
  { nameEn: "Exhibition", nameAr: "معرض", repSelectable: true },
  { nameEn: "Marketing", nameAr: "تسويق", repSelectable: false },
  { nameEn: "Other", nameAr: "أخرى", repSelectable: true },
] as const;
