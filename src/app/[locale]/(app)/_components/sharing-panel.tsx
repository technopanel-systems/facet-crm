import { getFormatter, getTranslations } from "next-intl/server";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { can, type AuthSession, type SharedRecordType } from "@/lib/authz";
import { listShares, shareableUsers } from "@/lib/sharing";

import { grantShareAction, revokeShareAction } from "./sharing-actions";
import { SharingControls, type ShareRow } from "./sharing-controls";

/**
 * Who holds this record, and the manager's controls for changing that
 * `[07 B1]`, `[25 §30]`.
 *
 * A server component, so the client half never imports a data module and every
 * screen wires sharing the same way rather than three times slightly
 * differently — `CommentBox`'s shape, and for the same reasons.
 *
 * **It renders for anyone who can open the record, but acts only for
 * `can_share`.** The list of who else is working a record is a fact about the
 * record, and the owning rep is the person who phoned to ask for the share; the
 * grant form and the revoke buttons are not rendered without the flag, which is
 * presentation, never the gate — `sharing.ts` re-checks both.
 *
 * **Nothing renders when there is nothing to say.** No shares and no flag means
 * no card: a panel on every record would make sharing look like an ordinary
 * edit, which is the reason the dormancy panel renders only when there is a
 * decision to take.
 *
 * Each revoke action is bound to its row's id here rather than in the client —
 * only a server action may cross that boundary, and an id bound server-side is
 * one a tampered form cannot change.
 */
export async function SharingPanel({
  session,
  recordType,
  recordId,
}: {
  session: AuthSession;
  recordType: SharedRecordType;
  recordId: string;
}) {
  const mayShare = can(session, "canShare");
  const [shares, people] = await Promise.all([
    listShares(recordType, recordId),
    mayShare
      ? shareableUsers(session, recordType, recordId)
      : Promise.resolve([]),
  ]);

  if (shares.length === 0 && !mayShare) return null;

  const t = await getTranslations();
  const format = await getFormatter();

  const rows: ShareRow[] = shares.map((share) => ({
    id: share.id,
    sharedWithName: share.sharedWithName,
    sharedByName: share.sharedByName,
    grantedOn: format.dateTime(share.createdAt, { dateStyle: "medium" }),
    revokeAction: mayShare
      ? revokeShareAction.bind(null, share.id, recordType, recordId)
      : undefined,
  }));

  return (
    <Card data-slot="sharing-panel">
      <CardHeader>
        <CardTitle className="text-start text-sm">
          {t("sharing.title")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <SharingControls
          shares={rows}
          people={people}
          grantAction={
            mayShare
              ? grantShareAction.bind(null, recordType, recordId)
              : undefined
          }
        />
      </CardContent>
    </Card>
  );
}
