# access.remote-computers

## What it is

The desktop app pairs with another Porcelain from the link `porcelain pair` prints. It talks to that computer across origins with its own credential and shows it online. It refuses an unreadable link, a used or bad code and a link for this computer, and it forgets a remote on Remove. Web and mobile use the same native Effect persistence service and readonly Atom state: a change appears only after storage succeeds. An unreadable store blocks pairing and changes until Read saved environments succeeds.

## How a user reaches it

- Workspace → `Toggle Sidebar` (phone width) → `Settings` (navigator footer) → `Remote computers`.
- The navigator's remote-computer menus open the same section (`onOpenRemotes` → `/settings/remotes`).
- Route: `/settings/remotes` (desktop shell only).
- Controls: textbox "Pairing link" + `Add` (or `Enter`); `Remove <computer name>` on each row.

## Driving it

`C=.agents/skills/web-verify/scripts/cli; $C start --desktop`; `WEB` is the web URL it printed. Steps 8 to 12 add the second computer `remote start` runs beside this one.
After each start, use the skill’s in-app attachment workflow: open the fresh attachment page in an owned tab and follow "Open workspace".

### Refusals (this computer alone)

1. Open `/settings/remotes` on the instance web URL
   Look for: heading "Remote computers"; the text "No remote computers yet"; button "Add" [disabled].
2. Set the text field named 'Pairing link' to 'not a link'
   Look for: button "Add" enabled.
3. Click the button named 'Add'
   Look for: alert "Paste the whole link porcelain pair printed, starting with http."
4. `ENV=$(curl -s "$WEB/api/health" | python3 -c "import json,sys; print(json.load(sys.stdin)['environmentId'])")` (this computer's environment id), then set the text field named 'Pairing link' to `http://127.0.0.1:9/pair#c=pcp_unused&e=<environmentId>`, substituting the actual `ENV` value
   Look for: the previous alert is gone.
5. Click the button named 'Add'
   Look for: alert "That link is for this computer." (checked before any request).
6. Set the text field named 'Pairing link' to `<web URL>/pair#c=pcp_bogus&e=another-computer`, using the printed web URL
   Look for: the previous alert is gone.
7. Click the button named 'Add', then wait for text containing 'That link was not accepted'
   Look for: alert "That link was not accepted. It works once, for a few minutes; run porcelain pair again." (`POST /api/pair` refused the code; a used link shows the same message).

### Pair, refuse the reused link, forget

8. Run `$C remote start`, then `$C remote pairing-link`. Use the skill’s in-app private attachment workflow to observe the remote attachment page’s "Open workspace" button, read its data-pairing-url attribute into a private REPL variable without printing it, and set the 'Pairing link' field in the original tab. Retain that exact URL privately for step 9, then click the button named 'Add'
   Look for: "remote computer Remote journey computer, project remote-sample" and its address; the status becomes "Online"; list "Remote computers" with listitem "Remote journey computer" holding "http://127.0.0.1:<remote port> · Porcelain 1.0.0" and "Online"; textbox "Pairing link" empty again.
9. Set the 'Pairing link' field to the same URL retained privately in step 8 through the skill’s in-app private attachment workflow, click the button named 'Add', then wait for text containing 'That link was not accepted'
   Look for: alert "That link was not accepted. It works once, for a few minutes; run porcelain pair again."; "Remote journey computer" still listed once.
10. Open `/settings/remotes` on the instance web URL, then wait for the text 'Online'
    Look for: listitem "Remote journey computer" still listed with "Online" (without the desktop bridge the app keeps remotes in `localStorage`, `porcelain.remotes`).
11. `$C server devices --remote`
    Look for: a device labelled "Remote computer" beside the remote's "Development setup": the remote holds this app's own credential.
12. Click the button named 'Remove Remote journey computer'
    Look for: the text "No remote computers yet".

## What proves it works

- Steps 3, 5 and 7: each refusal shows its alert, and the list stays empty.
- Step 8: "Online" means the remote answered `GET /api/environment` and authenticated `GET /api/session` with the new credential; browser network evidence inspected right after it lists the cross-origin `POST <remote>/api/pair` (200), `GET <remote>/api/environment` (200) and `GET <remote>/api/session` (200). Step 11 reads the new device on the remote under the label its link was issued for.
- `apps/web/spec/e2e/access-remote-computers.desktop.e2e.ts` also revokes the remote device, reloads Settings, and checks “Needs pairing” before forgetting it. It starts a second server named "Remote journey computer". It checks the empty state and the "Paste the whole link …" refusal, and "That link is for this computer." for a link with this server's id. With a real link from the remote, it checks the listitem named after the remote containing "Online", and that the remote's devices include "Remote computer". A reused link gets "That link was not accepted …". `Remove <name>` brings back "No remote computers yet".

## Gotchas

- `$C remote pairing-link` returns a safe attachment page for a fresh one-time link; step 9 must reuse the exact URL retained privately in step 8. Do not issue another link, store the code in a shell variable or return it as tool output.
- Desktop shell only: without `--desktop`, Settings has no Remote computers section. The desktop bridge changes where remotes are saved (the Keychain instead of `localStorage`). A failed storage read or write shows "Saved remote computers could not be read"; allow storage access, then choose Read saved environments. The last published remotes stay intact while writes are blocked.
- Remote status refreshes every 30 s (`REMOTE_STATUS_REFRESH_MS`) with a 5 s timeout. Right after Add the badge may read "Checking".
- Step 7 counts as a failed pairing attempt on this server. Do not repeat it in a loop.
