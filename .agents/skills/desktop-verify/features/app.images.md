---
selectors:
  - 'Open PR #'
  - 'Description'
tests:
  - apps/desktop/spec/e2e/images.e2e.ts
api: []
---

# app.images

Desktop Markdown and PR descriptions display HTTPS images, including GitHub private attachments, alongside app, data and blob images. The desktop response policy governs image requests in the renderer.

## How to get to it

Open a PR from its sidebar button and scroll to images in Description. Expand an evidence disclosure if present. Shared PR navigation is described in the web map `projects.pull-request-document.md`.

## Driving it with Electron

Use the disposable app lifecycle. Supply a PR fixture containing HTTPS screenshots, open its sidebar PR button, and verify the image elements have nonzero natural dimensions. Capture the visible screenshots. `images.e2e.ts` independently tests the desktop policy with controlled PNG responses from a signed GitHub image host and another HTTPS host, without a network dependency.

## Gotchas

GitHub private attachment URLs expire: use fresh signed URLs from the rendered PR response. Private PR screenshots stay in local evidence; use nonprivate fixtures for published screenshots. Linux Electron proves the shared image policy; no Mac-specific APIs are involved.
