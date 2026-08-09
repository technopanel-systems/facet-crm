import { getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

/**
 * The 404 every CRM screen falls back to.
 *
 * It says nothing about why. A record hidden by visibility and a record that
 * never existed must look identical, or the message itself becomes a way to
 * confirm that someone else's company exists `[04 Q7]`.
 */
export default async function NotFound() {
  const t = await getTranslations();

  return (
    <main className="mx-auto flex max-w-2xl flex-col items-start gap-4 px-6 py-16">
      <h1 className="text-start text-xl font-semibold tracking-tight">
        {t("errors.notFound.title")}
      </h1>
      <p className="text-muted-foreground text-start text-sm">
        {t("errors.notFound.body")}
      </p>
      <Button asChild size="sm" variant="outline">
        <Link href="/">{t("errors.notFound.home")}</Link>
      </Button>
    </main>
  );
}
