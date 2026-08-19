import type { HubProject } from '@porcelain/contracts/projects'

/**
 * What a "This device" terminal folder field should start at, before the human has ever
 * mapped this repo.
 *
 * The window is bound to a remote daemon, so the repo path it shows belongs to the OTHER
 * machine — `/home/you/worktrees/app-some-branch` on a Linux box does not exist on the Mac
 * in front of you. Prefilling that path only ever produced a folder the local shell can't
 * enter, so it is never a suggestion here.
 *
 * What we can know instead: this machine's own daemon publishes a Hub inventory, and a
 * Project's `groupingKey` (normalized origin URL, or its name when there is no origin) is
 * the SAME on both machines for the same repo. So a local clone of the remote repo can be
 * recognized and offered — its Project root, not a mirrored worktree path: the remote side
 * may be on a branch checkout this machine has never created, and the root is the folder a
 * human would have opened anyway.
 *
 * Everything here is a starting value for an editable field, never an action.
 */
export function suggestLocalTerminalPath(input: {
  /** The remote repo path the window is showing (a Project root or one of its worktrees). */
  repoPath: string
  /** Projects known to the daemon that owns `repoPath`. */
  remoteProjects: readonly HubProject[]
  /** Projects known to the daemon running on THIS device. */
  localProjects: readonly HubProject[]
  /** This device's home directory, when the shell reported one. */
  localHome: string | null
}): string {
  const remote = findHubProjectForPath(input.remoteProjects, input.repoPath)
  if (remote !== null) {
    const sameRepo = input.localProjects.find(
      (project) => project.groupingKey === remote.groupingKey,
    )
    if (sameRepo !== undefined) return sameRepo.path
    // No shared origin (a fork, or a clone with no remote): a same-named Project on this
    // device is the human's likely target and costs one edit if it isn't.
    const sameName = input.localProjects.find(
      (project) => project.name.toLowerCase() === remote.name.toLowerCase(),
    )
    if (sameName !== undefined) return sameName.path
  }
  // Nothing recognized: the home directory is a real folder here. An empty field is the
  // last resort — still better than a path that cannot exist on this machine.
  return input.localHome ?? ''
}

/** The Project owning a path, matched against the root or any of its live worktrees. PURE. */
export function findHubProjectForPath(
  projects: readonly HubProject[],
  repoPath: string,
): HubProject | null {
  return (
    projects.find(
      (project) =>
        project.path === repoPath ||
        project.worktrees.some((worktree) => worktree.path === repoPath),
    ) ?? null
  )
}
