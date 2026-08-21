---
name: remote
description: "Set up or operate a remote Porcelain host: start the daemon, choose LAN/Tailscale/Cloudflare exposure, pair devices, keep it always-on, revoke access, inspect share status, or troubleshoot. Load when the human mentions a remote host, pairing, systemd, Tailscale, Cloudflare, or service reachability."
license: MIT
---

# Porcelain remote

This skill covers the narrow host launcher and service lifecycle. It is not a general-purpose
agent CLI and it never replaces the `porcelain` MCP domain tools from `$companion`.

## Host launcher

The published package is `@fabiofiorita/porcelain`; its executable is `porcelain`. The supported
host commands are deliberately small:

```text
porcelain serve [--loopback|--lan|--tailnet|--cloudflare]
porcelain access issue|list|revoke
porcelain share status
```

Use `serve` to bring up the daemon, `access` to create/revoke one-time or client access, and
`share status` to inspect exposure. There is no `share on`/`share off` command and no hidden
installer. Configuration belongs in the app or the service environment.

## Setup sequence

1. Install/start `@fabiofiorita/porcelain` on the remote host. Loopback is the safe default.
2. Choose the narrowest exposure that solves the user's reach: LAN for the same network,
   Tailscale for a private mesh, or Cloudflare for an explicitly public HTTPS endpoint.
3. Pair each device with its own one-time link. Never put the host administrator credential in a
   plugin, MCP config, browser storage, or pairing URL.
4. Add the `porcelain.service` systemd user unit and enable linger when the daemon must survive
   logout or SSH closing.
5. Use `porcelain share status` and service logs for day-two diagnostics.

Load the reference matching the task:

```text
references/serve.md            install, serve, and choose exposure
references/pairing.md          issue/list/revoke per-device access
references/always-on.md        systemd user service, linger, restart, readiness
references/troubleshooting.md  ports, credentials, toolchains, reachability
```

## Security boundaries

- `~/.porcelain/admin-token` is a host-administration credential; keep it mode `0600`, never
  print or share it.
- MCP is token-free only for a direct loopback request. LAN, Tailscale, and Cloudflare do not
  expose `/mcp`; use the paired app APIs for remote access.
- Pair devices instead of handing them the administrator credential. Revoke a client when it is
  lost or no longer trusted.
- Use `--no-watchdog` under systemd or another supervisor; foreground runs keep the watchdog.
- Confirm the target host and development/production environment before changing a running daemon.

## Completion

A remote setup is complete when the intended daemon is running, the chosen exposure is visible in
`porcelain share status`, each device is paired independently, and a real client reaches the
intended environment. State any remaining network or live-host uncertainty explicitly.
