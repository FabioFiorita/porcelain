import { procedureCatalog } from '@porcelain/contracts'
import { publicProcedure, t } from '../../trpc'
import type { SearchOperations } from './search-operations'

export function createSearchRouter(operations: SearchOperations) {
  return t.router({
    searchText: publicProcedure
      .input(procedureCatalog.searchText.input)
      .output(procedureCatalog.searchText.output)
      .query(({ input }) => operations.searchText(input)),

    searchCode: publicProcedure
      .input(procedureCatalog.searchCode.input)
      .output(procedureCatalog.searchCode.output)
      .query(({ input }) => operations.searchCode(input)),

    searchFiles: publicProcedure
      .input(procedureCatalog.searchFiles.input)
      .output(procedureCatalog.searchFiles.output)
      .query(({ input }) => operations.searchFiles(input)),
  })
}
