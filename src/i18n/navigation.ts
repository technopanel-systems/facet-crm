import { createNavigation } from "next-intl/navigation";

import { routing } from "./routing";

/**
 * Locale-aware replacements for next/link and next/navigation.
 *
 * Always import Link, redirect, usePathname and useRouter from here for
 * internal routes — the raw next/* versions drop the locale prefix.
 */
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
