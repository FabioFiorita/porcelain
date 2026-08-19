import type { ActionView, WorktreeScriptKind } from '@porcelain/contracts/actions'
import type { SessionChange } from '@porcelain/contracts/session'

/**
 * Worktree lifecycle scripts: the saved commands Porcelain runs *itself*, in a terminal the
 * human can watch, when a Worktree is created or removed from the app.
 *
 * Three rules make this safe to have at all:
 *
 * 1. **Same table, same gate.** A lifecycle script is an Action with `kind`. It is not a
 *    second kind of stored command with a second set of rules — an agent can save one, and
 *    the human still accepts the command text before anything runs. Untrusted scripts are
 *    skipped, never silently executed because "the app started it".
 * 2. **A terminal, not a hidden child process.** Setup and dispose are exactly the moments a
 *    person wants to see output (a failed install, a container that will not stop). The
 *    session is retained and announced so a client can focus it while it runs.
 * 3. **Dispose finishes before the checkout does.** `git worktree remove --force` deletes the
 *    directory; a teardown that ran after it would run in nothing. So dispose blocks removal,
 *    bounded — a script that hangs must not make a Worktree unremovable. Removing a Worktree
 *    also ends its setup session: it is retained, so no reaper would ever collect a shell
 *    left running in a directory that no longer exists.
 */

/** How long a dispose run may hold up removal before the daemon gives up and removes anyway. */
export const DISPOSE_TIMEOUT_MS = 2 * 60_000

export type WorktreeScriptTarget = Readonly<{
  projectId: string
  worktreeId: string
  /** Absolute checkout path — the terminal's cwd. */
  path: string
}>

/**
 * The narrow slice of session machinery a lifecycle run needs: spawn something no reaper may
 * collect, and end it. Deliberately not all of TerminalOperations — mirrors `DevServerHost`.
 */
export type WorktreeScriptHost = Readonly<{
  createRetained(
    input: { name: string; cwd: string; initialInput?: string },
    observer: { onCommandSent(): void; onData(data: string): void; onExit(exitCode: number): void },
  ): { ok: true; value: string } | { ok: false; error: unknown }
  kill(id: string): unknown
}>

export type WorktreeScripts = Readonly<{
  /** Spawn the setup terminal and return once it exists — the human watches from there. */
  runSetup(target: WorktreeScriptTarget): Promise<void>
  /** Spawn the dispose terminal and wait for it to finish (bounded) before returning. */
  runDispose(target: WorktreeScriptTarget): Promise<void>
}>

type CreateWorktreeScriptsOptions = Readonly<{
  /** The Project's saved commands, already carrying per-machine `trusted`. */
  listActions: (projectId: string) => Promise<ActionView[]>
  host: WorktreeScriptHost
  publish: (change: SessionChange) => void
  timeoutMs?: number
  /** Injected so a test can resolve the wait without a real PTY or a real clock. */
  setTimeoutFn?: (callback: () => void, delay: number) => unknown
  clearTimeoutFn?: (handle: unknown) => void
}>

const ROLE_LABEL: Record<WorktreeScriptKind, string> = {
  'worktree-setup': 'Setup',
  'worktree-dispose': 'Dispose',
}

/**
 * The trusted scripts of one role, in list order.
 *
 * An untrusted script is dropped here and nowhere else, so there is exactly one place that
 * decides whether a command Porcelain starts on its own may run. Nothing about the skip is
 * typed into the shell: the title is agent-authorable text, and echoing it would be an
 * injection with extra steps. The client already reads the same list and shows the shield.
 */
export function trustedScriptsOfKind(
  actions: readonly ActionView[],
  kind: WorktreeScriptKind,
): ActionView[] {
  return actions.filter((action) => action.kind === kind && action.trusted)
}

export function createWorktreeScripts(options: CreateWorktreeScriptsOptions): WorktreeScripts {
  /** Setup terminal by checkout path, so removing that checkout can shut it down. */
  const setupSessions = new Map<string, string>()
  const timeoutMs = options.timeoutMs ?? DISPOSE_TIMEOUT_MS
  const setTimeoutFn = options.setTimeoutFn ?? ((callback, delay) => setTimeout(callback, delay))
  const clearTimeoutFn =
    options.clearTimeoutFn ?? ((handle) => clearTimeout(handle as ReturnType<typeof setTimeout>))

  /**
   * Spawn one terminal for the whole phase. The scripts are typed as consecutive lines, so the
   * shell runs them in the human's saved order and stops nothing on the way — the same thing
   * they would get by pasting the list themselves.
   */
  function spawn(
    kind: WorktreeScriptKind,
    target: WorktreeScriptTarget,
    scripts: readonly ActionView[],
    onExit: (exitCode: number) => void,
  ): string | null {
    // `exit` closes the shell once dispose is done; that exit is what unblocks removal.
    const lines = scripts.map((script) => script.command)
    if (kind === 'worktree-dispose') lines.push('exit')

    const created = options.host.createRetained(
      {
        name: `${ROLE_LABEL[kind]} · ${scripts.map((script) => script.title).join(', ')}`,
        cwd: target.path,
        initialInput: lines.join('\n'),
      },
      { onCommandSent: () => undefined, onData: () => undefined, onExit },
    )
    if (!created.ok) return null

    options.publish({
      kind: 'terminal.worktree-script-started',
      role: kind,
      projectId: target.projectId,
      worktreeId: target.worktreeId,
      terminalId: created.value,
    })
    return created.value
  }

  async function scriptsFor(
    kind: WorktreeScriptKind,
    projectId: string,
  ): Promise<ActionView[] | null> {
    const actions = await options.listActions(projectId)
    const scripts = trustedScriptsOfKind(actions, kind)
    return scripts.length === 0 ? null : scripts
  }

  return Object.freeze({
    async runSetup(target: WorktreeScriptTarget): Promise<void> {
      const scripts = await scriptsFor('worktree-setup', target.projectId)
      if (scripts === null) return
      const id = spawn('worktree-setup', target, scripts, () => setupSessions.delete(target.path))
      if (id !== null) setupSessions.set(target.path, id)
    },

    async runDispose(target: WorktreeScriptTarget): Promise<void> {
      // The setup shell goes first, whatever else happens: the human asked for this checkout
      // to be gone, and its own terminal must not outlive it.
      const setup = setupSessions.get(target.path)
      if (setup !== undefined) {
        setupSessions.delete(target.path)
        options.host.kill(setup)
      }

      const scripts = await scriptsFor('worktree-dispose', target.projectId)
      if (scripts === null) return

      await new Promise<void>((resolve) => {
        let settled = false
        let timer: unknown
        const finish = (id: string | null): void => {
          if (settled) return
          settled = true
          clearTimeoutFn(timer)
          // The checkout this session lives in is about to be deleted, and a retained
          // session is exempt from every reaper — so its owner has to end it. Watching
          // happens while it runs; there is no checkout left to read it in afterwards.
          if (id !== null) options.host.kill(id)
          resolve()
        }
        let spawned: string | null = null
        spawned = spawn('worktree-dispose', target, scripts, () => finish(spawned))
        if (spawned === null) {
          finish(null)
          return
        }
        const id = spawned
        // A teardown that never returns must not make the Worktree unremovable: at the
        // bound the daemon ends the session and removes anyway.
        timer = setTimeoutFn(() => finish(id), timeoutMs)
      })
    },
  })
}
