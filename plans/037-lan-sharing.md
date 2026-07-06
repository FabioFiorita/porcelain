# Plan 037: Share on the local network — the tailnet setup without Tailscale

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat <Planned-at-SHA>..HEAD -- src/backend/tailnet-listener.ts src/backend/tailnet.ts src/backend/api.ts src/backend/server.ts src/backend/config-store.ts src/renderer/src/components/settings/general-section.tsx src/renderer/src/hooks/use-tailnet.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch that changes the plan's meaning, treat it as a STOP.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED (opens a new listening surface — mitigations below are mandatory)
- **Depends on**: 031 (both edit `tailnet-listener.ts` and the audit skill — land 031 first)
- **Category**: direction
- **Planned at**: commit `50108e0`, 2026-07-05 (re-run `git rev-parse --short HEAD` and use the drift check above regardless)

## Why this matters

The user's real usage is mostly AT home: the iPad and other devices are already
on the same Wi-Fi as the Mac running Porcelain. Today the only way in is the
tailnet listener — which routes through Tailscale even when both devices sit on
the same LAN, and requires Tailscale to be installed and up on every device.
The ask: the same browser-client access, over plain local networking, for the
at-home case; Tailscale remains the away-from-home path.

**Decided tradeoff (record it, don't relitigate it)**: on the tailnet,
WireGuard encrypts the HTTP traffic, so the bearer token never crosses a wire
in cleartext. On a home LAN, it does — anyone who can sniff the local network
can capture the token. This is accepted for a trusted home network the same way
countless local dev tools accept it, BUT it must be (a) opt-in and default-off,
(b) recorded in the audit skill as a decision, and (c) never silently widened
(the bind stays on enumerated private-range addresses — 0.0.0.0 remains
forbidden, see the audit skill).

## Current state

The daemon (`src/backend/server.ts`) always listens on `127.0.0.1`; an optional
second listener binds the Tailscale interface. All of the second-listener
machinery already exists and is deliberately generic:

`src/backend/tailnet-listener.ts` (the whole module is ~80 lines — read it):

```ts
export const TAILNET_PORT = 43117
// initTailnetHandlers(request, upgrade)  <- server.ts hands over the shared
//   token-gated handlers once at boot (they close over the token digest)
// startTailnetListener(): Promise<string | null>   <- binds TAILNET_PORT on
//   findTailscaleAddress(), never 0.0.0.0; listen errors resolve null and must
//   never take loopback down
// stopTailnetListener(), tailnetUrl()
```

`src/backend/tailnet.ts` — the interface pick, injectable for tests:

```ts
export function findTailscaleAddress(
  interfaces: ReturnType<typeof networkInterfaces> = networkInterfaces(),
): string | null {
  // matches the CGNAT range 100.64.0.0/10 (first octet 100, second 64–127)
}
```

`src/backend/api.ts:966-978` — the status/toggle procedures:

```ts
tailnetStatus: t.procedure.query(async () => {
  const config = await loadConfig()
  return { enabled: config.tailnetBind === true, url: tailnetUrl() }
}),
setTailnetBind: t.procedure.input(z.boolean()).mutation(async ({ input }) => {
  await updateConfig((config) => ({ ...config, tailnetBind: input }))
  if (input) await startTailnetListener()
  else await stopTailnetListener()
  ...
}),
```

`src/backend/server.ts:143-146` — boot-time re-arm:

```ts
if ((await loadConfig()).tailnetBind === true) await startTailnetListener()
```

Renderer: `src/renderer/src/hooks/use-tailnet.ts` (`useTailnetStatus` /
`useSetTailnetBind`, thin tRPC wrappers) and the "Share over Tailscale" block in
`src/renderer/src/components/settings/general-section.tsx` (Switch + mono URL +
Copy-token button + `~/.porcelain/daemon-token` hint — added 2026-07-05,
commit `3e7fac6`).

Repo conventions that apply:

- One architecture: status = tRPC query, toggle = tRPC mutation that
  invalidates the status; components consume hooks, never `lib/trpc` or
  `lib/daemon` directly (lint-fenced).
- No `any`, no `as unknown as`, never `void` a promise; named exports.
- The audit skill (`.agents/skills/audit/SKILL.md`) records listener/bind
  invariants — it MUST be updated in the same commit (hard rule: docs say what
  the code can't).
- shadcn primitives only (the UI here reuses the existing `Switch`/`Button`).

## Commands you will need

| Purpose   | Command                          | Expected on success |
|-----------|----------------------------------|---------------------|
| Install   | `pnpm install`                   | exit 0              |
| Lint      | `pnpm lint`                      | exit 0              |
| Typecheck | `pnpm typecheck`                 | exit 0              |
| One test  | `pnpm test -- lan`               | new tests pass      |
| Full gate | `pnpm verify`                    | exit 0              |

## Scope

**In scope** (the only files you should modify/create):
- `src/backend/lan.ts` (create — the private-address pick) + `src/backend/lan.test.ts` (create)
- `src/backend/tailnet-listener.ts` (generalize into a two-instance listener factory — see Step 2; if 031 landed a rename/refactor here, adapt to its shape)
- `src/backend/server.ts` (boot re-arm for the LAN bind; handler handoff)
- `src/backend/api.ts` (`lanStatus` + `setLanBind` procedures mirroring the tailnet pair)
- `src/backend/config-store.ts` (only if the config schema enumerates keys — add `lanBind`; if config is schema-less passthrough, no edit needed)
- `src/renderer/src/hooks/use-lan.ts` (create — mirror `use-tailnet.ts`)
- `src/renderer/src/components/settings/general-section.tsx` (the "Share on local network" block)
- `.agents/skills/audit/SKILL.md` (record the new bind rule + cleartext decision)
- `.agents/skills/product/SKILL.md` (one sentence in the Remote access bullet: LAN for home, tailnet for away)

**Out of scope** (do NOT touch):
- HTTPS/TLS for the LAN listener — deliberately absent in v1 (self-signed certs
  create worse UX than the recorded cleartext tradeoff; revisit only if asked).
- mDNS/Bonjour *advertisement* (a `porcelain._tcp` service) — needs a native
  dep; NOT wanted. The `.local` hostname trick below needs no dep.
- The Mac-app "Remote daemon" connect flow — it's already URL+token agnostic;
  a LAN URL works there unchanged.
- Auth/token design — the shared token stays exactly as is.

## Git workflow

- Commit **straight to `main`** — the git-guard hook hard-blocks branches and
  runs `pnpm verify` before any commit. Do NOT push.
- Message style: Conventional Commits, e.g.
  `feat: share the daemon on the local network — opt-in LAN listener on the private-range interface, same token gate and port as the tailnet path (Tailscale stays the away-from-home path)`

## Steps

### Step 1: The private-address pick (`src/backend/lan.ts`)

Model on `tailnet.ts` exactly (injectable `interfaces` param, named export):

```ts
export function findLanAddresses(
  interfaces: ReturnType<typeof networkInterfaces> = networkInterfaces(),
): string[] {
  // non-internal IPv4 addresses in RFC1918 ranges: 10.0.0.0/8,
  // 172.16.0.0/12, 192.168.0.0/16 — EXCLUDING the CGNAT 100.64/10 range
  // (that's the tailnet's). Return all matches (Wi-Fi + Ethernet may both
  // be up); order as enumerated.
}
```

Also export a display-hostname helper:

```ts
/** The Bonjour name other LAN devices can resolve without any advertisement —
 *  macOS publishes `<hostname>.local` natively. Falls back to the first address. */
export function lanDisplayHost(addresses: string[]): string | null
```

(`os.hostname()` on macOS usually already ends in `.local`; append it when
absent; return null when `addresses` is empty.)

**Verify**: `pnpm test -- lan` → the Step-1 unit tests you write alongside
(write them now, in `lan.test.ts`): RFC1918 matches, 100.64/10 excluded,
internal/IPv6 skipped, multi-iface returns all, hostname `.local` suffixing.

### Step 2: Generalize the second listener

`tailnet-listener.ts` currently holds one module-level `server`/`address`
singleton. Refactor it to a small factory used twice, preserving every
documented behavior (idempotent start, listen-error resolves null and never
touches loopback, stop is a no-op when down):

- `createIfaceListener(pickAddresses: () => string[])` returning
  `{ start, stop, url }` — internally binds ONE `http.Server` per address on
  port `43117` (`LISTENER_PORT`, keep the exported `TAILNET_PORT` name as an
  alias if other files import it — check with grep).
- The tailnet instance wraps `findTailscaleAddress()` (a one-element array);
  the LAN instance wraps `findLanAddresses()`.
- `initTailnetHandlers` becomes the shared handler handoff for both instances
  (rename to `initIfaceHandlers` only if you also update the `server.ts`
  call site in the same commit).
- LAN `url()` prefers `lanDisplayHost()` (the `.local` name) with the numeric
  first address as fallback data — return both:
  `{ url: string, numericUrl: string } | null` for the LAN instance, or keep
  a single `url` string and expose the numeric list separately; pick the
  shape that keeps `tailnetUrl()`'s existing contract UNCHANGED (its callers
  in `api.ts` must not need edits beyond the new procedures).

**Verify**: `pnpm typecheck` → exit 0; existing tailnet behavior untouched
(`pnpm test` — the 027 harness suite, if present, must stay green).

### Step 3: API + boot wiring

Mirror the tailnet pair in `api.ts` (place them adjacent):

```ts
lanStatus: t.procedure.query(...)      // { enabled, url, numericUrl? }
setLanBind: t.procedure.input(z.boolean()).mutation(...)  // config key: lanBind
```

In `server.ts`, next to the `tailnetBind` re-arm:
`if ((await loadConfig()).lanBind === true) await startLanListener()`.

**Verify**: `pnpm typecheck` → exit 0.

### Step 4: Settings UI

In `general-section.tsx`, add a "Share on local network" `PreferenceRow` +
Switch directly below the "Share over Tailscale" block, matching its exact
markup shape (mono URL line when up, the SAME Copy-token button affordance —
extract the copy-button JSX into a tiny local component if duplicating it
reads badly, but keep it inside this file). Description copy:
"Lets devices on your home network reach this daemon — token-gated, traffic
is unencrypted on the LAN." (The honesty is deliberate; do not soften it.)
Create `use-lan.ts` mirroring `use-tailnet.ts`.

**Verify**: `pnpm lint && pnpm typecheck` → exit 0.

### Step 5: Record the decision (same commit)

- `.agents/skills/audit/SKILL.md`, the listener/bind invariant: extend it —
  allowed binds are loopback, the Tailscale CGNAT address, and (opt-in)
  RFC1918 private addresses via `findLanAddresses`; 0.0.0.0 remains forbidden;
  note the cleartext-token-on-LAN accepted tradeoff and why (home network
  trust, opt-in, default off).
- `.agents/skills/product/SKILL.md`, Remote access bullet: add the LAN path
  ("on your home network no Tailscale is needed; tailnet covers away").

### Step 6: Full gate

**Verify**: `pnpm verify` → exit 0.

## Test plan

- `lan.test.ts` (Step 1): address-pick matrix + hostname helper (pattern:
  the existing injectable-interfaces tests around `findTailscaleAddress` —
  grep `tailnet` in `src/backend/*.test.ts` for the exemplar).
- Listener factory: if plan 027's integration harness landed, add one case
  there proving the LAN listener serves `/trpc` with the token and 401s
  without it (reuse the harness's boot helper); if 027 is absent, unit-test
  the factory's idempotent start/stop with injected handlers instead.
- UI: no component test required (the block is a mirror of an untested
  sibling); do not start a new test pattern here.

## Done criteria

- [ ] `pnpm verify` exits 0
- [ ] `pnpm test -- lan` shows the new address-pick tests passing
- [ ] `grep -n "0.0.0.0" src/backend` → no listener bind on it (comments ok)
- [ ] Toggling "Share on local network" in Settings brings the listener up
      and shows an `http://<host>.local:43117` (or numeric) URL — manual check
      via `pnpm dev` + `curl` from the same machine: `curl -s -o /dev/null -w "%{http_code}" http://<lan-addr>:43117/trpc/tailnetStatus` → `401` without token
- [ ] Audit + product skills updated in the same commit
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- Plan 031 has NOT landed (check its row in `plans/README.md`) — order matters,
  both edit the same files.
- `tailnet-listener.ts` no longer matches the "Current state" contract after
  031 in a way that makes the factory refactor ambiguous.
- Binding the same port 43117 on a second address fails on macOS in your
  testing (it should not — distinct addresses are distinct sockets) — report
  the exact error instead of switching ports or widening the bind.
- The config store rejects unknown keys (schema-validated) and adding `lanBind`
  requires touching more than `config-store.ts`.

## Maintenance notes

- Anyone later proposing to "just bind 0.0.0.0 since we bind everything
  anyway" must be pointed at the audit skill: the enumerated-addresses rule is
  the guard against accidentally serving a coffee-shop network.
- If HTTPS is ever added, the LAN listener is the only surface that benefits —
  the tailnet path is already encrypted at the network layer.
- The `.local` display name assumes macOS Bonjour; a future Linux daemon host
  may not publish it — the numeric fallback covers that.
