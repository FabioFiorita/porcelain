# App links

The static Astro output is served by Cloudflare Pages, project `porcelain`,
custom domain `porcelain.fabiofiorita.com`. Live read-only inspection on
2026-10-19 found GitHub integration from `FabioFiorita/porcelain`, production
branch `main`, build command
`pnpm --filter "@porcelain/marketing..." install --frozen-lockfile && pnpm --filter @porcelain/marketing build`,
and output `apps/marketing/dist`. There is no deploy workflow in this checkout.
No deployment was performed for this change.

Pages reads `public/_headers` and `public/_redirects` from the built output.
Pairing uses the static page at `/open/pair/`.

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

## Pairing links

The server builds pairing links on the app-link origin from its settings:
`https://porcelain.fabiofiorita.com/open/pair#c=<code>&e=<environment>&a=<addresses>`.
The code stays in the fragment, so no request carries it; only the page's script
reads it, in the browser. The iOS
association's `/open/*` component and the Android `/open` path prefix already
cover `/open/pair`, so the association files are unchanged. `_redirects` rewrites
`/open/pair` to the static `/open/pair/` page, which validates the fragment in the
browser and offers, only when pressed, the first address's own `/pair#c=…&e=…`
page. Clients still decode the older `<address>/pair#…` links.

Installed apps are already associated with `/open/pair`, so the Camera opens the
app as soon as a server prints these links. Until the app's router handles
`/open/pair`, a JavaScript route an app update can deliver, it opens on an
unmatched route. The browser page needs the marketing deployment.
