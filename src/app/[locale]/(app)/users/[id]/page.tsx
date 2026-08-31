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
import { requestOriginForPeriod } from "@/lib/dispatches";
import { lookupName } from "@/lib/lookups";
import { currentPeriod, nextPeriodStart } from "@/lib/targets";

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

  /* `S123` — **who created a record is a measure**, for this one person.
   *
   * **It lives here since `28b`**, and it used to be a third table on
   * `/performance` beside attainment. Three figures in a row under one heading
   * needed a paragraph saying they could not be combined, and a caveat is a
   * design failing rather than a disclaimer. Two of the three DO combine —
   * `raised` is the denominator `raisedForThem` is a subset of, *and of nothing
   * else* — so the fraction below is the honest shape and the third figure
   * stands alone with its own window. The two labels are `S123`'s *two
   * questions, two figures, and a screen showing both must say which is which*.
   *
   * **The current month, and no picker.** The clock here is the ACT, not the
   * dispatch date; a control offering other months would put a second clock
   * back on a page that has none. `userId` NARROWS `visibleMeasuredUsersFilter`
   * and cannot widen it, so a reader who may not measure this person gets no
   * row and `D70` leaves the block out entirely. */
  const period = currentPeriod();
  const [origin] = await requestOriginForPeriod(
    session,
    period,
    nextPeriodStart(period),
    { userId: user.id },
  );

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
            {/* Both dates BARE — `dir="ltr"` scrambled their ar form, whose
                U+200F marks place the segments (A2-1, `98f1e2e`). */}
            {user.deactivatedAt ? (
              <Fact label={t("team.fields.deactivatedAt")}>
                {format.dateTime(user.deactivatedAt, {
                  dateStyle: "medium",
                })}
              </Fact>
            ) : null}
            <Fact label={t("common.createdAt")}>
              {format.dateTime(user.createdAt, { dateStyle: "medium" })}
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

      {/* `D70` — an empty block is absent, not an empty shell. */}
      {origin ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("team.origin.title")}</CardTitle>
            <CardDescription>
              {t("team.origin.hint", {
                month: format.dateTime(new Date(`${period}T00:00:00Z`), {
                  month: "long",
                  year: "numeric",
                  timeZone: "UTC",
                }),
              })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Facts>
              {/* A fraction, not two columns: `raised` is this figure's own
                  denominator and nothing else's. */}
              <Fact
                label={t("team.origin.raisedForThem")}
                name="origin-raised-for-them"
                numeric
              >
                {/* **`dir="auto"`, and `dir="ltr"` was wrong here** `D62`.
                    This is a PHRASE with a translated word between two
                    numbers, not a bare figure. Under an LTR base the Arabic
                    *3 من 14* lays out with the 3 on the left, and an Arabic
                    reader scanning right-to-left reads it as *14 من 3* — the
                    numerator and the denominator swapped, silently, on the one
                    figure that is a ratio. `auto` resolves off the first STRONG
                    character: `م` in Arabic and the `o` of *of* in English,
                    because European digits are weak and cannot decide it. The
                    figure beside this one keeps `dir="ltr"` — a bare number has
                    no order to get wrong. */}
                <span dir="auto">
                  {t("team.origin.outOf", {
                    part: origin.raisedForThem,
                    whole: origin.raised,
                  })}
                </span>
              </Fact>
              {/* Its own window, said in its own label — it counts edits made
                  this month to requests raised in ANY month, so it is not a
                  share of anything beside it. */}
              <Fact
                label={t("team.origin.editedByAnother")}
                name="origin-edited-by-another"
                numeric
              >
                <span dir="ltr">{origin.editedByAnother}</span>
              </Fact>
            </Facts>
          </CardContent>
        </Card>
      ) : null}

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
                  slot="account-deactivate"
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
                slot="account-reactivate"
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
