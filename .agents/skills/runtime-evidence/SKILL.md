---
name: runtime-evidence
description: Prepare isolated Porcelain development worktrees and runtimes, coordinate parallel implementation, and validate browser, Electron, and Android behavior with evidence in this repository.
---

# Runtime evidence

This is a repository development skill. It does not configure the shipped companion plugin or
prescribe a Canvas workflow. Use [AGENTS.md](../../../AGENTS.md) for repository boundaries and
[development.md](../../../docs/development.md) for launch and rebuild guidance. Commands belong
to [package.json](../../../package.json), package-local scripts, and the linked launchers; inspect
their current interfaces instead of carrying command recipes or allocations between sessions.

For Codex-created or managed worktrees, parallel file ownership, integration checks, and checkout
cleanup, read [parallel-work.md](references/parallel-work.md) before allocating or changing runtimes.
For concrete launch, refresh, device routing, and readiness checks, read
[runtime-surfaces.md](references/runtime-surfaces.md).

## Establish ownership and readiness

Run `pnpm dev:env` before launching. Record the checkout's resolved development profile,
`PORCELAIN_DEV` configuration, playground, and ports. Adopt or bootstrap an unmanaged linked
checkout before use. Never use production `~/.porcelain`, its listener, credentials, or repositories
as fixtures. Create task-specific disposable repositories inside the development playground.

Choose one daemon owner per profile. An Electron `pnpm dev` session already owns its daemon;
browser and mobile clients may connect to that verified daemon without starting `pnpm dev:daemon`.
Otherwise use the daemon launcher from development.md. Verify the actual listener and process
ownership before reusing a development runtime; a matching port alone is insufficient.

Record the exact process IDs, launch command, checkout/profile, device serial, and whether each
resource was started here or borrowed. Devices are machine-global. Address Android commands to
the selected serial; never infer ownership from the first listed device. On Windows use native
Android tooling as described in development.md; the Bash Android helper is not a PowerShell launcher.

Before collecting behavioral evidence, establish readiness for each requested surface:

- **Browser:** the intended development URL loads the application, connects to the intended daemon,
  and opens the disposable fixture. Distinguish hot-reload source from daemon-served built assets.
- **Electron:** the native window loads the intended build/profile and opens the same fixture on its
  intended Environment. A successful build or a browser rendition is insufficient.
- **Android:** the selected device is booted, the development client opens the intended Metro build,
  pairing connects to the development daemon, and the fixture opens. Metro listening or a package
  installed on the device alone is insufficient.

Mobile readiness covers both phone and tablet layouts. Record each form factor's device serial,
orientation, pairing, and observed result separately; one layout's capture does not prove the other.

For an all-surface request, verify all three before proceeding with the audit. If a surface is
blocked, record its precise readiness failure and resolve it or report the gap; do not substitute
unit-test results. Recheck readiness after changes requiring rebuild/restart. Use current source
and build provenance, not the presence of an old application window, to establish what is running.

## Coordinate evidence

Keep one operator in control of interactive UI at a time. When agents are involved, the coordinator
assigns the active surface, fixture, and expected starting state; other agents may inspect source
without changing that UI or its fixture. Release the surface explicitly at handoff. Readiness does
not authorize another agent to restart shared processes or retarget a device.

Choose tools for the actual surface. For native Windows Electron, follow the Computer Use skill's
`node_repl` and `@oai/sky` flow; browser-only `cua_repl` cannot establish native app behavior. Use the
available browser and native Android controls for their respective surfaces. If a required control
is unavailable, report that limitation rather than claiming runtime proof from source inspection.

Define a concrete expected outcome before each interaction. For cross-Environment scenarios, label
the fixture's owning Environment and verify requests/results against that owner. Distinct file
contents or branch lists help expose wrong-host behavior; identical paths on separate disposable
Environments help expose identity collisions. Keep navigation and mutation within the task's scope.

Save evidence under `scripts/agent-scratch/<task>/`. Maintain a small manifest alongside captures
and focused logs containing:

- Source revision and relevant uncommitted changes; build/restart provenance.
- Development profile, fixture paths and Environment identities, and runtime/process/device ownership.
- Surface, scenario, starting state, expected result, and observed result.
- Artifact paths, capture time, and limitations or unverified surfaces.

Exclude credentials from the manifest, logs, screenshots, and videos. Pair through the development
flow, but do not capture pairing tokens, administrator credentials, or authenticated URLs. Review
artifacts before sharing them. Record observable failures as failures; distinguish code findings,
test outcomes, and runtime observations. A screenshot of the final state alone may need a short
interaction trace to establish the behavior it proves.

## Cleanup and handoff

Stop only processes and devices this task started or whose ownership is verified. Remove only
task-owned fixtures and device forwarding/configuration; preserve borrowed runtimes and unrelated
state. Verify resolved targets before recursive filesystem cleanup. Retain requested evidence.

At handoff, record which runtimes remain running, their exact owners and identifiers, the current
UI/fixture state, evidence location, and outstanding limitations. Report which requested surfaces
were actually observed and which need further proof. Do not commit, publish, or release merely
because runtime verification succeeded; follow the user's delivery scope and repository rules.
