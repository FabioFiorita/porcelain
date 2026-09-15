# Test environments

Porcelain does not use simulated browsers (jsdom, happy-dom, or similar).
Those tools only approximate a page: layout, focus, overlays, CSS, and real
event sequences diverge from Chromium, which is how this app is used.

Three layers:

1. **Unit** — domain, contracts, git, server, and other code with no view.
   Vitest in Node. No DOM.
2. **View integration** — a specific view or query harness against domain
   types and API fixtures. Vitest Browser Mode in Chromium
   (`vitest-browser-react`). Proof is rendered behavior, not a fake window.
3. **End-to-end** — the built app and a disposable real API. Playwright in
   `apps/web/e2e`. Persistence and authentication stay here, not in view specs.

A function that needs `DOMParser` or other browser APIs is not a Node unit
spec; run it in Browser Mode. Do not add a DOM simulation package to make a
unit spec convenient.
