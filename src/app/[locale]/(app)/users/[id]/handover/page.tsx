import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/page-header";
import { can, listActiveUsers, requireSession } from "@/lib/authz";
import { bilingualName } from "@/lib/lookups";
import { getHandoverBook } from "@/lib/team";

import { reassignHandoverAction } from "../../actions";
import { HandoverForm } from "./handover-form";

export const dynamic = "force-dynamic";

export default async function HandoverPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const session = await requireSession();
  if (!can(session, "canManageUsers")) notFound();

  // `getHandoverBook` returns null for an unknown user AND for one who is
  // still active `[19 §3]` — the gate lives in the data layer, and a 404 is
  // how this screen expresses it. Hidden and non-existent look identical.
  const book = await getHandoverBook(session, id);
  if (!book) notFound();

  const t = await getTranslations();
  const format = await getFormatter();

  // Only an active colleague may receive work, and never the departing person
  // themselves — though the data layer refuses that too.
  const colleagues = (await listActiveUsers()).filter(
    (colleague) => colleague.id !== book.user.id,
  );

  const buckets = [
    {
      name: "membershipIds" as const,
      title: t("team.handover.companies"),
      empty: t("team.handover.noCompanies"),
      rows: book.companies.map((row) => ({
        id: row.membershipId,
        label: bilingualName(row, locale),
        badge: row.isPrimary ? t("team.handover.primary") : undefined,
      })),
    },
    {
      name: "projectIds" as const,
      title: t("team.handover.projects"),
      empty: t("team.handover.noProjects"),
      rows: book.projects.map((row) => ({
        id: row.id,
        label: bilingualName(row, locale),
      })),
    },
    {
      name: "threadIds" as const,
      title: t("team.handover.quotations"),
      empty: t("team.handover.noQuotations"),
      rows: book.quotationThreads.map((row) => ({
        id: row.id,
        label: bilingualName(
          { nameEn: row.projectNameEn, nameAr: row.projectNameAr },
          locale,
        ),
        note: bilingualName(
          { nameEn: row.companyNameEn, nameAr: row.companyNameAr },
          locale,
        ),
      })),
    },
    {
      name: "taskIds" as const,
      title: t("team.handover.tasks"),
      empty: t("team.handover.noTasks"),
      rows: book.tasks.map((row) => ({
        id: row.id,
        label: row.title,
        note: row.dueDate
          ? format.dateTime(new Date(`${row.dueDate}T00:00:00Z`), {
              dateStyle: "medium",
              timeZone: "UTC",
            })
          : t("team.handover.noDueDate"),
      })),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("team.handover.title")}
        description={t("team.handover.subtitle", { name: book.user.name })}
      />
      <p className="text-muted-foreground text-start text-sm">
        {t("team.handover.description")}
      </p>

      <HandoverForm
        action={reassignHandoverAction.bind(null, book.user.id)}
        buckets={buckets}
        colleagues={colleagues}
        isEmpty={book.isEmpty}
      />
    </div>
  );
}
