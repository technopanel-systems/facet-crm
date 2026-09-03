import { getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

/**
 * The 404 every CRM screen falls back to.
 *
 * It says nothing about why. A record hidden by visibility and a record that
 * never existed must look identical, or the message itself becomes a way to
 * confirm that someone else's company exists `[04 Q7]`.
 *
 * **The link out is load-bearing, not decoration.** Next replaces the whole
 * `(app)` subtree with this boundary — layout included — so the rail is not
 * here `[23]`. A rep who mistypes a URL has no navigation at all, and this
 * button is the only way back that is not the browser's own. It names Today,
 * the same word the rail uses for `/`: a second name for one place is how a
 * non-technical reader learns not to trust either.
 */
export default async function NotFound() {
  const t = await getTranslations();

  return (
    <div data-slot="not-found" className="flex max-w-2xl flex-col items-start gap-4 py-8">
      <h1 className="text-start text-xl font-semibold tracking-tight">
        {t("errors.notFound.title")}
      </h1>
      <p className="text-muted-foreground text-start text-sm">
        {t("errors.notFound.body")}
      </p>
      <Button asChild size="sm" variant="outline">
        <Link href="/">{t("errors.notFound.home")}</Link>
      </Button>
    </div>
  );
}
