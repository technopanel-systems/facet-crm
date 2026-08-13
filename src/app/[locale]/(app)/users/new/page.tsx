import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/page-header";
import { can, listRoles, requireSession } from "@/lib/authz";

import { createUserAction } from "../actions";
import { UserForm } from "../user-form";

export const dynamic = "force-dynamic";

export default async function NewUserPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await requireSession();
  if (!can(session, "canManageUsers")) notFound();

  const t = await getTranslations();
  const roles = await listRoles();

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <PageHeader title={t("team.newTitle")} />
      {/* There is no self-registration anywhere in FACET `[11 §1]`: this form
          is the only way an account comes into being, and the password is set
          here because no reset screen exists `[11 §5]`. */}
      <UserForm
        action={createUserAction}
        roles={roles}
        locale={locale}
        submitLabel={t("common.create")}
        cancelHref="/users"
        withPassword
      />
    </div>
  );
}
