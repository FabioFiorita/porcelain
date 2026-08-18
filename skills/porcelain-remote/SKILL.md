---
name: porcelain-remote
description: "Set up or operate a remote Porcelain daemon: choose exposure, pair devices, keep it always-on, revoke access, inspect share status, or troubleshoot. Load when the human mentions a remote daemon, pairing, Tailscale, Cloudflare, systemd, or reaching Porcelain from another device."
version: 0.54.0
license: MIT
---

# Porcelain remote

This shipped skill owns remote host setup and day-two commands. It is self-contained because an
installed copy cannot depend on documentation from the Porcelain source checkout.

## What this skill covers

Use the published `porcelain-daemon` host CLI to install and serve a daemon on another machine.
The companion CLI is a separate agent interface; do not use this runbook for project operations.

Load the reference that matches the branch:

```text
references/serve.md            install, serve, and choose LAN/Tailscale/Cloudflare exposure
references/pairing.md          issue, list, and revoke per-device access
references/always-on.md        systemd user service, linger, restart, readiness
references/troubleshooting.md  ports, authentication, toolchains, and reachability
```

## Setup sequence

1. Install and serve on the remote host. Loopback is the safe default.
2. Choose the narrowest exposure that solves the human's reach: LAN for the same network,
   Tailscale for a private mesh, or Cloudflare for an explicitly public HTTPS endpoint. Do not
   combine Tailscale and Cloudflare.
3. Pair each device with its own one-time link. Never share the host administrator token.
4. Add the systemd user unit and enable linger when the daemon must survive logout or SSH closing.
5. Use `share status` first for day-two diagnostics, then inspect pairing or service state.

## Security invariants

- Keep the administrator token at `~/.porcelain/admin-token` with mode `0600`; never print, log,
  paste, or put it in a pairing URL.
- Pair devices instead of handing them the administrator credential. Revoke a device's token when
  it is lost or no longer trusted.
- Keep the daemon on loopback unless an explicit exposure mode is needed; private listeners still
  require bearer authentication.
- Use `--no-watchdog` under systemd or another supervisor. Foreground/manual runs keep the
  watchdog enabled.
- Confirm the target host and environment before changing a running daemon. Preserve the user's
  production state when working on product code.

## Completion

A remote setup is complete when the daemon's share status is understood, the intended device has
been paired without exposing the admin credential, and a real client can reach the intended
development or production environment. Record any unresolved network or credential issue instead
of claiming reachability from a local process check.
