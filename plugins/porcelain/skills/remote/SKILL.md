---
name: remote
description: Set up or operate a remote Porcelain host, including exposure, pairing, revocation, an always-on service, updates, and reachability. Use for Porcelain-specific remote administration, not general SSH or network work.
license: MIT
---

# Porcelain remote

Operate the exact Porcelain host and account the human placed in scope. Use current CLI help and the
public [remote-access guide](https://github.com/FabioFiorita/porcelain/blob/main/docs/remote-access.md)
as operational authority; do not reconstruct commands from memory. Use `$companion` for Canvases,
comments, profiles, and Actions.

Confirm whether the target is a development daemon, a foreground production process, or an
always-on service. Start with loopback and add only the requested route: LAN for a trusted local
network, Tailscale for a private mesh, or Cloudflare for an explicitly public HTTPS endpoint. Pair
each client with its own short-lived link; never distribute the administrator token.

For an always-on Linux host, follow the guide's user-level systemd and linger setup. Keep tokens in
a protected environment file, not command arguments. Verify the daemon locally, inspect
`share status`, and connect a real intended client. A running process proves neither exposure nor
authorization. For updates, restart the documented `@latest` service or foreground command, wait
for readiness, and verify the reported version.

Porcelain's agent connector reaches a profile-scoped local OS socket on the agent's machine. Never
proxy that channel through LAN, Tailscale, Cloudflare, or renderer HTTP. Do not replace a daemon,
port, service, or exposure mode until its owner and purpose are known, and stop only the process or
service in scope. Treat a timeout as a reachability failure; an HTTP 401 proves the route reached the
daemon but not that credentials are valid.

Report the host, route, client, and version actually observed, plus any untested fallback. Keep
administrator and paired-client credentials out of logs, screenshots, URLs, prompts, and files.
