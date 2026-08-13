import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { PageHeader } from "@/components/page-header";
import { listActiveUsers, requireSession } from "@/lib/authz";
import { commentRecordName, getComment } from "@/lib/comments";
import { COMMENT_BODY_MAX } from "@/lib/enums";

import { updateCommentAction } from "../../actions";
import { CommentForm } from "./comment-form";

export const dynamic = "force-dynamic";

/**
 * Correcting one's own comment `[25 §12]`.
 *
 * **Author only, and a 404 rather than a message** — a screen the reader may
 * not use must not confirm that the record exists. `getComment` already returns
 * null for a comment on a record they cannot see; the author check is here as
 * well as in `updateComment`, because the UI is never the gate and the data
 * layer is.
 *
 * There is no delete control, here or anywhere `[25 §12]`, `[12 §7]`.
 */
export default async function EditCommentPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const session = await requireSession();
  const comment = await getComment(session, id);
  if (!comment) notFound();
  if (comment.authorUserId !== session.user.id) notFound();

  const t = await getTranslations();
  const [people, recordName] = await Promise.all([
    listActiveUsers(),
    commentRecordName(comment.recordType, comment.recordId),
  ]);

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <PageHeader
        title={t("comments.editTitle")}
        description={recordName ?? undefined}
      />
      <CommentForm
        action={updateCommentAction.bind(
          null,
          comment.id,
          comment.recordType,
          comment.recordId,
        )}
        body={comment.body}
        // Tagging yourself does nothing, so you are not offered `[25 §11]`.
        people={people
          .filter((person) => person.id !== session.user.id)
          .map((person) => ({ id: person.id, name: person.name }))}
        tagged={comment.mentions.map((person) => person.userId)}
        maxLength={COMMENT_BODY_MAX}
        cancelHref={recordHref(comment.recordType, comment.recordId)}
      />
    </div>
  );
}

function recordHref(recordType: string, recordId: string): string {
  if (recordType === "quotation_thread") return `/quotations/${recordId}`;
  if (recordType === "project") return `/projects/${recordId}`;
  if (recordType === "contact") return `/contacts/${recordId}`;
  if (recordType === "dispatch") return `/dispatches/${recordId}`;
  return `/companies/${recordId}`;
}
