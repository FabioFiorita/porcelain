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
  readDir: { kind: 'query', input: readDirInputSchema, output: readDirOutputSchema, errors: [] },
  hidePath: {
    kind: 'mutation',
    input: hidePathInputSchema,
    output: hidePathOutputSchema,
    errors: [],
  },
  unhidePath: {
    kind: 'mutation',
    input: unhidePathInputSchema,
    output: unhidePathOutputSchema,
    errors: [],
  },
  pinPath: { kind: 'mutation', input: pinPathInputSchema, output: pinPathOutputSchema, errors: [] },
  unpinPath: {
    kind: 'mutation',
    input: unpinPathInputSchema,
    output: unpinPathOutputSchema,
    errors: [],
  },
  pinnedEntries: {
    kind: 'query',
    input: pinnedEntriesInputSchema,
    output: pinnedEntriesOutputSchema,
    errors: [],
  },
  readFile: { kind: 'query', input: readFileInputSchema, output: readFileOutputSchema, errors: [] },
  previewHtml: {
    kind: 'query',
    input: previewHtmlInputSchema,
    output: previewHtmlOutputSchema,
    errors: [],
  },
  writeTextFile: {
    kind: 'mutation',
    input: writeTextFileInputSchema,
    output: writeTextFileOutputSchema,
    errors: [],
  },
  createFile: {
    kind: 'mutation',
    input: createFileInputSchema,
    output: createFileOutputSchema,
    errors: [],
  },
  createFolder: {
    kind: 'mutation',
    input: createFolderInputSchema,
    output: createFolderOutputSchema,
    errors: [],
  },
  renamePath: {
    kind: 'mutation',
    input: renamePathInputSchema,
    output: renamePathOutputSchema,
    errors: ['state.conflict'],
  },
  duplicatePath: {
    kind: 'mutation',
    input: duplicatePathInputSchema,
    output: duplicatePathOutputSchema,
    errors: [],
  },
  trashPath: {
    kind: 'mutation',
    input: trashPathInputSchema,
    output: trashPathOutputSchema,
    errors: [],
  },
  repoScope: {
    kind: 'query',
    input: repoScopeInputSchema,
    output: repoScopeOutputSchema,
    errors: [],
  },
} as const

export type FilesProcedureName = Extract<keyof typeof filesProcedureDefinitions, ProcedureName>

export const filesProcedures = filesProcedureDefinitions satisfies Record<
  FilesProcedureName,
  ProcedureContract
>
