# Public website boundary

The public website lives in `apps/site`, one independently deployable Next.js app for
landing, downloads, privacy, and Fumadocs documentation. It does not import application
implementations or connect to private Porcelain environments. `apps/web` remains the Vite
browser and Electron interface. No hosting provider has been selected.

Marketing and documentation share branding and global semantic styles. Documentation uses
its own Fumadocs layout. Public MDX belongs in `apps/site/content/docs`; contributor guides,
architecture, and decisions remain in the repository's `docs` directory. Public copy must
separate implemented server/browser foundations from planned end-user experiences. Downloads
remain unavailable until verified assets exist; the privacy page remains a draft until actual
operating practices are confirmed.

The foundation was generated non-interactively with `create-fumadocs-app@16.1.26`, resolved
from `latest`, using the `+next+fuma-docs-mdx` template, `--src`, and `--og-image next-og`
on Node 24.20.0 and pnpm 12.3.4. Search, Markdown negotiation, LLM exports, and OG routes remain
framework-owned integrations. Generated `.source` and Next outputs are not edited or committed.
The generated proxy is placed beside `src/app` to match Next's source-directory convention.

The site vendors only the existing shadcn primitives it uses from `apps/web`, with a client
boundary for the hook-based Badge. This keeps the deployments separate without introducing
a shared UI package or allowing application-to-application imports. Revisit extraction when
shared component maintenance warrants that boundary. The site uses the same preset primitives
and semantic token model; product behavior stays outside the vendor directory.

Root Biome, conventions, boundaries, Knip, and React Doctor include the site. Package typechecks
and build tasks use Turbo; browser smoke runs uncached, owns its production build and server,
and covers navigation, search, release state, privacy labeling, and generated documentation
endpoints at desktop and narrow Chromium sizes. A separate CI job owns this smoke. This does
not establish Electron, native mobile, or a deployed host's behavior.
