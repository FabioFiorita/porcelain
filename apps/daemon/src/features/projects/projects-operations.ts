import type {
  BrowseDirsOutput,
  CanvasRecord,
  CreateHubWorktreeInput,
  EnvironmentIdentity,
  HubInventory,
  HubWorktree,
  ListCanvasesInput,
  ListOverlayInput,
  ListOverlayOutput,
  MintCanvasAccessTokenInput,
  ProjectInfo,
  ProjectOverrides,
  PromoteCanvasOutput,
  PromoteOverridesInput,
  ReadCanvasInput,
  RemoveHubWorktreeInput,
} from '@porcelain/contracts/projects'
import type { CanvasAccessTokens } from './canvas-access-tokens'
import {
  type CanvasOperations,
  createCanvasOperations,
  type PromoteCanvasOperationInput,
  type WriteCanvasOperationInput,
} from './canvas-operations'
import type { CanvasOverlayStore } from './canvas-overlay-store'
import type { CanvasStore } from './canvas-store'
import type { EnvironmentIdentityStore } from './environment-identity-store'
import type { HubGitPort } from './hub-git-port'
import {
  createHubInventoryOperations,
  type HubInventoryOperations,
} from './hub-inventory-operations'
import type { HubInventoryStore } from './hub-inventory-store'
import type {
  ProjectsEffects,
  ProjectsPort,
  ProjectsPortError,
  ProjectsWorktree,
} from './projects-ports'
import type { ProjectsRecentsStore } from './projects-recents-store'
import type { ProjectOperationResult, ProjectsOperationError } from './projects-results'

export type { ProjectOperationResult, ProjectsOperationError } from './projects-results'

export type ProjectsOperations = Readonly<{
  openProject: (path: string) => Promise<ProjectOperationResult<ProjectInfo>>
  listRecentProjects: (input: {
    includeWorktrees: boolean
  }) => Promise<ProjectOperationResult<ProjectInfo[]>>
  removeRecentProject: (path: string) => Promise<ProjectOperationResult<void>>
  removeHubProject: (projectId: string) => Promise<ProjectOperationResult<void>>
  removeHubWorktree: (input: RemoveHubWorktreeInput) => Promise<ProjectOperationResult<void>>
  browseProjectDirectories: (
    path: string | null,
  ) => Promise<ProjectOperationResult<BrowseDirsOutput>>
  listHubInventory: () => Promise<ProjectOperationResult<HubInventory>>
  environmentIdentity: () => Promise<ProjectOperationResult<EnvironmentIdentity>>
  renameEnvironment: (name: string) => Promise<ProjectOperationResult<EnvironmentIdentity>>
  createHubWorktree: (input: CreateHubWorktreeInput) => Promise<ProjectOperationResult<HubWorktree>>
  listCanvases: (input: ListCanvasesInput) => Promise<ProjectOperationResult<CanvasRecord[]>>
  /** Agent-surface only — see canvas-operations.ts. No wire procedure writes a Canvas. */
  writeCanvas: (input: WriteCanvasOperationInput) => Promise<ProjectOperationResult<CanvasRecord>>
  forgetCanvas: (input: {
    projectId: string
    canvasId: string
    worktreePath?: string
  }) => Promise<ProjectOperationResult<void>>
  readCanvas: (
    input: ReadCanvasInput,
  ) => Promise<ProjectOperationResult<{ record: CanvasRecord; content: string }>>
  readCanvasAsset: CanvasOperations['readCanvasAsset']
  mintCanvasAccessToken: (
    input: MintCanvasAccessTokenInput,
  ) => Promise<ProjectOperationResult<{ token: string }>>
  promoteCanvas: (
    input: PromoteCanvasOperationInput,
  ) => Promise<ProjectOperationResult<PromoteCanvasOutput>>
  promoteOverrides: (
    input: PromoteOverridesInput,
  ) => Promise<ProjectOperationResult<ProjectOverrides>>
  listOverlay: (input: ListOverlayInput) => Promise<ProjectOperationResult<ListOverlayOutput>>
}>

function failure(error: ProjectsOperationError): ProjectOperationResult<never> {
  return { ok: false, error }
}

function mapPortError(error: ProjectsPortError): ProjectsOperationError {
  switch (error) {
    case 'not-found':
      return { code: 'projects.not-found' }
    case 'not-a-directory':
      return { code: 'projects.not-a-directory' }
    case 'unavailable':
      return { code: 'projects.unavailable' }
  }
}

function mapUnavailable<Value>(result: {
  ok: false
  error: { code: 'projects.unavailable' }
}): ProjectOperationResult<Value> {
  return { ok: false, error: result.error }
}

type AllowedPath = boolean | string | null

/** Normalize the dev boundary's canonical-path result while retaining test/fake boolean callers. */
function allowedPath(
  path: string,
  predicate: ((path: string) => AllowedPath) | undefined,
): string | null {
  if (predicate === undefined) return path
  const result = predicate(path)
  return typeof result === 'string' ? result : result === true ? path : null
}

export function createProjectsOperations(options: {
  projects: ProjectsPort
  recents: ProjectsRecentsStore
  worktree: ProjectsWorktree
  effects: ProjectsEffects
  hub: {
    environment: EnvironmentIdentityStore
    inventory: HubInventoryStore
    git: HubGitPort
    daemon: { host: string; platform: string; arch: string }
    createId?: () => string
    pathAllowed?: (path: string) => AllowedPath
    worktreeScripts?: {
      runSetup: (target: { projectId: string; worktreeId: string; path: string }) => Promise<void>
      runDispose: (target: { projectId: string; worktreeId: string; path: string }) => Promise<void>
    }
  }
  /**
   * Canvas storage plus the grant map. Built here rather than handed in already
   * assembled, because promotion has to ask the Hub which checkouts really
   * belong to a Project — a capability that only exists once `hub` below is
   * composed. The composition root shares the SAME `accessTokens` instance with
   * the `GET /canvas/<token>` route so a token minted through tRPC resolves
   * against the same in-memory map, and reaches `readCanvas` through this
   * operations object.
   */
  canvas: {
    store: CanvasStore
    overlay: CanvasOverlayStore
    accessTokens: CanvasAccessTokens
  }
}): ProjectsOperations {
  const hub: HubInventoryOperations = createHubInventoryOperations({
    environment: options.hub.environment,
    inventory: options.hub.inventory,
    recents: options.recents,
    git: options.hub.git,
    daemon: options.hub.daemon,
    pathAllowed: options.hub.pathAllowed,
    createId: options.hub.createId,
    worktreeScripts: options.hub.worktreeScripts,
  })
  const canvas: CanvasOperations = createCanvasOperations({
    store: options.canvas.store,
    overlay: options.canvas.overlay,
    accessTokens: options.canvas.accessTokens,
    worktrees: {
      async listWorktrees(projectId) {
        const inventory = await hub.listHubInventory()
        if (!inventory.ok) return inventory
        const project = inventory.value.projects.find((entry) => entry.id === projectId)
        if (project === undefined) return { ok: false, error: { code: 'projects.not-found' } }
        return { ok: true, value: project.worktrees }
      },
    },
  })

  return Object.freeze({
    async openProject(path: string): Promise<ProjectOperationResult<ProjectInfo>> {
      const allowed = allowedPath(path, options.hub.pathAllowed)
      if (allowed === null) {
        return failure({ code: 'projects.dev-repo-forbidden' })
      }
      const inspected = await options.projects.inspectProject(allowed)
      if (!inspected.ok) return failure(mapPortError(inspected.error))

      const added = await options.recents.addPath(allowed)
      if (!added.ok) return mapUnavailable(added)

      options.effects.warmFileList(allowed)
      await hub.registerPath(allowed)
      return { ok: true, value: inspected.value }
    },

    async listRecentProjects(input: {
      includeWorktrees: boolean
    }): Promise<ProjectOperationResult<ProjectInfo[]>> {
      const recentPaths = await options.recents.readPaths()
      if (!recentPaths.ok) return mapUnavailable(recentPaths)

      const projects = await Promise.all(
        recentPaths.value
          .flatMap((path) => {
            const allowed = allowedPath(path, options.hub.pathAllowed)
            return allowed === null ? [] : [allowed]
          })
          .map(async (path): Promise<ProjectInfo | null> => {
            const inspected = await options.projects.inspectProject(path)
            if (!inspected.ok) return null
            if (!input.includeWorktrees && (await options.worktree.isLinkedWorktree(path))) {
              return null
            }
            return inspected.value
          }),
      )
      return {
        ok: true,
        value: projects.filter((project): project is ProjectInfo => project !== null),
      }
    },

    async removeRecentProject(path: string): Promise<ProjectOperationResult<void>> {
      const removed = await options.recents.removePath(path)
      if (!removed.ok) return mapUnavailable(removed)
      return { ok: true, value: undefined }
    },

    removeHubProject: hub.removeHubProject,
    removeHubWorktree: hub.removeHubWorktree,

    async browseProjectDirectories(
      path: string | null,
    ): Promise<ProjectOperationResult<BrowseDirsOutput>> {
      const browsed = await options.projects.browseDirectories(path)
      if (!browsed.ok) return failure(mapPortError(browsed.error))
      return { ok: true, value: browsed.value }
    },

    listHubInventory: hub.listHubInventory,
    environmentIdentity: hub.environmentIdentity,
    renameEnvironment: hub.renameEnvironment,
    createHubWorktree: hub.createHubWorktree,
    listCanvases: canvas.listCanvases,
    writeCanvas: canvas.writeCanvas,
    forgetCanvas: canvas.forgetCanvas,
    readCanvas: canvas.readCanvas,
    readCanvasAsset: canvas.readCanvasAsset,
    mintCanvasAccessToken: canvas.mintCanvasAccessToken,
    promoteCanvas: canvas.promoteCanvas,
    promoteOverrides: canvas.promoteOverrides,
    listOverlay: canvas.listOverlay,
  })
}
