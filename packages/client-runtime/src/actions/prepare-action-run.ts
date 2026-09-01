import type { PrepareActionRunOutput } from '@porcelain/contracts/actions'

/**
 * Turn one daemon-authorized run into Terminal-create fields.
 *
 * Authorization is the daemon's: the `prepareActionRun` procedure is what checks that
 * the Action exists in that Project, that the explicit target names a Worktree the
 * daemon itself knows, and that the command text is trusted on that machine. This
 * function never re-decides any of that — it only answers "which cwd does this client
 * spawn in", which is the one thing the daemon cannot know: a `where: 'local'` action
 * runs on THIS device, in the folder the human mapped, not in the daemon's checkout.
 *
 * Yields Terminal-create field names (`name`, `cwd`, `initialInput`) as plain strings —
 * never imports Terminal runtime. No I/O, no spawn, no trust write.
 */

export type PrepareActionRunContext = {
  /** This device's mapping of the target checkout; required only for `where: 'local'`. */
  readonly localPath?: string | null
}

export type PreparedActionRun = {
  readonly id: string
  readonly title: string
  readonly command: string
  readonly where: 'primary' | 'local'
  /** Absolute cwd for the platform terminal create call (verified Worktree or This-device path). */
  readonly cwd: string
  /** Terminal session name — always the action title. */
  readonly name: string
  /** Shell initial input — always the action command text (not auto-executed). */
  readonly initialInput: string
}

/**
 * Client-prepare-only refusal. `actions.needs-local-path` is NOT a member of
 * `publicErrorSchema`: it is this device's missing folder mapping, not a daemon outcome.
 */
export type PrepareActionRunRefusal = {
  readonly code: 'actions.needs-local-path'
  readonly actionId: string
}

export type PrepareActionRunResult =
  | { readonly ok: true; readonly value: PreparedActionRun }
  | { readonly ok: false; readonly error: PrepareActionRunRefusal }

/** Bind a daemon-authorized run to the cwd this client will actually spawn in. */
export function prepareActionRun(
  authorized: PrepareActionRunOutput,
  context: PrepareActionRunContext = {},
): PrepareActionRunResult {
  const shared = {
    id: authorized.id,
    title: authorized.title,
    command: authorized.command,
    name: authorized.title,
    initialInput: authorized.command,
  }

  if (authorized.where === 'local') {
    const localPath = context.localPath
    if (localPath == null || localPath === '') {
      return {
        ok: false,
        error: { code: 'actions.needs-local-path', actionId: authorized.id },
      }
    }
    return { ok: true, value: { ...shared, where: 'local', cwd: localPath } }
  }

  return { ok: true, value: { ...shared, where: 'primary', cwd: authorized.cwd } }
}
