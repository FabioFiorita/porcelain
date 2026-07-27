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
- **Per-device credentials, so revoke means something.** One shared secret cannot be revoked per device.
- **The shared token keeps working alongside them** (decided 2026-07-26). Phase 4 issues each newly-paired device its own credential, but `~/.porcelain/daemon-token` stays valid as a fallback so existing iPad/Mac setups don't all have to be re-paired at once. Revoke applies per device; migration is invisible. The clean-break alternative (retire the shared token, re-pair everything) was considered and rejected as not worth the one-time disruption. Shipped: a paired device now gets its own credential, and a client still using the shared token shows in the roster as unattributable rather than being hidden or refused.
- **No scope matrix.** T3 splits credentials across view/operate/terminals/write-reviews/manage-access/relay. That is enterprise shape on a solo-dev tool: a device is trusted or it is gone.
- **An environment has many endpoints, one identity.** The same Beelink is a LAN address at home and a tailnet address away. Store endpoints per environment and fail over; persist the preference by endpoint *kind*, not raw IP, so it survives a network change. (Borrowed wholesale from T3's `AccessEndpoint` — the one piece of their model that is straightforwardly better than ours.)
- **No SSH launch.** T3 needs it because their server may not be running on the target. Ours is a lingered systemd unit or an `npx porcelain-daemon serve` the human already started.

## Phases

| # | Phase | State |
|---|-------|-------|
| 1 | **Identity + status** — daemon reports identity; environments auto-name; saved envs carry a live reachable/unreachable status | shipped |
| 2 | **Chip becomes the switcher** — always-visible top-bar control; Use here / New window per env; Add + Manage | shipped |
| 3 | **Pairing** — daemon mints short-lived codes; pairing link + QR in Share; single-paste add | shipped |
| 4 | **Connected devices** — per-device credentials, roster (device, repo, threads, terminals, last seen), per-device revoke | shipped |
| 5 | **Multi-endpoint** — endpoints per environment, ordered failover, preference by kind | shipped |

### Phase 4, as built

1. A device store (`devices.ts` → `~/.porcelain/devices.json`, 0600): `{ id, label, credentialHash, createdAt, lastSeenAt }`. Hashes only — the credential exists exactly twice, in the `/pair` response and on the device.
2. `tokenOk` became **`authenticate()`**, one gate for `/trpc` and the `/session` upgrade, accepting the shared token **or** a device credential. It returns the device id alongside `ok`, which is what makes a session attributable.
3. `POST /pair` mints a fresh device credential (and takes a peer-supplied `label` — display only).
4. Sessions carry identity **from the credential the upgrade authenticated with**, not from a client announcement — that was a late change to the sketch and a better one: a device can't claim to be another. `session:hello` still exists, but only to carry the repo path for the roster.
5. Settings → Environments grows a Connected devices list with per-device Revoke.

Deliberately NOT doing: T3's scope matrix (view / operate / terminals / write reviews / manage access / relay). A device is trusted or it is gone.

### Phase 5, as built

Endpoints live on the environment (`endpoints: string[]`, `url` = last known good, `preferredKind`); the kind is derived from the address, never stored. Failover walks `orderedEndpoints` — preferred kind, then last known good, then the rest — sequentially, and `environmentStatuses` self-heals the stored url on focus. One addition beyond the sketch: **adding an environment whose daemon reports a host we already know merges into it** as another endpoint, instead of leaving two identically-named rows the human has to tell apart. That is the "one identity, many endpoints" line taken literally, and it is only possible because phase 1 made the daemon announce its host.

## Traps found while building

- **The pairing link is the daemon's own url with the code in the HASH** (`<url>/#pair=<CODE>`), not a custom `porcelain://` scheme. One string then serves both consumers: a phone browser opens it, gets the app shell from that very daemon, and redeems on boot; the Mac app parses the same paste back into `{ url, code }`. The hash is never sent to a server, so the code can't land in an access log — and the client strips it from the address bar immediately, whatever the outcome, because it's single-use and would otherwise sit in history and screenshots.
- **`application/json` on `/pair` is load-bearing, not tidiness.** It forces a CORS preflight that our scoped CORS fails, which is what stops drive-by web content (which *can* reach 127.0.0.1) from ever sending the request. A `text/plain` POST would skip preflight entirely.
- **Respond 413, don't destroy the socket.** The first cut killed an oversized request mid-flight; the caller then saw a connection reset and couldn't distinguish "too large" from "daemon crashed". Drain past the cap instead — memory stays bounded either way.
- **Probing every saved environment on every render is a network stampede.** `environmentStatuses` fans out with a short timeout and the hook throttles; do not lower `staleTime` "for freshness".
- **Revoking a credential is not revoking a device.** The gate runs at upgrade time, so an already-connected socket keeps streaming terminals and agent turns after its credential is gone. `revokeDevice` therefore closes the device's live sessions too — the work (PTYs, threads) survives, since it is daemon-owned; only that device's access to it ends.
- **`matchDevice` is sync, so the store must be loaded before the first listener accepts.** It fails closed until then, which would 401 a legitimately-paired device during the boot window. `server.ts` awaits `loadDevices()` before `createDaemonHttp`; keep that ordering structural, not incidental.
- **A reported hostname is a label, not an identity.** The merge was first written as "same `host` → same machine", which is wrong in the ordinary case, never mind the hostile one: `shortHostname` yields the first label only, so `ubuntu` / `raspberrypi` / `MacBook-Pro` collide constantly. A wrong merge puts two machines' addresses in one entry, and the failover walk then sends one machine's token to the other's address. The host match only NOMINATES a twin; the proof is that the twin's existing credential also authenticates at the new address. A duplicate row is a cosmetic annoyance — a merged pair of machines is a leaked credential.
- **Adding an endpoint puts a SAVED token on a human-typed address.** Unlike adding an environment (where the human supplies the address and the token together), here one wrong digit discloses an existing environment's credential to whoever answers — and then persists that address so every later failover re-sends it. The first probe is unavoidable; persisting it is not, so the answering daemon must report the environment's host.
- **`environmentStatuses` writes.** It probes for seconds, then persists the healed url — a bare load→mutate→save there would resurrect an environment removed meanwhile, token and all. Every writer goes through `updateRemoteEnvironmentState`, keyed by id, never by an index into a pre-await snapshot.
- **Don't race an environment's endpoints.** The obvious implementation — probe every address in parallel, take the first reply — is wrong: on the home LAN the tailnet address usually still answers, just slower via the relay, so the race quietly picks the worse route. Preference decides; reachability only breaks ties.
- **A rejected token must short-circuit the walk.** The token is the same on every address of an environment, so re-probing the rest spends four seconds each to learn the same thing and delays the one error the human can act on (re-pair).
- **Reachability is not a preference.** Failover updates the last known good url only; the preferred *kind* moves solely by explicit choice. Otherwise one trip on a train quietly re-teaches the app to prefer the tailnet at home.
- **Re-pairing the same device adds a ROW, it does not replace one.** Deliberate: the label is peer-supplied, so folding a new pairing into an existing row by label would let one device take over another's identity by claiming its name. Duplicates are the human's to revoke.
- **The roster's writes must be serialized, with a unique tmp path.** A `lastSeenAt` flush can be in flight while a pairing or a revoke writes; sharing one `${path}.tmp` lets the second writer truncate the first's file (the loser's `rename` then fails ENOENT — on the pairing path that 500s the exchange *after* the code was burned), and interleaving can land malformed JSON, which by design de-authenticates everyone. Chain the writes.
- **`lastSeenAt` is a field a REQUEST writes** — stamped in memory on every authenticated hit, flushed at most once a minute (and on shutdown). A disk write per request would be absurd; the roster only needs "roughly when".
- **A remote daemon may be OLDER than this app.** Any new procedure used during probing must be optional — fall back to the reachability probe (`recentRepos`) and treat a missing identity as unknown, never as unreachable. This is the same skew class the `DaemonSkewToast` guards.
