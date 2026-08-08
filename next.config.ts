import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  // Emits a self-contained server bundle so the Docker runtime stage does not
  // need node_modules. See Dockerfile.
  output: "standalone",

  // `next dev` otherwise appends a self-re-adding block to CLAUDE.md on every
  // start. CLAUDE.md is the project's own rules file (see its header) and is
  // not a generated artifact. The Next 16 docs it points at are still readable
  // at node_modules/next/dist/docs/ — noted in the README instead.
  agentRules: false,
};

export default withNextIntl(nextConfig);
