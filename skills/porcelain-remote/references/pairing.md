# Pairing devices

Pairing gives one device its own revocable credential without ever handing out the host
administrator token.

## Issue a pairing link

```sh
npx porcelain-daemon@latest access issue --name "My iPhone"
```

Prints one URL. If a bind mode is already active, the CLI auto-picks the best reachable base URL
in this order: LAN → Tailscale → Cloudflare. Override explicitly when the auto-pick is wrong for
the device you're pairing (for example a public Cloudflare URL when the LAN URL would otherwise
win):

```sh
npx porcelain-daemon@latest access issue --name "My phone" --base-url https://<tunnel>.trycloudflare.com
```

If nothing is reachable yet (still loopback-only), pass `--base-url` explicitly or turn on a bind
mode first — see [serve.md](serve.md).

Open the printed link on the target device: a browser for the web client, or paste it into the Mac
app's connection-link entry.

## What the link actually is

- Format `pc_pair_<id>_<secret>` — the daemon exchanges it once at `POST /pair`.
- **Single-use.** A second attempt to exchange the same link fails.
- **15-minute TTL.** Issue it right before the device will use it; don't stockpile links.
- **Secret in the URL fragment**, not the query string or path. Browsers never send the fragment
  in a GET request, so it never appears in server logs or referrer headers. Don't move it, don't
  paste a link's fragment into a chat log or ticket that gets indexed anywhere sensitive — treat
  it like a password until it's consumed.
- On successful exchange, the device receives its **own** token (`pc_client_…`), stored on that
  device only. The admin token never leaves the host.

## List and revoke

```sh
npx porcelain-daemon@latest access list
```

Prints JSON with two arrays: `clients` (paired, active devices) and `pairings` (links issued but
not yet exchanged, still within TTL). Each has an `id`.

```sh
npx porcelain-daemon@latest access revoke <id>
```

Works on either an active client id or an unconsumed pairing id. Revoking a **client** immediately
invalidates its token and closes any live WebSocket session that token opened — not just future
requests, the daemon actively tears down the existing connection. Revoking a **pairing** just
burns the unused link.

Revoke a device the moment it's lost, decommissioned, or no longer trusted — there's no
"temporarily disable," only issue-a-new-link / revoke.

## Threat model in short

A client token is equivalent to a shell on the host: arbitrary-path file read/write and terminal
spawn, the same as the token holder sitting at the machine. That's deliberate — the token holder
*is* the user, from any network the daemon is reachable on. Treat every paired-device token, and
the admin token, as exactly as sensitive as a login credential for this machine. Full model:
`docs/remote-access.md` in the main repo.
