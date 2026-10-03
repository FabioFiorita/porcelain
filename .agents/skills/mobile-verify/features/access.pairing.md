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
---

# access.pairing

## What it is

Add environment opens a native sheet, “Pair an environment”, where the link `porcelain pair` printed is pasted. Pair redeems it as this device, saves the credential in the Keychain and the environment in SQLite, closes the sheet and lists the environment as “Online”. An invalid link is refused in the sheet, Cancel closes it, several environments can be paired, and every paired environment is restored after a cold launch.

The sheet opens at half height and can expand to full height. Its React Native content scrolls and uses the shared Uniwind theme; the field, buttons and sheet remain Expo UI controls.

## How a user reaches it

- Settings → Add environment → paste the link → Pair

## Driving it

Start an instance first: `.agents/skills/mobile-verify/scripts/cli start`. Start itself pairs through this flow; drive it again to pair a second time with a fresh link from the same server.

```sh
.agents/skills/mobile-verify/scripts/cli open /settings
.agents/skills/mobile-verify/scripts/cli tap --id add-environment
.agents/skills/mobile-verify/scripts/cli fill invalid-link --id pairing-link
.agents/skills/mobile-verify/scripts/cli tap --id pair-environment
.agents/skills/mobile-verify/scripts/cli snapshot
```

Look for: the sheet “Pair an environment” stays open and says to paste the whole link `porcelain pair` printed, starting with http.

```sh
.agents/skills/mobile-verify/scripts/cli fill {pairing-link} --id pairing-link
.agents/skills/mobile-verify/scripts/cli tap --id pair-environment
.agents/skills/mobile-verify/scripts/cli snapshot
```

Look for: the sheet closes and the environment shows “Online”. `{pairing-link}` makes the CLI issue a fresh one-time link from its server and type it; the evidence records the placeholder, never the link.

## What proves it works

- `apps/mobile/spec/e2e/pairing.e2e.ts` (iPhone and iPad): an invalid link is refused, two real environments pair through their links, both are restored after a cold launch, and each server then holds exactly one device labelled “Native mobile proof” whose platform is `iOS` on iPhone and `iPadOS` on iPad, one `POST /api/pair` and at least three authenticated `GET /api/environment` reads from the app.

## Gotchas

- Wait for the sheet's keyboard animation to settle before tapping Pair; the CLI's `fill` waits for it, and the flows use `waitForAnimationToEnd`. Maestro's iOS `hideKeyboard` dismissed this sheet, so the flows never use it.
- A link works once, for a few minutes; `{pairing-link}` issues a new one each time.
- The invalid-link message comes from the shared client, so the map names the sheet title instead.
- Use the button test ids when driving pairing: XCTest snapshots can also label a button's enclosing native host, making a label-only selector ambiguous.
