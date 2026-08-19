/**
 * The seeded notification types — `21 §2`'s five, and `25 §11`'s sixth.
 *
 * `10 §10` makes the type a **lookup, not an enum in code**: the trigger list
 * stays open and adding a type must be data, not a migration. That is why this
 * is a seed file rather than a `pgEnum`.
 *
 * Every row here is named in a user-truth document **and** has a real event in
 * the code that can raise it. `01 §13.2 #24` left the trigger and recipient
 * list open since the business model was written; `21 §2` closes it, and holds
 * the line `20 §11` drew — a row is seeded when, and only when, something
 * produces it.
 *
 * **`21 §2` is headed "and no sixth", and `mention.received` is the sixth.**
 * That heading enumerated what was true when it was written; the rule beneath
 * it is the test in the paragraph above, which `25 §11` passes on both limbs —
 * it is named in user truth, and `src/lib/comments.ts` raises it. Adding the
 * type without its producer would have been the dead gate; adding both in one
 * change is what `21 §11` describes for `share.granted`. `25` is the later
 * user-truth document besides.
 *
 * **`is_persistent` is not a synonym for act-now** `[21 §4]`. A type is
 * persistent only where its resolution condition can actually become true;
 * otherwise the rep gets a badge they can never clear, which is the failure that
 * makes the whole act-now tier get ignored — the opposite of what `07 G1`
 * wanted from persistence.
 */

import { NOTIFICATION_TYPES } from "@/lib/enums";

export type NotificationTypeSeed = {
  key: string;
  nameEn: string;
  nameAr: string;
  tier: "act_now" | "digest";
  isPersistent: boolean;
};

export const NOTIFICATION_TYPE_SEED: NotificationTypeSeed[] = [
  {
    // `07 E5`, `07 G1` — "a lead assigned to you", "a manager assignment".
    // Clears when the recipient logs an interaction against the company
    // `[21 §3]`: a first view is a click by another name, which `07 G1`
    // refuses.
    key: NOTIFICATION_TYPES.recordAssigned,
    nameEn: "Assigned to you",
    nameAr: "أُسند إليك",
    tier: "act_now",
    isPersistent: true,
  },
  {
    // `21 §5` — a handover raises ONE of these, naming the departing rep and
    // the counts, rather than one `record.assigned` per record.
    //
    // NOT persistent `[21 §4]`: it has no anchor and no completion condition,
    // so persistence would make it permanent. A handover summary is news; the
    // work items are the individual records, which reach the rep through their
    // own lists and follow-ups.
    key: NOTIFICATION_TYPES.recordHandedOver,
    nameEn: "Work handed over to you",
    nameAr: "تم تسليم عمل إليك",
    tier: "act_now",
    isPersistent: false,
  },
  {
    // `07 E5` — "a share approved". Raised for company, project and quotation
    // thread only: `record_shares` permits three more record types, but no
    // visibility filter reads a share on them, so a notification would announce
    // access the grantee did not receive `[21 §3]`.
    //
    // **The one seeded type with no live producer.** `07 B1`'s
    // manager-initiated sharing screen has never been built and no document
    // schedules it; the tier, persistence and resolution rules are settled so
    // the raise call is one line the day it exists `[21 §11]`.
    key: NOTIFICATION_TYPES.shareGranted,
    nameEn: "Shared with you",
    nameAr: "تمت مشاركته معك",
    tier: "act_now",
    isPersistent: true,
  },
  {
    // `07 E5`, `07 G1` — "one summary daily or weekly: what went stale, what is
    // dormant". Follows `21 §1`: a follow-up is a condition computed on read,
    // and this row is the only thing it ever writes.
    key: NOTIFICATION_TYPES.followUpDigest,
    nameEn: "Daily follow-ups",
    nameAr: "المتابعات اليومية",
    tier: "digest",
    isPersistent: false,
  },
  {
    // `25 §11` — "Tagging a person raises a notification. That is the difference
    // between a comment box people ignore and one that replaces WhatsApp."
    // Raised per mention by `addComment` and `updateComment`.
    //
    // Act-now rather than digest: it is directed at one person about one thing,
    // and the point is that it interrupts. A daily summary would reproduce
    // exactly the latency `25 §9` exists to remove.
    //
    // NOT persistent `[21 §4]`, for `record.handed_over`'s reason. Being
    // mentioned has no condition that can clear: opening the record is a click
    // by another name, which `07 G1` refuses, and a reply is not owed. Being
    // mentioned is news — and where it implies work, that work raises its own
    // notification through the normal path.
    //
    // It is also raised with NO ANCHOR, which is not cosmetic: the partial
    // unique index `notifications_live_key` covers every unresolved row that
    // carries a `record_id`, and nothing ever resolves a non-persistent type.
    // Anchored, the second mention of the same person on the same record would
    // be swallowed by `on conflict do nothing`, permanently. The record travels
    // in `payload` instead, as `record.handed_over`'s counts do `[21 §10]`.
    key: NOTIFICATION_TYPES.mentionReceived,
    nameEn: "Mentioned you",
    nameAr: "أشار إليك",
    tier: "act_now",
    isPersistent: false,
  },
];
