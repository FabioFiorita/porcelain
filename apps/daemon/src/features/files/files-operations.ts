import type { WorkspaceFiles } from './files-ports'
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

/**
 * Bound Files operations. One capability call per op; map adapter failures 1:1.
 * No publishSessionChange / FilesChanges until FIL-003.
 */
export function createFilesOperations(
  options: { workspaceFiles?: WorkspaceFiles } = {},
): FilesOperations {
  const workspaceFiles = options.workspaceFiles ?? createNodeWorkspaceFiles()

  return Object.freeze({
    readFile: (input) => workspaceFiles.readFile(input),
    previewHtml: (input) => workspaceFiles.previewHtml(input),
    writeTextFile: (input) => workspaceFiles.writeTextFile(input),
    createFile: (input) => workspaceFiles.createFile(input),
    createFolder: (input) => workspaceFiles.createFolder(input),
    renamePath: (input) => workspaceFiles.renamePath(input),
    duplicatePath: (input) => workspaceFiles.duplicatePath(input),
    trashPath: (input) => workspaceFiles.trashPath(input),
  })
}
