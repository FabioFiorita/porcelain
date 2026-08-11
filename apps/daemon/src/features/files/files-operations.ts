import type { SessionChange } from '@porcelain/contracts/session'
import { createFilesChangesPublisher } from './files-notifications'
import type { FilesChanges, WorkspaceFiles } from './files-ports'
import { createNodeWorkspaceFiles } from './workspace-files'

/**
 * Bound operations surface — exact per-operation result unions from WorkspaceFiles.
 * Do not widen to global FilesOperationResult<T>: that would let readFile advertise
 * create/rename-only errors and publish undeclared contract codes at the router.
 */
export type FilesOperations = {
  readFile: WorkspaceFiles['readFile']
  previewHtml: WorkspaceFiles['previewHtml']
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
    changes?: FilesChanges
    publishSessionChange?: (change: SessionChange) => void
  } = {},
): FilesOperations {
  const workspaceFiles = options.workspaceFiles ?? createNodeWorkspaceFiles()
  const changes =
    options.changes ??
    createFilesChangesPublisher(options.publishSessionChange ?? (() => undefined))

  return Object.freeze({
    readFile: (input) => workspaceFiles.readFile(input),
    previewHtml: (input) => workspaceFiles.previewHtml(input),
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
