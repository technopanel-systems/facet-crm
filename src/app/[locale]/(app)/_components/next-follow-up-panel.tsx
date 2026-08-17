import { getFormatter, getTranslations } from "next-intl/server";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { type AuthSession } from "@/lib/authz";
import {
  nextFollowUpContext,
  type FollowUpAnchorType,
} from "@/lib/follow-ups";

import {
  clearNextFollowUpAction,
  setNextFollowUpAction,
} from "./next-follow-up-actions";
import { NextFollowUpControls } from "./next-follow-up-controls";

/**
 * The rep's own follow-up date, on a company, a project or a quotation
 * `[25 §18]`.
 *
 * A server component, so the client half never imports a data module and all
 * three screens wire it the same way rather than three times slightly
 * differently — `SharingPanel`'s shape, and for the same reasons.
 *
 * **It renders for anyone who can open the record**, unlike the sharing panel:
 * there is no flag, because the date is every rep's note to themself about
 * work they already hold. `setNextFollowUp` re-checks visibility regardless.
 *
 * **Both actions are bound to this record on the server.** Only a server
 * action may cross that boundary, and a record id bound server-side is one a
 * tampered form cannot change.
 *
 * The two lines beside the value — who set it, and whether a customer's hold
 * will defer it — are both computed in `nextFollowUpContext`, so this screen
 * derives nothing: a second answer to "will this fire" is the trap `21 §7`
 * names, and `22 §6.7` records the same rule for the turn column.
 */
export async function NextFollowUpPanel({
  session,
  recordType,
  recordId,
  value,
}: {
  session: AuthSession;
  recordType: FollowUpAnchorType;
  recordId: string;
  /** The record's own `next_follow_up_at`, already on every detail type. */
  value: string | null;
}) {
  const [t, format, context] = await Promise.all([
    getTranslations(),
    getFormatter(),
    nextFollowUpContext(session, recordType, recordId, value),
  ]);

  /** A `date` column is a calendar day in Riyadh, never an instant. */
  const day = (value: string) =>
    format.dateTime(new Date(`${value}T00:00:00Z`), {
      dateStyle: "medium",
      timeZone: "UTC",
    });

  return (
    <Card data-slot="next-follow-up">
      <CardHeader>
        <CardTitle className="text-start text-sm">
          {t("followUps.nextFollowUp.title")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <NextFollowUpControls
          view={{
            value,
            valueLabel: value ? day(value) : null,
            setByName: context.setByName,
            setOnLabel: context.setOn ? day(context.setOn) : null,
            heldUntilLabel: context.heldUntil ? day(context.heldUntil) : null,
            heldCompanyName: context.heldCompanyName,
          }}
          setAction={setNextFollowUpAction.bind(null, recordType, recordId)}
          clearAction={clearNextFollowUpAction.bind(null, recordType, recordId)}
        />
      </CardContent>
    </Card>
  );
}
