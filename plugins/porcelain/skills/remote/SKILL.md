---
name: remote
description: Set up or operate a remote Porcelain host, including exposure, pairing, revocation, an always-on service, updates, and reachability. Use for Porcelain-specific remote administration, not general SSH or network work.
license: MIT
---

# Porcelain remote

This skill covers Porcelain's host launcher and service lifecycle. It does not replace the domain
MCP tools from `$companion`, and it does not make an SSH target implicit.

Use the current CLI help and the public
[remote-access guide](https://github.com/FabioFiorita/porcelain/blob/main/docs/remote-access.md) as
the operational authority. Do not reconstruct commands from remembered versions.

## Working flow

1. Confirm the exact host, user account, installed version, and whether the daemon is development,
   foreground production, or an always-on service.
2. Start with loopback. Add only the narrowest exposure the human needs: LAN on the same trusted
   network, Tailscale for a private mesh, or Cloudflare for an explicitly public HTTPS endpoint.
3. Pair each client with its own short-lived link. Never distribute the administrator token.
4. When the daemon must survive logout or reboot, use the documented user-level systemd service and
   linger setup. Keep credentials in a protected environment file rather than command arguments.
5. Verify the daemon locally, inspect `share status`, then connect a real intended client. A running
   process alone does not prove that exposure, pairing, or fallback routing works.
6. For updates, restart the documented `@latest` service or follow the foreground command shown by
   Porcelain. Wait for readiness and verify the reported version before declaring success.

## Safety boundaries

- Treat the administrator token and every paired-client token like host login credentials. Do not
  print, log, commit, or place them in plugin configuration.
- Porcelain's MCP channel is a profile-scoped local socket on the agent's machine. Do not proxy or
  forward it through LAN, Tailscale, Cloudflare, or HTTP to control another Environment.
- Never replace a running daemon, port, service unit, or exposure mode until its owner and purpose
  are identified. Stop only the process or service explicitly in scope.
- Network reachability and authorization are separate: a timeout is not a credential failure, and a
  401 proves the network path already reached the daemon.
- Report which host, route, client, and version were actually observed, plus any untested fallback.
