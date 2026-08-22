import { openTerminalsBoard } from '@renderer/features/terminal/terminals-navigation'
import type { DaemonSession } from '@renderer/lib/daemon'
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
 * Spawn a shell in the project root and show it on the Terminals surface. Shared by the
 * Terminals board's "+" button and the ⌘T shortcut so they stay in lockstep (naming, the
 * reveal step). No-op without a project. Not a store action — it reaches across three
 * stores via `getState()`, which only a lib helper may do. Imports the navigation module
 * directly rather than the `features/terminal` barrel: the barrel pulls in the roster,
 * which imports this file, and that is a real cycle.
 */
export async function spawnTerminal(): Promise<void> {
  const project = useProjectSelectionStore.getState().project
  if (!project) return
  await spawn(project.path, 'primary')
}

/** Spawn a primary-daemon shell in an explicit directory, reveal it, and name its id. */
export async function spawnTerminalAt(
  cwd: string,
  opts?: { name?: string; initialInput?: string },
): Promise<string> {
  return spawn(cwd, 'primary', opts)
}

/**
 * Spawn on a named Environment — a daemon this window is not bound to.
 *
 * Same path as every other spawn so the numbering floor, the reveal, and the id routing stay
 * in one place: the only difference is which daemon is asked, and the store records that so a
 * later keystroke reaches the same machine.
 */
export async function spawnTerminalOnSession(
  session: DaemonSession,
  cwd: string,
  opts?: { name?: string; initialInput?: string },
): Promise<string> {
  return spawn(cwd, 'primary', opts, session)
}

/**
 * Put one session in front of the human: focus it and open the Terminals tab.
 *
 * The reveal path for a shell the human ASKED for — ⌘T, the board's "+", a saved Action
 * they ran — which is worthless if it starts somewhere they cannot see, and there is
 * exactly one place to show it now. A shell nobody clicked for uses `followTerminal`.
 */
export function revealTerminal(id: string): void {
  useTerminalsStore.getState().focus(id)
  openTerminalsBoard()
}

/**
 * Point the board at a session without navigating to it.
 *
 * For shells the daemon starts on its own — a Worktree setup or dispose script. The old
 * bottom panel could slide one into view under whatever you were reading; the Viewer
 * cannot, and taking the pane away mid-review to show a script nobody asked for is the
 * worse surprise. The board renders `focusedId`, so a board already on screen switches to
 * it immediately and a closed one opens on it later.
 */
export function followTerminal(id: string): void {
  useTerminalsStore.getState().focus(id)
}

/**
 * Spawn a shell on the machine running the app (not the daemon this window is bound to)
 * and reveal it on the Terminals surface — the "This device" path. `localPath` is the human's
 * mapped local directory for this project; the caller (the Terminals board) collects it first,
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
  revealTerminal(id)
  return id
}
