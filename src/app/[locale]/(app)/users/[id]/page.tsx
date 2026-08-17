import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import {
  Fact,
  Facts,
  DetailHeader,
} from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { can, getManagedUser, requireSession } from "@/lib/authz";
import { lookupName } from "@/lib/lookups";

import { deactivateUserAction, reactivateUserAction } from "../actions";
import { AccountActionForm } from "./account-actions";

export const dynamic = "force-dynamic";

export default async function UserDetailPage({
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
  const format = await getFormatter();

  // `19 §5` — you may not deactivate yourself, so the control is not offered.
  // The data layer refuses regardless; this only avoids showing a dead button.
  const isSelf = user.id === session.user.id;

  return (
    <div className="flex flex-col gap-6">
      <DetailHeader
        name={user.name}
        state={[
          lookupName({ nameEn: user.roleNameEn, nameAr: user.roleNameAr }, locale),
          user.region ? t(`enums.region.${user.region}`) : null,
        ]
          .filter(Boolean)
          .join(" · ")}
        action={
          <Button asChild size="sm" variant="outline">
            <Link href={`/users/${user.id}/edit`}>{t("team.actions.edit")}</Link>
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>{t("team.detail.account")}</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          <Facts>
            <Fact label={t("team.fields.email")}>
              <span dir="ltr">{user.email}</span>
            </Fact>
            <Fact label={t("team.fields.role")}>
              {lookupName({ nameEn: user.roleNameEn, nameAr: user.roleNameAr }, locale)}
            </Fact>
            <Fact label={t("team.fields.region")}>
              {user.region ? t(`enums.region.${user.region}`) : null}
            </Fact>
            <Fact label={t("team.fields.status")}>
              {user.isActive ? (
                <Badge variant="secondary">
                  {t("team.fields.statusActive")}
                </Badge>
              ) : (
                <Badge variant="outline">
                  {t("team.fields.statusInactive")}
                </Badge>
              )}
            </Fact>
            {user.deactivatedAt ? (
              <Fact label={t("team.fields.deactivatedAt")}>
                <span dir="ltr">
                  {format.dateTime(user.deactivatedAt, {
                    dateStyle: "medium",
                  })}
                </span>
              </Fact>
            ) : null}
            <Fact label={t("common.createdAt")}>
              <span dir="ltr">
                {format.dateTime(user.createdAt, { dateStyle: "medium" })}
              </span>
            </Fact>
          </Facts>

          {!user.canSignIn ? (
            <p className="text-muted-foreground mt-4 text-start text-sm">
              {t("team.detail.cannotSignIn")}
            </p>
          ) : null}
        </CardContent>
      </Card>

      {/* `19` requirement 3 — targets are already built. This links to them
          rather than rebuilding a per-person panel. */}
      <Card>
        <CardHeader>
          <CardTitle>{t("team.detail.targets")}</CardTitle>
          <CardDescription>{t("team.detail.targetsHint")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild size="sm" variant="outline">
            <Link href="/targets">{t("team.detail.viewTargets")}</Link>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("team.detail.handover")}</CardTitle>
          <CardDescription>{t("team.detail.handoverHint")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-start gap-4">
          {user.isActive ? (
            <>
              {/* `19 §3` — the review begins after access is revoked, so the
                  handover link appears only once the account is closed. */}
              <p className="text-muted-foreground text-start text-sm">
                {t("team.detail.handoverClosed")}
              </p>
              {isSelf ? null : (
                <AccountActionForm
                  action={deactivateUserAction.bind(null, user.id)}
                  label={t("team.actions.deactivate")}
                  hint={t("team.actions.deactivateHint")}
                  variant="destructive"
                />
              )}
            </>
          ) : (
            <>
              <Button asChild size="sm">
                <Link href={`/users/${user.id}/handover`}>
                  {t("team.actions.handover")}
                </Link>
              </Button>
              <AccountActionForm
                action={reactivateUserAction.bind(null, user.id)}
                label={t("team.actions.reactivate")}
                hint={t("team.actions.reactivateHint")}
                variant="secondary"
              />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
