/**
 * Where an anchor's own record lives.
 *
 * Follow-ups and notifications both carry an anchor, and both had a private
 * copy of this mapping. The Today screen would have been the third, so it is
 * one function now `[22 §7]`.
 *
 * It takes the type as a plain string rather than importing
 * `FollowUpAnchorType` or `NotificationAnchorType`, so a client component can
 * use it without dragging a data module's types along behind it.
 *
 * Every anchor type has a screen already; `company` is the fallback because
 * both unions end there.
 */
export function anchorHref(anchorType: string, anchorId: string): string {
  if (anchorType === "quotation_thread") return `/quotations/${anchorId}`;
  if (anchorType === "project") return `/projects/${anchorId}`;
  if (anchorType === "contact") return `/contacts/${anchorId}`;
  return `/companies/${anchorId}`;
}
