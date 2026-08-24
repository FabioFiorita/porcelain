import type { DaemonSession } from '@renderer/lib/daemon'
import { environmentClientFor } from '@renderer/lib/environment-sessions'
import { trpcClient } from '@renderer/lib/trpc'
import { currentHubTarget } from '@renderer/stores/hub-selection'
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
 * Spawn a shell in the selected Worktree and open it in the Viewer-bottom terminal panel.
 * Shared by the panel's "+" button and the ⌘T shortcut so they stay in lockstep (naming,
 * the reveal step). Same target saved Actions use (`currentHubTarget`), so `pnpm dev` and
 * a typed shell start in the same checkout. No-op without a Worktree or open project.
 */
export async function spawnTerminal(): Promise<void> {
  const target = currentHubTarget()
  const cwd = target?.path ?? useProjectSelectionStore.getState().project?.path
  if (!cwd) return
  if (target === null) {
    await spawn(cwd, 'primary')
    return
  }
  const owner = environmentClientFor(target.environmentId, trpcClient)
  if (owner === null) {
    throw new Error('The target Environment is offline.')
  }
  await spawn(cwd, 'primary', undefined, owner.session ?? undefined)
}

/** Spawn a primary-daemon shell in an explicit directory and open it as a panel tab. */
export async function spawnTerminalAt(
  cwd: string,
  opts?: { name?: string; initialInput?: string },
): Promise<string> {
  return spawn(cwd, 'primary', opts)
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
 * Put one session in front of the human: open the bottom panel on its tab.
 *
 * The reveal path for a shell the human ASKED for — ⌘T, the panel's "+", a saved Action
 * they ran — which is worthless if it starts somewhere they cannot see. A shell nobody
 * clicked for uses `followTerminal`.
 */
export function revealTerminal(id: string): void {
  useTerminalsStore.getState().openPanel(id)
}

/**
 * Point the panel at a session without opening it.
 *
 * For shells the daemon starts on its own — a Worktree setup or dispose script. Sliding
 * the panel into view under whatever you were reading is the worse surprise; this way the
 * tab is already on it whenever the panel is next opened.
 */
export function followTerminal(id: string): void {
  useTerminalsStore.getState().followSession(id)
}

/**
 * Spawn a shell on the machine running the app (not the daemon this window is bound to)
 * and open it as a panel tab — the "This device" path. `localPath` is the human's mapped
 * local directory for this project; the caller (the terminal panel) collects it first,
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
  session?: DaemonSession,
): Promise<string> {
  const { sessions, create } = useTerminalsStore.getState()
  terminalNumberFloor = nextTerminalNumber(
    sessions.map((s) => s.name),
    terminalNumberFloor,
  )
  // The number is shared across machines on purpose: the roster is one list, so two
  // "Terminal 3"s in it — one local, one remote — would be the confusing outcome.
  // Named spawns (saved actions) keep the action title instead.
  const name = opts?.name ?? `Terminal ${terminalNumberFloor}`
  const id = await create({ cwd, name, origin, initialInput: opts?.initialInput, session })
  useTerminalsStore.getState().openPanel(id)
  return id
}
