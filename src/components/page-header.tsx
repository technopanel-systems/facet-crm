import type { ReactNode } from "react";

/**
 * The heading strip every CRM screen opens with: title on the reading side,
 * primary action on the far side. Logical alignment only, so Arabic mirrors
 * with no `rtl:` variant.
 */
export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="text-start">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description ? (
          <p className="text-muted-foreground mt-1 text-sm">{description}</p>
        ) : null}
      </div>
      {action ? <div className="flex items-center gap-2">{action}</div> : null}
    </div>
  );
}

/**
 * A labelled value on a detail screen. `null` renders the em dash rather than
 * collapsing the row — an empty field and a missing field look the same to a
 * rep, and both are worth seeing.
 */
export function DetailRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b py-2.5 last:border-b-0">
      <dt className="text-muted-foreground text-start text-sm">{label}</dt>
      <dd className="text-start text-sm font-medium">{children}</dd>
    </div>
  );
}
