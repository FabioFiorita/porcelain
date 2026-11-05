---
selectors:
  - 'Computer not paired'
  - 'Back to workspace'
tests:
  - apps/desktop/spec/e2e/review-links.e2e.ts
api: []
---

# app.review-links

A published HTTPS review link offers an explicit Mac app handoff and a browser fallback. The packaged Mac app handles `porcelain-desktop://open/reviews/<id>` and uses its saved connection to the publishing environment. Local links use the app's own server. Unknown computers show the existing pairing state without granting access from the link.

## How to get to it (user POV)

Open a published link, then choose Open in Porcelain for Mac. A newly built installed Mac app is required; browser fallback remains available. Return with Back to workspace or the review's normal navigation.

## Driving it with Electron

Preconditions: [surface baseline](README.md).

1. Build marketing and serve its static output through local Pages preview. With a valid link, inspect both destinations. Invalid links expose neither action.
2. With disposable Porcelain Dev, deliver the custom URL through `app.emit('open-url', event, url)` in the Electron main process. Confirm review, revision, decision and environment in the renderer destination. For the matching-local journey, register the disposable repository and publish a real review first. Build the link from its returned review ID and revision plus the published decision ID. Assert the rendered decision and read back that revision from the server before checking the strict unexpected-error list. A matching local environment must not be treated as remote.
3. Launch a fresh disposable app with the URL argument to prove startup retention; launch a second process with the same profile and URL to prove single-instance delivery. An unpaired environment must show Computer not paired; Back to workspace returns home.
4. Repeat with a saved paired remote and a published review; confirm that computer's actual review content. Reject unsafe hosts, credentials, fragments and duplicate known query keys before navigation.

## Gotchas

- Startup arguments and second-process delivery are `portable` regressions on Linux and macOS. The emitted Mac `open-url` event is a `macos` regression; neither proves installed protocol registration.

- Unpackaged development does not register as the operating system's protocol default and must not replace the installed app's registration. Injected open-url proves handler/bridge delivery, not Launch Services or a browser-to-installed-app journey.
- Release packaging declares the URL scheme and release startup registers it. Actual browser-to-app delivery requires a newly built Mac binary; marketing deployment alone cannot update the installed app.
- Mobile HTTPS association and browser fallback remain separate entry points.
