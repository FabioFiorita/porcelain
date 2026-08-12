import type {
  SearchCodeInput,
  SearchCodeOutput,
  SearchTextOutput,
} from '@porcelain/contracts/search'

export type SearchGit = Readonly<{
  listFiles: (repoPath: string) => Promise<string[]>
  searchText: (repoPath: string, query: string) => Promise<SearchTextOutput>
  searchCode: (
    repoPath: string,
    options: Omit<SearchCodeInput, 'repoPath'>,
  ) => Promise<SearchCodeOutput>
}>

export type SearchScope = Readonly<{
  hiddenPaths: (repoPath: string) => Promise<ReadonlySet<string>>
}>
