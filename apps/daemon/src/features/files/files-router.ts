import { procedureCatalog } from '@porcelain/contracts'
import { expectedFailure } from '../../daemon-composition/expected-failure'
import { toTrpcError } from '../../daemon-composition/public-error'
import { publicProcedure, t } from '../../trpc'
import type { FilesOperations } from './files-operations'
import type {
  FilesAlreadyExistsError,
  FilesDestinationExistsError,
  FilesNotFoundError,
  FilesPathOutsideError,
} from './files-ports'

/** Files feature router — tree, scope, and host-fs procedures. */

/** Full public error set for exhaustive mapping — callers may pass narrower per-op unions. */
type FilesMappedError =
  | FilesPathOutsideError
  | FilesNotFoundError
  | FilesAlreadyExistsError
  | FilesDestinationExistsError

function throwIfFailed<T>(
  result: { ok: true; value: T } | { ok: false; error: FilesMappedError },
): T {
  if (result.ok) return result.value
  const e = result.error
  switch (e.code) {
    case 'path-outside-project':
      throw toTrpcError(expectedFailure('files.path-outside-project', { path: e.path }))
    case 'not-found':
      throw toTrpcError(expectedFailure('files.not-found', { path: e.path }))
    case 'already-exists':
      throw toTrpcError(expectedFailure('files.already-exists', { path: e.path }))
    case 'destination-exists':
      throw toTrpcError(expectedFailure('state.conflict'))
    default: {
      const _exhaustive: never = e
      throw _exhaustive
    }
  }
}

export function createFilesFeatureRouter(operations: FilesOperations) {
  return t.router({
    readDir: publicProcedure
      .input(procedureCatalog.readDir.input)
      .output(procedureCatalog.readDir.output)
      .query(({ input }) => operations.readDir(input)),

    hidePath: publicProcedure
      .input(procedureCatalog.hidePath.input)
      .output(procedureCatalog.hidePath.output)
      .mutation(({ input }) => operations.hidePath(input.repoPath, input.path)),

    unhidePath: publicProcedure
      .input(procedureCatalog.unhidePath.input)
      .output(procedureCatalog.unhidePath.output)
      .mutation(({ input }) => operations.unhidePath(input.repoPath, input.path)),

    pinPath: publicProcedure
      .input(procedureCatalog.pinPath.input)
      .output(procedureCatalog.pinPath.output)
      .mutation(({ input }) => operations.pinPath(input.repoPath, input.path)),

    unpinPath: publicProcedure
      .input(procedureCatalog.unpinPath.input)
      .output(procedureCatalog.unpinPath.output)
      .mutation(({ input }) => operations.unpinPath(input.repoPath, input.path)),

    pinnedEntries: publicProcedure
      .input(procedureCatalog.pinnedEntries.input)
      .output(procedureCatalog.pinnedEntries.output)
      .query(({ input }) => operations.pinnedEntries(input)),

    repoScope: publicProcedure
      .input(procedureCatalog.repoScope.input)
      .output(procedureCatalog.repoScope.output)
      .query(({ input }) => operations.repoScope(input)),
    worktreeProfile: publicProcedure
      .input(procedureCatalog.worktreeProfile.input)
      .output(procedureCatalog.worktreeProfile.output)
      .query(({ input }) => operations.worktreeProfile(input)),

    readFile: publicProcedure
      .input(procedureCatalog.readFile.input)
      .output(procedureCatalog.readFile.output)
      .query(async ({ input }) => {
        const result = await operations.readFile(input)
        return throwIfFailed(result)
      }),

    previewHtml: publicProcedure
      .input(procedureCatalog.previewHtml.input)
      .output(procedureCatalog.previewHtml.output)
      .query(async ({ input }) => {
        const result = await operations.previewHtml(input)
        return throwIfFailed(result)
      }),

    writeTextFile: publicProcedure
      .input(procedureCatalog.writeTextFile.input)
      .output(procedureCatalog.writeTextFile.output)
      .mutation(async ({ input }) => {
        const result = await operations.writeTextFile(input)
        return throwIfFailed(result)
      }),

    createFile: publicProcedure
      .input(procedureCatalog.createFile.input)
      .output(procedureCatalog.createFile.output)
      .mutation(async ({ input }) => {
        const result = await operations.createFile(input)
        return throwIfFailed(result)
      }),

    createFolder: publicProcedure
      .input(procedureCatalog.createFolder.input)
      .output(procedureCatalog.createFolder.output)
      .mutation(async ({ input }) => {
        const result = await operations.createFolder(input)
        return throwIfFailed(result)
      }),

    renamePath: publicProcedure
      .input(procedureCatalog.renamePath.input)
      .output(procedureCatalog.renamePath.output)
      .mutation(async ({ input }) => {
        const result = await operations.renamePath(input)
        return throwIfFailed(result)
      }),

    duplicatePath: publicProcedure
      .input(procedureCatalog.duplicatePath.input)
      .output(procedureCatalog.duplicatePath.output)
      .mutation(async ({ input }) => {
        const result = await operations.duplicatePath(input)
        return throwIfFailed(result)
      }),

    trashPath: publicProcedure
      .input(procedureCatalog.trashPath.input)
      .output(procedureCatalog.trashPath.output)
      .mutation(async ({ input }) => {
        const result = await operations.trashPath(input)
        return throwIfFailed(result)
      }),
  })
}
