import { useProjectSelectionStore } from '@renderer/stores/project-selection'
import { type TerminalOrigin, useTerminalsStore } from '@renderer/stores/terminals'

/**
 * The next "Terminal N": one past the highest N in the roster (pure — the caller owns
 * the monotonic floor). Counting rows instead of parsing numbers handed out duplicates:
 * close Terminal 1 and the next spawn was a second "Terminal 2". Non-numbered (renamed)
 * sessions still bump the floor via the roster size so a fresh number never collides
 * conceptually with today's behavior.
 */
export function nextTerminalNumber(existingNames: string[], floor: number): number {
  const numbers = existingNames.map((name) => {
    const match = /^Terminal (\d+)$/.exec(name)
    return match ? Number(match[1]) : 0
  })
  return Math.max(floor, existingNames.length, ...numbers) + 1
}

// Monotonic per-window floor: a stale `terminalSessions` snapshot can transiently
// clobber the optimistic roster (hydrate REPLACES — see stores/terminals.ts), and a
// spawn inside that ≤5s self-heal window would recount from an empty roster. Under CI
// load this named a second terminal "Terminal 1" and gated a release (v0.19.0 e2e).
// The floor only ever rises, so a clobbered roster can't reissue a taken number.
let terminalNumberFloor = 0

/**
 * Spawn a shell in the project root and open it in the Viewer-bottom terminal panel. Shared by the Terminal
 * tab's "+" button and the ⌘T / ⌘N shortcuts so they stay in lockstep (naming, the
 * open-in-tab step). No-op without a project. Not a store action — it reaches across three
 * stores via `getState()`, which a lib helper can do without risking an import cycle.
 */
export async function spawnTerminal(): Promise<void> {
  const project = useProjectSelectionStore.getState().project
  if (!project) return
  await spawn(project.path, 'primary')
}

/** Spawn a primary-daemon shell in an explicit directory and open the bottom panel. */
export async function spawnTerminalAt(
  cwd: string,
  opts?: { name?: string; initialInput?: string },
): Promise<void> {
  await spawn(cwd, 'primary', opts)
}

/** Open the bottom panel, creating its first shell on demand for the active project. */
export async function openTerminalPanel(): Promise<void> {
  const { sessions, openPanel } = useTerminalsStore.getState()
  if (sessions.length === 0) {
    await spawnTerminal()
    return
  }
  openPanel()
}

/** Toggle the bottom panel; the first open creates a shell instead of showing an empty bar. */
export async function toggleTerminalPanel(): Promise<void> {
  const { panelOpen, closePanel } = useTerminalsStore.getState()
  if (panelOpen) {
    closePanel()
    return
  }
  await openTerminalPanel()
}

/**
 * Spawn a shell on the machine running the app (not the daemon this window is bound to)
 * and open it as a terminal tab — the "This device" path. `localPath` is the human's
 * mapped local directory for this project; the caller (the Terminal list) collects it first,
 * since the remote project's path rarely exists locally.
 */
export async function spawnLocalTerminal(
  localPath: string,
  opts?: { name?: string; initialInput?: string },
): Promise<void> {
  await spawn(localPath, 'local', opts)
}

async function spawn(
  cwd: string,
  origin: TerminalOrigin,
  opts?: { name?: string; initialInput?: string },
): Promise<void> {
  const { sessions, create } = useTerminalsStore.getState()
  terminalNumberFloor = nextTerminalNumber(
    sessions.map((s) => s.name),
    terminalNumberFloor,
  )
  // The number is shared across machines on purpose: the roster is one list, so two
  // "Terminal 3"s in it — one local, one remote — would be the confusing outcome.
  // Named spawns (saved actions) keep the action title instead.
  const name = opts?.name ?? `Terminal ${terminalNumberFloor}`
  const id = await create({ cwd, name, origin, initialInput: opts?.initialInput })
  useTerminalsStore.getState().openPanel(id)
}
