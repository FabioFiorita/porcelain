---
screen: /computers
selectors:
  - "Add computer"
  - "add-environment"
  - "Pair a computer"
  - "pairing-link"
  - "Pair"
  - "pair-environment"
  - "Cancel"
  - "cancel-pairing"
  - "Use development server"
  - "development-pairing-link"
  - "Creating pairing link…"
  - "Online"
tests:
  - apps/server/spec/kit/development-pairing.spec.ts
api:
  - POST /api/pair
  - GET /api/environment
  - GET /api/session
---

# access.pairing

## What it is

Add computer opens “Pair a computer” inline in the iPad Computers detail, or in a native sheet on a phone, where the link `porcelain pair` printed is pasted. Pair redeems it as this device, saves the credential in the Keychain and the environment in SQLite, closes the form and lists the environment as “Online”. An invalid link is refused in the form; editing the link clears that error. Pair is disabled for a blank link or unreadable saved environments, and the request uses the existing 15-second mobile deadline. A save error offers Read saved computers again in the form. Cancel closes it, several environments can be paired, and every paired environment is restored after a cold launch. Pairing a different address for the same environment retains the existing connection; see [multiple connections](access.connections.md).

On phones the sheet opens at half height and can expand to full height. Its React Native content scrolls and uses the shared Uniwind theme; the field and buttons are the shared `components/ui` primitives. The same form renders inside the iPad Computers detail without a sheet.

When Metro is launched by mobile-verify, Use development server requests a fresh single-use link from the disposable server's private owner socket and fills Pairing link. It does not pair automatically: select the normal Pair button to redeem the link. Creating pairing link… disables the field, helper and Pair while the request runs; Cancel remains available. A helper failure stays visible in the form, and selecting Use development server again retries. Editing the field clears both errors. The helper is absent from production bundles and development sessions without a configured helper URL; Metro accepts only loopback POST requests.

## How a user reaches it

- Settings → Computers → Add computer → paste the link → Pair
- Metro development: Settings → Computers → Add computer → Use development server → Pair

## Driving it

1. Select Settings, then Computers. Select Add computer in the Computers section (test id add-environment). Expect Pair a computer inline on iPad or in a sheet on a phone.
2. Enter invalid-link in the pairing-link field and select Pair (test id pair-environment). Expect the form to remain open with an invalid-link explanation; no native device is added on the server.
3. Use the card's pairing command to mint a fresh link. Paste it in pairing-link, wait for the keyboard animation to settle, then select Pair.
4. Expect the form to close and the environment to show Online. Read back the native device from the disposable server.
5. Repeat with a second disposable environment. Cold-launch and expect both environments restored.
6. Open Add computer and select Cancel (test id cancel-pairing). Expect the inline form or sheet closed with neither environment changed.
7. In the Metro development session, open Add computer and select Use development server (test id development-pairing-link). Expect a full link in pairing-link and no new device until Pair is selected. Request another link and expect its code to change; use Pair and read back the Development mobile device on the disposable server. Exercise the sheet on iPhone and the inline form on iPad.
8. Exercise a helper failure, expect an inline error, then retry after restoring the owner connection. While creating a link, select Cancel and expect the form closed; reopen it and expect a blank field with no error or pending request.

## What proves it works

Drive this feature with the mobile-verify skill on demand.

## Gotchas

- A link works once, for a few minutes; the card's pairing command issues a fresh one.
- The invalid-link message comes from the shared client, so the map names the sheet title instead.
- Use the button test ids when driving pairing: XCTest snapshots can also label a button's enclosing native host, making a label-only selector ambiguous.
- The verification launcher supplies PORCELAIN_OWNER_SOCKET and PORCELAIN_API_TARGET only to Metro and exposes the nonsecret helper URL as EXPO_PUBLIC_PORCELAIN_DEV_PAIR_URL. The link keeps the disposable server address, including the loopback port forwarded to the existing device host. Restart Metro after changing its configuration or owner socket; native app rebuilding is unnecessary for this JavaScript helper.
