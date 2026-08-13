import { listActiveUsers, type AuthSession } from "@/lib/authz";
import type { CommentRecordType } from "@/lib/enums";
import { COMMENT_BODY_MAX } from "@/lib/enums";

import { addCommentAction } from "../comments/actions";
import { CommentComposer } from "./comment-composer";

/**
 * The composer, with its people list — passed to `<Timeline composer={…}>` on
 * every record that takes a comment `[25 §9]`.
 *
 * A server component so the client half never imports a data module, and so
 * every screen wires the thread the same way rather than five times slightly
 * differently.
 *
 * **The picker is every active colleague**, not a scoped list. `listActiveUsers`
 * already backs the assignment and handover dropdowns — a list of colleagues is
 * not a record, and scoping it would mean inverting the visibility filters,
 * which answer "which records can this person see", not "which people can see
 * this record". Tagging somebody who cannot open the record is allowed
 * `[25 §11]` and shows them a notification with no link rather than nothing.
 *
 * **It does not scale past a couple of dozen people** — recorded as open in
 * `22 §6` with the trigger stated, rather than pre-solved at a threshold nobody
 * has reached.
 */
export async function CommentBox({
  session,
  recordType,
  recordId,
}: {
  session: AuthSession;
  recordType: CommentRecordType;
  recordId: string;
}) {
  const people = await listActiveUsers();

  return (
    <CommentComposer
      action={addCommentAction.bind(null, recordType, recordId)}
      // Tagging yourself raises nothing, so you are not offered `[25 §11]`.
      people={people
        .filter((person) => person.id !== session.user.id)
        .map((person) => ({ id: person.id, name: person.name }))}
      maxLength={COMMENT_BODY_MAX}
    />
  );
}
