import type { CreateHubWorktreeInput } from '@porcelain/contracts/projects'

/**
 * What the New Worktree sheet holds, and what it is allowed to send.
 *
 * Pure on purpose: the daemon input is `.strict()`, so a field the contract does not name is a
 * rejected write rather than an ignored one. Everything the sheet knows about which fields go
 * on the wire lives here, where it can be checked without a native runtime.
 */
export type NewWorktreeDraft = {
  /** `undefined` is "nobody has chosen yet" on a multi-Environment board — refusable. */
  readonly environmentId: string | undefined
  readonly projectId: string | null
  readonly branch: string
  /** The base ref, as typed. Empty means current HEAD, which is the daemon's own default. */
  readonly baseRef: string
}

export type NewWorktreeRequest =
  | { readonly ok: true; readonly environmentId: string; readonly input: CreateHubWorktreeInput }
  | { readonly ok: false; readonly message: string }

/**
 * The Environment picker appears only when more than one Environment is PAIRED.
 *
 * Paired, not "has an inventory loaded": the Hub reads every daemon in parallel and drops the
 * ones still in flight, so counting inventories would flicker the control away mid-load and
 * silently pick the first daemon that answered.
 */
export function showsEnvironmentPicker(pairedCount: number): boolean {
  return pairedCount > 1
}

/** One paired Environment is the target with nothing to choose; several must be chosen between. */
export function newWorktreeTarget(
  pairedIds: readonly string[],
  chosen: string | undefined,
): string | undefined {
  return showsEnvironmentPicker(pairedIds.length) ? chosen : pairedIds[0]
}

/**
 * The draft as a create request, or the reason it cannot be one.
 *
 * `baseRef` is OMITTED rather than sent empty — the contract's `min(1)` refuses an empty
 * string, and "no base ref" is how the daemon is told to branch from current HEAD. `existing`
 * is never sent: this sheet creates a branch, and checking one out is a different gesture.
 */
export function newWorktreeRequest(draft: NewWorktreeDraft): NewWorktreeRequest {
  if (draft.environmentId === undefined) {
    return { message: 'Choose the Environment this Worktree belongs to.', ok: false }
  }
  if (draft.projectId === null) {
    return { message: 'Choose the Project this Worktree belongs to.', ok: false }
  }
  const branch = draft.branch.trim()
  if (branch === '') {
    return { message: 'A Worktree needs a branch name.', ok: false }
  }
  const baseRef = draft.baseRef.trim()
  return {
    environmentId: draft.environmentId,
    input: {
      branch,
      projectId: draft.projectId,
      ...(baseRef === '' ? {} : { baseRef }),
    },
    ok: true,
  }
}
