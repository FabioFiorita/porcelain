import {
  type FilesForeignDependency,
  type FilesQueryEffect,
  filesMutations,
  filesProjectKey,
} from '@porcelain/client-runtime/files'
import type {
  CreateFileInput,
  CreateFolderInput,
  DuplicatePathInput,
  DuplicatePathOutput,
  HidePathInput,
  PinPathInput,
  RenamePathInput,
  TrashPathInput,
  UnhidePathInput,
  UnpinPathInput,
} from '@porcelain/contracts/files'
import { isFilesProjectRelativePath } from '@porcelain/contracts/files'
import {
  type QueryClient,
  type UseMutationResult,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query'
import { useHubRepoPath } from '@/features/projects'
import { isPaired, useActiveEnvironment } from '@/features/remote'
import { namedContractProcedure } from '@/lib/daemon/procedure'

import { parentPath } from './file-paths'
import { applyFilesForeignDependencies } from './files-foreign'
import { invalidateFilesEffects } from './files-query-filter'
import { callFilesMutation } from './use-files-mutations'

export { applyFilesForeignDependencies } from './files-foreign'

const hideProcedure = namedContractProcedure(
  filesMutations.hide.procedureName,
  filesMutations.hide.procedure,
)
const unhideProcedure = namedContractProcedure(
  filesMutations.unhide.procedureName,
  filesMutations.unhide.procedure,
)
const pinProcedure = namedContractProcedure(
  filesMutations.pin.procedureName,
  filesMutations.pin.procedure,
)
const unpinProcedure = namedContractProcedure(
  filesMutations.unpin.procedureName,
  filesMutations.unpin.procedure,
)
const createFileProcedure = namedContractProcedure(
  filesMutations.createFile.procedureName,
  filesMutations.createFile.procedure,
)
const createFolderProcedure = namedContractProcedure(
  filesMutations.createFolder.procedureName,
  filesMutations.createFolder.procedure,
)
const renameProcedure = namedContractProcedure(
  filesMutations.rename.procedureName,
  filesMutations.rename.procedure,
)
const duplicateProcedure = namedContractProcedure(
  filesMutations.duplicate.procedureName,
  filesMutations.duplicate.procedure,
)
const trashProcedure = namedContractProcedure(
  filesMutations.trash.procedureName,
  filesMutations.trash.procedure,
)

async function applyMutationSuccess(
  queryClient: QueryClient,
  environmentId: string,
  effects: readonly FilesQueryEffect[],
  dependencies: readonly FilesForeignDependency[],
): Promise<void> {
  await invalidateFilesEffects(queryClient, environmentId, effects)
  const first = effects[0]
  const projectPath =
    first === undefined
      ? null
      : first.type === 'exact'
        ? first.query.projectPath
        : first.projectPath
  await applyFilesForeignDependencies(queryClient, environmentId, projectPath, dependencies)
}

type MutationRunner<TInput, TOutput> = Pick<
  UseMutationResult<TOutput, Error, TInput>,
  'mutateAsync'
>

async function runMutation<TInput, TOutput>(
  mutation: MutationRunner<TInput, TOutput>,
  input: TInput,
  queryClient: QueryClient,
  environmentId: string,
  effects: readonly FilesQueryEffect[],
  dependencies: readonly FilesForeignDependency[],
): Promise<TOutput> {
  const output = await mutation.mutateAsync(input)
  await applyMutationSuccess(queryClient, environmentId, effects, dependencies)
  return output
}

export type FileWrites = {
  createFile: (dir: string, name: string) => Promise<void>
  createFolder: (dir: string, name: string) => Promise<void>
  rename: (relative: string, name: string) => Promise<void>
  duplicate: (relative: string) => Promise<string | null>
  trash: (relative: string) => Promise<void>
  isPending: boolean
}

/** Non-optimistic working-tree writes. Success effects are authoritative and awaited. */
export function useFileWrites(): FileWrites {
  const environment = useActiveEnvironment()
  const activeRepoPath = useHubRepoPath()
  const queryClient = useQueryClient()
  const create = useMutation({
    mutationFn: async (input: CreateFileInput): Promise<void> => {
      await callFilesMutation(environment, createFileProcedure, input)
    },
  })
  const folder = useMutation({
    mutationFn: async (input: CreateFolderInput): Promise<void> => {
      await callFilesMutation(environment, createFolderProcedure, input)
    },
  })
  const rename = useMutation({
    mutationFn: async (input: RenamePathInput): Promise<void> => {
      await callFilesMutation(environment, renameProcedure, input)
    },
  })
  const duplicate = useMutation({
    mutationFn: async (input: DuplicatePathInput): Promise<DuplicatePathOutput> => {
      return callFilesMutation(environment, duplicateProcedure, input)
    },
  })
  const trash = useMutation({
    mutationFn: async (input: TrashPathInput): Promise<void> => {
      await callFilesMutation(environment, trashProcedure, input)
    },
  })

  const project = (): { environmentId: string; projectPath: string } | null => {
    if (!isPaired(environment) || activeRepoPath === null) return null
    return { environmentId: environment.id, projectPath: filesProjectKey(activeRepoPath) }
  }

  return {
    createFile: async (dir, name): Promise<void> => {
      const scope = project()
      if (scope === null) return
      const path = dir === '' ? name : `${dir}/${name}`
      if (!isFilesProjectRelativePath(path)) return
      const input = { path, projectPath: scope.projectPath }
      await runMutation(
        create,
        input,
        queryClient,
        scope.environmentId,
        filesMutations.createFile.affectedEffects(input),
        filesMutations.createFile.foreignDependencies(input),
      )
    },
    createFolder: async (dir, name): Promise<void> => {
      const scope = project()
      if (scope === null) return
      const path = dir === '' ? name : `${dir}/${name}`
      if (!isFilesProjectRelativePath(path)) return
      const input = { path, projectPath: scope.projectPath }
      await runMutation(
        folder,
        input,
        queryClient,
        scope.environmentId,
        filesMutations.createFolder.affectedEffects(input),
        filesMutations.createFolder.foreignDependencies(input),
      )
    },
    duplicate: async (relative): Promise<string | null> => {
      const scope = project()
      if (scope === null || !isFilesProjectRelativePath(relative)) return null
      const input = { path: relative, projectPath: scope.projectPath }
      const output = await duplicate.mutateAsync(input)
      await applyMutationSuccess(
        queryClient,
        scope.environmentId,
        filesMutations.duplicate.affectedEffectsForResult(input, output),
        filesMutations.duplicate.foreignDependencies(input),
      )
      return output
    },
    isPending:
      create.isPending ||
      folder.isPending ||
      rename.isPending ||
      duplicate.isPending ||
      trash.isPending,
    rename: async (relative, name): Promise<void> => {
      const scope = project()
      if (scope === null || !isFilesProjectRelativePath(relative)) return
      const parent = parentPath(relative)
      const to = parent === '' ? name : `${parent}/${name}`
      if (!isFilesProjectRelativePath(to)) return
      const input = { from: relative, projectPath: scope.projectPath, to }
      await runMutation(
        rename,
        input,
        queryClient,
        scope.environmentId,
        filesMutations.rename.affectedEffects(input),
        filesMutations.rename.foreignDependencies(input),
      )
    },
    trash: async (relative): Promise<void> => {
      const scope = project()
      if (scope === null || !isFilesProjectRelativePath(relative)) return
      const input = { path: relative, projectPath: scope.projectPath }
      await runMutation(
        trash,
        input,
        queryClient,
        scope.environmentId,
        filesMutations.trash.affectedEffects(input),
        filesMutations.trash.foreignDependencies(input),
      )
    },
  }
}

type ScopeMutationInput = { projectPath: string; path: string }
type ScopeDefinition = {
  affectedEffects: (input: ScopeMutationInput) => readonly FilesQueryEffect[]
  foreignDependencies: (input: ScopeMutationInput) => readonly FilesForeignDependency[]
}

async function runScopeMutation(
  mutation: MutationRunner<ScopeMutationInput, void>,
  relative: string,
  definition: ScopeDefinition,
  environment: ReturnType<typeof useActiveEnvironment>,
  repoPath: string | null,
  queryClient: QueryClient,
): Promise<void> {
  if (!isPaired(environment) || repoPath === null || !isFilesProjectRelativePath(relative)) return
  const projectPath = filesProjectKey(repoPath)
  const input = { path: relative, projectPath }
  await runMutation(
    mutation,
    input,
    queryClient,
    environment.id,
    definition.affectedEffects(input),
    definition.foreignDependencies(input),
  )
}

/** Pin/hide scope writes, kept separate from working-tree mutations. */
export function usePathScope(): {
  pin: (relative: string) => Promise<void>
  unpin: (relative: string) => Promise<void>
  hide: (relative: string) => Promise<void>
  unhide: (relative: string) => Promise<void>
  isPending: boolean
  error: Error | null
} {
  const environment = useActiveEnvironment()
  const repoPath = useHubRepoPath()
  const queryClient = useQueryClient()
  const pin = useMutation({
    mutationFn: async (input: PinPathInput): Promise<void> => {
      await callFilesMutation(environment, pinProcedure, input)
    },
  })
  const unpin = useMutation({
    mutationFn: async (input: UnpinPathInput): Promise<void> => {
      await callFilesMutation(environment, unpinProcedure, input)
    },
  })
  const hide = useMutation({
    mutationFn: async (input: HidePathInput): Promise<void> => {
      await callFilesMutation(environment, hideProcedure, input)
    },
  })
  const unhide = useMutation({
    mutationFn: async (input: UnhidePathInput): Promise<void> => {
      await callFilesMutation(environment, unhideProcedure, input)
    },
  })

  const run = (
    mutation: MutationRunner<ScopeMutationInput, void>,
    relative: string,
    definition: ScopeDefinition,
  ): Promise<void> =>
    runScopeMutation(mutation, relative, definition, environment, repoPath, queryClient)

  const errors = [pin.error, unpin.error, hide.error, unhide.error]
  return {
    error: errors.find((error): error is Error => error instanceof Error) ?? null,
    hide: (relative) => run(hide, relative, filesMutations.hide),
    isPending: pin.isPending || unpin.isPending || hide.isPending || unhide.isPending,
    pin: (relative) => run(pin, relative, filesMutations.pin),
    unhide: (relative) => run(unhide, relative, filesMutations.unhide),
    unpin: (relative) => run(unpin, relative, filesMutations.unpin),
  }
}
