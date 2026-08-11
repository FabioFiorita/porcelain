import type { FileView } from '@porcelain/contracts/files'
import type { FilesOperationResult, WorkspaceFiles } from './files-ports'
import { createNodeWorkspaceFiles } from './workspace-files'

export type FilesOperations = {
  readFile(input: { projectPath: string; path: string }): Promise<FilesOperationResult<FileView>>

  previewHtml(input: {
    projectPath: string
    path: string
  }): Promise<FilesOperationResult<string | null>>

  writeTextFile(input: {
    projectPath: string
    path: string
    content: string
  }): Promise<FilesOperationResult<void>>

  createFile(input: { projectPath: string; path: string }): Promise<FilesOperationResult<void>>

  createFolder(input: { projectPath: string; path: string }): Promise<FilesOperationResult<void>>

  renamePath(input: {
    projectPath: string
    from: string
    to: string
  }): Promise<FilesOperationResult<void>>

  duplicatePath(input: { projectPath: string; path: string }): Promise<FilesOperationResult<string>>

  trashPath(input: { projectPath: string; path: string }): Promise<FilesOperationResult<void>>
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
