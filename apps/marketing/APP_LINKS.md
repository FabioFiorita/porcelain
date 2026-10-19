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
The button only appears after validation and only navigates when pressed.

Before deployment, replace `REPLACE_WITH_APPLE_TEAM_ID` in the AASA file with
the signing team's identifier, and replace each named Preview/Production Android
SHA-256 placeholder in `assetlinks.json` with the corresponding signing certificate
fingerprint. Neither value is present in the repository or `apps/mobile/eas.json`.
EAS project IDs and App Store Connect numeric app IDs are not Apple Team IDs.
Do not substitute the local debug signing key for a Preview or store key.
These placeholders deliberately cannot establish an association.

The mobile configuration applies to development, Preview and Production builds.
The public association lists Preview and Production only: development routing can
be verified with an explicit Android intent to the disposable development package.
This does not prove automatic domain verification. New native binaries and the
marketing deployment are both required; an OTA update cannot add the entitlement
or intent filter. After authorized deployment and binary delivery, verify HTTPS
200 responses without redirects and `Content-Type: application/json`, then test a
physical iPhone and Android device. iOS delivery remains blocked on #399.

References: [Expo iOS universal links](https://docs.expo.dev/linking/ios-universal-links/),
[Expo Android App Links](https://docs.expo.dev/linking/android-app-links/),
[Pages headers](https://developers.cloudflare.com/pages/configuration/headers/),
[Pages redirects](https://developers.cloudflare.com/pages/configuration/redirects/).
