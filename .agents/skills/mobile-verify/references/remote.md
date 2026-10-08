# Linux through the Mac hub

Linux runs the disposable server and Metro. The Mac owns Xcode, the fixed simulator pool and a matching cached development-client build. UI control goes through the agent-device proxy; the lifecycle CLI uses bounded SSH calls solely for simulator preparation and release.

Required: Node/pnpm from the repository toolchain on both machines, compatible agent-device client/proxy versions, authenticated SSH, full Xcode with an iOS 26+ runtime on the Mac, and the same native inputs in a Mac worktree. Install/build there, then keep the checkout for cleanup. Never point at the installed app or its data.

The ignored `.mobile-device-host.json` in the Linux main checkout is shared by its worktrees. Set these machine-local values (no credentials in the repository):

```json
{
  "hub": "http://127.0.0.1:4310",
  "tokenVariable": "AGENT_DEVICE_DAEMON_AUTH_TOKEN",
  "ports": [5173, 5183],
  "ssh": "mac",
  "checkout": "/private/matching/mac/worktree",
  "simulatorLimit": 2
}
```

`ports` must be free on Linux and forwarded to the Mac's loopback; the simulator must reach both server and Metro. Forward the Mac proxy's port to Linux separately. The owner's workstation setup may already provide these tunnels. Preserve it.

The Mac proxy should have its own state directory, separate from T3 and local CLI daemons, and restart only on process exit, never on a slow health request. For a persistent hub, set `AGENT_DEVICE_DAEMON_IDLE_TIMEOUT_MS=0` in its operator-owned environment: otherwise the default idle reap can stop the upstream daemon while the proxy stays running. Keep its token in protected operator storage. `/health` must answer JSON `ok:true`; a 200 containing `ok:false` is a failure. Follow the workstation skill's bounded diagnosis if the owner's hub is unavailable; leave T3's daemon alone.

`start` writes a 0600 config in its protected instance directory, connects with `agent-device connect proxy --daemon-base-url http://127.0.0.1:4310/agent-device` using that config/session, prepares the claimed simulator through SSH and pairs through the hub. Its card prints the Linux-side pinned invocation. Use it for every snapshot, press, fill and wait; do not copy the Mac's loopback T3 config. The setup session is closed before handoff. Stop closes the journey session, disconnects this connection and releases only its captured claim on the Mac.

Check device RPC health, app backend health, Metro status and native pairing separately. A successful device snapshot alone does not prove the Linux-hosted app journey or reconnection.
