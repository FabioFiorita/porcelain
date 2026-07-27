# Environments v2 — recognizable, pairable, accountable

**Live plan.** Started 2026-07-26. Pillar 2 ("remote as a product") work: the environment layer shipped in v0.18–0.19 proved the *transport* (per-window daemon binding, tailnet/LAN binds, browser client). This plan fixes the *human* layer around it.

## The three complaints this answers

1. **"I don't remember where the token is."** Adding an environment means finding `~/.porcelain/daemon-token` on the other machine and pasting 64 hex chars.
2. **"I want to see what's connected to my Linux box."** The daemon holds `sessions = new Set<Session>()` with no identity on a session — no device, no connect time, no address. The question is currently unanswerable, and the only "revoke" is rotating the one shared token and re-pairing everything.
3. **"I want to recognize it a little bit more."** An environment is a user-typed string. Nothing tells you the window is on the Beelink except a name you invented, and the switcher is buried in Settings.

## Decisions

- **Identity is reported, not typed.** The daemon announces `hostname / platform / arch / version`. Names auto-fill; the human may still rename.
- **The chip is the switcher, and it is always visible** — including on This device. A control that only appears once you are *already* remote cannot be the thing you reach for to *go* remote. (Reverses the "chip only when remote" call from the per-window pass.)
- **Pairing replaces token archaeology.** A short-lived pairing code, transportable as a link or QR, exchanged for a per-device credential. The long-lived token stops being a thing the human ever reads.
- **Per-device credentials, so revoke means something.** One shared secret cannot be revoked per device. This is the same change as pairing, which is why they land together.
- **No scope matrix.** T3 splits credentials across view/operate/terminals/write-reviews/manage-access/relay. That is enterprise shape on a solo-dev tool: a device is trusted or it is gone.
- **An environment has many endpoints, one identity.** The same Beelink is a LAN address at home and a tailnet address away. Store endpoints per environment and fail over; persist the preference by endpoint *kind*, not raw IP, so it survives a network change. (Borrowed wholesale from T3's `AccessEndpoint` — the one piece of their model that is straightforwardly better than ours.)
- **No SSH launch.** T3 needs it because their server may not be running on the target. Ours is a lingered systemd unit or an `npx porcelain-daemon serve` the human already started.

## Phases

| # | Phase | State |
|---|-------|-------|
| 1 | **Identity + status** — daemon reports identity; environments auto-name; saved envs carry a live reachable/unreachable status | shipped |
| 2 | **Chip becomes the switcher** — always-visible top-bar control; Use here / New window per env; Add + Manage | shipped |
| 3 | **Pairing** — daemon mints short-lived codes; pairing link + QR in Share; single-paste add | shipped |
| 4 | **Connected devices** — per-device credentials, roster (device, repo, threads, terminals, last seen), per-device revoke | planned |
| 5 | **Multi-endpoint** — endpoints per environment, ordered failover, preference by kind | planned |

## Traps found while building

- **The pairing link is the daemon's own url with the code in the HASH** (`<url>/#pair=<CODE>`), not a custom `porcelain://` scheme. One string then serves both consumers: a phone browser opens it, gets the app shell from that very daemon, and redeems on boot; the Mac app parses the same paste back into `{ url, code }`. The hash is never sent to a server, so the code can't land in an access log — and the client strips it from the address bar immediately, whatever the outcome, because it's single-use and would otherwise sit in history and screenshots.
- **`application/json` on `/pair` is load-bearing, not tidiness.** It forces a CORS preflight that our scoped CORS fails, which is what stops drive-by web content (which *can* reach 127.0.0.1) from ever sending the request. A `text/plain` POST would skip preflight entirely.
- **Respond 413, don't destroy the socket.** The first cut killed an oversized request mid-flight; the caller then saw a connection reset and couldn't distinguish "too large" from "daemon crashed". Drain past the cap instead — memory stays bounded either way.
- **Probing every saved environment on every render is a network stampede.** `environmentStatuses` fans out with a short timeout and the hook throttles; do not lower `staleTime` "for freshness".
- **A remote daemon may be OLDER than this app.** Any new procedure used during probing must be optional — fall back to the reachability probe (`recentRepos`) and treat a missing identity as unknown, never as unreachable. This is the same skew class the `DaemonSkewToast` guards.
