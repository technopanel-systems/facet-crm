import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/page-header";
import { can, requireSession } from "@/lib/authz";
import { getDispatch, listDispatchProjectOptions } from "@/lib/dispatches";
import {
  listProductClasses,
  listProductFireRatings,
  listProductSuppliers,
  listProductThicknesses,
  lookupName,
} from "@/lib/lookups";

import { updateDispatchRequestAction } from "../../actions";
import { DispatchEditForm } from "../../dispatch-form";

export const dynamic = "force-dynamic";

/**
 * `S125` `S62` — **a rep edits their own request until they submit it. After
 * that the coordinator edits it.**
 *
 * The route offers itself to exactly the two identities the rule names, and
 * `notFound()`s for everyone else: a screen someone may not use and one that
 * does not exist must look identical `D53`. `updateDispatchRequest` makes the
 * same two checks before it writes `S109`, so this is presentation.
 */
export default async function EditDispatchRequestPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const session = await requireSession();
  const t = await getTranslations();

  const dispatch = await getDispatch(session, id);
  if (!dispatch) notFound();

  // The rule, twice: their own draft, or the coordinator's submitted one.
  // Approved is final `S73`; refused is archived until revived `S122`.
  const mine =
    dispatch.status === "draft" &&
    dispatch.recordedByUserId === session.user.id;
  const hers = dispatch.status === "submitted" && can(session, "canDispatch");
  if (!mine && !hers) notFound();

  // `S74` — a request against a quotation with no project of its own `S50` is
  // the only one where the project is a choice. A free entry names none `S75`.
  const chooseProject =
    dispatch.quotationThreadId !== null && dispatch.threadProjectId === null;

  const [projects, suppliers, classes, fireRatings, thicknesses] =
    await Promise.all([
      chooseProject ? listDispatchProjectOptions(session) : [],
      listProductSuppliers(),
      listProductClasses(),
      listProductFireRatings(),
      listProductThicknesses(),
    ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("dispatches.editTitle")}
        description={
          hers
            ? t("dispatches.detail.editByCoordinator")
            : t("dispatches.detail.editByRep")
        }
      />

      <DispatchEditForm
        action={updateDispatchRequestAction.bind(null, id)}
        dispatchId={id}
        // `S116` — what the request carries now, kept or changed.
        lines={dispatch.lines.map((line) => ({
          supplierId: line.supplierId,
          classId: line.classId,
          fireRatingId: line.fireRatingId,
          customColour: line.customColour,
          thicknessId: line.thicknessId,
          widthM: line.widthM,
          lengthM: line.lengthM,
          quantityPcs: line.quantityPcs,
          unitPrice: line.unitPrice,
        }))}
        dispatchDate={dispatch.dispatchDate}
        projectLabel={
          dispatch.projectId
            ? lookupName(
                {
                  nameEn: dispatch.projectNameEn ?? "",
                  nameAr: dispatch.projectNameAr,
                },
                locale,
              )
            : null
        }
        chooseProject={chooseProject}
        projectId={dispatch.projectId}
        projects={projects.map((project) => ({
          id: project.id,
          label: lookupName(project, locale),
        }))}
        products={{ suppliers, classes, fireRatings, thicknesses }}
        locale={locale}
      />
    </div>
  );
}
