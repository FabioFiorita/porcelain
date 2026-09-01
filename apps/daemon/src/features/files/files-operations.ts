import type { SessionChange } from '@porcelain/contracts/session'
import { join } from 'node:path'
import { createFilePreviewTokens, type FilePreviewTokens } from './file-preview-tokens'
import { createFilesChangesPublisher } from './files-notifications'
import type { FilesChanges, FilesScope, WorkspaceFiles } from './files-ports'
import { createFilesScope } from './files-scope'
import { createNodeWorkspaceFiles } from './workspace-files'

/**
 * Bound operations surface — exact per-operation result unions from WorkspaceFiles.
 * Do not widen to global FilesOperationResult<T>: that would let readFile advertise
 * create/rename-only errors and publish undeclared contract codes at the router.
 */
export type FilesOperations = {
  readDir: (input: {
    projectPath: string
    path: string
    showHidden: boolean
  }) => ReturnType<WorkspaceFiles['readDir']>
  hidePath: (projectPath: string, path: string) => Promise<void>
  unhidePath: (projectPath: string, path: string) => Promise<void>
  pinPath: (projectPath: string, path: string) => Promise<void>
  unpinPath: (projectPath: string, path: string) => Promise<void>
  pinnedEntries: (repoPath: string) => ReturnType<WorkspaceFiles['pinnedEntries']>
  repoScope: FilesScope['read']
  worktreeProfile: FilesScope['readProfile']
  setProjectProfile: FilesScope['setProjectProfile']
  setWorktreeProfile: FilesScope['setWorktreeProfile']
  readFile: WorkspaceFiles['readFile']
  previewHtml: WorkspaceFiles['previewHtml']
  /**
   * Capability grant for `GET /file-preview/<token>` — the scripts-enabled HTML
   * preview surface. Mint only; the route owns `resolve` (server.ts holds the one
   * shared token store), exactly as Canvas does.
   */
  mintFilePreviewToken: (input: { projectPath: string; path: string }) => { token: string }
  writeTextFile: WorkspaceFiles['writeTextFile']
  createFile: WorkspaceFiles['createFile']
  createFolder: WorkspaceFiles['createFolder']
  renamePath: WorkspaceFiles['renamePath']
  duplicatePath: WorkspaceFiles['duplicatePath']
  trashPath: WorkspaceFiles['trashPath']
}

/** Preserve first-seen order; drop consecutive/identical duplicates. */
function uniquePaths(paths: readonly string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const path of paths) {
    if (seen.has(path)) continue
    seen.add(path)
    out.push(path)
  }
  return out
}

/**
 * Bound Files operations. One capability call per op; map adapter failures 1:1.
 * Publish typed change facts only after durable success.
 */
export function createFilesOperations(
  options: {
    workspaceFiles?: WorkspaceFiles
    scope?: FilesScope
    previewTokens?: FilePreviewTokens
    changes?: FilesChanges
    publishSessionChange?: (change: SessionChange) => void
  } = {},
): FilesOperations {
  const workspaceFiles = options.workspaceFiles ?? createNodeWorkspaceFiles()
  const scope = options.scope ?? createFilesScope()
  const previewTokens = options.previewTokens ?? createFilePreviewTokens()
  const changes =
    options.changes ??
    createFilesChangesPublisher(options.publishSessionChange ?? (() => undefined))

  return Object.freeze({
    async readDir(input) {
      const stored = await scope.read(input.projectPath)
      return workspaceFiles.readDir({
        projectPath: input.projectPath,
        hiddenPaths: new Set(stored.hiddenPaths),
        path: input.path,
        pinnedPaths: new Set(stored.pinnedPaths),
        showHidden: input.showHidden,
      })
    },
    hidePath: (projectPath, path) => scope.hidePath(projectPath, join(projectPath, path)),
    unhidePath: (projectPath, path) => scope.unhidePath(projectPath, join(projectPath, path)),
    pinPath: (projectPath, path) => scope.pinPath(projectPath, join(projectPath, path)),
    unpinPath: (projectPath, path) => scope.unpinPath(projectPath, join(projectPath, path)),
    async pinnedEntries(repoPath) {
      const stored = await scope.read(repoPath)
      return workspaceFiles.pinnedEntries({
        projectPath: repoPath,
        hiddenPaths: new Set(stored.hiddenPaths),
        pinnedPaths: stored.pinnedPaths,
      })
    },
    repoScope: (repoPath) => scope.read(repoPath),
    worktreeProfile: (repoPath) => scope.readProfile(repoPath),
    setProjectProfile: (repoPath, profile) => scope.setProjectProfile(repoPath, profile),
    setWorktreeProfile: (repoPath, profile) => scope.setWorktreeProfile(repoPath, profile),
    readFile: (input) => workspaceFiles.readFile(input),
    previewHtml: (input) => workspaceFiles.previewHtml(input),
    mintFilePreviewToken: (input) => ({ token: previewTokens.mint(input) }),
    async writeTextFile(input) {
      const result = await workspaceFiles.writeTextFile(input)
      if (!result.ok) return result
      changes.publish({
        type: 'files.content-changed',
        projectPath: input.projectPath,
        paths: [input.path],
      })
      return result
    },
    async createFile(input) {
      const result = await workspaceFiles.createFile(input)
      if (!result.ok) return result
      changes.publish({
        type: 'files.tree-changed',
        projectPath: input.projectPath,
        paths: [input.path],
      })
      return result
    },
    async createFolder(input) {
      const result = await workspaceFiles.createFolder(input)
      if (!result.ok) return result
      changes.publish({
        type: 'files.tree-changed',
        projectPath: input.projectPath,
        paths: [input.path],
      })
      return result
    },
    async renamePath(input) {
      const result = await workspaceFiles.renamePath(input)
      if (!result.ok) return result
      changes.publish({
        type: 'files.tree-changed',
        projectPath: input.projectPath,
        paths: uniquePaths([input.from, input.to]),
      })
      return result
    },
    async duplicatePath(input) {
      const result = await workspaceFiles.duplicatePath(input)
      if (!result.ok) return result
      changes.publish({
        type: 'files.tree-changed',
        projectPath: input.projectPath,
        paths: [result.value],
      })
      return result
    },
    async trashPath(input) {
      const result = await workspaceFiles.trashPath(input)
      if (!result.ok) return result
      changes.publish({
        type: 'files.tree-changed',
        projectPath: input.projectPath,
        paths: [input.path],
      })
      return result
    },
  })
}
