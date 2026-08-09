import type { ProcedureContract } from '../procedure-contract'
import type { ProcedureName } from '../procedures/names'
import {
  createFileInputSchema,
  createFileOutputSchema,
  createFolderInputSchema,
  createFolderOutputSchema,
  duplicatePathInputSchema,
  duplicatePathOutputSchema,
  hidePathInputSchema,
  hidePathOutputSchema,
  pinnedEntriesInputSchema,
  pinnedEntriesOutputSchema,
  pinPathInputSchema,
  pinPathOutputSchema,
  previewHtmlInputSchema,
  previewHtmlOutputSchema,
  readDirInputSchema,
  readDirOutputSchema,
  readFileInputSchema,
  readFileOutputSchema,
  renamePathInputSchema,
  renamePathOutputSchema,
  repoScopeInputSchema,
  repoScopeOutputSchema,
  trashPathInputSchema,
  trashPathOutputSchema,
  unhidePathInputSchema,
  unhidePathOutputSchema,
  unpinPathInputSchema,
  unpinPathOutputSchema,
  writeTextFileInputSchema,
  writeTextFileOutputSchema,
} from './files.contract'

const filesProcedureDefinitions = {
  readDir: { kind: 'query', input: readDirInputSchema, output: readDirOutputSchema },
  hidePath: { kind: 'mutation', input: hidePathInputSchema, output: hidePathOutputSchema },
  unhidePath: { kind: 'mutation', input: unhidePathInputSchema, output: unhidePathOutputSchema },
  pinPath: { kind: 'mutation', input: pinPathInputSchema, output: pinPathOutputSchema },
  unpinPath: { kind: 'mutation', input: unpinPathInputSchema, output: unpinPathOutputSchema },
  pinnedEntries: {
    kind: 'query',
    input: pinnedEntriesInputSchema,
    output: pinnedEntriesOutputSchema,
  },
  readFile: { kind: 'query', input: readFileInputSchema, output: readFileOutputSchema },
  previewHtml: {
    kind: 'query',
    input: previewHtmlInputSchema,
    output: previewHtmlOutputSchema,
  },
  writeTextFile: {
    kind: 'mutation',
    input: writeTextFileInputSchema,
    output: writeTextFileOutputSchema,
  },
  createFile: { kind: 'mutation', input: createFileInputSchema, output: createFileOutputSchema },
  createFolder: {
    kind: 'mutation',
    input: createFolderInputSchema,
    output: createFolderOutputSchema,
  },
  renamePath: {
    kind: 'mutation',
    input: renamePathInputSchema,
    output: renamePathOutputSchema,
  },
  duplicatePath: {
    kind: 'mutation',
    input: duplicatePathInputSchema,
    output: duplicatePathOutputSchema,
  },
  trashPath: { kind: 'mutation', input: trashPathInputSchema, output: trashPathOutputSchema },
  repoScope: { kind: 'query', input: repoScopeInputSchema, output: repoScopeOutputSchema },
} as const

export type FilesProcedureName = Extract<keyof typeof filesProcedureDefinitions, ProcedureName>

export const filesProcedures = filesProcedureDefinitions satisfies Record<
  FilesProcedureName,
  ProcedureContract
>
