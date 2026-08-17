import { randomUUID } from 'node:crypto'
import type {
  CreateHubWorktreeInput,
  EnvironmentIdentity,
  HubInventory,
  HubProject,
  HubWorktree,
  RemoveHubWorktreeInput,
} from '@porcelain/contracts/projects'
import type { GitWorkspaceError } from '../git'
import type { EnvironmentIdentityStore } from './environment-identity-store'
import type { HubGitPort } from './hub-git-port'
import {
  type DiscoveredProject,
  rematchProject,
  rematchWorktrees,
  type StoredHubProject,
  worktreeDisplayName,
} from './hub-identity'
import type { HubInventoryStore } from './hub-inventory-store'
import type { ProjectsRecentsStore } from './projects-recents-store'
import type { ProjectOperationResult, ProjectsOperationError } from './projects-results'

export type HubInventoryOperations = Readonly<{
  listHubInventory: () => Promise<ProjectOperationResult<HubInventory>>
  createHubWorktree: (input: CreateHubWorktreeInput) => Promise<ProjectOperationResult<HubWorktree>>
  removeHubProject: (projectId: string) => Promise<ProjectOperationResult<void>>
  removeHubWorktree: (input: RemoveHubWorktreeInput) => Promise<ProjectOperationResult<void>>
  registerPath: (path: string) => Promise<void>
}>

function unavailable(): ProjectOperationResult<never> {
  return { ok: false, error: { code: 'projects.unavailable' } }
}

function notFound(): ProjectOperationResult<never> {
  return { ok: false, error: { code: 'projects.not-found' } }
}

type AllowedPath = boolean | string | null

function allowedPath(
  path: string,
  predicate: ((path: string) => AllowedPath) | undefined,
): string | null {
  if (predicate === undefined) return path
  const result = predicate(path)
  return typeof result === 'string' ? result : result === true ? path : null
}

function mapGitWorkspaceError(error: GitWorkspaceError): ProjectsOperationError {
  switch (error.code) {
    case 'git.not-a-repository':
    case 'git.branch-already-exists':
    case 'git.worktree-conflict':
      return error
    case 'git.branch-not-found':
    case 'git.working-tree-conflict':
      return { code: 'projects.unavailable' }
  }
}

function upsertProject(
  projects: readonly StoredHubProject[],
  next: StoredHubProject,
): StoredHubProject[] {
  const index = projects.findIndex((project) => project.id === next.id)
  if (index === -1) return [...projects, next]
  return projects.map((project, current) => (current === index ? next : project))
}

function toHubWorktree(
  projectId: string,
  storedId: string,
  discovered: DiscoveredProject['worktrees'][number],
): HubWorktree {
  return {
    id: storedId,
    projectId,
    path: discovered.path,
    name: worktreeDisplayName(discovered.path),
    branch: discovered.branch,
    isPrimary: discovered.isPrimary,
  }
}

function toHubProject(
  environmentId: string,
  stored: StoredHubProject,
  live: DiscoveredProject['worktrees'],
): HubProject | null {
  if (live.length === 0) return null
  const byGitDir = new Map(stored.worktrees.map((worktree) => [worktree.gitDir, worktree.id]))
  const worktrees = live.flatMap((worktree) => {
    const id = byGitDir.get(worktree.gitDir)
    return id === undefined ? [] : [toHubWorktree(stored.id, id, worktree)]
  })
  const primary = worktrees.find((worktree) => worktree.isPrimary) ?? worktrees[0]
  if (primary === undefined) return null
  return {
    id: stored.id,
    environmentId,
    name: stored.name,
    groupingKey: stored.groupingKey,
    path: primary.path,
    worktrees,
  }
}

export function createHubInventoryOperations(options: {
  environment: EnvironmentIdentityStore
  inventory: HubInventoryStore
  recents: ProjectsRecentsStore
  git: HubGitPort
  daemon: { host: string; platform: string; arch: string }
  /** Optional development-daemon boundary; production has no path restriction. */
  pathAllowed?: (path: string) => AllowedPath
  createId?: () => string
}): HubInventoryOperations {
  const createId = options.createId ?? randomUUID

  async function loadEnvironment(): Promise<ProjectOperationResult<EnvironmentIdentity>> {
    const record = await options.environment.read()
    if (!record.ok) return unavailable()
    return {
      ok: true,
      value: {
        ...record.value,
        host: options.daemon.host,
        platform: options.daemon.platform,
        arch: options.daemon.arch,
      },
    }
  }

  async function refreshProject(
    stored: StoredHubProject,
  ): Promise<{ stored: StoredHubProject; live: DiscoveredProject['worktrees'] }> {
    const listed = await options.git.listWorktrees(stored.commonGitDir)
    if (!listed.ok) return { stored, live: [] }
    const rematched = rematchWorktrees(stored.worktrees, listed.value, createId)
    return { stored: { ...stored, worktrees: rematched }, live: listed.value }
  }

  async function registerDiscovered(
    working: StoredHubProject[],
    discovered: DiscoveredProject,
  ): Promise<StoredHubProject[]> {
    const existence = new Map<string, boolean>()
    await Promise.all(
      working.map(async (project) => {
        existence.set(project.commonGitDir, await options.git.pathExists(project.commonGitDir))
      }),
    )
    const rematched = rematchProject(
      working,
      discovered,
      (commonGitDir) => existence.get(commonGitDir) === true,
      createId,
    )
    return upsertProject(working, rematched)
  }

  async function rebuild(): Promise<
    ProjectOperationResult<{
      environment: EnvironmentIdentity
      stored: StoredHubProject[]
      live: HubProject[]
    }>
  > {
    const environment = await loadEnvironment()
    if (!environment.ok) return environment
    const storedResult = await options.inventory.readProjects()
    if (!storedResult.ok) return unavailable()
    const recents = await options.recents.readPaths()
    if (!recents.ok) return unavailable()

    let working = [...storedResult.value]
    for (const path of recents.value) {
      const allowed = allowedPath(path, options.pathAllowed)
      if (allowed === null) continue
      const discovered = await options.git.discoverProject(allowed)
      if (!discovered.ok) continue
      working = await registerDiscovered(working, discovered.value)
    }

    const live: HubProject[] = []
    const nextStored: StoredHubProject[] = []
    for (const project of working) {
      const refreshed = await refreshProject(project)
      // A single Git project can contain worktrees from multiple families. Filter each live
      // entry before mapping it into the public inventory; checking only `some()` and then
      // passing the complete list would leak a production checkout beside a playground one.
      const allowedLive = refreshed.live.flatMap((worktree) => {
        const path = allowedPath(worktree.path, options.pathAllowed)
        return path === null ? [] : [{ ...worktree, path }]
      })
      if (allowedLive.length === 0) continue
      const liveGitDirs = new Set(allowedLive.map((worktree) => worktree.gitDir))
      const stored = {
        ...refreshed.stored,
        worktrees: refreshed.stored.worktrees.filter((worktree) =>
          liveGitDirs.has(worktree.gitDir),
        ),
      }
      nextStored.push(stored)
      const hubProject = toHubProject(environment.value.id, stored, allowedLive)
      if (hubProject !== null) live.push(hubProject)
    }

    const written = await options.inventory.writeProjects(nextStored)
    if (!written.ok) return unavailable()
    return { ok: true, value: { environment: environment.value, stored: nextStored, live } }
  }

  async function removeHubProject(projectId: string): Promise<ProjectOperationResult<void>> {
    const rebuilt = await rebuild()
    if (!rebuilt.ok) return rebuilt
    const stored = rebuilt.value.stored.find((project) => project.id === projectId)
    if (stored === undefined) return notFound()
    const live = rebuilt.value.live.find((project) => project.id === projectId)
    const livePaths = new Set(live?.worktrees.map((worktree) => worktree.path) ?? [])
    const recents = await options.recents.readPaths()
    if (!recents.ok) return unavailable()

    for (const path of recents.value) {
      const discovered = livePaths.has(path)
        ? { ok: true as const, value: { commonGitDir: stored.commonGitDir } }
        : await (() => {
            const allowed = allowedPath(path, options.pathAllowed)
            return allowed === null
              ? Promise.resolve({ ok: false as const, error: 'not-a-repository' as const })
              : options.git.discoverProject(allowed)
          })()
      if (!discovered.ok || discovered.value.commonGitDir !== stored.commonGitDir) continue
      const removed = await options.recents.removePath(path)
      if (!removed.ok) return unavailable()
    }

    const written = await options.inventory.writeProjects(
      rebuilt.value.stored.filter((project) => project.id !== projectId),
    )
    if (!written.ok) return unavailable()
    return { ok: true, value: undefined }
  }

  async function removeHubWorktree(
    input: RemoveHubWorktreeInput,
  ): Promise<ProjectOperationResult<void>> {
    const rebuilt = await rebuild()
    if (!rebuilt.ok) return rebuilt
    const project = rebuilt.value.live.find((entry) => entry.id === input.projectId)
    const worktree = project?.worktrees.find((entry) => entry.id === input.worktreeId)
    if (project === undefined || worktree === undefined) return notFound()
    if (worktree.isPrimary) return { ok: false, error: { code: 'git.worktree-conflict' } }

    const removed = await options.git.removeWorktree(project.path, worktree.path)
    if (!removed.ok) return { ok: false, error: mapGitWorkspaceError(removed.error) }
    const removedRecent = await options.recents.removePath(worktree.path)
    if (!removedRecent.ok) return unavailable()
    const refreshed = await rebuild()
    if (!refreshed.ok) return refreshed
    return { ok: true, value: undefined }
  }

  return Object.freeze({
    async listHubInventory(): Promise<ProjectOperationResult<HubInventory>> {
      const rebuilt = await rebuild()
      if (!rebuilt.ok) return rebuilt
      return {
        ok: true,
        value: { environment: rebuilt.value.environment, projects: rebuilt.value.live },
      }
    },

    async createHubWorktree(
      input: CreateHubWorktreeInput,
    ): Promise<ProjectOperationResult<HubWorktree>> {
      const rebuilt = await rebuild()
      if (!rebuilt.ok) return rebuilt
      const project = rebuilt.value.live.find((entry) => entry.id === input.projectId)
      if (project === undefined) return notFound()

      const added = await options.git.addWorktree(
        project.path,
        input.branch,
        input.baseRef,
        input.existing === true,
      )
      if (!added.ok) {
        return { ok: false, error: mapGitWorkspaceError(added.error) }
      }

      const refreshed = await rebuild()
      if (!refreshed.ok) return refreshed
      const created = refreshed.value.live
        .find((entry) => entry.id === input.projectId)
        ?.worktrees.find((worktree) => worktree.path === added.value.path)
      if (created === undefined) return unavailable()
      return { ok: true, value: created }
    },

    removeHubProject,
    removeHubWorktree,

    async registerPath(path: string): Promise<void> {
      const allowed = allowedPath(path, options.pathAllowed)
      if (allowed === null) return
      const discovered = await options.git.discoverProject(allowed)
      if (!discovered.ok) return
      const stored = await options.inventory.readProjects()
      if (!stored.ok) return
      const next = await registerDiscovered(stored.value, discovered.value)
      await options.inventory.writeProjects(next)
    },
  })
}
