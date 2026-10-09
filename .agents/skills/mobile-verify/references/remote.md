# Linux driving the Mac

Linux runs the disposable server and Metro. The Mac owns Xcode, the fixed simulator pool and a matching cached development-client build. UI control reaches the Mac one of two ways, and both work the same once started:

- **T3's Device panel.** Open the Mac's simulator in T3 and pass its UDID, launcher and host config to `start` as in [T3-owned device](driving.md#t3-owned-device). T3 brings its own agent-device on both machines, so no hub is needed.
- **The agent-device hub**, for harnesses without a device panel. The repository pins agent-device in `package.json`; the hub on the Mac must run that same version, and `doctor` refuses a hub whose version differs or whose daemon does not answer.

The lifecycle CLI uses an SSH connection held for the run’s lifetime solely for simulator preparation and release. The host helper owns the claim until that connection closes; a dead helper’s claim is reclaimed by the next allocation.

Required: Node/pnpm from the repository toolchain on both machines, authenticated SSH, full Xcode with an iOS 26+ runtime on the Mac, and the same native inputs in a Mac worktree. Install/build there, then keep the checkout for cleanup. Never point at the installed app or its data.

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

`ports` must be free on Linux and forwarded to the Mac's loopback; the simulator must reach both server and Metro. For the hub route, forward the Mac proxy's port to Linux separately; the T3 route ignores `hub` and its token. The owner's workstation setup may already provide these tunnels. Preserve it.

The Mac proxy should have its own state directory, separate from T3 and local CLI daemons, and restart only on process exit, never on a slow health request. The proxy starts its daemon once, so set `AGENT_DEVICE_DAEMON_IDLE_TIMEOUT_MS=0` in its operator-owned environment; otherwise the default five-minute idle reap stops the daemon while the proxy keeps answering. Its startup output repeats the bearer token, so do not keep it in a log. Keep the token in protected operator storage. `/health` must answer `ok:true` with an `upstream` daemon that is also `ok:true`, both on the pinned version. Follow the workstation skill's bounded diagnosis if the owner's hub is unavailable; leave T3's daemon alone.

`start` writes a 0600 config in its protected instance directory, connects with `agent-device connect proxy --daemon-base-url http://127.0.0.1:4310/agent-device` using that config/session, prepares the claimed simulator through SSH and pairs through the hub. Its card prints the Linux-side pinned invocation. Use it for every snapshot, press, fill and wait; do not copy the Mac's loopback T3 config. The setup session is closed before handoff. Stop closes the journey session, disconnects this connection and releases only its captured claim on the Mac.

Check device RPC health, app backend health, Metro status and native pairing separately. A successful device snapshot alone does not prove the Linux-hosted app journey or reconnection.
