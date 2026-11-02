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
physical iPhone and Android device. Merging triggers the marketing deployment;
Fábio will run the new iOS Preview build from `main`.

References: [Expo iOS universal links](https://docs.expo.dev/linking/ios-universal-links/),
[Expo Android App Links](https://docs.expo.dev/linking/android-app-links/),
[Pages headers](https://developers.cloudflare.com/pages/configuration/headers/),
[Pages redirects](https://developers.cloudflare.com/pages/configuration/redirects/).
