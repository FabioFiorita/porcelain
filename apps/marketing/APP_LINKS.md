# Review links

The static Astro output is served by Cloudflare Pages, project `porcelain`,
custom domain `porcelain.fabiofiorita.com`. Live read-only inspection on
2026-10-19 found GitHub integration from `FabioFiorita/porcelain`, production
branch `main`, build command
`pnpm --filter "@porcelain/marketing..." install --frozen-lockfile && pnpm --filter @porcelain/marketing build`,
and output `apps/marketing/dist`. There is no deploy workflow in this checkout.
No deployment was performed for this change.

Pages reads `public/_headers` and `public/_redirects` from the built output.
The former sets both association files to `application/json`; the latter serves
the static browser fallback for arbitrary `/open/reviews/<reviewId>` URLs with a
200 rewrite, retaining the original path and query for validation in the browser.
Its target is `/open/reviews/`, without `index.html`: Pages redirects explicit
`index.html` paths to their directory URL, which causes it to reject that rewrite.
The button only appears after validation and only navigates when pressed.

The AASA file uses the supplied Apple Team ID `9QH8M89WF9` for Preview and
Production. The Preview/Production Android SHA-256 placeholders in
`assetlinks.json` remain because no Android binary is distributed. Before Android
delivery, replace them with the corresponding signing certificate fingerprints;
do not substitute the local debug signing key for a Preview or store key.
These Android placeholders deliberately cannot establish an association.

The mobile configuration applies to development, Preview and Production builds.
The public association lists Preview and Production only: development routing can
be verified with an explicit Android intent to the disposable development package.
This does not prove automatic domain verification. New native binaries and the
marketing deployment are both required; an OTA update cannot add the entitlement
or intent filter. After authorized deployment and binary delivery, verify HTTPS
200 responses without redirects and `Content-Type: application/json`, then test a
physical iPhone and Android device. Merging should trigger the marketing deployment when build watch paths match;
Fábio will run the new iOS Preview build from `main`.

References: [Expo iOS universal links](https://docs.expo.dev/linking/ios-universal-links/),
[Expo Android App Links](https://docs.expo.dev/linking/android-app-links/),
[Pages headers](https://developers.cloudflare.com/pages/configuration/headers/),
[Pages redirects](https://developers.cloudflare.com/pages/configuration/redirects/).

## Workspace build triggers

The current checkout has no Wrangler configuration or marketing deploy workflow;
Git integration remains the deployment owner. Dashboard watch paths and recent
build logs have not been inspected for this fix, so restricted watch paths are a
hypothesis, not a confirmed cause. Check skipped/failed deployments before
changing settings. Do not add a second deploy workflow alongside Git integration.

Proposed dashboard change (requires a separate authorized operation): Workers &
Pages → `porcelain` → Settings → Build → Build watch paths. Set Include paths to
the following repository-relative patterns and clear Exclude paths:

```text
apps/marketing/*
apps/server/*
packages/access/*
packages/agents/*
packages/changes/*
packages/client/*
packages/contracts/*
packages/effects/*
packages/files/*
packages/git/*
packages/git-actions/*
packages/kernel/*
packages/process/*
packages/projects/*
packages/reviews/*
packages/storage/*
packages/theme/*
package.json
pnpm-lock.yaml
pnpm-workspace.yaml
.node-version
patches/*
scripts/*
lefthook.yml
```

This list comes from `pnpm --filter "@porcelain/marketing..." list --depth -1`:
marketing directly depends on client and theme; client brings in contracts and
domain packages, plus server through its development dependency. The documented
filtered install includes development dependencies, so the complete selected
graph is included even where Astro currently tree-shakes the package away. Root
install configuration, patches and prepare scripts are included as build inputs.
Recompute the list when workspace dependencies change. Pages uses `*` across path
separators, so each directory pattern includes nested files. See
[Cloudflare build watch paths](https://developers.cloudflare.com/pages/configuration/build-watch-paths/).

After authorization, retry a production build from current `main` and confirm the
published bundle accepts `protocol=https` and an unknown query key. This proposal
alone does not refresh the already deployed bundle; no deployment or dashboard
change is part of this fix.
