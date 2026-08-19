import { realpath } from 'node:fs/promises'
import { resolve } from 'node:path'

/**
 * Which checkout a tool call is about.
 *
 * A stateless request carries no working directory, so the answer that used to be
 * free — the CLI resolved the git toplevel of wherever the agent was standing — has
 * to be said out loud on every call. The spec's advice for state that spans requests
 * is to mint an explicit handle; this is deliberately NOT that. Identity here is
 * *derivable* from the Hub inventory the daemon already keeps, so a minted handle
 * would need a server-side table and reintroduce exactly the state statelessness
 * removed.
 *
 * Two accepted forms. A path is the ordinary local answer and costs the agent
 * nothing, since it knows its own checkout. The explicit ids exist because a path on
 * the agent's machine names nothing on a daemon running somewhere else.
 */
export type WorkspaceRef = string | { projectId: string; worktreeId?: string }

export type ResolvedWorkspace = Readonly<{
  projectId: string
  worktreeId: string | null
  /** The checkout on disk. Null when addressed by id and no live worktree matches. */
  worktreePath: string | null
}>

/**
 * Only what resolution reads. A structural slice rather than the whole
 * `HubInventory`, so this stays independent of fields it does not use — and so a
 * test can build one without pretending to be the contract.
 */
export type WorkspaceInventory = Readonly<{
  projects: readonly Readonly<{
    id: string
    /** Only used to say which Projects exist when resolution fails. */
    name?: string
    path: string
    worktrees: readonly Readonly<{
      id: string
      path: string
      isPrimary: boolean
      name?: string
      branch?: string
    }>[]
  }>[]
}>

export type WorkspaceResolution =
  | Readonly<{ ok: true; value: ResolvedWorkspace }>
  | Readonly<{ ok: false; message: string }>

/**
 * What this daemon has open, in the failure message itself. Telling an agent to
 * "pass {projectId}" without ever naming one is a dead end: it has no other way to
 * learn an id, so it either guesses or goes around the tool.
 */
export function describeKnownProjects(inventory: WorkspaceInventory): string {
  if (inventory.projects.length === 0) {
    return 'This daemon has no Projects open yet — open the repository in Porcelain first.'
  }
  const lines = inventory.projects.map((project) => {
    const worktrees = project.worktrees
      .map((worktree) => `      worktreeId ${worktree.id} → ${worktree.path}`)
      .join('\n')
    const label = project.name === undefined ? '' : ` (${project.name})`
    return `  projectId ${project.id}${label} → ${project.path}${worktrees === '' ? '' : `\n${worktrees}`}`
  })
  return `Projects open on this daemon:\n${lines.join('\n')}`
}

export function isWorkspaceRef(value: unknown): value is WorkspaceRef {
  if (typeof value === 'string') return value !== ''
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  return typeof record.projectId === 'string' && record.projectId !== ''
}

/** Symlink-resolved, so an equivalent path matches and a lookalike does not. */
async function realpathOrNull(path: string): Promise<string | null> {
  try {
    return await realpath(resolve(path))
  } catch {
    return null
  }
}

/**
 * Resolve against the inventory the Hub already minted, never by inventing an
 * identity: a tool call for a checkout Porcelain has not opened is refused with the
 * one action that fixes it, rather than silently writing under a fresh id whose data
 * the app would never show.
 */
export async function resolveWorkspace(
  ref: WorkspaceRef,
  inventory: WorkspaceInventory,
): Promise<WorkspaceResolution> {
  if (typeof ref !== 'string') {
    const project = inventory.projects.find((candidate) => candidate.id === ref.projectId)
    if (project === undefined) {
      return {
        ok: false,
        message: `No Project ${ref.projectId} on this daemon. ${describeKnownProjects(inventory)}`,
      }
    }
    if (ref.worktreeId === undefined) {
      const primary = project.worktrees.find((worktree) => worktree.isPrimary)
      return {
        ok: true,
        value: {
          projectId: project.id,
          worktreeId: primary?.id ?? null,
          worktreePath: primary?.path ?? project.path,
        },
      }
    }
    const worktree = project.worktrees.find((candidate) => candidate.id === ref.worktreeId)
    if (worktree === undefined) {
      return {
        ok: false,
        message: `No Worktree ${ref.worktreeId} in Project ${ref.projectId}. ${describeKnownProjects(inventory)}`,
      }
    }
    return {
      ok: true,
      value: { projectId: project.id, worktreeId: worktree.id, worktreePath: worktree.path },
    }
  }

  const requested = await realpathOrNull(ref)
  if (requested === null) {
    return {
      ok: false,
      message: `No such directory: ${ref}. Pass the absolute path of the checkout you are working in (your process.cwd() or its repository root). ${describeKnownProjects(inventory)}`,
    }
  }

  for (const project of inventory.projects) {
    for (const worktree of project.worktrees) {
      const candidate = await realpathOrNull(worktree.path)
      if (candidate === null) continue
      // An exact match or any directory inside it: an agent stands in a subdirectory
      // as often as at the root, and refusing that would make the tool feel broken.
      if (requested === candidate || requested.startsWith(`${candidate}/`)) {
        return {
          ok: true,
          value: { projectId: project.id, worktreeId: worktree.id, worktreePath: worktree.path },
        }
      }
    }
  }
  return {
    ok: false,
    message: `${ref} is not a checkout Porcelain has open. Open it in the Porcelain app first, or call again with {projectId, worktreeId?}. ${describeKnownProjects(inventory)}`,
  }
}
