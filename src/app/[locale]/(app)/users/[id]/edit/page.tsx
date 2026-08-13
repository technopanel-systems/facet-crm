import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/page-header";
import { can, getManagedUser, listRoles, requireSession } from "@/lib/authz";

import { updateUserAction } from "../../actions";
import { UserForm } from "../../user-form";

export const dynamic = "force-dynamic";

export default async function EditUserPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const session = await requireSession();
  if (!can(session, "canManageUsers")) notFound();

  const user = await getManagedUser(session, id);
  if (!user) notFound();

  const t = await getTranslations();
  const roles = await listRoles();

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <PageHeader title={t("team.editTitle")} description={user.name} />
      {/* No password field: it is set at creation and there is no reset
          screen `[11 §5]`. The email IS editable `[19 §6]`. */}
      <UserForm
        action={updateUserAction.bind(null, user.id)}
        roles={roles}
        locale={locale}
        defaults={{
          name: user.name,
          email: user.email,
          roleId: user.roleId,
          region: user.region,
        }}
        submitLabel={t("common.save")}
        cancelHref={`/users/${user.id}`}
      />
    </div>
  );
}
