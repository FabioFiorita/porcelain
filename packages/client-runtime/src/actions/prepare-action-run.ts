import type { ActionView } from '@porcelain/contracts/actions'
import { actionsProjectKey } from './actions-queries'

/**
 * Pure client Actions run preparation (ACT-002).
 *
 * Distinct from the daemon internal operation of the same name (store+trust re-check by
 * actionId). Runs against an already-fetched ActionView plus adapter-supplied context.
 * Yields Terminal-create field names (`name`, `cwd`, `initialInput`) as plain strings —
 * never imports Terminal runtime. No I/O, no spawn, no trust write.
 */

export type PrepareActionRunContext = {
  readonly projectPath: string
  readonly localPath?: string | null
}

export type PreparedActionRun = {
  readonly id: string
  readonly title: string
  readonly command: string
  readonly where: 'primary' | 'local'
  readonly projectPath: string
  /** Absolute cwd for the platform terminal create call (project root or This-device path). */
  readonly cwd: string
  /** Terminal session name — always the action title. */
  readonly name: string
  /** Shell initial input — always the action command text (not auto-executed). */
  readonly initialInput: string
}

/**
 * Client-prepare-only refusal codes. `actions.needs-local-path` is NOT a member of
 * `publicErrorSchema`. `actions.untrusted` reuses the public code string for vocabulary
 * alignment but is returned as a plain object, not a transport-mapped public error.
 */
export type PrepareActionRunRefusal =
  | { readonly code: 'actions.untrusted'; readonly actionId: string }
  | { readonly code: 'actions.needs-local-path'; readonly actionId: string }

export type PrepareActionRunResult =
  | { readonly ok: true; readonly value: PreparedActionRun }
  | { readonly ok: false; readonly error: PrepareActionRunRefusal }

/**
 * Prepare a trusted ActionView for an explicit Actions → Terminal create transition.
 * Throws `ActionsIdentityError` when `context.projectPath` is empty (even for local runs).
 */
export function prepareActionRun(
  action: ActionView,
  context: PrepareActionRunContext,
): PrepareActionRunResult {
  // Project identity is always required — validate before any outcome branch.
  const projectPath = actionsProjectKey(context.projectPath)

  if (action.trusted !== true) {
    return {
      ok: false,
      error: { code: 'actions.untrusted', actionId: action.id },
    }
  }

  if (action.where === 'local') {
    const localPath = context.localPath
    if (localPath == null || localPath === '') {
      return {
        ok: false,
        error: { code: 'actions.needs-local-path', actionId: action.id },
      }
    }
    return {
      ok: true,
      value: {
        id: action.id,
        title: action.title,
        command: action.command,
        where: 'local',
        projectPath,
        cwd: localPath,
        name: action.title,
        initialInput: action.command,
      },
    }
  }

  // `where` is 'primary' or omitted/undefined → project root.
  return {
    ok: true,
    value: {
      id: action.id,
      title: action.title,
      command: action.command,
      where: 'primary',
      projectPath,
      cwd: projectPath,
      name: action.title,
      initialInput: action.command,
    },
  }
}
