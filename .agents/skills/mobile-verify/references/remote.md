# Linux driving the Mac

Linux runs the disposable server and Metro. The Mac owns Xcode, the fixed simulator pool and a matching cached development-client build. UI control reaches the Mac one of two ways, and both work the same once started:

- **T3's Device panel.** Open the Mac's simulator in T3 and pass its UDID, launcher and host config to `start` as in [T3-owned device](driving.md#t3-owned-device). T3 brings its own agent-device on both machines, so no hub is needed.
- **The agent-device hub**, for harnesses without a device panel. Each developer installs agent-device on their own machine and names it in `agentDevice` in the host file below; it must run the same version as the hub, and `doctor` refuses a hub whose version differs from it or whose daemon does not answer.

The lifecycle CLI uses an SSH connection held for the run’s lifetime solely for simulator preparation and release. The host helper owns the claim until that connection closes; a dead helper’s claim is reclaimed by the next allocation.

Required: Node/pnpm from the repository toolchain on both machines, authenticated SSH, full Xcode with an iOS 26+ runtime on the Mac, and the same native inputs in a Mac worktree. Install/build there, then keep the checkout for cleanup. Never point at the installed app or its data. That Mac checkout is shared by every Linux run: put it on your branch's native inputs before `start`, and do not move it while another run uses it. `doctor` and `start` ask the Mac for its native fingerprint first and refuse, before any setup, when it differs from this checkout or has no development client yet; run `cli build` on the Mac then. The fingerprint covers iOS inputs only, so Android files in the Mac checkout do not change it.

The ignored `.mobile-device-host.json` in the Linux main checkout is shared by its worktrees. Set these machine-local values (no credentials in the repository):

```json
{
  "agentDevice": "/absolute/path/to/agent-device",
  "hub": "http://127.0.0.1:4310",
  "tokenVariable": "AGENT_DEVICE_DAEMON_AUTH_TOKEN",
  "ports": [5173, 5183],
  "ssh": "mac",
  "checkout": "/private/matching/mac/worktree",
  "simulatorLimit": 2
}
```

`agentDevice` is the agent-device executable you installed, at the hub's version. `ports` must be free on Linux and forwarded to the Mac's loopback; the simulator must reach both server and Metro. For the hub route, forward the Mac proxy's port to Linux separately; the T3 route ignores `hub` and its token. If the developer's machines already forward these ports, reuse those tunnels rather than opening new ones.

The Mac proxy should have its own state directory, separate from T3 and local CLI daemons, and restart only on process exit, never on a slow health request. The proxy starts its daemon once, so set `AGENT_DEVICE_DAEMON_IDLE_TIMEOUT_MS=0` in its operator-owned environment; otherwise the default five-minute idle reap stops the daemon while the proxy keeps answering. Its startup output repeats the bearer token, so do not keep it in a log. Keep the token in protected operator storage. `/health` must answer `ok:true` with an `upstream` daemon that is also `ok:true`, both on the same version as this machine's agent-device (`agentDevice`). If `doctor` reports the hub unavailable, compare `hub`'s `/health` on Linux with the proxy's `/health` on the Mac (`ssh <ssh> curl http://127.0.0.1:<proxy port>/health`): Mac healthy and Linux not means the tunnel, Mac unhealthy means the proxy or its daemon. Restart the proxy only when no other run is using it; otherwise report it. Leave T3's daemon alone.

`start` writes a 0600 config in its protected instance directory, connects with `agent-device connect proxy --daemon-base-url http://127.0.0.1:4310/agent-device` using that config/session, prepares the claimed simulator through SSH and pairs through the hub. Its card prints the full Linux-side invocation. Use it for every snapshot, press, fill and wait; do not copy the Mac's loopback T3 config. The setup session is closed before handoff. Stop closes the journey session, disconnects this connection and releases only its captured claim on the Mac.

Check device RPC health, app backend health, Metro status and native pairing separately. A successful device snapshot alone does not prove the Linux-hosted app journey or reconnection.
