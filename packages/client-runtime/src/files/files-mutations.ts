import {
  type CreateFileInput,
  type CreateFolderInput,
  type DuplicatePathInput,
  type DuplicatePathOutput,
  filesProcedures,
  type HidePathInput,
  type PinPathInput,
  type RenamePathInput,
  type TrashPathInput,
  type UnhidePathInput,
  type UnpinPathInput,
  type WriteTextFileInput,
} from '@porcelain/contracts/files'
import type { FilesForeignDependency, FilesQueryEffect } from './files-effects'
import {
  contentPreviewEffects,
  dedupeFilesForeignDependencies,
  dedupeFilesQueryEffects,
  FILES_FOREIGN_CONTENT_INDEX,
  FILES_FOREIGN_PATH_INDEX,
  FILES_FOREIGN_WORKING_TREE,
  filesContentSubtreeEffect,
  filesExactEffect,
  filesTreeFamilyEffect,
  filesTreeSubtreeEffect,
  treeEffectsForStructuralPath,
  treeSubtreeEffectsForStructuralPath,
} from './files-effects'
import { filesPinsQuery, filesProjectKey, filesScopeQuery } from './files-queries'

type FilesMutationProcedureName =
  | 'hidePath'
  | 'unhidePath'
  | 'pinPath'
  | 'unpinPath'
  | 'writeTextFile'
  | 'createFile'
  | 'createFolder'
  | 'renamePath'
  | 'duplicatePath'
  | 'trashPath'

/**
 * Standard Files mutation: procedure object is pinned to procedureName.
 * Effects are complete from input alone (void-output procedures).
 */
export type FilesMutationDefinition<TName extends FilesMutationProcedureName, TInput> = {
  readonly procedure: (typeof filesProcedures)[TName]
  readonly procedureName: TName
  readonly affectedEffects: (input: TInput) => readonly FilesQueryEffect[]
  readonly foreignDependencies: (input: TInput) => readonly FilesForeignDependency[]
  readonly requiresAuthoritativeRefetch: true
}

/**
 * Result-dependent mutation. Only `duplicate` uses this.
 * `affectedEffects(input)` is the source-only base set.
 * `affectedEffectsForResult(input, output)` is the complete post-success set (base + destination).
 * `output` is required — no optional parameter and no incomplete success fallback.
 */
export type FilesResultMutationDefinition<
  TName extends FilesMutationProcedureName,
  TInput,
  TOutput,
> = FilesMutationDefinition<TName, TInput> & {
  readonly affectedEffectsForResult: (input: TInput, output: TOutput) => readonly FilesQueryEffect[]
}

function scopeMutationEffects(repoPath: string): readonly FilesQueryEffect[] {
  const p = filesProjectKey(repoPath)
  return [
    filesExactEffect(filesScopeQuery(p)),
    filesExactEffect(filesPinsQuery(p)),
    filesTreeFamilyEffect(p),
  ]
}

const PATH_INDEX_ONLY: readonly FilesForeignDependency[] = [FILES_FOREIGN_PATH_INDEX]

const WORKING_TREE_PATH_INDEX: readonly FilesForeignDependency[] = dedupeFilesForeignDependencies([
  FILES_FOREIGN_WORKING_TREE,
  FILES_FOREIGN_PATH_INDEX,
])

const ALL_THREE_FOREIGN: readonly FilesForeignDependency[] = dedupeFilesForeignDependencies([
  FILES_FOREIGN_WORKING_TREE,
  FILES_FOREIGN_PATH_INDEX,
  FILES_FOREIGN_CONTENT_INDEX,
])

function structuralTreesAndPins(projectPath: string, path: string): readonly FilesQueryEffect[] {
  return dedupeFilesQueryEffects([
    ...treeEffectsForStructuralPath(projectPath, path),
    filesExactEffect(filesPinsQuery(projectPath)),
  ])
}

export const filesMutations = {
  hide: {
    procedure: filesProcedures.hidePath,
    procedureName: 'hidePath',
    affectedEffects: (input: HidePathInput): readonly FilesQueryEffect[] =>
      scopeMutationEffects(input.repoPath),
    foreignDependencies: (_input: HidePathInput): readonly FilesForeignDependency[] =>
      PATH_INDEX_ONLY,
    requiresAuthoritativeRefetch: true,
  },
  unhide: {
    procedure: filesProcedures.unhidePath,
    procedureName: 'unhidePath',
    affectedEffects: (input: UnhidePathInput): readonly FilesQueryEffect[] =>
      scopeMutationEffects(input.repoPath),
    foreignDependencies: (_input: UnhidePathInput): readonly FilesForeignDependency[] =>
      PATH_INDEX_ONLY,
    requiresAuthoritativeRefetch: true,
  },
  pin: {
    procedure: filesProcedures.pinPath,
    procedureName: 'pinPath',
    affectedEffects: (input: PinPathInput): readonly FilesQueryEffect[] =>
      scopeMutationEffects(input.repoPath),
    foreignDependencies: (_input: PinPathInput): readonly FilesForeignDependency[] => [],
    requiresAuthoritativeRefetch: true,
  },
  unpin: {
    procedure: filesProcedures.unpinPath,
    procedureName: 'unpinPath',
    affectedEffects: (input: UnpinPathInput): readonly FilesQueryEffect[] =>
      scopeMutationEffects(input.repoPath),
    foreignDependencies: (_input: UnpinPathInput): readonly FilesForeignDependency[] => [],
    requiresAuthoritativeRefetch: true,
  },
  writeText: {
    procedure: filesProcedures.writeTextFile,
    procedureName: 'writeTextFile',
    affectedEffects: (input: WriteTextFileInput): readonly FilesQueryEffect[] =>
      dedupeFilesQueryEffects([
        ...treeEffectsForStructuralPath(input.projectPath, input.path),
        ...contentPreviewEffects(input.projectPath, input.path),
      ]),
    foreignDependencies: (_input: WriteTextFileInput): readonly FilesForeignDependency[] =>
      ALL_THREE_FOREIGN,
    requiresAuthoritativeRefetch: true,
  },
  createFile: {
    procedure: filesProcedures.createFile,
    procedureName: 'createFile',
    affectedEffects: (input: CreateFileInput): readonly FilesQueryEffect[] =>
      dedupeFilesQueryEffects([
        ...structuralTreesAndPins(input.projectPath, input.path),
        ...contentPreviewEffects(input.projectPath, input.path),
      ]),
    foreignDependencies: (_input: CreateFileInput): readonly FilesForeignDependency[] =>
      WORKING_TREE_PATH_INDEX,
    requiresAuthoritativeRefetch: true,
  },
  createFolder: {
    procedure: filesProcedures.createFolder,
    procedureName: 'createFolder',
    affectedEffects: (input: CreateFolderInput): readonly FilesQueryEffect[] =>
      structuralTreesAndPins(input.projectPath, input.path),
    foreignDependencies: (_input: CreateFolderInput): readonly FilesForeignDependency[] =>
      WORKING_TREE_PATH_INDEX,
    requiresAuthoritativeRefetch: true,
  },
  rename: {
    procedure: filesProcedures.renamePath,
    procedureName: 'renamePath',
    affectedEffects: (input: RenamePathInput): readonly FilesQueryEffect[] =>
      dedupeFilesQueryEffects([
        ...treeSubtreeEffectsForStructuralPath(input.projectPath, input.from),
        ...treeSubtreeEffectsForStructuralPath(input.projectPath, input.to),
        filesExactEffect(filesPinsQuery(input.projectPath)),
        filesContentSubtreeEffect(input.projectPath, input.from),
        filesContentSubtreeEffect(input.projectPath, input.to),
      ]),
    foreignDependencies: (_input: RenamePathInput): readonly FilesForeignDependency[] =>
      ALL_THREE_FOREIGN,
    requiresAuthoritativeRefetch: true,
  },
  duplicate: {
    procedure: filesProcedures.duplicatePath,
    procedureName: 'duplicatePath',
    affectedEffects: (input: DuplicatePathInput): readonly FilesQueryEffect[] =>
      structuralTreesAndPins(input.projectPath, input.path),
    affectedEffectsForResult: (
      input: DuplicatePathInput,
      output: DuplicatePathOutput,
    ): readonly FilesQueryEffect[] =>
      dedupeFilesQueryEffects([
        ...structuralTreesAndPins(input.projectPath, input.path),
        filesTreeSubtreeEffect(input.projectPath, output),
        filesContentSubtreeEffect(input.projectPath, output),
      ]),
    foreignDependencies: (_input: DuplicatePathInput): readonly FilesForeignDependency[] =>
      ALL_THREE_FOREIGN,
    requiresAuthoritativeRefetch: true,
  },
  trash: {
    procedure: filesProcedures.trashPath,
    procedureName: 'trashPath',
    affectedEffects: (input: TrashPathInput): readonly FilesQueryEffect[] =>
      dedupeFilesQueryEffects([
        ...treeSubtreeEffectsForStructuralPath(input.projectPath, input.path),
        filesExactEffect(filesPinsQuery(input.projectPath)),
        filesContentSubtreeEffect(input.projectPath, input.path),
      ]),
    foreignDependencies: (_input: TrashPathInput): readonly FilesForeignDependency[] =>
      ALL_THREE_FOREIGN,
    requiresAuthoritativeRefetch: true,
  },
} as const satisfies {
  readonly hide: FilesMutationDefinition<'hidePath', HidePathInput>
  readonly unhide: FilesMutationDefinition<'unhidePath', UnhidePathInput>
  readonly pin: FilesMutationDefinition<'pinPath', PinPathInput>
  readonly unpin: FilesMutationDefinition<'unpinPath', UnpinPathInput>
  readonly writeText: FilesMutationDefinition<'writeTextFile', WriteTextFileInput>
  readonly createFile: FilesMutationDefinition<'createFile', CreateFileInput>
  readonly createFolder: FilesMutationDefinition<'createFolder', CreateFolderInput>
  readonly rename: FilesMutationDefinition<'renamePath', RenamePathInput>
  readonly duplicate: FilesResultMutationDefinition<
    'duplicatePath',
    DuplicatePathInput,
    DuplicatePathOutput
  >
  readonly trash: FilesMutationDefinition<'trashPath', TrashPathInput>
}

export type FilesMutation = (typeof filesMutations)[keyof typeof filesMutations]
