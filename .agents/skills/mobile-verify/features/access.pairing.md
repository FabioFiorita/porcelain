---
screen: /settings
selectors:
  - "Add environment"
  - "add-environment"
  - "Pair an environment"
  - "pairing-link"
  - "Pair"
  - "pair-environment"
  - "Cancel"
  - "cancel-pairing"
  - "Online"
tests:
  - apps/mobile/spec/e2e/pairing.e2e.ts
api:
  - POST /api/pair
  - GET /api/environment
  - GET /api/session
---

# access.pairing

## What it is

Add environment opens a native sheet, “Pair an environment”, where the link `porcelain pair` printed is pasted. Pair redeems it as this device, saves the credential in the Keychain and the environment in SQLite, closes the sheet and lists the environment as “Online”. An invalid link is refused in the sheet; editing the link clears that error. Pair is disabled for a blank link or unreadable saved environments, and the request uses the existing 15-second mobile deadline. A save error offers Read saved environments again in the sheet. Cancel closes it, several environments can be paired, and every paired environment is restored after a cold launch.

The sheet opens at half height and can expand to full height. Its React Native content scrolls and uses the shared Uniwind theme; the field and buttons are the shared `components/ui` primitives inside the Expo UI sheet.

## How a user reaches it

- Settings → Add environment → paste the link → Pair

## Driving it

1. Select Settings, then Add environment (test id add-environment). Expect Pair an environment.
2. Enter invalid-link in the pairing-link field and select Pair (test id pair-environment). Expect the sheet to remain open with an invalid-link explanation; no native device is added on the server.
3. Use the card's pairing command to mint a fresh link. Paste it in pairing-link, wait for the keyboard animation to settle, then select Pair.
4. Expect the sheet to close and the environment to show Online. Read back the native device from the disposable server.
5. Repeat with a second disposable environment. Cold-launch and expect both environments restored.
6. Open Add environment and select Cancel (test id cancel-pairing). Expect the sheet closed with neither environment changed.

## What proves it works

- `apps/mobile/spec/e2e/pairing.e2e.ts` (iPhone and iPad): an invalid link is refused, two real environments pair through their links, both are restored after a cold launch, and each server then holds exactly one device labelled “Native mobile proof” whose platform is `iOS` on iPhone and `iPadOS` on iPad, one `POST /api/pair` and at least three authenticated `GET /api/environment` reads from the app.

## Gotchas

- Wait for the sheet's keyboard animation to settle before tapping Pair; wait for it explicitly; the flows use `waitForAnimationToEnd`. Maestro's iOS `hideKeyboard` dismissed this sheet, so the flows never use it.
- A link works once, for a few minutes; the card's pairing command issues a fresh one.
- The invalid-link message comes from the shared client, so the map names the sheet title instead.
- Use the button test ids when driving pairing: XCTest snapshots can also label a button's enclosing native host, making a label-only selector ambiguous.
