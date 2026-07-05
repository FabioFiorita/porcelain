import { useRepoStore } from '@renderer/stores/repo'
import { tabId, useTabsStore } from '@renderer/stores/tabs'
import { useTerminalsStore } from '@renderer/stores/terminals'

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
 * Spawn a shell in the repo root and open it as a terminal tab. Shared by the Terminal
 * tab's "+" button and the ⌘T / ⌘N shortcuts so they stay in lockstep (naming, the
 * open-in-tab step). No-op without a repo. Not a store action — it reaches across three
 * stores via `getState()`, which a lib helper can do without risking an import cycle.
 */
export async function spawnTerminal(): Promise<void> {
  const repo = useRepoStore.getState().repo
  if (!repo) return
  const { sessions, create } = useTerminalsStore.getState()
  terminalNumberFloor = nextTerminalNumber(
    sessions.map((s) => s.name),
    terminalNumberFloor,
  )
  const name = `Terminal ${terminalNumberFloor}`
  const id = await create({ cwd: repo.path, name })
  useTabsStore
    .getState()
    .openTab({ id: tabId('terminal', id), kind: 'terminal', title: name, path: id })
}
