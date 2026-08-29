/**
 * The seeded notification types — **`S92`'s six, and no seventh**.
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
 * **`tier` and `is_persistent` are gone** `S91`, with `0033`. Every row used to
 * carry both: a tier deciding whether it interrupted, and a flag deciding
 * whether reading it was enough to make it go away. There is one kind of
 * delivery now — a bell carrying news `S92` — so neither has a value to hold.
 * `21 §4`'s rule that persistence belongs only to a type whose condition can
 * clear is not overturned; it is universal, because no type has a condition any
 * more.
 *
 * **`followup.digest` is gone with them.** It was `07 E5`'s *"one summary
 * daily: what went stale, what is dormant"* — the only seeded type that ever
 * carried WORK rather than news, and `S91` answers it in one line: *the list is
 * the notification*. A digest is `S87`'s list said a second time and a day
 * late.
 *
 * **The comments below still explain why each surviving type is news and why
 * four of them carry no anchor**, because both facts still decide behaviour.
 * What they no longer explain is a column.
 */

import { NOTIFICATION_TYPES } from "@/lib/enums";

export type NotificationTypeSeed = {
  key: string;
  nameEn: string;
  nameAr: string;
};

export const NOTIFICATION_TYPE_SEED: NotificationTypeSeed[] = [
  {
    // `07 E5`, `07 G1` — "a lead assigned to you", "a manager assignment".
    //
    // It used to CLEAR, when the recipient logged an interaction against the
    // company `[21 §3]`. `S91` deletes the per-anchor resolution conditions
    // and the sweep that re-derived them, so it is read like every other item
    // now. The work is on the list `S87`; this says it arrived.
    key: NOTIFICATION_TYPES.recordAssigned,
    nameEn: "Assigned to you",
    nameAr: "أُسند إليك",
  },
  {
    // `21 §5` — a handover raises ONE of these, naming the departing rep and
    // the counts, rather than one `record.assigned` per record.
    //
    // A handover summary is news: the work items are the individual records,
    // which reach the rep through their own list `S87`. It was the first type
    // `21 §4` refused persistence to, for having no anchor and no completion
    // condition; since `S91` that is true of all six.
    key: NOTIFICATION_TYPES.recordHandedOver,
    nameEn: "Work handed over to you",
    nameAr: "تم تسليم عمل إليك",
  },
  {
    // `07 E5` — "a share approved". Raised for company, project and quotation
    // thread only: `record_shares` permits three more record types, but no
    // visibility filter reads a share on them, so a notification would announce
    // access the grantee did not receive `[21 §3]`.
    //
    // **The one seeded type with no live producer.** `07 B1`'s
    // manager-initiated sharing screen has never been built and no document
    // schedules it. `21 §11` kept the row so the raise call would be one line
    // the day it exists, and that is still true — there is now less to settle,
    // not more, since `S91` took the tier, the flag and the resolution rule.
    key: NOTIFICATION_TYPES.shareGranted,
    nameEn: "Shared with you",
    nameAr: "تمت مشاركته معك",
  },
  {
    // `25 §11` — "Tagging a person raises a notification. That is the difference
    // between a comment box people ignore and one that replaces WhatsApp."
    // Raised per mention by `addComment` and `updateComment`.
    //
    // It is directed at one person about one thing and the point is that it
    // interrupts — which is why it was act-now and never the digest, back when
    // there were two of those. Being mentioned is news: a reply is not owed,
    // and where it implies work, that work raises its own notification through
    // the normal path.
    //
    // It is also raised with NO ANCHOR. That was load-bearing until `0033`:
    // the partial unique index `notifications_live_key` covered every
    // unresolved row carrying a `record_id`, so an anchored second mention of
    // the same person on the same record was swallowed by `on conflict do
    // nothing`, permanently. The index is gone and the reason is now the plain
    // one — a mention is about a comment, and a comment is not one of the four
    // anchors `ANCHOR_TYPES` names. The record travels in `payload` instead, as
    // `record.handed_over`'s counts do `[21 §10]`.
    key: NOTIFICATION_TYPES.mentionReceived,
    nameEn: "Mentioned you",
    nameAr: "أشار إليك",
  },
  {
    // `S128` — *a decision that ends someone's work reaches them*, and `S92`
    // carries it as news: *a refusal, a rejection, a cancellation*. One type
    // for all four acts, because `S92` names one item and the four differ only
    // in which record ended — which travels in `payload`, as the kind does.
    //
    // A daily summary of "your dispatch was cancelled last Tuesday" is exactly
    // the latency `S128` exists to remove, which is why this was never the
    // digest — and `S91` has since deleted the digest for the same reason at
    // scale. The decision has already happened, so there is nothing to clear
    // and nothing to do but read it.
    //
    // Raised with **no anchor**, and the reason is `S128`'s own — *where the
    // person told cannot see the record, the message carries the reason and
    // stands alone*. An anchor is a link into something a co-credited rep
    // cannot open. (It also dodged `notifications_live_key`, which would have
    // swallowed a second decision against the same record for good; that index
    // is gone with `0033` and this reason no longer needs it.)
    key: NOTIFICATION_TYPES.decisionEndedWork,
    nameEn: "A decision ended your work",
    nameAr: "قرار أنهى عملك",
  },
  {
    // `S129` — *a rep is told when they are given a share of someone else's
    // credit*, the split case `S80` confirms at approval, never `S78`'s
    // ordinary 100%, which needs no telling.
    //
    // **Raised by `setCreditSplit`, which is the dated row with an author
    // `S110` that `S129` itself names as the event that already exists.**
    // `S80`'s prompt at approval does not — `dispatches.ts` deliberately
    // imports no split writer `[07 D3]`, `[12 §1]` — so `S129` keeps its marker
    // and says which half is true (`WORKFLOW §7`). When that prompt lands it
    // calls this same writer and the telling comes free.
    //
    // News, for the type above's reasons — the share has already been given.
    // No anchor either: a rep given a share need not hold the project `S30`, so
    // the record travels in `payload` and is re-checked on read.
    key: NOTIFICATION_TYPES.creditGranted,
    nameEn: "Credit shared with you",
    nameAr: "تمت مشاركة رصيد معك",
  },
];
