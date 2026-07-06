# Plan 031: Record the tailnet blast radius as an invariant; tighten interface selection where cheap

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 113e373..HEAD -- src/backend/tailnet.ts src/backend/tailnet.test.ts .agents/skills/audit/SKILL.md`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: plans/024-skills-doc-truth-pass.md (soft — both edit the audit skill; land 024 first to avoid conflicts)
- **Category**: security (documentation + a small hardening)
- **Planned at**: commit `113e373`, 2026-07-05

## Why this matters

The security audit verified the daemon's documented invariants all hold. Two
tailnet-related facts, however, are **true in code but recorded nowhere** as
accepted decisions — and undocumented accepted risk is how a future change
regresses silently:

1. **A tailnet peer holding the daemon token has arbitrary-path filesystem
   read/write/trash on the host** — not just repo access. The token gate was
   designed against the loopback drive-by threat; once the tailnet listener is
   on, the same procedures are reachable from every device on the tailnet. That
   is consistent with "the token is the whole boundary", but the audit skill
   never says so for the tailnet case, and the Beelink deployment (a
   long-running daemon on an always-on box) makes it matter more.
2. **"Tailscale interface" detection is an IP-range match** on CGNAT space
   (100.64/10), which is shared RFC-6598 space — some carrier-grade NAT and
   other mesh VPNs also assign from it. The code comment records *why*
   (name-independent detection); it does not record the residual risk (binding
   a non-Tailscale 100.64 interface loses the encrypted-overlay assumption) nor
   handle the ambiguous multi-candidate case.

This plan writes both decisions into the audit skill (the designated home for
earned invariants) and adds one cheap code hardening: deterministic, logged
behavior when multiple 100.64/10 candidates exist.

## Current state

The full-FS surface (all absolute-path, no repo containment — by design for the
viewer), `src/backend/api.ts`: `readFile` (`:537`, with the 10 MB stat-first
cap), `writeTextFile` (`:565`), `createFile` (`:573`), `createFolder` (`:579`),
`renamePath` (`:585`), `duplicatePath` (`:596`), `trashPath` (`:630`). All ride
`/trpc`, whose handlers are shared verbatim with the tailnet listener
(`server.ts:232` `initTailnetHandlers(requestListener, handleUpgrade)`).
`terminal:create` (a shell) rides the same shared `/session` upgrade.

The detection, [src/backend/tailnet.ts](../src/backend/tailnet.ts) (whole file
is 27 lines):

```ts
export function findTailscaleAddress(
  interfaces: ReturnType<typeof networkInterfaces> = networkInterfaces(),
): string | null {
  for (const addrs of Object.values(interfaces)) {
    for (const addr of addrs ?? []) {
      if (addr.internal || addr.family !== 'IPv4') continue
      const [first, second] = addr.address.split('.').map(Number)
      if (first === 100 && second >= 64 && second <= 127) return addr.address
    }
  }
  return null
}
```

Its doc comment already records the name-independence decision: "We match the
range rather than the `utun`/`tailscale0` interface name so it works regardless
of what the OS calls the interface. `interfaces` is injectable for tests."
Note the return is **first match in object-iteration order** — with two
candidates the choice is arbitrary and unlogged.

Existing tests: `src/backend/tailnet.test.ts` (injectable-interfaces pattern —
extend it). The audit skill's daemon bullet
(`.agents/skills/audit/SKILL.md:46-88`) documents the bind/auth invariants but
not the two facts above.

Decisions already made that this plan must NOT relitigate:

- Plain HTTP over the tailnet (WireGuard encrypts the wire) — documented.
- Static assets unauthenticated — documented.
- The token as the whole boundary (no per-procedure authorization) — documented
  for loopback; this plan extends the record to tailnet, it does not add
  authorization.
- Repo-scoping the file procedures was **considered and rejected** in this
  audit round: the viewer legitimately reads outside any one repo (file finder
  across repos, pinned siblings, the daemon-side directory browser), and a
  scope check would break those flows for no gain against the actual threat
  model (the token holder is the user). Record that rejection; don't implement it.

## Commands you will need

| Purpose   | Command                       | Expected on success |
|-----------|-------------------------------|---------------------|
| Targeted  | `pnpm test -- tailnet`        | all pass            |
| Full gate | `pnpm verify`                 | exit 0              |

## Scope

**In scope**:
- `.agents/skills/audit/SKILL.md` (the daemon-listener invariant bullet)
- `src/backend/tailnet.ts` + `src/backend/tailnet.test.ts`

**Out of scope**:
- Any authorization/scoping change to `api.ts` procedures (rejected — above).
- `tailnet-listener.ts` lifecycle (its ms-scale start/stop race was examined
  and rejected as not worth fixing — recorded in the plans index).
- TLS on the tailnet listener; the Settings UI copy.

## Git workflow

- Commit straight to `main` (hook-enforced verify; branches hook-blocked). Do NOT push.
- Message: `docs+fix: record the tailnet token blast radius as an audit invariant; deterministic multi-candidate tailscale-address selection`

## Steps

### Step 1: Write the invariant

In `.agents/skills/audit/SKILL.md`, inside the existing bullet **"The daemon is
the ONE sanctioned listener…"** (lines 46–88), append two sentences to the
numbered list (as a new point (6), matching the bullet's voice):

> (6) **The token is the whole boundary ACROSS THE TAILNET TOO — accepted:** a
> tailnet peer presenting the token gets everything loopback gets, including
> arbitrary-path `readFile`/`writeTextFile`/`renamePath`/`trashPath` and
> `terminal:create` (a shell). That's the design (the token holder IS the
> user); the consequences are (a) the token file and `remote-daemon.json` are
> exactly as sensitive as user-level shell access on the daemon host, and (b)
> the tailnet bind must never widen beyond the Tailscale interface — the
> 100.64/10 match is range-based BY DESIGN (name-independent; see
> `tailnet.ts`'s comment), with the residual risk that non-Tailscale CGNAT
> interfaces exist; `findTailscaleAddress` therefore refuses ambiguous
> multi-candidate setups (logs and returns null) rather than guessing. Don't
> add per-procedure authorization to "fix" this — repo-scoping the file
> procedures breaks the cross-repo viewer flows and was explicitly rejected.

(Adjust the point number if plan 024's edits renumbered; integrate, don't
duplicate.)

**Verify**: `grep -n "ACROSS THE TAILNET" .agents/skills/audit/SKILL.md` → 1 hit.

### Step 2: Deterministic multi-candidate selection

In `tailnet.ts`, collect ALL range matches instead of returning the first:

- 0 matches → `null` (unchanged).
- 1 match → return it (unchanged — the overwhelmingly common case).
- ≥2 distinct addresses → prefer a candidate whose interface **name** starts
  with `tailscale` (Linux convention; the Beelink daemon runs there). If
  exactly one name-matches, return it. Otherwise `console.error` a one-line
  warning listing the candidates and return **null** (fail closed to
  "tailnet unavailable" — the Settings toggle already surfaces that state)
  rather than binding an arbitrary interface.

Keep the injectable-`interfaces` signature. Note macOS names every VPN `utunN`,
so the name preference only disambiguates on Linux — that's fine; on macOS an
ambiguous setup fails closed, which is the safe behavior the invariant now
promises. Update the doc comment to match (three-case behavior).

**Verify**: `pnpm test -- tailnet` → extended tests pass (Step 3).

### Step 3: Tests

Extend `src/backend/tailnet.test.ts` (same injected-fixture style as the
existing cases):

1. single 100.64/10 candidate → returned (existing behavior — likely already
   covered; keep)
2. two candidates, one on an interface named `tailscale0` → the `tailscale0`
   address wins
3. two candidates, neither name-matched (`utun3`, `utun7`) → `null` (and, if
   the existing tests assert on console output anywhere, follow that pattern;
   otherwise don't assert the log)
4. one candidate that is internal or IPv6 → skipped (existing coverage — verify present)

**Verify**: `pnpm test -- tailnet` → all pass; then `pnpm verify` → exit 0.

## Test plan

Step 3's cases in the existing `tailnet.test.ts`. No integration test — the
listener wiring is unchanged.

## Done criteria

- [ ] `pnpm verify` exits 0
- [ ] `grep -n "ACROSS THE TAILNET" .agents/skills/audit/SKILL.md` → 1 hit
- [ ] `pnpm test -- tailnet` shows the multi-candidate cases passing
- [ ] `findTailscaleAddress` still takes injectable interfaces (signature unchanged for single-candidate callers)
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

- The maintainer's actual setup has **multiple** 100.64/10 interfaces where the
  current first-match behavior is load-bearing (you can't know this from the
  repo) — the fail-closed change would break their tailnet toggle. Flag this
  prominently in your report; if the app's Settings show "unavailable" after
  the change on the dev machine, revert Step 2 and keep Steps 1+3's
  documentation/tests only.
- Plan 024 hasn't landed and your audit-skill edit conflicts with its pending
  changes — coordinate (land 024 first).

## Maintenance notes

- If the Beelink deployment ever standardizes, a stronger check (`tailscale ip
  -4` reconciliation) is the next rung — deferred because it adds a CLI
  dependency for marginal gain on a single-user system.
- Reviewer should scrutinize: that 0/1-candidate behavior is byte-identical
  (the common path must not change), and that the new invariant text doesn't
  contradict the existing point (1) bind wording.
