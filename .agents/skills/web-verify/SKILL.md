---
name: web-verify
description: Inspect and interact with Porcelain web on a disposable server using the in-app browser, confirm observable results, and stop owned resources.
---

# Web verification

Use the in-app browser for interactive work. The repository launcher owns the disposable server, Vite and private attachment page; the browser tool owns its tab. The launcher does not drive a browser or assert results. Automated Playwright regression tests remain a separate responsibility.

## Start and attach

From the repository root:

```sh
C=.agents/skills/web-verify/scripts/cli
$C doctor
$C start
```

Start prints the instance id, web URL, attachment URL, private connection file, evidence folder and sample repository. Open the attachment URL in an owned hidden in-app tab, inspect the button named `Open workspace`, and click it to pair. `pair` refreshes an expired or consumed link and prints the attachment details again. Opening the web URL in a fresh browser before pairing lets you inspect the not-paired state.

`start --desktop` serves the desktop renderer without Electron; it does not prove a native bridge. `--coding-tool` installs the kit's fake coding-tool executable in the disposable server. With several instances, pass `--instance <id>` to launcher commands.

The services bind to loopback. If the launcher runs on another host, forward both printed web and attachment ports with the same port numbers. The link uses the printed web origin. For a second disposable computer, also forward the distinct port printed as `remote address` before adding its link: the renderer contacts that origin directly. Run disk readback where the sample repository lives.

### Browser interaction

Create one owned tab through the computer-use tool's documented entry point:

```js
let tab = await cua.createBrowserTab('iab', attachmentUrl, { visible: false });
```

Read returned documentation. Use its advertised viewport capability, AX observations, input actions and screenshots; do not guess unsupported APIs. Refresh AX state after actions before choosing new targets. Right-click uses the documented right mouse button, and form input uses the documented value setter. In a file editor, focus the editor and use keyboard selection/caret movement and typing; confirm the resulting text.

Generic contenteditable value setting can insert instead of replacing. Select all before a replacement, type through keyboard input, then read the buffer and actual file. A successful command or Saved label does not prove correct content.

A new tab does not establish a separate browser profile. The disposable origin and fresh pairing are the data boundary. Independent profile creation is not exposed by this tool. Keep emitted screenshots as evidence when the tool has no supported file export.

### Private links and same-document pairing

The connection file contains `{ web, pairingUrl }`, has mode 0600, and is removed on stop. The attachment page exposes the same URL only as the observed button's `data-pairing-url`. Do not print that code, put it in a report, or publish an unredacted capture.

For same-document `/pair` hash-change verification, keep the unpaired workspace tab at `/pair`. Open the fresh attachment page in another owned hidden tab. Read its observed button’s private destination with the browser's documented DOM API; keep the value in the REPL without emitting it:

```js
let linkTab = await cua.createBrowserTab('iab', attachmentUrl, { visible: false });
let pairingUrl = await linkTab.playwright
  .getByRole('button', { name: 'Open workspace', exact: true })
  .getAttribute('data-pairing-url');
await linkTab.close();
await tab.goto(pairingUrl);
await tab.playwright.getByRole('region', { name: 'Review content' }).waitFor({ state: 'visible', timeoutMs: 10000 });
await tab.getAXState();
```

Follow the returned tool documentation and observed button before this read. The value must be present; inspect a failed read instead of navigating with it. Wait for a code-free workspace URL before capturing evidence. If an input still holds a private URL, use `getAXState({ emit: false })` and redact the private code before emitting or saving that observation. An ordinary attachment-button click from the attachment page navigates to another document and does not prove the same-document case.

`remote pairing-link [--trusted]` prints a separate attachment URL and private file. Read that attachment's observed button through the same workflow, then set the observed remote-link field in the workspace through the documented browser API. Retain the exact URL privately only when testing reuse; do not issue a new link for that case.

## Drive a finite promise

State expected user-visible behavior and relevant entry points before interacting. The optional [feature guides](features/README.md) provide navigation and fixture setup. They are ordinary Markdown guidance, not an API contract, required inventory or synchronized schema.

Choose and verify the viewport. Many guides describe compact 414×896 drawers; at 1280×800 use the visible navigator/review panes instead. Confirm actual screenshot dimensions rather than crediting a successful resize call. Compact mouse/keyboard interaction does not establish touch or native-mobile behavior.

Follow semantic steps. When a state differs, inspect it before continuing dependent actions. Re-derive targets after navigation, dialogs or reloads. Distinguish failed input, premature observations and unsupported actions from product failures.

Confirm a rename after a real reload and with `$C server project`. Confirm edits after navigation away/back and by reading the actual sample file. Compare exact expected content, including duplication or truncation. Record attempted, successful, failed and unavailable actions separately; narrow claims to observed entry points, width and connection.

### Capability limits

The selected browser exposes console observations, but no request interception or live WebSocket fault controls. A guide requiring an exact HTTP hold/failure or deliberate live-connection drop cannot be credited from ordinary UI success. Record that limitation and reassess the missing capability openly. Do not switch interactive drivers on failure. Existing automated regression tests exercise those controlled conditions separately.

Browser request-history inspection is also not exposed in the selected tool. Use launcher server readback and real persisted state for outcomes available through those boundaries; leave an exact browser HTTP/status requirement unverified when it cannot be observed. The tool's documented DOM API can inspect observed controls and private attachment controls, but page evaluation cannot read local files.

Agent publication and server readback are fixture operations, still listed by `$C` help. Shell and Git setup happen only in the printed sample repository. The server watches those real files.

## Evidence and stop

Retain native tool outputs, useful screenshots, exact expected/observed results and independent disk/server readback in the printed evidence folder or native conversation artifacts. Keep credentials and raw pairing captures private. Launcher `evidence` lists its retained records; it does not claim to capture the external tool's actions.

Close only owned browser tabs, resetting a temporary viewport first. Then:

```sh
$C stop --instance <id>
$C evidence --instance <id>
```

Stop removes runtime connection files and disposable data, and retains evidence. Repeating explicit stop confirms the already-stopped state without signaling other processes. Inspect a failed cleanup report before retrying. Stop never owns an external browser tab.

Vite serves live web edits to the open tab. The shared freshness check still refuses fixture commands and server readback after source changes; restart before using those commands. Stop the owned instance before changing the launcher or switching branches, while its recorded detail schema still matches the running launcher. Server and launcher changes require a new build/start and attachment. Retain which source/build was exercised. Run relevant regression files for product behavior you changed; CI owns whole suites.
