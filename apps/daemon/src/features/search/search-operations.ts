import type {
  SearchCodeInput,
  SearchCodeOutput,
  SearchFilesInput,
  SearchFilesOutput,
  SearchTextInput,
  SearchTextOutput,
} from '@porcelain/contracts/search'
import { fuzzySearch } from './fuzzy'
import { searchCandidates } from './search-candidates'
import type { SearchGit, SearchScope } from './search-ports'

export type SearchOperations = Readonly<{
  searchFiles: (input: SearchFilesInput) => Promise<SearchFilesOutput>
  searchText: (input: SearchTextInput) => Promise<SearchTextOutput>
  searchCode: (input: SearchCodeInput) => Promise<SearchCodeOutput>
}>

export function createSearchOperations(options: {
  git: SearchGit
  scope: SearchScope
}): SearchOperations {
  return Object.freeze({
    async searchFiles(input: SearchFilesInput): Promise<SearchFilesOutput> {
      if (input.query.trim() === '') return []

      const [files, hidden] = await Promise.all([
        options.git.listFiles(input.repoPath),
        options.scope.hiddenPaths(input.repoPath),
      ])
      const { paths, dirs } = searchCandidates(input.repoPath, files, hidden)
      return fuzzySearch(input.query, paths, 50).map((result) => ({
        path: result.path,
        kind: dirs.has(result.path) ? 'dir' : 'file',
      }))
    },

    searchText(input: SearchTextInput): Promise<SearchTextOutput> {
      return options.git.searchText(input.repoPath, input.query)
    },

    searchCode(input: SearchCodeInput): Promise<SearchCodeOutput> {
      const { repoPath, ...searchOptions } = input
      return options.git.searchCode(repoPath, searchOptions)
    },
  })
}
