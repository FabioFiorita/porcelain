import type { ProcedureContract } from '../procedure-contract'
import {
  searchCodeInputSchema,
  searchCodeOutputSchema,
  searchFilesInputSchema,
  searchFilesOutputSchema,
  searchTextInputSchema,
  searchTextOutputSchema,
} from './search.contract'

const searchProcedureDefinitions = {
  searchText: {
    kind: 'query',
    input: searchTextInputSchema,
    output: searchTextOutputSchema,
    errors: [],
  },
  searchCode: {
    kind: 'query',
    input: searchCodeInputSchema,
    output: searchCodeOutputSchema,
    errors: [],
  },
  searchFiles: {
    kind: 'query',
    input: searchFilesInputSchema,
    output: searchFilesOutputSchema,
    errors: [],
  },
} as const

export type SearchProcedureName = keyof typeof searchProcedureDefinitions

export const searchProcedures = searchProcedureDefinitions satisfies Record<
  SearchProcedureName,
  ProcedureContract
>
