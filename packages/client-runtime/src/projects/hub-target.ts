/** The operational target a Viewer tab or selection is bound to. */
export type HubTarget = Readonly<{
  environmentId: string
  projectId: string
  worktreeId: string
  /** Worktree checkout the daemon procedures take as `repoPath`. */
  path: string
}>

export type HubSelection =
  | Readonly<{ kind: 'home' }>
  | Readonly<{ kind: 'project'; environmentId: string; projectId: string }>
  | Readonly<{
      kind: 'worktree'
      environmentId: string
      projectId: string
      worktreeId: string
      path: string
    }>

export function hubTargetOf(selection: HubSelection): HubTarget | null {
  if (selection.kind !== 'worktree') return null
  return {
    environmentId: selection.environmentId,
    projectId: selection.projectId,
    worktreeId: selection.worktreeId,
    path: selection.path,
  }
}

/** Tab identity includes Environment + Project + Worktree so the same path stays distinct. */
export function hubTabKey(kind: string, key: string, target: HubTarget | null): string {
  if (target === null) return `${kind}:${key}`
  return `${kind}:${target.environmentId}:${target.projectId}:${target.worktreeId}:${key}`
}

export function sameHubTarget(left: HubTarget | null, right: HubTarget | null): boolean {
  if (left === null || right === null) return left === right
  return (
    left.environmentId === right.environmentId &&
    left.projectId === right.projectId &&
    left.worktreeId === right.worktreeId
  )
}
