import { useRepoStore } from '@renderer/stores/repo'
import { tabId, useTabsStore } from '@renderer/stores/tabs'
import { useTerminalsStore } from '@renderer/stores/terminals'

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
  const name = `Terminal ${sessions.length + 1}`
  const id = await create({ cwd: repo.path, name })
  useTabsStore
    .getState()
    .openTab({ id: tabId('terminal', id), kind: 'terminal', title: name, path: id })
}
