# Machine-local device host

The main checkout's git-ignored `.mobile-device-host.json` is shared by its worktrees. All fields are optional:

| Field | Value |
| --- | --- |
| `agentDevice` | Absolute path to the local agent-device executable. |
| `androidSerial` | Booted local emulator serial; `--serial` overrides it. |
| `ssh` | SSH destination of the iOS build/device host. |
| `checkout` | Absolute checkout path on that host, with matching native inputs. |
| `hub` | HTTP(S) URL of the device hub as reached from this machine. |
| `tokenVariable` | Environment-variable name holding its token; uppercase letters, digits and underscores. |
| `ports` | At least two integer ports (1024–65535) reachable by the simulator for server and Metro. |
| `simulatorLimit` | Positive integer host limit; verification never exceeds two. |

Configure `hub`, `tokenVariable` and `ports` together. Keep tokens in the environment, outside the file.

Run `scripts/cli doctor` from this skill with the intended device flags. It reports malformed host configuration, missing dependencies/driver, device availability, hub health/version mismatch and native fingerprint/build failures. Correct the reported field or dependency; make the driver and hub versions agree. For a native mismatch, sync native inputs to the configured build checkout and build there before retrying. Hub or forwarding failures require repair by the machine's device tooling before verification starts.

Keep the remote checkout available through cleanup. A device snapshot proves driver access only; verify backend, Metro and pairing through the app separately.
