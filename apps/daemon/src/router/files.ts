import { procedureCatalog } from '@porcelain/contracts'
import { gitGrep, gitListSearchFiles, gitSearchCode } from '../git/git'
import { fuzzySearch, type SearchResult } from '../search/fuzzy'
import { searchCandidates } from '../search/search-candidates'
import { hiddenPathsForRepo } from '../stores/scope-store'
import { publicProcedure, t } from '../trpc'

/**
 * Residual Search-only router. The eight host-fs procedures live in
 * features/files/files-router.ts (FIL-002).
 */
export function createFilesRouter() {
  return t.router({
    searchText: publicProcedure
      .input(procedureCatalog.searchText.input)
      .output(procedureCatalog.searchText.output)
      .query(({ input }) => gitGrep(input.repoPath, input.query)),

    searchCode: publicProcedure
      .input(procedureCatalog.searchCode.input)
      .output(procedureCatalog.searchCode.output)
      .query(({ input }) =>
        gitSearchCode(input.repoPath, {
          query: input.query,
          regex: input.regex,
          caseSensitive: input.caseSensitive,
          include: input.include,
          exclude: input.exclude,
        }),
      ),

    searchFiles: publicProcedure
      .input(procedureCatalog.searchFiles.input)
      .output(procedureCatalog.searchFiles.output)
      .query(async ({ input }): Promise<SearchResult[]> => {
        if (input.query.trim() === '') return []
        const [files, hidden] = await Promise.all([
          gitListSearchFiles(input.repoPath),
          hiddenPathsForRepo(input.repoPath),
        ])
        const { paths, dirs } = searchCandidates(input.repoPath, files, hidden)
        return fuzzySearch(input.query, paths, 50).map((r) => ({
          path: r.path,
          kind: dirs.has(r.path) ? 'dir' : 'file',
        }))
      }),
  })
}
