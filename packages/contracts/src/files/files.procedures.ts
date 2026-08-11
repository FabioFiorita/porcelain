import type { ProcedureContract } from '../procedure-contract'
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
  readFile: {
    kind: 'query',
    input: readFileInputSchema,
    output: readFileOutputSchema,
    errors: ['files.path-outside-project'],
  },
  previewHtml: {
    kind: 'query',
    input: previewHtmlInputSchema,
    output: previewHtmlOutputSchema,
    errors: ['files.path-outside-project'],
  },
  writeTextFile: {
    kind: 'mutation',
    input: writeTextFileInputSchema,
    output: writeTextFileOutputSchema,
    errors: ['files.path-outside-project', 'files.not-found'],
  },
  createFile: {
    kind: 'mutation',
    input: createFileInputSchema,
    output: createFileOutputSchema,
    errors: ['files.path-outside-project', 'files.already-exists', 'files.not-found'],
  },
  createFolder: {
    kind: 'mutation',
    input: createFolderInputSchema,
    output: createFolderOutputSchema,
    errors: ['files.path-outside-project', 'files.already-exists', 'files.not-found'],
  },
  renamePath: {
    kind: 'mutation',
    input: renamePathInputSchema,
    output: renamePathOutputSchema,
    errors: ['files.path-outside-project', 'state.conflict', 'files.not-found'],
  },
  duplicatePath: {
    kind: 'mutation',
    input: duplicatePathInputSchema,
    output: duplicatePathOutputSchema,
    errors: ['files.path-outside-project', 'files.not-found'],
  },
  trashPath: {
    kind: 'mutation',
    input: trashPathInputSchema,
    output: trashPathOutputSchema,
    errors: ['files.path-outside-project', 'files.not-found'],
  },
  repoScope: {
    kind: 'query',
    input: repoScopeInputSchema,
    output: repoScopeOutputSchema,
    errors: [],
  },
} as const

export type FilesProcedureName = keyof typeof filesProcedureDefinitions

export const filesProcedures = filesProcedureDefinitions satisfies Record<
  FilesProcedureName,
  ProcedureContract
>
