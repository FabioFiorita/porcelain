# Porcelain mobile delivery

The [Porcelain Expo project](https://expo.dev/accounts/fabiofiorita/projects/porcelain) uses the repository's `apps/mobile` base directory. In Expo, open **Workflows → Run a workflow**, choose `main` and select **Preview delivery** or **Production delivery**. Both workflows are manual only; pushes and pull requests do not start EAS jobs.

| Profile       | Delivery                                        | App               |
| ------------- | ----------------------------------------------- | ----------------- |
| `development` | Simulator development client, loaded from Metro | Porcelain Dev     |
| `preview`     | Standalone, ad hoc iOS install link             | Porcelain Preview |
| `production`  | Store-signed iOS build uploaded to TestFlight   | Porcelain         |

Preview builds include the JavaScript bundle and connect directly to a paired Porcelain service; Metro is only needed for development. One iOS build supports iPhone and iPad. These workflows intentionally build iOS only.

Each manual run fingerprints the selected variant and looks for a compatible build on its own channel. If one exists, the workflow publishes an OTA update; if the native runtime changed, it creates a signed binary. Set **force_build** to create a new binary regardless, for example after changing the ad hoc provisioning profile. A matching in-progress build is awaited instead of starting another one.

Production submits a newly built binary to App Store Connect for TestFlight. An OTA-only run has no store submission. A production OTA reaches compatible installations on the production channel, including TestFlight and any future store installations. App Store review and public release remain separate actions. Build numbers increment on EAS.

Expo Updates checks for compatible updates at launch without delaying startup for the network. Downloaded updates take effect on a later cold launch; the bundled code remains available offline and Expo's default error-recovery protections remain enabled. Preview and production use separate native identities and channels. Expo Observe and behavioral analytics are not included; the privacy-page OTA disclosure is tracked separately.

## One-time Expo setup

Connect `FabioFiorita/porcelain` in the project's GitHub settings and set its base directory to `apps/mobile`. Use an Expo account with access to the `fabiofiorita` project. The profile's committed `APP_VARIANT` selects the app identity; no product secrets or server address are required at build time.

Ad hoc preview requires Apple signing credentials for `com.fabiofiorita.porcelain.preview` and a provisioning profile that includes each physical iPhone/iPad. Register devices and configure the `preview` profile before running it from the dashboard. Existing provisioning profiles do not automatically gain newly registered devices; regenerate the profile before building for additional devices.

Production uses the existing Porcelain App Store Connect app (`6796720233`, bundle `com.fabiofiorita.porcelain`). Configure its store signing credentials and an EAS-managed App Store Connect submission key before the first production run. Signing credentials belong in EAS, not in Git.

From a local terminal signed into the personal Expo account, run these commands in `apps/mobile` as needed:

```sh
eas device:create
eas credentials:configure-build --platform ios --profile preview
eas credentials --platform ios
```

The last command configures the production submission key through **App Store Connect → Manage your API Key**. Local login is unnecessary when starting an already configured workflow from Expo's dashboard. For a manual CLI run from this directory:

```sh
eas workflow:run .eas/workflows/preview.yml --ref main
# Only when intentionally preparing TestFlight:
eas workflow:run .eas/workflows/production.yml --ref main
```

References: [workflow syntax](https://docs.expo.dev/eas/workflows/syntax/), [ad hoc distribution](https://docs.expo.dev/build/internal-distribution/), [iOS submission](https://docs.expo.dev/submit/ios/).
